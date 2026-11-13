/**
 * DEMONSTRATIVO MENSAL DO CLIENTE (11/11/2026).
 *
 * O CASO REAL que motivou isto: a planilha "DEMONSTRATIVO 12 agos a 10 set"
 * da Toca Imobiliária, feita à mão pela gestão. Ela **não tinha uma fórmula
 * sequer** — o "52 horas" e o "VALOR TOTAL : R$ 3.033,66" eram texto
 * digitado. E os dois estavam errados:
 *
 *   - somando as 14 linhas de horas da própria planilha: **50 h**, não 52;
 *   - somando as 5 linhas de valor da própria planilha: **R$ 3.023,66**,
 *     não R$ 3.033,66.
 *
 * Foram R$ 70 cobrados a mais de um cliente, num documento já enviado.
 *
 * O que estes testes protegem:
 *  1. NENHUM total é digitado — o sistema soma, e a soma bate;
 *  2. cancelada não entra: hora desmarcada não é hora cobrada;
 *  3. o preço combinado do cliente manda, e não o da tabela da sala — a Toca
 *     paga R$ 30 numa sala que custa R$ 40;
 *  4. as horas aparecem separadas por sala E somadas, como o dono pediu;
 *  5. o total ajustado à mão existe, mas só quando escrito de propósito;
 *  6. salvar CONGELA a tabela: remarcar uma reserva depois não muda o
 *     documento que o cliente recebeu;
 *  7. as contas são em centavos — somar reais acumula diferença.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import {
  buscar,
  comoDinheiro,
  emCentavos,
  listar,
  marcarEnviado,
  montarDoPeriodo,
  salvar,
} from "@/lib/demonstrativos";
import {
  cortarParaCaber,
  gerarPdfDoDemonstrativo,
  quebrarTexto,
} from "@/lib/pdf-demonstrativo";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";

const DA_TOCA = "+5511900003001";
const DO_VINICIUS = "+5511900003002";
const DO_MATHEUS = "+5511900003003";
const DE_FORA = "+5511900003004";
const TELEFONES = [DA_TOCA, DO_VINICIUS, DO_MATHEUS, DE_FORA];

/** Prefixo próprio, para a limpeza não encostar em empresa de fora. */
const PREFIXO_EMPRESA = "ZZ";

/** Um período fixo no passado: aqui a recepção pode lançar para trás. */
const DE = "2026-09-10";
const ATE = "2026-10-10";

let salaPrivativa: string;
let nomeDaPrivativa: string;
let salaReuniao: string;
let operador: { id: string; nome: string };

beforeAll(async () => {
  await aquecerConexao();

  // O slug nunca muda (está nos QR codes impressos); em produção esta sala
  // hoje se chama "Sala Privativa", e no banco de teste ainda "Sala CI".
  const privativa = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-ci" },
    select: { id: true, nome: true },
  });
  salaPrivativa = privativa.id;
  nomeDaPrivativa = privativa.nome;

  const reuniao = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-de-reuniao" },
    select: { id: true },
  });
  salaReuniao = reuniao.id;

  operador = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.demonstrativo" },
    create: { nome: "Admin de Teste", usuario: "zz.demonstrativo", senhaHash: "x" },
    update: {},
    select: { id: true, nome: true },
  });
});

async function limpar(): Promise<void> {
  await bancoDeTeste.demonstrativo.deleteMany({
    where: { empresa: { nome: { startsWith: PREFIXO_EMPRESA } } },
  });
  await bancoDeTeste.demonstrativo.deleteMany({
    where: { cliente: { telefones: { some: { telefone: { in: TELEFONES } } } } },
  });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: { in: TELEFONES } } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
  await bancoDeTeste.cliente.deleteMany({
    where: { reservas: { none: {} }, telefones: { none: {} } },
  });
  await bancoDeTeste.empresa.deleteMany({
    where: { nome: { startsWith: PREFIXO_EMPRESA } },
  });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.demonstrativo" } });
  await bancoDeTeste.$disconnect();
});

