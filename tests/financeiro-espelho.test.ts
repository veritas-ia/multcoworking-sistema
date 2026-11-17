/**
 * O LANÇAMENTO ESPELHA A ORIGEM — Fase 16, Parte B (17/11/2026).
 *
 * O QUE ESTES TESTES PROTEGEM, e é tudo a mesma coisa vista de ângulos
 * diferentes: **dinheiro contado duas vezes.**
 *
 * O mensalista paga as horas dele no demonstrativo, no fim do ciclo. Se cada
 * reserva virasse entrada no caixa, as mesmas horas entrariam DUAS VEZES — uma
 * como reserva, outra como mensalidade — e **cada linha continuaria parecendo
 * certa**. Ninguém descobriria olhando a tela.
 *
 * Por isso:
 *
 *  1. a reserva **não** vira lançamento sozinha. Só quando alguém diz que
 *     recebeu, no balcão;
 *  2. o consumo **NA_MENSALIDADE** não vira lançamento: ele vai no
 *     demonstrativo;
 *  3. o consumo **NA_HORA** vira, porque a recepcionista já informou a forma de
 *     pagamento — é confirmação, não suposição;
 *  4. clicar duas vezes em "Recebi" não cria duas linhas;
 *  5. o empório é **uma linha por dia e por forma**, RECALCULADA — lançar o
 *     quinto consumo do dia dá o mesmo resultado que lançar os cinco de uma vez.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listarAcoes, TipoDeAcao } from "@/lib/acoes";
import {
  CategoriaDoProduto,
  criarProduto,
  lancarConsumo,
  listarFormasDePagamento,
  MomentoDoPagamento,
  registrarMovimento,
  TipoMovimentoEstoque,
} from "@/lib/emporio";
import {
  desfazerRecebimentoDaReserva,
  desvincular,
  listarLancamentos,
  registrarRecebimentoDaReserva,
  resumir,
  sincronizarEmporioDoDia,
} from "@/lib/financeiro";
import { dataLocalDe, instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao, idDoCliente } from "./apoio/banco";

const ZZ = "ZZ Espelho";
const USUARIO = "zz.espelho";
const TELEFONE = "+5511900009200";

let operador: { id: string; nome: string };
let clienteId: string;
let salaId: string;

/**
 * O DIA DA FICHA É SEMPRE DO PASSADO.
 *
 * Mesma regra do teste de consumo: o motor recusa consumo no futuro, e "hoje
 * às 10:00" É futuro quando a suíte roda de manhã — a suíte passaria de tarde
 * e falharia de manhã, sem ninguém ter mexido em nada.
 */
const diasAtras = (quantos: number): string =>
  dataLocalDe(new Date(Date.now() - quantos * 24 * 60 * 60 * 1000));

