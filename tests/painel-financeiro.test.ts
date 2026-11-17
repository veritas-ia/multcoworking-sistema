/**
 * O PAINEL DO FINANCEIRO — Fase 16, Parte E (17/11/2026).
 *
 * O QUE ESTES TESTES PROTEGEM, e é tudo a mesma preocupação: **o painel não
 * pode inventar número.**
 *
 *  1. **O CAIXA É PELA DATA DE PAGAMENTO**, não de vencimento. Uma conta de
 *     outubro paga em novembro saiu do caixa em novembro — é ali que o dinheiro
 *     se mexeu.
 *  2. **O QUE NUNCA FOI PAGO NÃO ENTRA NO CAIXA.** Somar o pendente diria que o
 *     dinheiro já entrou, e a equipe decidiria em cima de um saldo que não
 *     existe.
 *  3. **A INADIMPLÊNCIA OLHA TODO O PASSADO.** Uma conta de agosto continua em
 *     atraso em dezembro; limitá-la ao mês faria a dívida desaparecer sozinha
 *     com o tempo — o número mais perigoso de se errar nesta tela.
 *  4. **MARGEM E VARIAÇÃO SÃO NULAS SEM BASE**, nunca zero nem 100%: dividir por
 *     zero daria Infinity, e "0%" é uma informação diferente de "não há o que
 *     dividir".
 *  5. **TUDO EM CENTAVOS.**
 *
 * TODA DATA É FIXA e o "hoje" entra como parâmetro: painel que dependa do
 * relógio mostra um número num dia e outro no seguinte.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  lancar,
  montarPainelFinanceiro,
  TipoDeLancamento,
} from "@/lib/financeiro";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

const USUARIO = "zz.painel";
const NOME = "ZZ Painel";

/** Um "hoje" FIXO: 17/12/2026. */
const AGORA = new Date("2026-12-17T15:00:00.000Z");
const MES = "2026-12";

let operador: { id: string; nome: string };

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  await bancoDeTeste.lancamento.deleteMany({});
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  await bancoDeTeste.categoriaFinanceira.updateMany({ data: { ativa: true } });
}

beforeEach(async () => {
  await limpar();

  const usuario = await bancoDeTeste.usuario.create({
    data: { usuario: USUARIO, nome: NOME, senhaHash: "x" },
  });
  operador = { id: usuario.id, nome: usuario.nome };
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

async function categoria(slug: string): Promise<string> {
  const linha = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });

  return linha.id;
}

/** Um lançamento, com o mínimo de cerimônia. */
async function lancamento(entrada: {
  descricao: string;
  valor: string;
  slug: string;
  vencimento: string;
  pagoEm?: string | null;
}): Promise<void> {
  const feito = await lancar(
    {
      descricao: entrada.descricao,
      valor: entrada.valor,
      categoriaId: await categoria(entrada.slug),
      vencimento: entrada.vencimento,
      pagoEm: entrada.pagoEm ?? null,
    },
    operador,
    AGORA,
  );

  if (!feito.ok) throw new Error(feito.falha.motivo);
}

async function painel(competencia = MES) {
  const feito = await montarPainelFinanceiro({ competencia, agora: AGORA });

  if (!feito.ok) throw new Error(feito.falha.motivo);

  return feito.dados;
}

// -----------------------------------------------------------------------------

