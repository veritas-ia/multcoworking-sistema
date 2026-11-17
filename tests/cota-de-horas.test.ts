/**
 * A COTA DE HORAS DA MENSALIDADE — Fase 16, Parte D (17/11/2026).
 *
 * O QUE MUDOU: o demonstrativo passou a descontar as horas que JÁ ESTÃO PAGAS
 * na mensalidade e a cobrar só o excedente. Antes ele cobrava todas as horas
 * do período, e a gestão descontava de cabeça — exatamente o tipo de conta
 * manual que gerou os R$ 70 cobrados a mais na planilha da Toca.
 *
 * ISTO REABRE, COM AUTORIZAÇÃO DO DONO, a decisão de 12/11 que dizia "o
 * demonstrativo NÃO trata horas incluídas no plano".
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 *  1. **O DOCUMENTO SEM COTA NÃO MUDOU NADA.** Todo demonstrativo já emitido
 *     tem cota nula, e qualquer desvio aqui mudaria uma cobrança que o cliente
 *     recebeu. É o teste mais importante do arquivo.
 *  2. **A COTA É CONGELADA NA EMISSÃO.** Reajustar o contrato depois não mexe
 *     num documento guardado.
 *  3. **AS HORAS DA COTA SÃO AS PRIMEIRAS**, em ordem cronológica — a única
 *     regra que se explica numa frase ao cliente.
 *  4. **UMA RESERVA PODE SER PARTIDA**, e a parte cobrada sai proporcional ao
 *     valor congelado dela.
 *  5. **A SOMA É EM CENTAVOS**, inclusive na divisão proporcional.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import { buscar, montarDoPeriodo, salvar } from "@/lib/demonstrativos";
import { criarContrato } from "@/lib/financeiro";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";

const ZZ = "ZZ Cota";
const USUARIO = "zz.cota";
const TELEFONE = "+5511900009400";

/** Um período fixo no passado: ali a recepção pode lançar para trás. */
const DE = "2026-09-10";
const ATE = "2026-10-10";

let salaId: string;
let operador: { id: string; nome: string };
let clienteId: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    where: { ativa: true },
    select: { id: true },
  });
  salaId = sala.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.demonstrativo.deleteMany({
    where: { cliente: { telefones: { some: { telefone: TELEFONE } } } },
  });
  await bancoDeTeste.lancamento.deleteMany({});
  await bancoDeTeste.contratoMensal.deleteMany({});
  await bancoDeTeste.espaco.deleteMany({ where: { nome: { startsWith: ZZ } } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.cliente.deleteMany({
    where: {
      reservas: { none: {} },
      telefones: { none: {} },
      consumosEmporio: { none: {} },
      demonstrativos: { none: {} },
      lancamentos: { none: {} },
      contratos: { none: {} },
    },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await limpar();

  const usuario = await bancoDeTeste.usuario.create({
    data: { usuario: USUARIO, nome: ZZ, senhaHash: "x" },
  });
  operador = { id: usuario.id, nome: usuario.nome };
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/**
 * Uma reserva pela recepção, que é o caminho real.
 *
 * Ela devolve o `clienteId` na primeira chamada: o cadastro nasce aqui, e é
 * ele que o demonstrativo agrupa.
 */
async function reserva(dia: string, hora: string, horas: number): Promise<void> {
  const criada = await criarReservaNaRecepcao({
    salaId,
    telefone: TELEFONE,
    nomeCliente: `${ZZ} Cliente`,
    profissaoId: await idDaProfissao("OUTROS"),
    inicio: instanteDe(dia, hora),
    fim: new Date(instanteDe(dia, hora).getTime() + horas * 60 * 60_000),
    operador,
  });

  if (!criada.ok) {
    throw new Error(`não criou a reserva: ${criada.falha.motivo}`);
  }

  const linha = await bancoDeTeste.reserva.findUniqueOrThrow({
    where: { id: criada.dados.id },
    select: { clienteId: true },
  });

  clienteId = linha.clienteId;
}

/** Um contrato com cota, para o demonstrativo achar sozinho. */
async function contratoComCota(cotaHoras: number): Promise<void> {
  const feito = await criarContrato({
    clienteId,
    valorMensal: "2400,00",
    diaVencimento: 10,
    cotaHoras,
    inicio: "2026-01-01",
  });

  if (!feito.ok) throw new Error(feito.falha.motivo);
}

// -----------------------------------------------------------------------------

describe("sem cota, nada mudou", () => {
  /**
   * O TESTE MAIS IMPORTANTE DO ARQUIVO.
   *
   * Todo demonstrativo já emitido tem cota NULA. Se o caminho sem cota
   * mudasse, uma cobrança que o cliente recebeu passaria a dizer outro valor —
   * e ninguém descobriria olhando a tela.
   */
  it("com preço combinado, cobra todas as horas", async () => {
    await reserva("2026-09-15", "09:00", 2);
    await reserva("2026-09-16", "09:00", 3);

    const feito = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.cotaHoras).toBeNull();
    expect(feito.dados.horas).toBe(5);
    expect(feito.dados.horasNaCota).toBe(0);
    expect(feito.dados.horasCobradas).toBe(5);
    expect(feito.dados.valorDasHorasCentavos).toBe(15_000);
  });

  it("sem preço combinado, soma o valor congelado de cada reserva", async () => {
    await reserva("2026-09-15", "09:00", 2);
    await reserva("2026-09-16", "09:00", 3);

    const feito = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

    if (!feito.ok) throw new Error("deveria montar");

    const somaDosItens = feito.dados.itens.reduce(
      (soma, item) => soma + item.valorCentavos,
      0,
    );

    expect(feito.dados.horasCobradas).toBe(5);
    expect(feito.dados.valorDasHorasCentavos).toBe(somaDosItens);
  });

  /**
   * COTA ZERO É TRATADA COMO "SEM COTA" no desconto.
   *
   * O banco e o contrato recusam gravar zero, mas a gestão pode mandar zero
   * pela tela ao apagar o campo — e ali zero tem de significar "cobre tudo",
   * não "tem plano de zero hora".
   */
  it("cota zero cobra tudo, como se não houvesse cota", async () => {
    await reserva("2026-09-15", "09:00", 2);

    const feito = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      cotaHoras: 0,
    });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.cotaHoras).toBeNull();
    expect(feito.dados.horasCobradas).toBe(2);
    expect(feito.dados.valorDasHorasCentavos).toBe(6_000);
  });
});