async function reserva(
  dia: string,
  hora: string,
  horas: number,
  sala = salaPrivativa,
  telefone = DA_TOCA,
  nome = "Toca Imobiliária",
) {
  const criada = await criarReservaNaRecepcao({
    salaId: sala,
    telefone,
    nomeCliente: nome,
    profissaoId: await idDaProfissao("OUTROS"),
    inicio: instanteDe(dia, hora),
    fim: new Date(instanteDe(dia, hora).getTime() + horas * 60 * 60_000),
    operador,
  });

  if (!criada.ok) {
    throw new Error(`Não criou a reserva de teste: ${criada.falha.motivo}`);
  }

  return criada.dados.id;
}

async function cadastroDaToca(): Promise<string> {
  const ligado = await bancoDeTeste.telefoneDoCliente.findUniqueOrThrow({
    where: { telefone: DA_TOCA },
    select: { clienteId: true },
  });
  return ligado.clienteId;
}

// -----------------------------------------------------------------------------

describe("o sistema soma, e a planilha não somava", () => {
  it("as horas saem da soma das linhas, nunca digitadas", async () => {
    // As mesmas horas que a planilha de setembro da Toca tinha, em três
    // dias: 2,5 + 6,5 + 3,5. A planilha escrevia o total à mão e errava.
    await reserva("2026-09-11", "09:00", 2.5);
    await reserva("2026-09-15", "09:00", 6.5);
    await reserva("2026-09-16", "09:00", 3.5);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    expect(feito.ok).toBe(true);
    if (!feito.ok) return;

    expect(feito.dados.horas).toBe(12.5);
    expect(feito.dados.itens).toHaveLength(3);
    // 12,5 h x R$ 30,00 = R$ 375,00
    expect(feito.dados.valorDasHorasCentavos).toBe(37_500);
  });

  it("o TOTAL é a soma das horas com as linhas digitadas", async () => {
    // As linhas extras da planilha de setembro, na ordem em que estavam.
    await reserva("2026-09-11", "09:00", 2);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [
        { descricao: "1 posição: 10 dias", valor: "313.34" },
        { descricao: "1 posição: 2 dias", valor: "31.32" },
        { descricao: "2 posições", valor: "940.00" },
        { descricao: "Empório: 13 águas, 15 c/ gás, 8 barrinhas", valor: "179.00" },
      ],
    });

    if (!feito.ok) throw new Error("deveria montar");

    // 2 h x 30 = 60,00  +  313,34 + 31,32 + 940,00 + 179,00 = 1.523,66
    expect(feito.dados.valorDasHorasCentavos).toBe(6_000);
    expect(feito.dados.valorDasLinhasCentavos).toBe(146_366);
    expect(feito.dados.totalCalculadoCentavos).toBe(152_366);
    expect(comoDinheiro(feito.dados.totalCentavos)).toBe("R$ 1.523,66");
  });

  it("soma em CENTAVOS: três linhas de R$ 33,33 dão R$ 99,99", async () => {
    // Somar reais em ponto flutuante acumula diferença de um centavo ao longo
    // de muitas linhas. Mesma regra do faturamento do relatório.
    await reserva("2026-09-11", "09:00", 1);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "0.00",
      linhasExtras: [
        { descricao: "a", valor: "33.33" },
        { descricao: "b", valor: "33.33" },
        { descricao: "c", valor: "33.33" },
      ],
    });

    if (!feito.ok) throw new Error("deveria montar");
    expect(comoDinheiro(feito.dados.totalCentavos)).toBe("R$ 99,99");
  });

  it("meia hora x preço quebrado não perde centavo", async () => {
    await reserva("2026-09-11", "09:00", 2.5);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "33.33",
    });

    if (!feito.ok) throw new Error("deveria montar");
    // 2,5 x 33,33 = 83,325 -> arredonda uma vez só, no fim
    expect(feito.dados.valorDasHorasCentavos).toBe(8_333);
  });
});

