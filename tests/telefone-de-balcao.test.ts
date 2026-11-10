/**
 * TELEFONE DE BALCAO (29/10/2026).
 *
 * O CASO REAL, medido em producao: o telefone do atendimento comercial do
 * coworking acumulou 14 reservas de QUATRO clientes diferentes — Toca (11
 * reservas, 22,5 h), Prestare (1, 3 h), Matheus Toca (1, 1 h) e Rafael Passos
 * (1, 1,5 h). No painel aquilo virava um "cliente" so, com 28 horas, levando
 * o nome de um deles. O dono leu "Rafael Passos — 28 h" de um cliente que
 * tinha 1,5 e perguntou como poderia confiar no painel.
 *
 * O que estes testes protegem:
 *  1. sem marcacao, NADA muda — o telefone continua mandando, como sempre;
 *  2. marcado, cada NOME daquele numero vira um cliente, com as horas dele;
 *  3. a busca acha a pessoa certa dentro do numero, e nao as quatro;
 *  4. abrir um deles traz as reservas e o faturamento DELE, nao do numero;
 *  5. os OUTROS telefones continuam agrupados pelo telefone, inclusive quem
 *     escreve o proprio nome de dois jeitos — a correcao nao pode reabrir o
 *     problema dos "44 nomes para 25 telefones";
 *  6. marcar e desmarcar NAO TOCA EM RESERVA NENHUMA, e desmarcar devolve
 *     tudo exatamente como era;
 *  7. telefone torto e recusado: gravado em outro formato, ele nunca casaria
 *     com as reservas e a marcacao nao faria efeito — sem erro aparecer.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  montarDetalheDoCliente,
  montarRelatorio,
  procurarClientes,
} from "@/lib/relatorios";
import { instanteDe } from "@/lib/tempo";
import {
  desmarcarTelefoneDeBalcao,
  listarTelefonesDeBalcao,
  marcarTelefoneDeBalcao,
} from "@/lib/telefones-balcao";

import { aquecerConexao, bancoDeTeste, idDaProfissao, idDoCliente } from "./apoio/banco";

/** O numero da recepcao, em miniatura. */
const BALCAO = "+5511900000901";
/** Um cliente comum, que escreve o proprio nome de dois jeitos. */
const DA_GIOVANA = "+5511900000902";
const TELEFONES = [BALCAO, DA_GIOVANA];

const DIA = "2026-11-09";
const PERIODO = { de: DIA, ate: DIA };

let salaId: string;
let salaContainer: string;
let usuarioId: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  salaId = sala.id;

  const container = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaContainer = container.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.balcao" },
    create: { nome: "Admin de Teste", usuario: "zz.balcao", senhaHash: "x" },
    update: {},
    select: { id: true },
  });
  usuarioId = admin.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: { in: TELEFONES } } });
  await bancoDeTeste.telefoneDeBalcao.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.balcao" } });
  await bancoDeTeste.$disconnect();
});

/**
 * Uma reserva de N horas cheias, com faixa e sala proprias.
 *
 * Cada chamada ocupa uma faixa diferente do dia e alterna a sala: duas
 * reservas no mesmo horario e na mesma sala sao recusadas pelo banco, e aqui
 * o horario nao importa para nada — o que esta sendo testado e o
 * agrupamento.
 */
let proxima = 0;

async function reservaDe(telefone: string, nome: string, horas: number, valor = "40.00") {
  const inicio = 8 + proxima * 3;
  const sala = proxima % 2 === 0 ? salaId : salaContainer;
  proxima += 1;

  return bancoDeTeste.reserva.create({
    data: {
      salaId: sala,
      nomeCliente: nome,
      telefone,
      clienteId: await idDoCliente(telefone, nome),
      profissaoId: await idDaProfissao("OUTROS"),
      inicio: instanteDe(DIA, `${String(inicio).padStart(2, "0")}:00`),
      fim: instanteDe(DIA, `${String(inicio + horas).padStart(2, "0")}:00`),
      duracaoMinutos: horas * 60,
      valor,
      origem: "ADMIN",
      status: "CONCLUIDA",
      confirmacaoEnviadaEm: new Date(),
    },
  });
}