describe("com cota, cobra só o excedente", () => {
  it("a cota vem do CONTRATO, sem ninguém digitar", async () => {
    await reserva("2026-09-15", "09:00", 2);
    await contratoComCota(10);

    const feito = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.cotaHoras).toBe(10);
  });

  it("15 horas de cota e 20 usadas: cobra 5", async () => {
    // Quatro reservas de 5 h, em ordem.
    for (const dia of ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]) {
      await reserva(dia, "09:00", 5);
    }

    await contratoComCota(15);

    const feito = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.horas).toBe(20);
    expect(feito.dados.horasNaCota).toBe(15);
    expect(feito.dados.horasCobradas).toBe(5);
    // 5 h × R$ 30 = R$ 150,00 — e não as 20 h × R$ 30 = R$ 600,00 de antes.
    expect(feito.dados.valorDasHorasCentavos).toBe(15_000);
  });

  /**
   * A COTA MAIOR QUE O USO NÃO GERA CRÉDITO.
   *
   * Quem tem 15 h inclusas e usou 4 paga ZERO de horas extras — e não
   * "menos 11 horas". Um valor negativo aqui viraria desconto no empório e nas
   * linhas extras, e o total do documento sairia menor que a mensalidade.
   */
  it("usou menos que a cota: cobra zero, e nunca negativo", async () => {
    await reserva("2026-09-15", "09:00", 4);
    await contratoComCota(15);

    const feito = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.horasNaCota).toBe(4);
    expect(feito.dados.horasCobradas).toBe(0);
    expect(feito.dados.valorDasHorasCentavos).toBe(0);
  });

  /**
   * AS HORAS DA COTA SÃO AS PRIMEIRAS, em ordem cronológica.
   *
   * É a única regra que se explica numa frase ao cliente: "suas 3 horas
   * inclusas foram as do dia 15; a partir dali é extra". Pelas mais caras ou
   * pelas mais baratas, a escolha seria arbitrária e o cliente teria razão em
   * achar que o sistema decidiu contra ele.
   */
  it("a cota come as reservas mais ANTIGAS primeiro", async () => {
    await reserva("2026-09-15", "09:00", 3);
    await reserva("2026-09-20", "09:00", 3);
    await contratoComCota(3);

    const feito = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.horasNaCota).toBe(3);
    expect(feito.dados.horasCobradas).toBe(3);

    // A cobrada é a SEGUNDA reserva: o valor tem de ser o dela, não o da
    // primeira. (Com preço igual nas duas o número coincide, então o teste
    // confere a identidade do item para não passar por acidente.)
    const segunda = feito.dados.itens[1]!;
    expect(feito.dados.valorDasHorasCentavos).toBe(segunda.valorCentavos);
    expect(feito.dados.itens[0]?.dia).toBe("2026-09-15");
  });

  /**
   * UMA RESERVA PODE SER PARTIDA.
   *
   * Restam 1 h de cota e a reserva tem 2 h: uma entra, a outra é cobrada. Sem
   * partir, ou a hora extra sairia de graça ou a cota seria perdida — as duas
   * injustas, e nenhuma explicável.
   */
  it("parte a reserva quando a cota acaba no meio dela", async () => {
    await reserva("2026-09-15", "09:00", 2);
    await reserva("2026-09-16", "09:00", 2);
    // Cota de 3 h: a primeira inteira (2 h) e metade da segunda (1 h).
    await contratoComCota(3);

    const feito = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.horasNaCota).toBe(3);
    expect(feito.dados.horasCobradas).toBe(1);
    expect(feito.dados.valorDasHorasCentavos).toBe(3_000);
  });

  /**
   * SEM PREÇO COMBINADO, a parte cobrada sai PROPORCIONAL ao valor congelado.
   *
   * A reserva de 2 h custou X; cobrando 1 h dela, cobra-se X/2. Qualquer outra
   * conta (o preço de hoje, a média do período) criaria um número que não bate
   * com a reserva gravada.
   */
  it("parte o valor congelado proporcionalmente, sem preço combinado", async () => {
    await reserva("2026-09-15", "09:00", 2);
    await reserva("2026-09-16", "09:00", 2);
    await contratoComCota(3);

    const feito = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

    if (!feito.ok) throw new Error("deveria montar");

    const segunda = feito.dados.itens[1]!;
    const metade = Math.round(segunda.valorCentavos / 2);

    expect(feito.dados.horasCobradas).toBe(1);
    expect(feito.dados.valorDasHorasCentavos).toBe(metade);
  });

  /**
   * A RESERVA COBRADA INTEIRA VALE EXATAMENTE O VALOR GRAVADO.
   *
   * A conta proporcional daria o mesmo número quase sempre — e "quase" num
   * valor congelado é o começo de um centavo de diferença que ninguém
   * explica. Por isso o caso inteiro é tratado à parte no motor.
   */
  it("reserva cobrada inteira não passa pela divisão", async () => {
    await reserva("2026-09-15", "09:00", 1);
    await reserva("2026-09-16", "09:00", 3);
    // A cota come exatamente a primeira; a segunda é cobrada inteira.
    await contratoComCota(1);

    const feito = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

    if (!feito.ok) throw new Error("deveria montar");

    const segunda = feito.dados.itens[1]!;

    expect(feito.dados.horasCobradas).toBe(3);
    expect(feito.dados.valorDasHorasCentavos).toBe(segunda.valorCentavos);
  });

  it("a cota não mexe no empório nem nas linhas extras", async () => {
    await reserva("2026-09-15", "09:00", 2);
    await contratoComCota(15);

    const feito = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [{ descricao: "2 posições", valor: "940.00" }],
    });

    if (!feito.ok) throw new Error("deveria montar");

    // As horas foram todas para a cota...
    expect(feito.dados.valorDasHorasCentavos).toBe(0);
    // ...e a linha extra continua inteira. A cota é das HORAS, não da conta.
    expect(feito.dados.valorDasLinhasCentavos).toBe(94_000);
    expect(feito.dados.totalCentavos).toBe(94_000);
  });
});