describe("o que entra e o que não entra", () => {
  it("CANCELADA não entra: hora desmarcada não é hora cobrada", async () => {
    await reserva("2026-09-11", "09:00", 2);
    const desmarcada = await reserva("2026-09-15", "09:00", 5);

    await bancoDeTeste.reserva.update({
      where: { id: desmarcada },
      data: { status: "CANCELADA", canceladoEm: new Date() },
    });

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.horas).toBe(2);
  });

  it("reserva fora do período não entra", async () => {
    await reserva("2026-09-11", "09:00", 2);
    await reserva("2026-10-20", "09:00", 8);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.horas).toBe(2);
  });

  it("o último dia do período entra inteiro", async () => {
    // "10/09 a 10/10" inclui o dia 10/10 todo. Cortar no começo do dia
    // deixaria de fora a reserva da tarde e ninguém entenderia por quê.
    await reserva("2026-10-10", "15:00", 3);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.horas).toBe(3);
  });

  it("recusa período invertido", async () => {
    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca().catch(() => "x"),
      de: "2026-10-10",
      ate: "2026-09-10",
      valorHora: "30.00",
    });

    expect(feito.ok).toBe(false);
    expect(feito.ok === false && feito.falha.codigo).toBe("PERIODO_INVERTIDO");
  });
});

describe("as horas separadas por sala", () => {
  it("mostra cada sala e também o total somado", async () => {
    // Pedido do dono: "pode somar todas as salas, mas também mostra separado,
    // porque o cliente também tem essa visualização".
    await reserva("2026-09-11", "09:00", 2, salaPrivativa);
    await reserva("2026-09-15", "09:00", 3, salaPrivativa);
    await reserva("2026-09-16", "09:00", 1.5, salaReuniao);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!feito.ok) throw new Error("deveria montar");

    const porSala = new Map(feito.dados.porSala.map((s) => [s.sala, s.horas]));
    expect(porSala.get(nomeDaPrivativa)).toBe(5);
    expect(porSala.get("Sala de Reunião")).toBe(1.5);
    expect(feito.dados.horas).toBe(6.5);
  });
});

describe("o preço combinado do cliente", () => {
  it("vale o do cliente, e não o da tabela da sala", async () => {
    // A Toca paga R$ 30 numa sala que custa R$ 40. O valor congelado na
    // reserva é o da tabela e NÃO serve para o demonstrativo.
    await reserva("2026-09-11", "09:00", 2);
    const clienteId = await cadastroDaToca();

    await bancoDeTeste.cliente.update({
      where: { id: clienteId },
      data: { precoHoraAcordado: "30.00" },
    });

    const feito = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.valorHora).toBe("30.00");
    expect(feito.dados.valorDasHorasCentavos).toBe(6_000);
  });

  it("salvar com 'lembrar' guarda o preço para a próxima vez", async () => {
    await reserva("2026-09-11", "09:00", 2);
    const clienteId = await cadastroDaToca();

    await salvar({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: true,
    });

    const cliente = await bancoDeTeste.cliente.findUniqueOrThrow({
      where: { id: clienteId },
    });
    expect(cliente.precoHoraAcordado?.toFixed(2)).toBe("30.00");
  });
});