/** O caso de producao em miniatura: quatro clientes num numero so. */
async function oNumeroDaRecepcao(): Promise<void> {
  proxima = 0;
  await reservaDe(BALCAO, "Toca", 3);
  await reservaDe(BALCAO, "Prestare", 2);
  await reservaDe(BALCAO, "Rafael Passos", 1);
}

async function marcar(): Promise<void> {
  const feito = await marcarTelefoneDeBalcao(
    BALCAO,
    "Atendimento comercial do coworking",
    usuarioId,
  );
  expect(feito.ok).toBe(true);
}

// -----------------------------------------------------------------------------

describe("sem marcação, nada muda", () => {
  it("o número continua sendo um cliente só, como sempre foi", async () => {
    await oNumeroDaRecepcao();

    const relatorio = await montarRelatorio(PERIODO);
    const doNumero = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    expect(doNumero).toHaveLength(1);
    expect(doNumero[0]?.horas).toBe(6);
  });
});

describe("marcado, cada nome vira um cliente", () => {
  it("separa as horas de cada pessoa do mesmo número", async () => {
    await oNumeroDaRecepcao();
    await marcar();

    const relatorio = await montarRelatorio(PERIODO);
    const doNumero = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    expect(doNumero).toHaveLength(3);

    const porNome = new Map(doNumero.map((cliente) => [cliente.nome, cliente.horas]));
    expect(porNome.get("Toca")).toBe(3);
    expect(porNome.get("Prestare")).toBe(2);
    expect(porNome.get("Rafael Passos")).toBe(1);

    // E a soma continua sendo a mesma: nenhuma hora foi perdida no caminho.
    expect([...porNome.values()].reduce((soma, horas) => soma + horas, 0)).toBe(6);
  });

  it("cada linha vira um CADASTRO próprio, e não só um rótulo", async () => {
    // Desde a Fase 14 marcar é ação sobre os dados: quem diz quem é quem é o
    // cadastro, e um número de balcão não pode ter um cadastro só.
    await oNumeroDaRecepcao();
    await marcar();

    const relatorio = await montarRelatorio(PERIODO);
    const doNumero = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    const cadastros = new Set(doNumero.map((cliente) => cliente.clienteId));
    expect(cadastros.size).toBe(3);

    // E o telefone não é mais de ninguém: deixá-lo ligado faria a próxima
    // reserva de outra pessoa cair no cadastro de quem estava lá antes.
    const vinculo = await bancoDeTeste.telefoneDoCliente.findUnique({
      where: { telefone: BALCAO },
    });
    expect(vinculo).toBeNull();
  });

  it("junta as grafias do MESMO nome dentro do número", async () => {
    // "Toca" e "toca" sao a mesma empresa escrita de dois jeitos pela mesma
    // recepcionista; separar isso seria trocar um defeito por outro.
    proxima = 0;
    await reservaDe(BALCAO, "Toca", 2);
    await reservaDe(BALCAO, "toca", 1);
    await marcar();

    const relatorio = await montarRelatorio(PERIODO);
    const doNumero = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    expect(doNumero).toHaveLength(1);
    expect(doNumero[0]?.horas).toBe(3);
  });
});

describe("a busca acha a pessoa certa dentro do número", () => {
  it("procurar 'rafael' devolve o Rafael, e não as três pessoas", async () => {
    await oNumeroDaRecepcao();
    await marcar();

    const achados = await procurarClientes(PERIODO, "rafael");
    const doNumero = achados.filter((cliente) => cliente.telefone === BALCAO);

    expect(doNumero).toHaveLength(1);
    expect(doNumero[0]?.nome).toBe("Rafael Passos");
    expect(doNumero[0]?.horas).toBe(1);
  });

  it("procurar pelo telefone mostra as três separadas", async () => {
    // Quem digita o numero quer ver quem esta ali dentro.
    await oNumeroDaRecepcao();
    await marcar();

    const achados = await procurarClientes(PERIODO, BALCAO);

    expect(achados).toHaveLength(3);
  });
});