describe("a cota é congelada na emissão", () => {
  /**
   * REAJUSTAR O CONTRATO NÃO MEXE NO DOCUMENTO GUARDADO.
   *
   * Mesma regra do valor da reserva, do preço do empório e do valor da
   * mensalidade. Se retroagisse, um mês já fechado mudaria sozinho quando a
   * equipe mexesse no plano do cliente.
   */
  it("mudar a cota do contrato não muda o documento salvo", async () => {
    await reserva("2026-09-15", "09:00", 5);
    await contratoComCota(3);

    const emitido = await salvar({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!emitido.ok) throw new Error(emitido.falha.motivo);

    expect(emitido.dados.cotaHoras).toBe(3);
    expect(emitido.dados.horasCobradas).toBe(2);
    expect(emitido.dados.valorDasHorasCentavos).toBe(6_000);

    const antes = await bancoDeTeste.demonstrativo.findUniqueOrThrow({
      where: { id: emitido.dados.id! },
    });

    // A equipe aumenta a cota do plano para 10 h.
    const contrato = await bancoDeTeste.contratoMensal.findFirstOrThrow({
      where: { clienteId },
      select: { id: true },
    });
    await bancoDeTeste.contratoMensal.update({
      where: { id: contrato.id },
      data: { cotaHoras: 10 },
    });

    const depois = await bancoDeTeste.demonstrativo.findUniqueOrThrow({
      where: { id: emitido.dados.id! },
    });

    // A LINHA INTEIRA fica intacta.
    expect(depois).toEqual(antes);

    // E ao reabrir, o documento continua contando a mesma história.
    const relido = await buscar(emitido.dados.id!);

    expect(relido?.cotaHoras).toBe(3);
    expect(relido?.horasCobradas).toBe(2);
    expect(relido?.valorDasHorasCentavos).toBe(6_000);
  });

  /**
   * O DOCUMENTO ANTIGO, sem cota gravada, continua idêntico ao reabrir.
   *
   * É o caso de todos os demonstrativos que já existem em produção.
   */
  it("documento emitido sem cota continua cobrando tudo ao reabrir", async () => {
    await reserva("2026-09-15", "09:00", 5);

    const emitido = await salvar({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!emitido.ok) throw new Error(emitido.falha.motivo);

    // Agora a equipe cadastra um contrato com cota — DEPOIS da emissão.
    await contratoComCota(10);

    const relido = await buscar(emitido.dados.id!);

    expect(relido?.cotaHoras).toBeNull();
    expect(relido?.horasCobradas).toBe(5);
    expect(relido?.valorDasHorasCentavos).toBe(15_000);
  });

  /**
   * A GESTÃO PODE APAGAR A COTA de um documento específico.
   *
   * É o caso do período de três meses: a cota é mensal e aplicada uma vez, e
   * ali pode ser melhor cobrar tudo e acertar à parte. Mandar nulo de
   * propósito tem de valer mais que a cota do contrato — senão o campo se
   * preencheria de novo sozinho a cada vez que ela o apagasse.
   */
  it("mandar cota nula vale mais que a do contrato", async () => {
    await reserva("2026-09-15", "09:00", 5);
    await contratoComCota(3);

    const feito = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      cotaHoras: null,
    });

    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.cotaHoras).toBeNull();
    expect(feito.dados.horasCobradas).toBe(5);
    expect(feito.dados.valorDasHorasCentavos).toBe(15_000);
  });
});