const DIA_DA_FICHA = diasAtras(1);
const DIA_ANTERIOR = diasAtras(2);

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    where: { ativa: true },
    select: { id: true },
  });
  salaId = sala.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.acaoRegistrada.deleteMany({
    where: { OR: [{ usuario: { usuario: USUARIO } }, { usuarioNome: ZZ }] },
  });
  // TODOS os lançamentos saem: a tabela nasce vazia no banco de teste (não
  // entra no script de preparação), então não há nada de produção a preservar.
  // Filtrando por nome, um que escapasse travaria por RESTRICT a remoção da
  // categoria e do cliente — a limpeza pararia no meio e o número de testes
  // vermelhos mudaria a cada execução.
  await bancoDeTeste.lancamento.deleteMany({});
  await bancoDeTeste.consumoDoEmporio.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.movimentoDeEstoque.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.produto.deleteMany({ where: { nome: { startsWith: ZZ } } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.cliente.deleteMany({
    where: {
      reservas: { none: {} },
      telefones: { none: {} },
      consumosEmporio: { none: {} },
      demonstrativos: { none: {} },
      lancamentos: { none: {} },
    },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  // Toda categoria volta ligada: um teste daqui desliga a do empório de
  // propósito, e deixá-la desligada faria os seguintes falharem por um motivo
  // que não tem nada a ver com a regra deles.
  await bancoDeTeste.categoriaFinanceira.updateMany({ data: { ativa: true } });
}

beforeEach(async () => {
  await limpar();

  const usuario = await bancoDeTeste.usuario.create({
    data: { usuario: USUARIO, nome: ZZ, senhaHash: "x" },
  });
  operador = { id: usuario.id, nome: usuario.nome };
  clienteId = await idDoCliente(TELEFONE, `${ZZ} Cliente`);
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** Uma reserva gravada direto, como a recepção lança. */
async function reserva(opcoes?: {
  dia?: string;
  inicio?: string;
  fim?: string;
  valor?: string;
  cancelada?: boolean;
}): Promise<string> {
  const dia = opcoes?.dia ?? DIA_DA_FICHA;
  const criada = await bancoDeTeste.reserva.create({
    data: {
      salaId,
      clienteId,
      profissaoId: await idDaProfissao(),
      nomeCliente: `${ZZ} Cliente`,
      telefone: TELEFONE,
      inicio: instanteDe(dia, opcoes?.inicio ?? "09:00"),
      fim: instanteDe(dia, opcoes?.fim ?? "10:00"),
      duracaoMinutos: 60,
      valor: opcoes?.valor ?? "40.00",
      status: opcoes?.cancelada ? "CANCELADA" : "CONFIRMADA",
      origem: "ADMIN",
      ...(opcoes?.cancelada ? { canceladoEm: new Date() } : {}),
    },
  });

  return criada.id;
}

async function produto(nome: string, preco: string): Promise<string> {
  const feito = await criarProduto({
    nome: `${ZZ} ${nome}`,
    categoria: CategoriaDoProduto.COMIDA,
    preco,
  });

  if (!feito.ok) throw new Error("não criou o produto");

  await registrarMovimento({
    produtoId: feito.dados.id,
    tipo: TipoMovimentoEstoque.REPOSICAO,
    quantidade: 50,
    usuarioId: operador.id,
  });

  return feito.dados.id;
}

/** Os lançamentos do dia da ficha, sem olhar o resto do banco. */
async function doDia(dia = DIA_DA_FICHA) {
  return listarLancamentos({ de: dia, ate: dia });
}

// -----------------------------------------------------------------------------

describe("a reserva NÃO vira lançamento sozinha", () => {
  /**
   * O TESTE MAIS IMPORTANTE DESTE ARQUIVO.
   *
   * Se um dia alguém "melhorar" o sistema fazendo a reserva virar entrada
   * automaticamente, as horas do mensalista passam a entrar duas vezes — uma
   * como reserva, outra como mensalidade — e é aqui que isso estoura.
   */
  it("criar reserva não cria linha nenhuma no caixa", async () => {
    await reserva();

    expect(await doDia()).toHaveLength(0);
  });

  it("o 'Recebi' cria UMA entrada já paga, com o valor congelado da reserva", async () => {
    const reservaId = await reserva({ valor: "40.00" });

    const feito = await registrarRecebimentoDaReserva({
      reservaId,
      pagoEm: DIA_DA_FICHA,
      operador,
    });

    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.tipo).toBe("ENTRADA");
    expect(feito.dados.valor).toBe("40.00");
    expect(feito.dados.situacao).toBe("PAGO");
    expect(feito.dados.origem).toBe("RESERVA");
    // A descrição se explica sozinha na lista do caixa.
    expect(feito.dados.descricao).toContain(`${ZZ} Cliente`);

    const lista = await doDia();
    expect(lista).toHaveLength(1);
  });

  /**
   * DOIS CLIQUES NÃO CRIAM DUAS LINHAS.
   *
   * O índice único do banco também recusaria, mas aqui a segunda chamada
   * devolve a linha que existe — a recepcionista clicou duas vezes e não
   * precisa ver erro nenhum.
   */
  it("clicar duas vezes em 'Recebi' não dobra o dinheiro", async () => {
    const reservaId = await reserva({ valor: "40.00" });

    const primeiro = await registrarRecebimentoDaReserva({ reservaId, operador });
    const segundo = await registrarRecebimentoDaReserva({ reservaId, operador });

    if (!primeiro.ok || !segundo.ok) throw new Error("deveria aceitar as duas");

    expect(segundo.dados.id).toBe(primeiro.dados.id);

    const lista = await doDia();
    expect(lista).toHaveLength(1);
    expect(resumir(lista).entradasCentavos).toBe(4_000);
  });

  /**
   * RESERVA CANCELADA NÃO GERA RECEITA.
   *
   * O caixa passaria a mostrar dinheiro de algo que não aconteceu.
   */
  it("reserva cancelada é recusada, e nada entra no caixa", async () => {
    const reservaId = await reserva({ cancelada: true });

    const feito = await registrarRecebimentoDaReserva({ reservaId, operador });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("RESERVA_CANCELADA");

    expect(await doDia()).toHaveLength(0);
  });

  it("desfazer apaga a linha e deixa a evidência", async () => {
    const reservaId = await reserva();
    await registrarRecebimentoDaReserva({ reservaId, operador });

    const desfeito = await desfazerRecebimentoDaReserva({ reservaId, operador });
    if (!desfeito.ok) throw new Error(desfeito.falha.motivo);

    expect(await doDia()).toHaveLength(0);

    const acoes = await listarAcoes({ tipo: TipoDeAcao.LANCAMENTO_EXCLUIDO });
    const nossa = acoes.find((acao) => acao.usuarioNome === ZZ);

    expect(nossa).toBeDefined();
    expect(nossa?.resumo).toContain("Recebimento desfeito");
    // O motivo é escrito pelo sistema: aqui o "por quê" é a ação em si.
    expect(nossa?.motivo).toBe("recebimento desfeito na agenda");
  });

  /**
   * A LINHA SOBREVIVE À EXCLUSÃO DA RESERVA.
   *
   * A chave é ON DELETE SET NULL, e não RESTRICT. Levando o lançamento junto,
   * o dinheiro que entrou no caixa desapareceria dele — e o caixa de um mês
   * fechado mudaria sozinho, sem ninguém pedir.
   */
  it("excluir a reserva não apaga o dinheiro do caixa — a linha vira manual", async () => {
    const reservaId = await reserva({ valor: "40.00" });
    await registrarRecebimentoDaReserva({ reservaId, operador });

    await bancoDeTeste.reserva.delete({ where: { id: reservaId } });

    const lista = await doDia();
    expect(lista).toHaveLength(1);
    expect(lista[0]?.valor).toBe("40.00");
    // Sem a reserva, ela deixa de ser espelho e passa a ser editável.
    expect(lista[0]?.origem).toBe("MANUAL");
  });

  it("desvincular solta a linha da reserva e ela vira manual", async () => {
    const reservaId = await reserva();
    const feito = await registrarRecebimentoDaReserva({ reservaId, operador });
    if (!feito.ok) throw new Error("deveria criar");

    const solta = await desvincular(feito.dados.id);
    if (!solta.ok) throw new Error(solta.falha.motivo);

    expect(solta.dados.origem).toBe("MANUAL");

    // E a reserva aceita um recebimento NOVO: a antiga virou manual e não
    // ocupa mais o lugar dela. (Soltar é assumir controle da linha velha.)
    const denovo = await registrarRecebimentoDaReserva({ reservaId, operador });
    if (!denovo.ok) throw new Error(denovo.falha.motivo);

    expect(denovo.dados.id).not.toBe(feito.dados.id);
  });
});

describe("o empório pago na hora entra; o da mensalidade não", () => {
  /**
   * O CONSUMO NA_MENSALIDADE VAI NO DEMONSTRATIVO.
   *
   * Cobrar no caixa também seria cobrar duas vezes pela mesma barrinha, e o
   * cliente não teria como perceber olhando o documento.
   */
  it("consumo NA_MENSALIDADE não cria linha no caixa", async () => {
    const produtoId = await produto("Kit Kat", "6.50");

    const feito = await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 2,
      dia: DIA_DA_FICHA,
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador.id,
    });

    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(await doDia()).toHaveLength(0);
  });

  it("consumo NA_HORA cria UMA linha paga, com a forma de pagamento", async () => {
    const produtoId = await produto("Kit Kat", "6.50");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    const feito = await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 2,
      dia: DIA_DA_FICHA,
      hora: "10:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador.id,
    });

    if (!feito.ok) throw new Error(feito.falha.motivo);

    const lista = await doDia();

    expect(lista).toHaveLength(1);
    expect(lista[0]?.origem).toBe("EMPORIO");
    expect(lista[0]?.situacao).toBe("PAGO");
    expect(lista[0]?.valor).toBe("13.00");
    expect(lista[0]?.formaPagamento?.nome).toBe(formas[0]!.nome);
    // A descrição diz o dia, a quantidade e a forma — é o que a equipe
    // compara com o comprovante de Pix.
    expect(lista[0]?.descricao).toContain("2 itens");
  });

  /**
   * UMA LINHA POR DIA, NÃO UMA POR BARRINHA.
   *
   * Uma linha por consumo daria ~150 linhas de empório por mês, afogando as
   * ~20 contas de verdade. O dinheiro também não chega assim: chega como UM
   * comprovante de Pix do dia.
   */
  it("cinco consumos do mesmo dia dão UMA linha somada", async () => {
    const produtoId = await produto("Água", "4.00");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    for (let i = 0; i < 5; i += 1) {
      const feito = await lancarConsumo({
        clienteId,
        produtoId,
        quantidade: 1,
        dia: DIA_DA_FICHA,
        hora: `1${i}:00`,
        momento: MomentoDoPagamento.NA_HORA,
        formaPagamentoId: formas[0]!.id,
        usuarioId: operador.id,
      });
      if (!feito.ok) throw new Error(feito.falha.motivo);
    }

    const lista = await doDia();

    expect(lista).toHaveLength(1);
    expect(lista[0]?.valor).toBe("20.00");
    expect(lista[0]?.descricao).toContain("5 itens");
  });

  /**
   * FORMAS DIFERENTES, LINHAS DIFERENTES.
   *
   * O dinheiro chega separado: o Pix do dia é um comprovante, o dinheiro da
   * gaveta é outro. Juntar os dois numa linha esconderia de onde veio.
   */
  it("Pix e dinheiro no mesmo dia dão duas linhas", async () => {
    const produtoId = await produto("Água", "4.00");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    if (formas.length < 2) {
      throw new Error("o teste precisa de duas formas de pagamento cadastradas");
    }

    for (const forma of formas.slice(0, 2)) {
      const feito = await lancarConsumo({
        clienteId,
        produtoId,
        quantidade: 1,
        dia: DIA_DA_FICHA,
        hora: "11:00",
        momento: MomentoDoPagamento.NA_HORA,
        formaPagamentoId: forma.id,
        usuarioId: operador.id,
      });
      if (!feito.ok) throw new Error(feito.falha.motivo);
    }

    const lista = await doDia();

    expect(lista).toHaveLength(2);
    expect(resumir(lista).entradasCentavos).toBe(800);
  });

  /**
   * A SINCRONIZAÇÃO RECALCULA, e é isso que a faz segura.
   *
   * Rodar duas vezes não dobra nada — um acumulador erraria para sempre. É a
   * mesma escolha da contagem do estoque, e pela mesma razão.
   */
  it("sincronizar duas vezes não dobra o valor", async () => {
    const produtoId = await produto("Água", "4.00");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 3,
      dia: DIA_DA_FICHA,
      hora: "11:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador.id,
    });

    await sincronizarEmporioDoDia(DIA_DA_FICHA, operador);
    await sincronizarEmporioDoDia(DIA_DA_FICHA, operador);

    const lista = await doDia();

    expect(lista).toHaveLength(1);
    expect(lista[0]?.valor).toBe("12.00");
  });

  it("dias diferentes não se misturam", async () => {
    const produtoId = await produto("Água", "4.00");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    for (const dia of [DIA_DA_FICHA, DIA_ANTERIOR]) {
      await lancarConsumo({
        clienteId,
        produtoId,
        quantidade: 1,
        dia,
        hora: "11:00",
        momento: MomentoDoPagamento.NA_HORA,
        formaPagamentoId: formas[0]!.id,
        usuarioId: operador.id,
      });
    }

    expect(await doDia(DIA_DA_FICHA)).toHaveLength(1);
    expect(await doDia(DIA_ANTERIOR)).toHaveLength(1);
  });

  /**
   * CORTESIA NÃO GERA LINHA.
   *
   * Os doze botões da máquina de café são de graça. Uma linha de R$ 0,00 só
   * sujaria o caixa — e o banco recusaria, pela trava de valor positivo.
   */
  it("consumo de cortesia (preço zero) não cria linha", async () => {
    const produtoId = await produto("Café expresso", "0");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    const feito = await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 2,
      dia: DIA_DA_FICHA,
      hora: "11:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador.id,
    });

    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(await doDia()).toHaveLength(0);
  });

  /**
   * A LINHA DO EMPÓRIO NÃO SE DESVINCULA, e a recusa explica por quê.
   *
   * Ela é recalculada a cada consumo do dia: soltá-la não a tornaria editável
   * de verdade — o próximo consumo criaria outra linha ao lado, e o dinheiro
   * do dia apareceria DUAS VEZES no caixa.
   */
  it("desvincular a linha do empório é recusado", async () => {
    const produtoId = await produto("Água", "4.00");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 1,
      dia: DIA_DA_FICHA,
      hora: "11:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador.id,
    });

    const linha = (await doDia())[0]!;
    const feito = await desvincular(linha.id);

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("EMPORIO_NAO_DESVINCULA");

    // E a linha continua lá, inteira.
    const depois = await doDia();
    expect(depois).toHaveLength(1);
    expect(depois[0]?.origem).toBe("EMPORIO");
  });

  /**
   * O CONSUMO NÃO SE PERDE SE O CAIXA FALHAR.
   *
   * A categoria do empório desligada não é o caso de falha real, mas é o mais
   * fácil de provocar: a sincronização usa a categoria mesmo desligada, então
   * aqui a gente APAGA a ligação de outro jeito — renomeando o slug, que é o
   * que a sincronização procura. O consumo tem de sobreviver: ele está escrito
   * na ficha da parede, e a linha do caixa é derivada dele.
   */
  it("o consumo é salvo mesmo se a linha do caixa não puder nascer", async () => {
    const produtoId = await produto("Água", "4.00");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    const categoria = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow({
      where: { slug: "emporio" },
      select: { id: true },
    });

    await bancoDeTeste.categoriaFinanceira.update({
      where: { id: categoria.id },
      data: { slug: "emporio-renomeado-pelo-teste" },
    });

    try {
      const feito = await lancarConsumo({
        clienteId,
        produtoId,
        quantidade: 1,
        dia: DIA_DA_FICHA,
        hora: "11:00",
        momento: MomentoDoPagamento.NA_HORA,
        formaPagamentoId: formas[0]!.id,
        usuarioId: operador.id,
      });

      // O CONSUMO PASSOU, que é o que importa: a recepcionista não perde o que
      // digitou com a ficha na mão.
      expect(feito.ok).toBe(true);
      // E o caixa ficou sem a linha, como esperado.
      expect(await doDia()).toHaveLength(0);
    } finally {
      await bancoDeTeste.categoriaFinanceira.update({
        where: { id: categoria.id },
        data: { slug: "emporio" },
      });
    }
  });

  /**
   * E DEPOIS ELE SE AUTOCORRIGE.
   *
   * É por isso que a sincronização RECALCULA em vez de somar: o dia que ficou
   * de fora volta inteiro no próximo lançamento, sem ninguém precisar saber
   * que falhou.
   */
  it("o dia que ficou de fora volta inteiro no próximo lançamento", async () => {
    const produtoId = await produto("Água", "4.00");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    // Dois consumos gravados direto no banco, como se a sincronização tivesse
    // falhado nos dois.
    for (const hora of ["10:00", "11:00"]) {
      await bancoDeTeste.consumoDoEmporio.create({
        data: {
          clienteId,
          produtoId,
          quantidade: 1,
          precoUnitario: "4.00",
          valor: "4.00",
          consumidoEm: instanteDe(DIA_DA_FICHA, hora),
          momento: MomentoDoPagamento.NA_HORA,
          formaPagamentoId: formas[0]!.id,
        },
      });
    }

    expect(await doDia()).toHaveLength(0);

    // O terceiro consumo, agora pelo caminho normal.
    await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 1,
      dia: DIA_DA_FICHA,
      hora: "12:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador.id,
    });

    const lista = await doDia();

    expect(lista).toHaveLength(1);
    // OS TRÊS entraram, e não só o último: o recálculo olha o dia inteiro.
    expect(lista[0]?.valor).toBe("12.00");
  });
});