describe("abrir um cliente do número de balcão", () => {
  /** O cadastro de uma das pessoas do número, pelo nome dela. */
  async function cadastroChamado(nome: string): Promise<string> {
    const relatorio = await montarRelatorio(PERIODO);
    const achado = relatorio.horasPorCliente.find(
      (cliente) => cliente.telefone === BALCAO && cliente.nome === nome,
    );
    if (!achado) {
      throw new Error(`Não achei o cadastro de ${nome} no relatório.`);
    }
    return achado.clienteId;
  }

  it("traz as reservas e o faturamento DELE, não do número", async () => {
    proxima = 0;
    await reservaDe(BALCAO, "Toca", 3, "150.00");
    await reservaDe(BALCAO, "Rafael Passos", 1, "40.00");
    await marcar();

    const detalhe = await montarDetalheDoCliente(
      PERIODO,
      await cadastroChamado("Rafael Passos"),
    );

    expect(detalhe?.nome).toBe("Rafael Passos");
    expect(detalhe?.horas).toBe(1);
    expect(detalhe?.totalDeReservas).toBe(1);
    expect(detalhe?.faturamentoCentavos).toBe(4000);
  });

  it("o gráfico e o detalhe contam a MESMA coisa", async () => {
    // Dois números discordando na mesma tela é a doença que esta fase veio
    // curar. O detalhe abre pelo cadastro, igual ao gráfico agrupa.
    await oNumeroDaRecepcao();
    await marcar();

    const relatorio = await montarRelatorio(PERIODO);
    const doNumero = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    for (const noGrafico of doNumero) {
      const detalhe = await montarDetalheDoCliente(PERIODO, noGrafico.clienteId);
      expect(detalhe?.horas, `no gráfico: ${noGrafico.nome}`).toBe(noGrafico.horas);
      expect(detalhe?.nome).toBe(noGrafico.nome);
    }
  });

  it("num telefone NORMAL as grafias continuam juntas", async () => {
    // Ali o nome é só uma grafia da mesma pessoa: separar traria de volta o
    // problema dos "44 nomes para 25 telefones".
    proxima = 0;
    await reservaDe(DA_GIOVANA, "Giovana Lenharo", 2);
    await reservaDe(DA_GIOVANA, "Giovanna Lenharo", 3);

    const relatorio = await montarRelatorio(PERIODO);
    const dela = relatorio.horasPorCliente.find(
      (cliente) => cliente.telefone === DA_GIOVANA,
    );

    const detalhe = await montarDetalheDoCliente(PERIODO, dela!.clienteId);

    expect(detalhe?.horas).toBe(5);
    expect(detalhe?.totalDeReservas).toBe(2);
  });
});

describe("os outros telefones não são afetados", () => {
  it("quem escreve o nome de dois jeitos continua sendo um cliente só", async () => {
    proxima = 0;
    await reservaDe(DA_GIOVANA, "Giovana Lenharo", 2);
    await reservaDe(DA_GIOVANA, "Giovanna Lenharo", 3);
    await marcar();

    const relatorio = await montarRelatorio(PERIODO);
    const dela = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === DA_GIOVANA,
    );

    expect(dela).toHaveLength(1);
    expect(dela[0]?.horas).toBe(5);
  });
});

describe("o que marcar MUDA e o que não muda", () => {
  it("troca o CADASTRO da reserva, e NADA MAIS nela", async () => {
    // Desde a Fase 14 marcar é ação sobre os dados, e não uma lente na hora
    // de montar o relatório. O que ela mexe é o dono da reserva; horário,
    // sala, valor, nome e telefone ficam exatamente como estavam.
    const criada = await reservaDe(BALCAO, "Toca", 2);
    const antes = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });

    await marcar();

    const depois = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });

    expect(depois.clienteId).not.toBe(antes.clienteId);
    expect({ ...depois, clienteId: null, atualizadoEm: null }).toEqual({
      ...antes,
      clienteId: null,
      atualizadoEm: null,
    });
  });

  it("desmarcar NÃO junta de volta — e isso é de propósito", async () => {
    // O sistema não tem como saber que a Toca e a Prestare eram para ser a
    // mesma pessoa, e não eram. Se a marcação foi engano, a equipe junta os
    // cadastros em Configurações → Clientes, escolhendo quais.
    await oNumeroDaRecepcao();
    await marcar();

    expect(
      (await montarRelatorio(PERIODO)).horasPorCliente.filter(
        (cliente) => cliente.telefone === BALCAO,
      ),
    ).toHaveLength(3);

    await desmarcarTelefoneDeBalcao(BALCAO);

    const depois = (await montarRelatorio(PERIODO)).horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    expect(depois).toHaveLength(3);
    // Nenhuma hora se perdeu no caminho.
    expect(depois.reduce((soma, cliente) => soma + cliente.horas, 0)).toBe(6);
  });
});