describe("o caixa é pela data de PAGAMENTO", () => {
  /**
   * Uma conta de outubro paga em novembro saiu do caixa em NOVEMBRO. É ali que
   * o dinheiro se mexeu, e é por isso que o painel usa `pagoEm`.
   */
  it("a conta vence num mês e é paga noutro: conta no mês do pagamento", async () => {
    await lancamento({
      descricao: "ZZ energia de novembro",
      valor: "430,00",
      slug: "energia",
      vencimento: "2026-11-28",
      pagoEm: "2026-12-03",
    });

    const dezembro = await painel("2026-12");
    const novembro = await painel("2026-11");

    expect(dezembro.saidasCentavos).toBe(43_000);
    expect(novembro.saidasCentavos).toBe(0);
  });

  /**
   * O QUE NUNCA FOI PAGO NÃO ENTRA NO CAIXA.
   *
   * Somar o pendente diria que o dinheiro já entrou, e a equipe decidiria em
   * cima de um saldo que não existe.
   */
  it("pendente não entra no caixa, em nenhum mês", async () => {
    await lancamento({
      descricao: "ZZ mensalidade a receber",
      valor: "2400,00",
      slug: "mensalidades",
      vencimento: "2026-12-10",
    });

    const dezembro = await painel();

    expect(dezembro.entradasCentavos).toBe(0);
    expect(dezembro.resultadoCentavos).toBe(0);
  });

  it("entradas e saídas somam separadas, e o resultado é a diferença", async () => {
    await lancamento({
      descricao: "ZZ mensalidade",
      valor: "2400,00",
      slug: "mensalidades",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    await lancamento({
      descricao: "ZZ energia",
      valor: "430,25",
      slug: "energia",
      vencimento: "2026-12-08",
      pagoEm: "2026-12-08",
    });

    const dezembro = await painel();

    expect(dezembro.entradasCentavos).toBe(240_000);
    expect(dezembro.saidasCentavos).toBe(43_025);
    expect(dezembro.resultadoCentavos).toBe(196_975);
  });

  /**
   * O ÚLTIMO DIA DO MÊS ENTRA, e o primeiro do seguinte não.
   *
   * A janela é fechada nas duas pontas. Um erro de um dia aqui jogaria o
   * pagamento de 31/12 para janeiro, e o fechamento do ano não bateria.
   */
  it("as bordas do mês entram no mês certo", async () => {
    await lancamento({
      descricao: "ZZ do primeiro dia",
      valor: "10,00",
      slug: "mensalidades",
      vencimento: "2026-12-01",
      pagoEm: "2026-12-01",
    });

    await lancamento({
      descricao: "ZZ do último dia",
      valor: "20,00",
      slug: "mensalidades",
      vencimento: "2026-12-31",
      pagoEm: "2026-12-31",
    });

    await lancamento({
      descricao: "ZZ do dia 1 de janeiro",
      valor: "40,00",
      slug: "mensalidades",
      vencimento: "2027-01-01",
      pagoEm: "2027-01-01",
    });

    const dezembro = await painel();

    expect(dezembro.entradasCentavos).toBe(3_000);
  });

  /** Fevereiro tem 28 dias, e a janela precisa saber disso sozinha. */
  it("fevereiro não perde o último dia", async () => {
    await lancamento({
      descricao: "ZZ 28 de fevereiro",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-02-28",
      pagoEm: "2026-02-28",
    });

    const fevereiro = await painel("2026-02");

    expect(fevereiro.entradasCentavos).toBe(10_000);
  });
});

describe("a margem e a variação não inventam número", () => {
  /**
   * MARGEM NULA, E NÃO ZERO, quando não entrou nada.
   *
   * "Margem de 0%" diria que a margem é zero — informação diferente de "não há
   * o que dividir". E a conta daria Infinity.
   */
  it("sem entrada no mês, a margem é nula", async () => {
    await lancamento({
      descricao: "ZZ só despesa",
      valor: "430,00",
      slug: "energia",
      vencimento: "2026-12-08",
      pagoEm: "2026-12-08",
    });

    const dezembro = await painel();

    expect(dezembro.entradasCentavos).toBe(0);
    expect(dezembro.margem).toBeNull();
  });

  it("com entrada, a margem é o resultado sobre o que entrou", async () => {
    await lancamento({
      descricao: "ZZ entrada",
      valor: "1000,00",
      slug: "mensalidades",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    await lancamento({
      descricao: "ZZ saída",
      valor: "250,00",
      slug: "energia",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    const dezembro = await painel();

    // (1000 − 250) / 1000 = 75%
    expect(dezembro.margem).toBe(75);
  });

  it("a margem fica negativa quando saiu mais do que entrou", async () => {
    await lancamento({
      descricao: "ZZ entrada pequena",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    await lancamento({
      descricao: "ZZ saída grande",
      valor: "300,00",
      slug: "energia",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    const dezembro = await painel();

    expect(dezembro.resultadoCentavos).toBe(-20_000);
    expect(dezembro.margem).toBe(-200);
  });

  /**
   * O MÊS ANTERIOR ENTRA NA RESPOSTA, para a tela calcular a variação sem uma
   * segunda consulta — e sem refazer a conta do caixa por conta própria.
   */
  it("o mês anterior vem na resposta, com os números dele", async () => {
    await lancamento({
      descricao: "ZZ de novembro",
      valor: "500,00",
      slug: "mensalidades",
      vencimento: "2026-11-10",
      pagoEm: "2026-11-10",
    });

    await lancamento({
      descricao: "ZZ de dezembro",
      valor: "1000,00",
      slug: "mensalidades",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    const dezembro = await painel();

    expect(dezembro.competenciaAnterior).toBe("2026-11");
    expect(dezembro.entradasCentavos).toBe(100_000);
    expect(dezembro.anterior.entradasCentavos).toBe(50_000);
  });
});

describe("a inadimplência olha TODO o passado", () => {
  /**
   * O NÚMERO MAIS PERIGOSO DESTA TELA.
   *
   * Uma conta de agosto que ninguém pagou continua em atraso em dezembro.
   * Limitá-la ao mês escolhido faria a dívida desaparecer sozinha com o tempo —
   * e o painel diria "nada em atraso" com o cliente devendo há meses.
   */
  it("conta de meses atrás continua em atraso", async () => {
    await lancamento({
      descricao: "ZZ mensalidade de agosto",
      valor: "2400,00",
      slug: "mensalidades",
      vencimento: "2026-08-10",
    });

    const dezembro = await painel();

    expect(dezembro.atrasadoAReceberCentavos).toBe(240_000);
    expect(dezembro.quantasAtrasadasAReceber).toBe(1);
  });

  it("separa o que é a receber do que é a pagar, e conta quantas", async () => {
    await lancamento({
      descricao: "ZZ a receber 1",
      valor: "1000,00",
      slug: "mensalidades",
      vencimento: "2026-10-10",
    });

    await lancamento({
      descricao: "ZZ a receber 2",
      valor: "500,00",
      slug: "mensalidades",
      vencimento: "2026-11-10",
    });

    await lancamento({
      descricao: "ZZ a pagar",
      valor: "200,00",
      slug: "energia",
      vencimento: "2026-11-15",
    });

    const dezembro = await painel();

    expect(dezembro.atrasadoAReceberCentavos).toBe(150_000);
    expect(dezembro.quantasAtrasadasAReceber).toBe(2);
    expect(dezembro.atrasadoAPagarCentavos).toBe(20_000);
    expect(dezembro.quantasAtrasadasAPagar).toBe(1);
  });

  /**
   * QUEM VENCE HOJE NÃO ESTÁ ATRASADO, e quem vence amanhã também não.
   *
   * A conta é "vencimento < hoje", e não "<=": quem vence hoje tem o dia todo
   * para pagar. Mesma regra da situação do lançamento.
   */
  it("vencer hoje ou no futuro não é atraso", async () => {
    await lancamento({
      descricao: "ZZ vence hoje",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-12-17",
    });

    await lancamento({
      descricao: "ZZ vence depois",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-12-28",
    });

    const dezembro = await painel();

    expect(dezembro.atrasadoAReceberCentavos).toBe(0);
    expect(dezembro.quantasAtrasadasAReceber).toBe(0);
  });

  it("conta paga não está em atraso, mesmo tendo vencido antes", async () => {
    await lancamento({
      descricao: "ZZ venceu e foi paga atrasada",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-10-10",
      pagoEm: "2026-11-05",
    });

    const dezembro = await painel();

    expect(dezembro.atrasadoAReceberCentavos).toBe(0);
  });
});

describe("por categoria, e a evolução", () => {
  it("agrupa por categoria, do maior para o menor, com a contagem", async () => {
    await lancamento({
      descricao: "ZZ energia",
      valor: "400,00",
      slug: "energia",
      vencimento: "2026-12-05",
      pagoEm: "2026-12-05",
    });

    await lancamento({
      descricao: "ZZ internet",
      valor: "200,00",
      slug: "internet",
      vencimento: "2026-12-05",
      pagoEm: "2026-12-05",
    });

    await lancamento({
      descricao: "ZZ internet 2",
      valor: "100,00",
      slug: "internet",
      vencimento: "2026-12-06",
      pagoEm: "2026-12-06",
    });

    const dezembro = await painel();

    expect(dezembro.saidasPorCategoria).toHaveLength(2);
    // Energia (R$ 400) vem antes de Internet (R$ 300).
    expect(dezembro.saidasPorCategoria[0]?.categoria).toBe("Energia");
    expect(dezembro.saidasPorCategoria[0]?.centavos).toBe(40_000);
    expect(dezembro.saidasPorCategoria[0]?.quantas).toBe(1);
    expect(dezembro.saidasPorCategoria[1]?.centavos).toBe(30_000);
    expect(dezembro.saidasPorCategoria[1]?.quantas).toBe(2);
  });

  it("entrada e saída não se misturam no agrupamento", async () => {
    await lancamento({
      descricao: "ZZ mensalidade",
      valor: "1000,00",
      slug: "mensalidades",
      vencimento: "2026-12-05",
      pagoEm: "2026-12-05",
    });

    await lancamento({
      descricao: "ZZ energia",
      valor: "400,00",
      slug: "energia",
      vencimento: "2026-12-05",
      pagoEm: "2026-12-05",
    });

    const dezembro = await painel();

    expect(dezembro.entradasPorCategoria.map((f) => f.categoria)).toEqual([
      "Mensalidades",
    ]);
    expect(dezembro.saidasPorCategoria.map((f) => f.categoria)).toEqual(["Energia"]);
  });

  /**
   * A EVOLUÇÃO TERMINA NO MÊS ESCOLHIDO, e a série é contínua.
   *
   * Mês sem movimento aparece com zero, e não some da lista: um buraco no meio
   * do gráfico faria o olho ler a tendência errada.
   */
  it("a série vai até o mês escolhido, com os meses vazios em zero", async () => {
    await lancamento({
      descricao: "ZZ de outubro",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-10-10",
      pagoEm: "2026-10-10",
    });

    await lancamento({
      descricao: "ZZ de dezembro",
      valor: "300,00",
      slug: "mensalidades",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    const dezembro = await painel();

    expect(dezembro.evolucao).toHaveLength(6);
    expect(dezembro.evolucao.at(-1)?.competencia).toBe("2026-12");
    expect(dezembro.evolucao.at(0)?.competencia).toBe("2026-07");

    const outubro = dezembro.evolucao.find((m) => m.competencia === "2026-10");
    const novembro = dezembro.evolucao.find((m) => m.competencia === "2026-11");

    expect(outubro?.entradasCentavos).toBe(10_000);
    // Novembro não teve movimento, e aparece com zero em vez de faltar.
    expect(novembro?.entradasCentavos).toBe(0);
  });

  it("a virada do ano não quebra a série", async () => {
    const janeiro = await montarPainelFinanceiro({
      competencia: "2027-01",
      agora: AGORA,
    });

    if (!janeiro.ok) throw new Error("deveria montar");

    expect(janeiro.dados.competenciaAnterior).toBe("2026-12");
    expect(janeiro.dados.evolucao.at(0)?.competencia).toBe("2026-08");
    expect(janeiro.dados.evolucao.at(-1)?.competencia).toBe("2027-01");
  });
});

describe("a projeção é do que VENCE à frente", () => {
  it("mostra o pendente dos próximos meses, separado", async () => {
    await lancamento({
      descricao: "ZZ mensalidade de janeiro",
      valor: "2400,00",
      slug: "mensalidades",
      vencimento: "2027-01-10",
    });

    await lancamento({
      descricao: "ZZ aluguel de janeiro",
      valor: "3500,00",
      slug: "aluguel",
      vencimento: "2027-01-05",
    });

    const dezembro = await painel();
    const janeiro = dezembro.projecao.find((m) => m.competencia === "2027-01");

    expect(janeiro?.aReceberCentavos).toBe(240_000);
    expect(janeiro?.aPagarCentavos).toBe(350_000);
  });

  /**
   * O QUE JÁ FOI PAGO NÃO É PREVISÃO.
   *
   * Uma conta de janeiro já paga em dezembro não precisa mais ser prevista — ela
   * já está no caixa. Contá-la nos dois lugares faria o mesmo dinheiro aparecer
   * duas vezes na mesma tela.
   */
  it("o que já foi pago sai da projeção", async () => {
    await lancamento({
      descricao: "ZZ janeiro adiantado",
      valor: "2400,00",
      slug: "mensalidades",
      vencimento: "2027-01-10",
      pagoEm: "2026-12-15",
    });

    const dezembro = await painel();
    const janeiro = dezembro.projecao.find((m) => m.competencia === "2027-01");

    expect(janeiro?.aReceberCentavos).toBe(0);
    // E ele entrou no caixa de dezembro, que é onde o dinheiro se mexeu.
    expect(dezembro.entradasCentavos).toBe(240_000);
  });

  it("a projeção começa no mês SEGUINTE, não no escolhido", async () => {
    await lancamento({
      descricao: "ZZ pendente de dezembro",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-12-28",
    });

    const dezembro = await painel();

    expect(dezembro.projecao.map((m) => m.competencia)).toEqual([
      "2027-01",
      "2027-02",
      "2027-03",
    ]);
  });
});

describe("o painel é só leitura", () => {
  /**
   * MONTAR O PAINEL NÃO MEXE EM NADA.
   *
   * Mesma regra do dashboard de relatórios. Sem este teste, bastaria alguém
   * acrescentar um "marcar como atrasado" na montagem para a tela de leitura
   * passar a escrever — e ninguém notaria até um número mudar sozinho.
   */
  it("montar o painel não altera lançamento nenhum", async () => {
    await lancamento({
      descricao: "ZZ intacta",
      valor: "430,25",
      slug: "energia",
      vencimento: "2026-10-10",
    });

    const antes = await bancoDeTeste.lancamento.findMany({
      orderBy: { criadoEm: "asc" },
    });

    await painel();
    await painel("2026-10");

    const depois = await bancoDeTeste.lancamento.findMany({
      orderBy: { criadoEm: "asc" },
    });

    expect(depois).toEqual(antes);
  });

  it("mês escrito errado é recusado", async () => {
    for (const competencia of ["2026-13", "2026", "dezembro"]) {
      const feito = await montarPainelFinanceiro({ competencia, agora: AGORA });

      expect(feito.ok).toBe(false);
      if (feito.ok) throw new Error(`deveria recusar ${competencia}`);
      expect(feito.falha.codigo).toBe("COMPETENCIA_INVALIDA");
    }
  });
});

describe("a soma é em centavos", () => {
  /**
   * Três contas de R$ 33,33 precisam dar R$ 99,99 — em ponto flutuante dariam
   * R$ 99,990000000000009, e um painel com um centavo de diferença faz a equipe
   * desconfiar do número inteiro.
   */
  it("três de R$ 33,33 dão R$ 99,99 em todos os números", async () => {
    for (let i = 0; i < 3; i += 1) {
      await lancamento({
        descricao: `ZZ terço ${i + 1}`,
        valor: "33,33",
        slug: "mensalidades",
        vencimento: "2026-12-10",
        pagoEm: "2026-12-10",
      });
    }

    const dezembro = await painel();

    expect(dezembro.entradasCentavos).toBe(9_999);
    expect(dezembro.resultadoCentavos).toBe(9_999);
    expect(dezembro.entradasPorCategoria[0]?.centavos).toBe(9_999);
    expect(dezembro.evolucao.at(-1)?.entradasCentavos).toBe(9_999);
    // E o número é inteiro: centavo não tem fração.
    expect(Number.isInteger(dezembro.entradasCentavos)).toBe(true);
  });

  it("o lado de cada linha vem da categoria, nunca do sinal do valor", async () => {
    await lancamento({
      descricao: "ZZ entrada",
      valor: "100,00",
      slug: "mensalidades",
      vencimento: "2026-12-10",
      pagoEm: "2026-12-10",
    });

    const categoriaDeEntrada = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow(
      { where: { slug: "mensalidades" }, select: { tipo: true } },
    );

    expect(categoriaDeEntrada.tipo).toBe(TipoDeLancamento.ENTRADA);

    const dezembro = await painel();

    expect(dezembro.entradasCentavos).toBe(10_000);
    expect(dezembro.saidasCentavos).toBe(0);
  });
});