describe("o preço por hora é OPCIONAL", () => {
  /** O valor que cada reserva já tem gravado, somado em centavos. */
  async function valorGravadoNasReservas(): Promise<number> {
    const reservas = await bancoDeTeste.reserva.findMany({
      where: { telefone: DA_TOCA },
      select: { valor: true },
    });
    return reservas.reduce(
      (soma, r) => soma + Math.round(Number(r.valor) * 100),
      0,
    );
  }

  it("sem preço combinado, soma o valor JÁ GRAVADO em cada reserva", async () => {
    // O caminho normal: o cliente paga a tabela da sala. A gestão não
    // precisa digitar preço nenhum, e o total já sai certo — é o mesmo
    // valor que foi congelado em cada reserva na hora de criar.
    await reserva("2026-09-11", "09:00", 2);
    await reserva("2026-09-14", "14:00", 1.5);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
    });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.valorHora).toBeNull();
    expect(feito.dados.horas).toBe(3.5);
    expect(feito.dados.valorDasHorasCentavos).toBe(await valorGravadoNasReservas());
    expect(feito.dados.valorDasHorasCentavos).toBeGreaterThan(0);
  });

  it("o preço combinado, quando existe, manda — e dá outro número", async () => {
    // As MESMAS reservas pelos dois caminhos. Se os dois dessem o mesmo
    // valor, o teste de cima não estaria provando nada.
    await reserva("2026-09-11", "09:00", 2);
    const clienteId = await cadastroDaToca();

    const semPreco = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });
    const comPreco = await montarDoPeriodo({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });

    if (!semPreco.ok || !comPreco.ok) throw new Error("deveria montar");
    expect(semPreco.dados.valorDasHorasCentavos).toBe(
      await valorGravadoNasReservas(),
    );
    expect(comPreco.dados.valorDasHorasCentavos).toBe(6_000);
    expect(semPreco.dados.valorDasHorasCentavos).not.toBe(
      comPreco.dados.valorDasHorasCentavos,
    );
  });

  it("soma com as linhas extras, sem precisar digitar preço nenhum", async () => {
    await reserva("2026-09-11", "09:00", 2);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      linhasExtras: [{ descricao: "2 posições", valor: "940.00" }],
    });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.totalCentavos).toBe(
      (await valorGravadoNasReservas()) + 94_000,
    );
  });

  it("salvar SEM preço funciona, e o documento guarda o mesmo total", async () => {
    await reserva("2026-09-11", "09:00", 2);
    const esperado = await valorGravadoNasReservas();

    const salvo = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: true,
    });

    if (!salvo.ok) throw new Error("deveria salvar");
    expect(salvo.dados.valorHora).toBeNull();
    expect(salvo.dados.totalCentavos).toBe(esperado);

    // Relido do banco, o documento conta a mesma coisa: o valor de cada
    // reserva viaja dentro dos itens congelados.
    const lido = await buscar(salvo.dados.id!);
    expect(lido?.valorHora).toBeNull();
    expect(lido?.totalCentavos).toBe(esperado);

    // E na lista dos emitidos também — ela refaz a conta por fora.
    const lista = await listar({ clienteId: salvo.dados.clienteId });
    expect(lista.find((item) => item.id === salvo.dados.id)?.totalCentavos).toBe(
      esperado,
    );
  });

  it("salvar sem preço NÃO apaga o preço combinado já cadastrado", async () => {
    // Gravar nulo aqui tiraria em silêncio o preço negociado que a equipe
    // cadastrou antes, e o mês seguinte sairia pela tabela da sala.
    await reserva("2026-09-11", "09:00", 2);
    const clienteId = await cadastroDaToca();

    await bancoDeTeste.cliente.update({
      where: { id: clienteId },
      data: { precoHoraAcordado: "30.00" },
    });

    await salvar({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: null,
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: true,
    });

    const cliente = await bancoDeTeste.cliente.findUniqueOrThrow({
      where: { id: clienteId },
    });
    expect(cliente.precoHoraAcordado?.toFixed(2)).toBe("30.00");
  });

  it("mudar o preço da sala depois NÃO mexe no documento", async () => {
    // O valor é o congelado na reserva, nunca um recálculo. Sem isso, o
    // documento de um mês já fechado mudaria sozinho quando a equipe
    // reajustasse o preço da sala no painel.
    await reserva("2026-09-11", "09:00", 2);
    const clienteId = await cadastroDaToca();
    const antes = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

    const sala = await bancoDeTeste.sala.findUniqueOrThrow({
      where: { id: salaPrivativa },
      select: { precoPorHora: true },
    });

    try {
      await bancoDeTeste.sala.update({
        where: { id: salaPrivativa },
        data: { precoPorHora: Number(sala.precoPorHora) * 2 },
      });

      const depois = await montarDoPeriodo({ clienteId, de: DE, ate: ATE });

      if (!antes.ok || !depois.ok) throw new Error("deveria montar");
      expect(depois.dados.valorDasHorasCentavos).toBe(
        antes.dados.valorDasHorasCentavos,
      );
    } finally {
      await bancoDeTeste.sala.update({
        where: { id: salaPrivativa },
        data: { precoPorHora: sala.precoPorHora },
      });
    }
  });
});

describe("o total ajustado à mão", () => {
  it("só vale quando escrito de propósito", async () => {
    await reserva("2026-09-11", "09:00", 2);

    const normal = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
    });
    if (!normal.ok) throw new Error("deveria montar");
    expect(normal.dados.totalCentavos).toBe(6_000);

    const renegociado = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      totalAjustado: "50.00",
    });
    if (!renegociado.ok) throw new Error("deveria montar");

    expect(renegociado.dados.totalCentavos).toBe(5_000);
    // E o calculado continua visível: a tela mostra os dois, para ninguém
    // ajustar sem perceber de quanto era.
    expect(renegociado.dados.totalCalculadoCentavos).toBe(6_000);
  });
});

