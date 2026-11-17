/**
 * O LANCAMENTO DO CONSUMO DO EMPORIO (Fase 15).
 *
 * POR QUE ISTO EXISTE
 *
 * Hoje a recepcionista le a ficha fisica, SOMA DE CABECA por cliente e digita
 * uma linha de texto no controle de horas, com o total escrito a mao —
 * "EMPORIO 12 aguas sem gas/10 aguas com gas/... R$ 201,50". E o mesmo tipo de
 * numero digitado sem conferencia que gerou os R$ 70 cobrados a mais na
 * planilha da Toca.
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 *  1. QUEM SOMA E O SISTEMA. O valor nunca vem da tela — aceitar o total de
 *     quem chama devolveria exatamente o problema que isto veio resolver;
 *  2. o preco fica CONGELADO na linha. Reajustar o produto no painel nao pode
 *     mudar o que ja foi consumido, igual a reserva;
 *  3. a hora e a DO PAPEL. Carimbar a hora do lancamento faria o relatorio
 *     dizer que todo mundo consome no fim do dia;
 *  4. o consumo da BAIXA no estoque — e e isso que permite a contagem do dia
 *     seguinte virar a coluna "FALTOU" da ficha;
 *  5. cafe NAO da baixa: ele e medido por contador, e "estoque de expresso"
 *     nao existe.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  CategoriaDoProduto,
  criarProduto,
  extratoDoProduto,
  lancarConsumo,
  listarConsumos,
  listarFormasDePagamento,
  listarProdutos,
  MomentoDoPagamento,
  registrarMovimento,
  TipoDeControle,
  TipoMovimentoEstoque,
} from "@/lib/emporio";
import { buscar, montarDoPeriodo, salvar } from "@/lib/demonstrativos";
import { dataLocalDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDoCliente } from "./apoio/banco";

const ZZ = "ZZ Consumo";
const USUARIO = "zz.consumo";
const TELEFONE = "+5511900006001";

let operador: string;
let clienteId: string;

/**
 * O DIA DA FICHA E SEMPRE DO PASSADO — e o teste precisa respeitar isso.
 *
 * O DEFEITO QUE ISTO CONSERTA: estes ajudantes eram "hoje" e "ontem", e o dia
 * de referencia era HOJE. Mas o motor recusa consumo no futuro, e "hoje as
 * 10:00" E futuro quando o teste roda de manha. Resultado: a suite passava de
 * tarde e falhava de manha, com dez testes vermelhos e nenhuma mensagem
 * apontando a causa — ninguem tinha mexido em nada.
 *
 * E a mesma familia do defeito ja registrado no CLAUDE.md ("teste com data:
 * nunca fixa no futuro"), um nivel mais fino: nao e a data que fica no futuro,
 * e a HORA dentro do dia de hoje.
 *
 * Agora o dia de referencia e ONTEM e o anterior e ANTEONTEM. Qualquer hora
 * do dia cabe no passado, e o teste da o mesmo resultado as 9h e as 21h — que
 * e tambem o que acontece de verdade: a recepcionista le o papel no dia
 * seguinte.
 */
const diasAtras = (quantos: number): string =>
  dataLocalDe(new Date(Date.now() - quantos * 24 * 60 * 60 * 1000));