describe("a marcação em si", () => {
  it("recusa telefone torto", async () => {
    // Gravado em outro formato, ele nunca casaria com as reservas: a
    // marcacao nao faria efeito nenhum e nenhum erro apareceria.
    const resultado = await marcarTelefoneDeBalcao("119000", "da recepção", usuarioId);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.falha.codigo).toBe("TELEFONE_INVALIDO");
  });

  it("exige o motivo escrito", async () => {
    // Daqui a seis meses ninguem lembra por que aquele numero foi marcado, e
    // sem explicacao a proxima pessoa desmarca "para testar".
    const resultado = await marcarTelefoneDeBalcao(BALCAO, "  ", usuarioId);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.falha.codigo).toBe("MOTIVO_VAZIO");
  });

  it("não marca o mesmo número duas vezes", async () => {
    await marcar();
    const outra = await marcarTelefoneDeBalcao(BALCAO, "de novo", usuarioId);

    expect(outra.ok).toBe(false);
    expect(outra.ok === false && outra.falha.codigo).toBe("JA_MARCADO");
  });

  it("guarda quem marcou e os nomes que o número carrega", async () => {
    await oNumeroDaRecepcao();
    await marcar();

    const lista = await listarTelefonesDeBalcao();
    const esse = lista.find((item) => item.telefone === BALCAO);

    expect(esse?.marcadoPor).toBe("Admin de Teste");
    expect(esse?.reservas).toBe(3);
    expect(esse?.pessoas.map((pessoa) => pessoa.nome)).toContain("Prestare");
  });

  it("lista QUEM está preso no número, com as horas de cada um", async () => {
    // E a lista de trabalho da recepcao: de quem ainda falta pegar o
    // telefone de verdade. Sem ela, marcar o numero esconderia o problema
    // em vez de mostra-lo.
    await oNumeroDaRecepcao();
    await marcar();

    const lista = await listarTelefonesDeBalcao();
    const esse = lista.find((item) => item.telefone === BALCAO);
    const porNome = new Map(
      (esse?.pessoas ?? []).map((pessoa) => [pessoa.nome, pessoa]),
    );

    expect(porNome.get("Toca")?.horas).toBe(3);
    expect(porNome.get("Prestare")?.horas).toBe(2);
    expect(porNome.get("Rafael Passos")?.horas).toBe(1);
    expect(porNome.get("Toca")?.reservas).toBe(1);
    // Do que mais usou para o que menos usou.
    expect(esse?.pessoas[0]?.nome).toBe("Toca");
  });

  it("a hora CANCELADA não entra, mas a reserva é contada", async () => {
    // Mesma regra do relatorio para as horas — hora desmarcada nao e hora
    // usada. A reserva conta porque ela esta nesse numero, e a tela precisa
    // mostrar a pessoa para a equipe ir atras do telefone dela.
    proxima = 0;
    await reservaDe(BALCAO, "Toca", 2);
    const cancelada = await reservaDe(BALCAO, "Toca", 3);
    await bancoDeTeste.reserva.update({
      where: { id: cancelada.id },
      // A data do cancelamento vai junto: o banco tem uma trava exigindo as
      // duas coisas, para nunca existir reserva cancelada sem saber quando.
      data: { status: "CANCELADA", canceladoEm: new Date() },
    });
    await marcar();

    const lista = await listarTelefonesDeBalcao();
    const toca = lista
      .find((item) => item.telefone === BALCAO)
      ?.pessoas.find((pessoa) => pessoa.nome === "Toca");

    expect(toca?.horas).toBe(2);
    expect(toca?.reservas).toBe(2);
  });

  it("avisa quando o número não estava marcado", async () => {
    const resultado = await desmarcarTelefoneDeBalcao(BALCAO);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.falha.codigo).toBe("NAO_MARCADO");
  });
});