describe("salvar CONGELA o documento", () => {
  it("remarcar uma reserva depois não muda o que o cliente recebeu", async () => {
    // Mesma regra do valor congelado na reserva: o documento enviado tem de
    // continuar batendo com o que foi enviado.
    const reservaId = await reserva("2026-09-11", "09:00", 2);

    const salvo = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [{ descricao: "2 posições", valor: "940.00" }],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!salvo.ok) throw new Error("deveria salvar");
    const antes = salvo.dados.totalCentavos;

    // A reserva muda de 2 h para 5 h DEPOIS da emissão.
    await bancoDeTeste.reserva.update({
      where: { id: reservaId },
      data: {
        fim: instanteDe("2026-09-11", "14:00"),
        duracaoMinutos: 300,
      },
    });

    const relido = await buscar(salvo.dados.id!);

    expect(relido?.horas).toBe(2);
    expect(relido?.totalCentavos).toBe(antes);
    expect(relido?.itens).toHaveLength(1);
  });

  it("guarda as linhas digitadas, para não redigitar no mês seguinte", async () => {
    await reserva("2026-09-11", "09:00", 2);

    const salvo = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [
        { descricao: "1 posição: 10 dias", valor: "313.34" },
        { descricao: "Empório", valor: "179.00" },
      ],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!salvo.ok) throw new Error("deveria salvar");

    const relido = await buscar(salvo.dados.id!);
    expect(relido?.linhasExtras).toHaveLength(2);
    expect(relido?.linhasExtras[0]?.descricao).toBe("1 posição: 10 dias");
    expect(emCentavos(relido!.linhasExtras[1]!.valor)).toBe(17_900);
  });
});