describe("a soma continua em centavos", () => {
  /**
   * Três reservas de R$ 33,33 precisam dar R$ 99,99, com cota zerada — em
   * ponto flutuante dariam R$ 99,990000000000009.
   *
   * A divisão proporcional da cota é o lugar mais fácil de perder um centavo,
   * e é por isso que ela arredonda uma vez por item, em centavos inteiros.
   */
  it("a divisão da cota não perde centavo", async () => {
    await reserva("2026-09-15", "09:00", 2);
    await reserva("2026-09-16", "09:00", 2);
    await reserva("2026-09-17", "09:00", 2);

    const semCota = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });
    if (!semCota.ok) throw new Error("deveria montar");

    const total = semCota.dados.valorDasHorasCentavos;

    // Com cota de 2 h, a primeira reserva inteira sai; sobram as duas últimas,
    // cobradas inteiras. O valor tem de ser o total menos a primeira — exato,
    // sem arredondamento no meio.
    await contratoComCota(2);

    const comCota = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });
    if (!comCota.ok) throw new Error("deveria montar");

    const primeira = semCota.dados.itens[0]!.valorCentavos;

    expect(comCota.dados.valorDasHorasCentavos).toBe(total - primeira);
    // E o número é inteiro: centavo não tem fração.
    expect(Number.isInteger(comCota.dados.valorDasHorasCentavos)).toBe(true);
  });
});