/** O dia escrito na ficha. */
const diaDaFicha = (): string => diasAtras(1);
/** O dia anterior ao da ficha, para os testes de periodo de dois dias. */
const diaAnterior = (): string => diasAtras(2);
/** Continua sendo futuro de verdade: e a recusa que o motor precisa dar. */
const amanha = (): string => diasAtras(-1);

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  // Os demonstrativos saem PRIMEIRO: o teste do congelamento emite um, e ele
  // segura o cliente pela chave estrangeira. Sem isto a limpeza falha e TODO
  // o arquivo quebra — uma falha que não tem nada a ver com a regra testada.
  await bancoDeTeste.demonstrativo.deleteMany({
    where: { cliente: { telefones: { some: { telefone: TELEFONE } } } },
  });
  await bancoDeTeste.consumoDoEmporio.deleteMany({
    where: { OR: [{ produto: { nome: { startsWith: ZZ } } }, { cliente: { telefones: { some: { telefone: TELEFONE } } } }] },
  });
  await bancoDeTeste.movimentoDeEstoque.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.produto.deleteMany({ where: { nome: { startsWith: ZZ } } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.cliente.deleteMany({
    where: {
      reservas: { none: {} },
      telefones: { none: {} },
      consumosEmporio: { none: {} },
      demonstrativos: { none: {} },
    },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await limpar();

  const criado = await bancoDeTeste.usuario.create({
    data: { nome: "Recepção", usuario: USUARIO, senhaHash: "x" },
    select: { id: true },
  });

  operador = criado.id;
  clienteId = await idDoCliente(TELEFONE, "ZZ Giovanna");
});

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** Um produto de prateleira, com estoque. */
async function produto(nome: string, preco: string, inicial = 20): Promise<string> {
  const feito = await criarProduto({
    nome: `${ZZ} ${nome}`,
    categoria: CategoriaDoProduto.COMIDA,
    preco,
  });

  if (!feito.ok) throw new Error("não criou o produto");

  await registrarMovimento({
    produtoId: feito.dados.id,
    tipo: TipoMovimentoEstoque.REPOSICAO,
    quantidade: inicial,
    usuarioId: operador,
  });

  return feito.dados.id;
}

async function estoque(id: string): Promise<number> {
  const lista = await listarProdutos();
  return lista.find((p) => p.id === id)!.estoque;
}

// -----------------------------------------------------------------------------

describe("quem soma é o sistema", () => {
  it("multiplica quantidade por preço, e o valor nunca vem da tela", async () => {
    // Aceitar o total de quem chama devolveria o problema que isto veio
    // resolver: um número digitado que ninguém confere.
    const id = await produto("Barrinha Proteína", "12.00");

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 7,
      dia: diaDaFicha(),
      hora: "10:30",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria lançar");
    expect(feito.dados.precoUnitario).toBe("12.00");
    expect(feito.dados.valor).toBe("84.00");
  });

  it("preço quebrado não perde centavo", async () => {
    const id = await produto("Stick", "3.80");

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 3,
      dia: diaDaFicha(),
      hora: "10:30",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria lançar");
    expect(feito.dados.valor).toBe("11.40");
  });

  it("o preço fica CONGELADO: reajustar o produto não mexe no passado", async () => {
    // Mesma regra do valor congelado na reserva. Sem isto, um mês já cobrado
    // mudaria de valor sozinho quando a equipe reajustasse o preço.
    const id = await produto("Suflair", "7.50");

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 2,
      dia: diaDaFicha(),
      hora: "09:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria lançar");

    await bancoDeTeste.produto.update({ where: { id }, data: { preco: "15.00" } });

    const depois = await listarConsumos({ de: diaDaFicha(), ate: diaDaFicha(), clienteId });
    const nosso = depois.find((c) => c.id === feito.dados.id);

    expect(nosso?.precoUnitario).toBe("7.50");
    expect(nosso?.valor).toBe("15.00");
  });
});

describe("a hora é a do PAPEL, não a do lançamento", () => {
  it("lançar hoje um consumo de ontem guarda ontem", async () => {
    // A recepcionista lê a ficha no dia seguinte. Carimbar a hora de agora
    // faria o relatório dizer que todo mundo consome no fim do dia.
    const id = await produto("Cookies", "4.50");

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaAnterior(),
      hora: "14:20",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria lançar");
    expect(feito.dados.dia).toBe(diaAnterior());
    expect(feito.dados.hora).toBe("14:20");
  });

  it("recusa consumo no futuro", async () => {
    const id = await produto("Cookies", "4.50");

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: amanha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria lançar");
    expect(feito.falha.codigo).toBe("DIA_NO_FUTURO");
  });

  it("recusa hora em formato torto", async () => {
    const id = await produto("Cookies", "4.50");

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaDaFicha(),
      hora: "9h40",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);
  });
});