describe("documento enviado não se reescreve", () => {
  /**
   * NAO existe rota que apague um demonstrativo, de proposito. Mas regravar
   * em cima de um que o cliente ja recebeu faz o mesmo estrago com outro
   * nome: o que esta guardado deixa de bater com o que ele tem na mao, e
   * ninguem percebe. A nota de cobranca perde a serventia de ser prova.
   */
  it("recusa salvar de novo depois de enviado", async () => {
    await reserva("2026-09-11", "09:00", 2);

    const primeiro = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!primeiro.ok) throw new Error("deveria salvar");
    await marcarEnviado(primeiro.dados.id!);

    const segundo = await salvar({
      id: primeiro.dados.id,
      clienteId: primeiro.dados.clienteId,
      de: DE,
      ate: ATE,
      valorHora: "999.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    expect(segundo.ok).toBe(false);
    if (segundo.ok) throw new Error("não deveria ter salvo");
    expect(segundo.falha.codigo).toBe("JA_ENVIADO");

    // E a linha ficou INTACTA: a recusa não é só uma mensagem na tela.
    const lido = await buscar(primeiro.dados.id!);
    expect(lido?.valorHora).toBe("30.00");
    expect(lido?.totalCentavos).toBe(primeiro.dados.totalCentavos);
  });

  it("antes de enviar, salvar de novo continua valendo", async () => {
    // A equipe mexe no período e nas linhas à vontade até mandar. É só
    // depois do envio que o documento vira registro.
    await reserva("2026-09-11", "09:00", 2);

    const primeiro = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!primeiro.ok) throw new Error("deveria salvar");

    const segundo = await salvar({
      id: primeiro.dados.id,
      clienteId: primeiro.dados.clienteId,
      de: DE,
      ate: ATE,
      valorHora: "50.00",
      linhasExtras: [{ descricao: "2 posições", valor: "940.00" }],
      totalAjustado: null,
      lembrarPreco: false,
    });

    expect(segundo.ok).toBe(true);
    if (!segundo.ok) throw new Error("deveria salvar");
    // Mesmo documento, não um segundo.
    expect(segundo.dados.id).toBe(primeiro.dados.id);
    expect(segundo.dados.valorHora).toBe("50.00");
  });

  it("corrigir depois do envio é emitir um documento NOVO", async () => {
    await reserva("2026-09-11", "09:00", 2);
    const clienteId = await cadastroDaToca();

    const enviado = await salvar({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!enviado.ok) throw new Error("deveria salvar");
    await marcarEnviado(enviado.dados.id!);

    // Sem "id": nasce outro, e o enviado continua lá.
    const novo = await salvar({
      clienteId,
      de: DE,
      ate: ATE,
      valorHora: "25.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!novo.ok) throw new Error("deveria salvar o novo");
    expect(novo.dados.id).not.toBe(enviado.dados.id);

    const lista = await listar({ clienteId });
    expect(lista.filter((item) => item.id === enviado.dados.id)).toHaveLength(1);
    expect(lista.filter((item) => item.id === novo.dados.id)).toHaveLength(1);
  });
});

describe("a formatação do texto no PDF", () => {
  /**
   * O DEFEITO REAL, visto pelo dono num documento ja emitido: a descricao da
   * linha do emporio era escrita sem limite de largura e o valor ficava
   * colado a direita POR CIMA dela —
   * "...chocolate Stick/R$ 201,50Chocobiscuit".
   *
   * Uma cobranca que o cliente nao consegue ler nao serve para nada, e o erro
   * nao aparece em teste nenhum que olhe so os numeros: as contas estavam
   * certas. Por isso o teste e da QUEBRA do texto.
   *
   * A medicao entra como funcao, entao da para testar sem montar um PDF. Aqui
   * cada letra mede 6 pontos, o que torna as contas conferiveis a mao.
   */
  const medir = (texto: string): number => texto.length * 6;

  it("quebra o texto em linhas que cabem na largura", () => {
    const linhas = quebrarTexto("um dois tres quatro cinco", 60, medir);

    for (const linha of linhas) {
      expect(medir(linha)).toBeLessThanOrEqual(60);
    }
    // Nenhuma palavra se perdeu pelo caminho.
    expect(linhas.join(" ")).toBe("um dois tres quatro cinco");
  });

  it("a descrição REAL do empório cabe, e nada se perde", () => {
    const real =
      "EMPÓRIO 12 águas sem gás/10 águas com gás/7 barrinhas de proteína/" +
      "3 YOPRO/1 chocolate Stick/1 Chocobiscuit";

    const linhas = quebrarTexto(real, 300, medir);

    expect(linhas.length).toBeGreaterThan(1);
    for (const linha of linhas) {
      expect(medir(linha)).toBeLessThanOrEqual(300);
    }
    expect(linhas.join(" ")).toBe(real);
  });

  it("parte uma palavra sozinha maior que a linha", () => {
    // Sem isto ela transbordaria igual, e o conserto não teria servido.
    const linhas = quebrarTexto("abcdefghijklmnopqrst", 60, medir);

    expect(linhas.length).toBeGreaterThan(1);
    for (const linha of linhas) {
      expect(medir(linha)).toBeLessThanOrEqual(60);
    }
    expect(linhas.join("")).toBe("abcdefghijklmnopqrst");
  });

  it("texto vazio não vira uma linha vazia", () => {
    expect(quebrarTexto("", 100, medir)).toEqual([]);
    expect(quebrarTexto("   ", 100, medir)).toEqual([]);
  });

  it("corta com reticências o que não cabe numa célula da tabela", () => {
    // Na TABELA cortar é o certo: quebrar em duas linhas desalinharia a
    // altura da linha inteira.
    const cortado = cortarParaCaber("Sala de Reunião Grande", 60, medir);

    expect(medir(cortado)).toBeLessThanOrEqual(60);
    expect(cortado.endsWith("…")).toBe(true);
  });

  it("não corta o que já cabe", () => {
    expect(cortarParaCaber("Sala CI", 600, medir)).toBe("Sala CI");
  });

  it("o PDF sai inteiro com uma descrição longa de verdade", async () => {
    await reserva("2026-09-11", "09:00", 2);

    const feito = await montarDoPeriodo({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [
        { descricao: "5 POSIÇÕES", valor: "2350.00" },
        {
          descricao:
            "EMPÓRIO 12 águas sem gás/10 águas com gás/7 barrinhas de " +
            "proteína/3 YOPRO/1 chocolate Stick/1 Chocobiscuit",
          valor: "201.50",
        },
      ],
    });

    if (!feito.ok) throw new Error("deveria montar");

    const arquivo = await gerarPdfDoDemonstrativo(feito.dados);

    // É um PDF de verdade, e o total continua certo depois da mudança de
    // layout: mexer no desenho não pode mexer na conta.
    expect(Buffer.from(arquivo.slice(0, 5)).toString()).toBe("%PDF-");
    expect(comoDinheiro(feito.dados.totalCentavos)).toBe("R$ 2.611,50");
  });
});

describe("o PDF", () => {
  it("sai um arquivo PDF de verdade, com as contas dentro", async () => {
    await reserva("2026-09-11", "09:00", 2.5);
    await reserva("2026-09-15", "09:00", 6.5, salaReuniao);

    const salvo = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [
        { descricao: "2 posições", valor: "940.00" },
        { descricao: "Empório: 13 águas, 15 c/ gás, 8 barrinhas", valor: "179.00" },
      ],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!salvo.ok) throw new Error("deveria salvar");

    const { gerarPdfDoDemonstrativo, nomeDoArquivo } = await import(
      "@/lib/pdf-demonstrativo"
    );
    const bytes = await gerarPdfDoDemonstrativo(salvo.dados);

    // Todo PDF começa com "%PDF-" e termina com "%%EOF". Sem isso, o
    // WhatsApp entrega um arquivo que não abre — e o cliente é quem
    // descobre.
    const texto = Buffer.from(bytes).toString("latin1");
    expect(texto.startsWith("%PDF-")).toBe(true);
    expect(texto.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(bytes.length).toBeGreaterThan(1_000);

    // 9 h x R$ 30 = R$ 270 + 940 + 179 = R$ 1.389,00
    expect(comoDinheiro(salvo.dados.totalCentavos)).toBe("R$ 1.389,00");

    // E o nome do arquivo diz de quem é e de quando, sem acento nem espaço.
    const nome = nomeDoArquivo(salvo.dados);
    expect(nome).toBe("Demonstrativo-Toca-Imobiliaria-2026-09-10-a-2026-10-10.pdf");
    expect(nome).toMatch(/^[\w.-]+$/);
  });

  it("gera mesmo sem nenhuma reserva no período", async () => {
    // Um mês em que o cliente não usou nada ainda tem posições e empório a
    // cobrar. O documento não pode simplesmente falhar.
    await reserva("2026-11-20", "09:00", 1);

    const salvo = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [{ descricao: "2 posições", valor: "940.00" }],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!salvo.ok) throw new Error("deveria salvar");
    expect(salvo.dados.horas).toBe(0);

    const { gerarPdfDoDemonstrativo } = await import("@/lib/pdf-demonstrativo");
    const bytes = await gerarPdfDoDemonstrativo(salvo.dados);
    expect(bytes.length).toBeGreaterThan(1_000);
    expect(comoDinheiro(salvo.dados.totalCentavos)).toBe("R$ 940,00");
  });

  it("aguenta um mês cheio sem estourar a página", async () => {
    // 30 linhas não cabem numa folha A4: o documento tem de virar a página
    // sozinho, repetindo o cabeçalho da tabela.
    for (let dia = 1; dia <= 28; dia += 1) {
      const data = `2026-09-${String(dia).padStart(2, "0")}`;
      if (data >= DE) {
        await reserva(data, "09:00", 1);
      }
    }

    const salvo = await salvar({
      clienteId: await cadastroDaToca(),
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!salvo.ok) throw new Error("deveria salvar");

    const { gerarPdfDoDemonstrativo } = await import("@/lib/pdf-demonstrativo");
    const bytes = await gerarPdfDoDemonstrativo(salvo.dados);
    const texto = Buffer.from(bytes).toString("latin1");

    expect(texto.startsWith("%PDF-")).toBe(true);
    // Mais de uma página: o contador de páginas do PDF tem de passar de 1.
    expect(salvo.dados.itens.length).toBeGreaterThan(15);
  });
});


describe("o demonstrativo de uma EMPRESA inteira", () => {
  /**
   * O caso real: o dono procurou "Toca" no painel e achou QUATRO cadastros —
   * Matheus Vitullo, Toca, Vinicius e Matheus Toca. Não são a mesma pessoa,
   * são quatro gentes da mesma empresa. A fatura é da EMPRESA.
   */
  async function montarAToca() {
    const empresa = await bancoDeTeste.empresa.create({
      data: { nome: `${PREFIXO_EMPRESA} Toca Imobiliária` },
      select: { id: true },
    });

    // Três pessoas, três telefones, todas da Toca.
    await reserva("2026-09-11", "09:00", 2, salaPrivativa, DA_TOCA, "Matheus Vitullo");
    await reserva("2026-09-15", "09:00", 3, salaReuniao, DO_VINICIUS, "Vinicius");
    await reserva("2026-09-16", "09:00", 1.5, salaPrivativa, DO_MATHEUS, "Matheus Toca");

    for (const telefone of [DA_TOCA, DO_VINICIUS, DO_MATHEUS]) {
      const ligado = await bancoDeTeste.telefoneDoCliente.findUniqueOrThrow({
        where: { telefone },
        select: { clienteId: true },
      });
      await bancoDeTeste.cliente.update({
        where: { id: ligado.clienteId },
        data: { empresaId: empresa.id },
      });
    }

    return empresa.id;
  }

  it("junta as horas de TODOS os funcionários num documento só", async () => {
    const empresaId = await montarAToca();

    const feito = await montarDoPeriodo({ empresaId, de: DE, ate: ATE, valorHora: "30.00" });

    if (!feito.ok) throw new Error("deveria montar");

    // 2 + 3 + 1,5 = 6,5 h de três pessoas diferentes.
    expect(feito.dados.horas).toBe(6.5);
    expect(feito.dados.itens).toHaveLength(3);
    expect(feito.dados.clienteNome).toBe(`${PREFIXO_EMPRESA} Toca Imobiliária`);
  });

  it("mostra DE QUEM foram as horas", async () => {
    // O cliente quer saber de quem são as horas que estão sendo cobradas.
    const empresaId = await montarAToca();

    const feito = await montarDoPeriodo({ empresaId, de: DE, ate: ATE, valorHora: "30.00" });
    if (!feito.ok) throw new Error("deveria montar");

    const porPessoa = new Map(feito.dados.porPessoa.map((p) => [p.nome, p.horas]));
    expect(porPessoa.get("Matheus Vitullo")).toBe(2);
    expect(porPessoa.get("Vinicius")).toBe(3);
    expect(porPessoa.get("Matheus Toca")).toBe(1.5);
  });

  it("NÃO entra quem não é da empresa", async () => {
    const empresaId = await montarAToca();
    // Alguém de fora, no mesmo período.
    await reserva("2026-09-18", "09:00", 8, salaReuniao, DE_FORA, "Pessoa de Fora");

    const feito = await montarDoPeriodo({ empresaId, de: DE, ate: ATE, valorHora: "30.00" });
    if (!feito.ok) throw new Error("deveria montar");

    expect(feito.dados.horas).toBe(6.5);
    expect(feito.dados.porPessoa.map((p) => p.nome)).not.toContain("Pessoa de Fora");
  });

  it("salvar congela também quem reservou", async () => {
    const empresaId = await montarAToca();

    const salvo = await salvar({
      empresaId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: true,
    });

    if (!salvo.ok) throw new Error("deveria salvar");

    const relido = await buscar(salvo.dados.id!);
    expect(relido?.horas).toBe(6.5);
    expect(relido?.porPessoa).toHaveLength(3);
    expect(relido?.clienteNome).toBe(`${PREFIXO_EMPRESA} Toca Imobiliária`);
  });

  it("guarda o preço em TODOS os clientes da empresa", async () => {
    // No mês seguinte o valor já vem preenchido, venha o documento de quem
    // vier — da empresa ou de uma pessoa dela.
    const empresaId = await montarAToca();

    await salvar({
      empresaId,
      de: DE,
      ate: ATE,
      valorHora: "30.00",
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: true,
    });

    const quantos = await bancoDeTeste.cliente.count({
      where: { empresaId, precoHoraAcordado: "30.00" },
    });
    expect(quantos).toBe(3);
  });
});
