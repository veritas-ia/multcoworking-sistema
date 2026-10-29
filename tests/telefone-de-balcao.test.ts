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

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";

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
    expect(doNumero[0]?.separadoPorNome).toBe(false);
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

  it("avisa a tela que esta linha é um nome, e não o número inteiro", async () => {
    // Sem este aviso a tela abriria o cliente so pelo telefone, e traria as
    // reservas das tres pessoas somadas.
    await oNumeroDaRecepcao();
    await marcar();

    const relatorio = await montarRelatorio(PERIODO);
    const doNumero = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    expect(doNumero.every((cliente) => cliente.separadoPorNome)).toBe(true);
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
  it("traz as reservas e o faturamento DELE, não do número", async () => {
    proxima = 0;
    await reservaDe(BALCAO, "Toca", 3, "150.00");
    await reservaDe(BALCAO, "Rafael Passos", 1, "40.00");
    await marcar();

    const detalhe = await montarDetalheDoCliente(PERIODO, BALCAO, "Rafael Passos");

    expect(detalhe?.nome).toBe("Rafael Passos");
    expect(detalhe?.horas).toBe(1);
    expect(detalhe?.totalDeReservas).toBe(1);
    expect(detalhe?.faturamentoCentavos).toBe(4000);
  });

  it("sem o nome, ainda traz o número inteiro", async () => {
    // A tela manda o nome quando a linha veio separada. Nao mandar nao pode
    // quebrar nada: continua valendo o comportamento antigo.
    await oNumeroDaRecepcao();
    await marcar();

    const detalhe = await montarDetalheDoCliente(PERIODO, BALCAO);

    expect(detalhe?.totalDeReservas).toBe(3);
  });

  it("num telefone NORMAL o nome é ignorado", async () => {
    // Ali o nome e so uma grafia da mesma pessoa: filtrar por ele traria de
    // volta o defeito que a busca tinha, de somar so o que batia com o nome.
    proxima = 0;
    await reservaDe(DA_GIOVANA, "Giovana Lenharo", 2);
    await reservaDe(DA_GIOVANA, "Giovanna Lenharo", 3);

    const detalhe = await montarDetalheDoCliente(
      PERIODO,
      DA_GIOVANA,
      "Giovana Lenharo",
    );

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
    expect(dela[0]?.separadoPorNome).toBe(false);
  });
});

describe("marcar e desmarcar não tocam em reserva nenhuma", () => {
  it("a linha da reserva fica intacta, antes e depois", async () => {
    const criada = await reservaDe(BALCAO, "Toca", 2);
    const antes = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });

    await marcar();
    await desmarcarTelefoneDeBalcao(BALCAO);

    const depois = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });

    expect(depois).toEqual(antes);
  });

  it("desmarcar devolve o agrupamento como era", async () => {
    await oNumeroDaRecepcao();
    await marcar();

    expect(
      (await montarRelatorio(PERIODO)).horasPorCliente.filter(
        (cliente) => cliente.telefone === BALCAO,
      ),
    ).toHaveLength(3);

    await desmarcarTelefoneDeBalcao(BALCAO);

    const voltou = (await montarRelatorio(PERIODO)).horasPorCliente.filter(
      (cliente) => cliente.telefone === BALCAO,
    );

    expect(voltou).toHaveLength(1);
    expect(voltou[0]?.horas).toBe(6);
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
    expect(esse?.nomes).toContain("Prestare");
  });

  it("avisa quando o número não estava marcado", async () => {
    const resultado = await desmarcarTelefoneDeBalcao(BALCAO);

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.falha.codigo).toBe("NAO_MARCADO");
  });
});