describe("o consumo dá baixa no estoque", () => {
  it("e é isso que faz a contagem do dia seguinte conferir", async () => {
    const id = await produto("Suflair", "7.50", 20);

    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 3,
      dia: diaDaFicha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    expect(await estoque(id)).toBe(17);

    const extrato = await extratoDoProduto(id);
    const venda = extrato.find((m) => m.tipo === TipoMovimentoEstoque.VENDA);

    expect(venda?.quantidade).toBe(-3);
    // O extrato diz DE QUEM foi, para explicar a saída meses depois.
    expect(venda?.motivo).toContain("ZZ Giovanna");
  });

  it("CAFÉ não dá baixa: contador não tem estoque", async () => {
    const feito = await criarProduto({
      nome: `${ZZ} Expresso`,
      categoria: CategoriaDoProduto.BEBIDA,
      preco: "0",
    });

    if (!feito.ok) throw new Error("não criou");
    await bancoDeTeste.produto.update({
      where: { id: feito.dados.id },
      data: { controle: TipoDeControle.CONTADOR },
    });

    const lancado = await lancarConsumo({
      clienteId,
      produtoId: feito.dados.id,
      quantidade: 2,
      dia: diaDaFicha(),
      hora: "08:30",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    expect(lancado.ok).toBe(true);
    // Registrado como consumo, mas sem movimento nenhum.
    expect(await extratoDoProduto(feito.dados.id)).toHaveLength(0);
  });

  it("cortesia (preço zero) é registrada do mesmo jeito", async () => {
    // O café é grátis, mas o consumo precisa existir: é dele que sai quanto
    // repor de leite, pó e copo.
    const id = await produto("Água de cortesia", "0");

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaDaFicha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_HORA,
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria lançar");
    expect(feito.dados.valor).toBe("0.00");
  });
});

describe("as duas formas de fechar, e só essas duas", () => {
  it("NA_HORA guarda a forma de pagamento", async () => {
    const id = await produto("Kit Kat", "6.50");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });
    const pix = formas.find((forma) => forma.nome === "Pix")!;

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaDaFicha(),
      hora: "11:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: pix.id,
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria lançar");
    expect(feito.dados.formaPagamento).toBe("Pix");
  });

  it("NA_MENSALIDADE NÃO guarda forma, mesmo se a tela mandar uma", async () => {
    // Ainda não foi pago: gravar uma forma ali seria dizer que aconteceu algo
    // que não aconteceu, e o relatório passaria a contar dinheiro que ninguém
    // recebeu.
    const id = await produto("Kit Kat", "6.50");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });
    const pix = formas.find((forma) => forma.nome === "Pix")!;

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaDaFicha(),
      hora: "11:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      formaPagamentoId: pix.id,
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria lançar");
    expect(feito.dados.formaPagamento).toBeNull();
  });

  it("o BANCO também recusa forma de pagamento no NA_MENSALIDADE", async () => {
    const id = await produto("Kit Kat", "6.50");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    await expect(
      bancoDeTeste.consumoDoEmporio.create({
        data: {
          clienteId,
          produtoId: id,
          quantidade: 1,
          precoUnitario: "6.50",
          valor: "6.50",
          consumidoEm: new Date(),
          momento: MomentoDoPagamento.NA_MENSALIDADE,
          formaPagamentoId: formas[0]!.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("filtrar por momento separa o que é cobrança do que já foi pago", async () => {
    // É a lista do NA_MENSALIDADE que vai para o controle de horas.
    const id = await produto("Kit Kat", "6.50");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaDaFicha(),
      hora: "09:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador,
    });

    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 2,
      dia: diaDaFicha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    const aCobrar = await listarConsumos({
      de: diaDaFicha(),
      ate: diaDaFicha(),
      clienteId,
      momento: MomentoDoPagamento.NA_MENSALIDADE,
    });

    expect(aCobrar).toHaveLength(1);
    expect(aCobrar[0]?.quantidade).toBe(2);
  });
});

describe("o que o lançamento recusa", () => {
  it("quantidade zero, negativa ou quebrada", async () => {
    const id = await produto("Kit Kat", "6.50");

    for (const quantidade of [0, -1, 1.5]) {
      const feito = await lancarConsumo({
        clienteId,
        produtoId: id,
        quantidade,
        dia: diaDaFicha(),
        hora: "10:00",
        momento: MomentoDoPagamento.NA_MENSALIDADE,
        usuarioId: operador,
      });
      expect(feito.ok).toBe(false);
    }
  });

  it("produto desligado", async () => {
    const id = await produto("Saiu de linha", "5.00");
    await bancoDeTeste.produto.update({ where: { id }, data: { ativo: false } });

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaDaFicha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria lançar");
    expect(feito.falha.codigo).toBe("NAO_ENCONTRADO");
  });

  it("cliente desligado", async () => {
    const id = await produto("Kit Kat", "6.50");
    await bancoDeTeste.cliente.update({
      where: { id: clienteId },
      data: { ativo: false },
    });

    const feito = await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaDaFicha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);

    await bancoDeTeste.cliente.update({
      where: { id: clienteId },
      data: { ativo: true },
    });
  });

  it("o BANCO recusa quantidade zero", async () => {
    const id = await produto("Kit Kat", "6.50");

    await expect(
      bancoDeTeste.consumoDoEmporio.create({
        data: {
          clienteId,
          produtoId: id,
          quantidade: 0,
          precoUnitario: "6.50",
          valor: "0",
          consumidoEm: new Date(),
          momento: MomentoDoPagamento.NA_MENSALIDADE,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("O CICLO FECHA: o consumo chega na cobrança sozinho", () => {
  /** O período que cobre os lançamentos de hoje e ontem. */
  const periodo = () => ({ de: diaAnterior(), ate: diaDaFicha() });

  it("o empório entra no controle de horas, SOMADO pelo sistema", async () => {
    // É isto que tira o "R$ 201,50" digitado à mão do documento.
    const agua = await produto("Água sem gás", "3.00");
    const barrinha = await produto("Barrinha Proteína", "12.00");

    await lancarConsumo({
      clienteId,
      produtoId: agua,
      quantidade: 12,
      dia: diaAnterior(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    await lancarConsumo({
      clienteId,
      produtoId: barrinha,
      quantidade: 7,
      dia: diaDaFicha(),
      hora: "11:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    const feito = await montarDoPeriodo({ clienteId, ...periodo() });

    if (!feito.ok) throw new Error("deveria montar");

    // 12 x 3,00 + 7 x 12,00 = 36,00 + 84,00 = 120,00
    expect(feito.dados.emporio?.valorCentavos).toBe(12_000);
    expect(feito.dados.totalCentavos).toBe(12_000);
    // A descrição sai dos lançamentos, não de texto digitado.
    expect(feito.dados.emporio?.descricao).toContain("7 ZZ Consumo Barrinha Proteína");
    expect(feito.dados.emporio?.descricao).toContain("12 ZZ Consumo Água sem gás");
  });

  it("agrupa POR PRODUTO, e não linha a linha", async () => {
    // A ficha do cliente diz "12 águas", não doze linhas de uma água. Ler
    // doze linhas iguais num documento de cobrança só atrapalha a conferência.
    const agua = await produto("Água sem gás", "3.00");

    // ONTEM, e não hoje: "hoje às 15:00" ainda não aconteceu quando o teste
    // roda de manhã, e o lançamento no futuro é recusado — corretamente.
    for (const hora of ["09:00", "11:00", "15:00"]) {
      await lancarConsumo({
        clienteId,
        produtoId: agua,
        quantidade: 2,
        dia: diaAnterior(),
        hora,
        momento: MomentoDoPagamento.NA_MENSALIDADE,
        usuarioId: operador,
      });
    }

    const feito = await montarDoPeriodo({ clienteId, ...periodo() });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.emporio?.itens).toHaveLength(1);
    expect(feito.dados.emporio?.itens[0]?.quantidade).toBe(6);
    expect(feito.dados.emporio?.valorCentavos).toBe(1_800);
  });

  it("O QUE FOI PAGO NA HORA NÃO ENTRA", async () => {
    // Cobrar de novo no fim do mês seria cobrar duas vezes pela mesma
    // barrinha, e o cliente não teria como perceber olhando o documento.
    const id = await produto("Kit Kat", "6.50");
    const formas = await listarFormasDePagamento({ somenteAtivas: true });

    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 4,
      dia: diaDaFicha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_HORA,
      formaPagamentoId: formas[0]!.id,
      usuarioId: operador,
    });

    const feito = await montarDoPeriodo({ clienteId, ...periodo() });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.emporio).toBeNull();
    expect(feito.dados.totalCentavos).toBe(0);
  });

  it("soma em CENTAVOS: três de R$ 33,33 dão R$ 99,99", async () => {
    const id = await produto("Caro", "33.33");

    for (const hora of ["09:00", "10:00", "11:00"]) {
      await lancarConsumo({
        clienteId,
        produtoId: id,
        quantidade: 1,
        dia: diaAnterior(),
        hora,
        momento: MomentoDoPagamento.NA_MENSALIDADE,
        usuarioId: operador,
      });
    }

    const feito = await montarDoPeriodo({ clienteId, ...periodo() });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.emporio?.valorCentavos).toBe(9_999);
  });

  it("consumo fora do período não entra", async () => {
    const id = await produto("Kit Kat", "6.50");

    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 1,
      dia: diaAnterior(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    const feito = await montarDoPeriodo({ clienteId, de: diaDaFicha(), ate: diaDaFicha() });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.emporio).toBeNull();
  });

  it("SALVAR CONGELA o empório: lançar depois não muda o documento", async () => {
    // Mesma regra da tabela de horas. Sem isto, um lançamento feito amanhã
    // mudaria um documento que o cliente já recebeu.
    const id = await produto("Kit Kat", "6.50");

    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 2,
      dia: diaAnterior(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    const salvo = await salvar({
      clienteId,
      ...periodo(),
      linhasExtras: [],
      totalAjustado: null,
      lembrarPreco: false,
    });

    if (!salvo.ok) throw new Error("deveria salvar");
    expect(salvo.dados.emporio?.valorCentavos).toBe(1_300);

    // Mais um consumo DEPOIS de emitido.
    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 10,
      dia: diaAnterior(),
      hora: "16:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    const lido = await buscar(salvo.dados.id!);

    expect(lido?.emporio?.valorCentavos).toBe(1_300);
    expect(lido?.totalCentavos).toBe(1_300);
  });

  it("o empório NÃO é uma linha digitada: as duas convivem", async () => {
    // As extras a gestão digita; o empório o sistema soma. Misturar deixaria
    // a equipe editar por cima de um número calculado.
    const id = await produto("Kit Kat", "6.50");

    await lancarConsumo({
      clienteId,
      produtoId: id,
      quantidade: 2,
      dia: diaDaFicha(),
      hora: "10:00",
      momento: MomentoDoPagamento.NA_MENSALIDADE,
      usuarioId: operador,
    });

    const feito = await montarDoPeriodo({
      clienteId,
      ...periodo(),
      linhasExtras: [{ descricao: "5 POSIÇÕES", valor: "2350.00" }],
    });

    if (!feito.ok) throw new Error("deveria montar");
    expect(feito.dados.emporio?.valorCentavos).toBe(1_300);
    expect(feito.dados.valorDasLinhasCentavos).toBe(235_000);
    expect(feito.dados.totalCentavos).toBe(236_300);
  });
});