describe("os dois juntos, sem contar duas vezes", () => {
  /**
   * O CENÁRIO COMPLETO DE UM DIA.
   *
   * Reserva recebida no balcão (R$ 40) + empório pago na hora (R$ 13) +
   * empório na mensalidade (R$ 20, que NÃO entra) + uma reserva de mensalista
   * sem recebimento (R$ 40, que NÃO entra).
   *
   * O caixa do dia tem de ser R$ 53 — e não R$ 113.
   */
  it("o caixa do dia soma só o que entrou de verdade", async () => {
    const produtoId = await produto("Kit Kat", "6.50");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    // 1. A reserva do cliente de passagem, recebida no balcão.
    const recebida = await reserva({ valor: "40.00", inicio: "09:00", fim: "10:00" });
    await registrarRecebimentoDaReserva({
      reservaId: recebida,
      pagoEm: DIA_DA_FICHA,
      operador,
    });

    // 2. A reserva do mensalista, que paga no fim do mês. NINGUÉM marca.
    await reserva({ valor: "40.00", inicio: "14:00", fim: "15:00" });

    // 3. Empório pago na hora.
    await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 2,
      dia: DIA_DA_FICHA,
      hora: "10:30",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador.id,
    });

    // 4. Empório na mensalidade — vai no demonstrativo, não no caixa.
    await lancarConsumo({
      clienteId,
      produtoId,
      quantidade: 3,
      dia: DIA_DA_FICHA,
      hora: "15:30",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador.id,
    });

    const lista = await doDia();
    const resumo = resumir(lista);

    // Duas linhas: a reserva recebida e o empório do dia.
    expect(lista).toHaveLength(2);
    expect(resumo.entradasCentavos).toBe(5_300);
    expect(resumo.saidasCentavos).toBe(0);

    // E nada ficou pendente: as duas são dinheiro que já entrou.
    expect(resumo.aReceberCentavos).toBe(0);
  });
});
