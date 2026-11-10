/**
 * FASE 14, PARTE A — o cliente vira cadastro de verdade (10/11/2026).
 *
 * Ate aqui "quem e o cliente" era adivinhado de dois campos soltos digitados
 * em cada reserva: o nome e o telefone. Dai vinham os 44 nomes para 25
 * telefones, o mesmo Rafael em dois numeros e o telefone da casa virando um
 * "cliente" com 28 horas.
 *
 * A PARTE A E INVISIVEL DE PROPOSITO: na tela nada muda. O que estes testes
 * protegem e a base ficando correta embaixo.
 *
 *  1. as TRES portas que criam reserva passam a gravar o cadastro;
 *  2. o TELEFONE manda: mesmo numero com nome diferente e UM cadastro so, e
 *     nao dois — se isso quebrar, a bagunca dos 44 nomes volta gravada no
 *     banco, e nao mais so na tela;
 *  3. telefone de BALCAO e a excecao: cada nome vira um cadastro, e o numero
 *     nao e ligado a ninguem;
 *  4. a serie recorrente resolve o cliente UMA vez, e todas as ocorrencias
 *     nascem com ele;
 *  5. um telefone pertence a NO MAXIMO um cliente — quem garante e o banco;
 *  6. o relatorio agrupa pelo CADASTRO e mostra o nome oficial dele;
 *  7. dois telefones no mesmo cadastro viram UM cliente no relatorio. E a
 *     base do caso do Rafael; a tela de juntar e a Parte B.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import { garantirCliente } from "@/lib/clientes";
import { criarSerie } from "@/lib/recorrencias";
import { montarRelatorio, procurarClientes } from "@/lib/relatorios";
import { criarReservaPublica } from "@/lib/reservas";
import { instanteDe } from "@/lib/tempo";
import { marcarTelefoneDeBalcao } from "@/lib/telefones-balcao";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";

const DELA = "+5511900001001";
const DELE = "+5511900001002";
/** O segundo número da mesma pessoa, para o caso do Rafael. */
const DELE_OUTRO = "+5511900001003";
const BALCAO = "+5511900001004";
const TELEFONES = [DELA, DELE, DELE_OUTRO, BALCAO];

/**
 * A PRÓXIMA segunda-feira, pelo menos três dias à frente.
 *
 * Calculada a partir de hoje de propósito: uma data fixa aqui passaria a
 * ficar no PASSADO com o tempo, e a reserva do site — que tem antecedência
 * mínima — começaria a ser recusada sozinha, sem nada ter quebrado. Já
 * aconteceu neste projeto.
 */
function proximaSegunda(diasDepois = 0): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + 3);
  while (data.getUTCDay() !== 1) {
    data.setUTCDate(data.getUTCDate() + 1);
  }
  data.setUTCDate(data.getUTCDate() + diasDepois);
  return data.toISOString().slice(0, 10);
}

const DIA = proximaSegunda();
const PERIODO = { de: DIA, ate: DIA };

let salaId: string;
let salaContainer: string;
let operador: { id: string; nome: string };

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-ci" },
    select: { id: true },
  });
  salaId = sala.id;

  const container = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaContainer = container.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.clientes" },
    create: { nome: "Admin de Teste", usuario: "zz.clientes", senhaHash: "x" },
    update: {},
    select: { id: true, nome: true },
  });
  operador = admin;
});

async function limpar(): Promise<void> {
  // A ORDEM IMPORTA: a reserva aponta para o cliente com ON DELETE RESTRICT.
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: { in: TELEFONES } } });
  await bancoDeTeste.telefoneDeBalcao.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
  await bancoDeTeste.telefoneDoCliente.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
  await bancoDeTeste.cliente.deleteMany({
    where: { reservas: { none: {} }, telefones: { none: {} } },
  });
  // Volta o relógio das faixas: sem isto o contador atravessa os testes e
  // estoura as 24 horas do dia.
  proxima = 8;
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.clientes" } });
  await bancoDeTeste.$disconnect();
});

/** Horas diferentes a cada chamada, para nunca esbarrar na trava do banco. */
let proxima = 8;

function faixa(): { inicio: Date; fim: Date } {
  const hora = String(proxima++).padStart(2, "0");
  return {
    inicio: instanteDe(DIA, `${hora}:00`),
    fim: instanteDe(DIA, `${String(Number(hora) + 1).padStart(2, "0")}:00`),
  };
}

async function pelaRecepcao(telefone: string, nome: string, sala = salaId) {
  const { inicio, fim } = faixa();

  return criarReservaNaRecepcao({
    salaId: sala,
    telefone,
    nomeCliente: nome,
    profissaoId: await idDaProfissao("OUTROS"),
    inicio,
    fim,
    operador,
  });
}

/** O cadastro ligado a uma reserva recém-criada. */
async function clienteDaReserva(reservaId: string) {
  const reserva = await bancoDeTeste.reserva.findUniqueOrThrow({
    where: { id: reservaId },
    select: { clienteId: true, cliente: { select: { nome: true } } },
  });
  return reserva;
}

// -----------------------------------------------------------------------------

describe("as três portas gravam o cadastro", () => {
  it("o site cria o cadastro e liga o telefone a ele", async () => {
    const { inicio, fim } = faixa();

    const resultado = await criarReservaPublica({
      salaId,
      telefone: DELA,
      nomeCliente: "Giovana Lenharo",
      profissaoId: await idDaProfissao("OUTROS"),
      inicio,
      fim,
    });

    if (!resultado.criada) {
      throw new Error(`A reserva deveria ter sido criada: ${resultado.falha.motivo}`);
    }

    const reserva = await clienteDaReserva(resultado.reservaId);
    expect(reserva.clienteId).not.toBeNull();
    expect(reserva.cliente?.nome).toBe("Giovana Lenharo");

    // E o número ficou ligado ao cadastro: é por isso que a próxima reserva
    // dele cai no mesmo cliente.
    const vinculo = await bancoDeTeste.telefoneDoCliente.findUnique({
      where: { telefone: DELA },
    });
    expect(vinculo?.clienteId).toBe(reserva.clienteId);
  });

  it("a recepção também", async () => {
    const criada = await pelaRecepcao(DELE, "Rafael dos Passos");
    expect(criada.ok).toBe(true);

    const reserva = await clienteDaReserva(
      criada.ok ? criada.dados.id : "",
    );
    expect(reserva.cliente?.nome).toBe("Rafael dos Passos");
  });

  it("a série resolve o cliente UMA vez e todas as ocorrências nascem com ele", async () => {
    const resultado = await criarSerie({
      salaId: salaContainer,
      telefone: DELA,
      nomeCliente: "Giovana Lenharo",
      profissaoId: await idDaProfissao("OUTROS"),
      empresaId: null,
      horaInicio: "08:00",
      horaFim: "09:00",
      diasDaSemana: [1],
      frequencia: "SEMANAL",
      semanaDoMes: null,
      dataInicio: DIA,
      dataFim: proximaSegunda(21),
      operador,
    });

    expect(resultado.ok).toBe(true);
    const criadas = resultado.ok ? resultado.dados.criadas : [];
    expect(criadas.length).toBeGreaterThan(1);

    const clientes = await bancoDeTeste.reserva.findMany({
      where: { id: { in: criadas.map((ocorrencia) => ocorrencia.id) } },
      select: { clienteId: true },
    });

    const distintos = new Set(clientes.map((reserva) => reserva.clienteId));
    expect(distintos.size).toBe(1);
    expect([...distintos][0]).not.toBeNull();
  });
});

describe("o telefone manda sobre o nome", () => {
  it("mesmo número com nome diferente NÃO cria um segundo cadastro", async () => {
    // Se isto quebrar, os "44 nomes para 25 telefones" voltam — e agora
    // gravados no banco, e não mais só no rótulo da tela.
    const primeira = await pelaRecepcao(DELE, "Rafael dos Passos");
    const segunda = await pelaRecepcao(DELE, "Rafael Passos", salaContainer);

    expect(primeira.ok && segunda.ok).toBe(true);

    const a = await clienteDaReserva(primeira.ok ? primeira.dados.id : "");
    const b = await clienteDaReserva(segunda.ok ? segunda.dados.id : "");

    expect(b.clienteId).toBe(a.clienteId);
    // E o nome OFICIAL continua o da primeira: a segunda não renomeia
    // ninguém pelas costas.
    expect(b.cliente?.nome).toBe("Rafael dos Passos");
  });

  it("telefones diferentes são cadastros diferentes, até alguém juntar", async () => {
    const a = await pelaRecepcao(DELE, "Rafael Passos");
    const b = await pelaRecepcao(DELE_OUTRO, "Rafael Passos", salaContainer);

    const umA = await clienteDaReserva(a.ok ? a.dados.id : "");
    const umB = await clienteDaReserva(b.ok ? b.dados.id : "");

    expect(umA.clienteId).not.toBe(umB.clienteId);
  });
});

describe("telefone de balcão é a exceção", () => {
  it("cada NOME vira um cadastro, e o número não é ligado a ninguém", async () => {
    await marcarTelefoneDeBalcao(BALCAO, "Atendimento comercial", operador.id);

    const toca = await pelaRecepcao(BALCAO, "Toca");
    const prestare = await pelaRecepcao(BALCAO, "Prestare", salaContainer);

    const umaToca = await clienteDaReserva(toca.ok ? toca.dados.id : "");
    const umaPrestare = await clienteDaReserva(
      prestare.ok ? prestare.dados.id : "",
    );

    expect(umaToca.clienteId).not.toBe(umaPrestare.clienteId);
    expect(umaToca.cliente?.nome).toBe("Toca");
    expect(umaPrestare.cliente?.nome).toBe("Prestare");

    // O NÚMERO NÃO É DE NINGUÉM. Ligá-lo faria a próxima reserva de outra
    // pessoa cair no cadastro da Toca.
    const vinculo = await bancoDeTeste.telefoneDoCliente.findUnique({
      where: { telefone: BALCAO },
    });
    expect(vinculo).toBeNull();
  });

  it("o MESMO nome no número de balcão reusa o cadastro", async () => {
    // "Toca" e "toca" são a mesma empresa escrita de dois jeitos pela mesma
    // recepcionista; separar isso seria trocar um defeito por outro.
    await marcarTelefoneDeBalcao(BALCAO, "Atendimento comercial", operador.id);

    const uma = await pelaRecepcao(BALCAO, "Toca");
    const outra = await pelaRecepcao(BALCAO, "toca", salaContainer);

    const a = await clienteDaReserva(uma.ok ? uma.dados.id : "");
    const b = await clienteDaReserva(outra.ok ? outra.dados.id : "");

    expect(b.clienteId).toBe(a.clienteId);
  });
});

describe("o banco é quem garante", () => {
  it("um telefone não pertence a dois clientes", async () => {
    // Sem isto o mesmo número somaria em dois cadastros e o faturamento
    // apareceria dobrado, sem ninguém desconfiar do número.
    await pelaRecepcao(DELE, "Rafael Passos");

    const outro = await bancoDeTeste.cliente.create({
      data: { nome: "Outra Pessoa" },
      select: { id: true },
    });

    await expect(
      bancoDeTeste.telefoneDoCliente.create({
        data: { telefone: DELE, clienteId: outro.id },
      }),
    ).rejects.toThrow();

    await bancoDeTeste.cliente.delete({ where: { id: outro.id } });
  });

  it("cliente com reserva não pode ser apagado", async () => {
    const criada = await pelaRecepcao(DELE, "Rafael Passos");
    const reserva = await clienteDaReserva(criada.ok ? criada.dados.id : "");

    await expect(
      bancoDeTeste.cliente.delete({ where: { id: reserva.clienteId! } }),
    ).rejects.toThrow();
  });
});

describe("o relatório passa a agrupar pelo cadastro", () => {
  it("mostra o nome OFICIAL, e não o escrito na reserva", async () => {
    // O nome oficial não depende do período escolhido na tela, que era o
    // problema do rótulo até aqui.
    const criada = await pelaRecepcao(DELE, "Rafael dos Passos");
    const reserva = await clienteDaReserva(criada.ok ? criada.dados.id : "");

    await bancoDeTeste.cliente.update({
      where: { id: reserva.clienteId! },
      data: { nome: "Rafael Passos (oficial)" },
    });

    const relatorio = await montarRelatorio(PERIODO);
    const dele = relatorio.horasPorCliente.find(
      (cliente) => cliente.telefone === DELE,
    );

    expect(dele?.nome).toBe("Rafael Passos (oficial)");
  });

  it("DOIS TELEFONES no mesmo cadastro viram UM cliente", async () => {
    // É o caso do Rafael, que o sistema nunca conseguiu resolver. A tela de
    // juntar é a Parte B; aqui se prova que a base já aguenta.
    const a = await pelaRecepcao(DELE, "Rafael dos Passos");
    await pelaRecepcao(DELE_OUTRO, "Rafael Passos", salaContainer);

    const doPrimeiro = await clienteDaReserva(a.ok ? a.dados.id : "");

    // Junta na mão o que a Parte B vai fazer por botão.
    await bancoDeTeste.reserva.updateMany({
      where: { telefone: DELE_OUTRO },
      data: { clienteId: doPrimeiro.clienteId },
    });

    const relatorio = await montarRelatorio(PERIODO);
    const doRafael = relatorio.horasPorCliente.filter((cliente) =>
      [DELE, DELE_OUTRO].includes(cliente.telefone),
    );

    expect(doRafael).toHaveLength(1);
    expect(doRafael[0]?.horas).toBe(2);
  });

  it("a busca acha pelo nome oficial e pelo escrito na reserva", async () => {
    const criada = await pelaRecepcao(DELE, "Rafael dos Passos");
    const reserva = await clienteDaReserva(criada.ok ? criada.dados.id : "");

    await bancoDeTeste.cliente.update({
      where: { id: reserva.clienteId! },
      data: { nome: "Zoroastro Oficial" },
    });

    const peloOficial = await procurarClientes(PERIODO, "zoroastro");
    const peloEscrito = await procurarClientes(PERIODO, "passos");

    expect(peloOficial.map((cliente) => cliente.telefone)).toContain(DELE);
    expect(peloEscrito.map((cliente) => cliente.telefone)).toContain(DELE);
  });
});

describe("a recepção escolhe o cadastro (Fase 14, parte C)", () => {
  it("cadastro SEM telefone ganha o número que a recepção acabou de conseguir", async () => {
    // O caso do "Miguel": ele só existia porque alguém lançou uma reserva no
    // telefone do balcão. Agora a recepção conseguiu o número dele, escolhe o
    // cadastro na busca e digita o telefone — e os dois ficam ligados.
    await marcarTelefoneDeBalcao(BALCAO, "Atendimento comercial", operador.id);

    const noBalcao = await pelaRecepcao(BALCAO, "Miguel");
    const miguel = await clienteDaReserva(noBalcao.ok ? noBalcao.dados.id : "");

    // Antes: o cadastro existe e não tem telefone nenhum.
    expect(
      await bancoDeTeste.telefoneDoCliente.count({
        where: { clienteId: miguel.clienteId! },
      }),
    ).toBe(0);

    const { inicio, fim } = faixa();
    const agora = await criarReservaNaRecepcao({
      salaId: salaContainer,
      telefone: DELE,
      nomeCliente: "Miguel",
      clienteId: miguel.clienteId,
      profissaoId: await idDaProfissao("OUTROS"),
      inicio,
      fim,
      operador,
    });

    expect(agora.ok).toBe(true);

    const nova = await clienteDaReserva(agora.ok ? agora.dados.id : "");
    expect(nova.clienteId).toBe(miguel.clienteId);

    // E o número ficou ligado: a PRÓXIMA reserva dele cai no mesmo cadastro
    // sozinha, sem ninguém escolher nada.
    const vinculo = await bancoDeTeste.telefoneDoCliente.findUnique({
      where: { telefone: DELE },
    });
    expect(vinculo?.clienteId).toBe(miguel.clienteId);
  });

  it("recusa ligar um telefone que já é de OUTRO cadastro", async () => {
    // Deixar passar ligaria o número de alguém ao cliente errado — e dali em
    // diante TODAS as reservas daquele número cairiam na conta errada, sem
    // ninguém desconfiar.
    const daOutra = await pelaRecepcao(DELA, "Giovana Lenharo");
    const outra = await clienteDaReserva(daOutra.ok ? daOutra.dados.id : "");

    const doRafael = await pelaRecepcao(DELE, "Rafael Passos", salaContainer);
    const rafael = await clienteDaReserva(doRafael.ok ? doRafael.dados.id : "");

    const { inicio, fim } = faixa();
    const tentativa = await criarReservaNaRecepcao({
      salaId: salaId,
      // O telefone da Giovana, com o cadastro do Rafael escolhido.
      telefone: DELA,
      nomeCliente: "Rafael Passos",
      clienteId: rafael.clienteId,
      profissaoId: await idDaProfissao("OUTROS"),
      inicio,
      fim,
      operador,
    });

    expect(tentativa.ok).toBe(false);
    expect(tentativa.ok === false && tentativa.falha.motivo).toContain(
      "Giovana Lenharo",
    );

    // E nada mudou: o telefone continua sendo dela.
    const vinculo = await bancoDeTeste.telefoneDoCliente.findUnique({
      where: { telefone: DELA },
    });
    expect(vinculo?.clienteId).toBe(outra.clienteId);
  });

  it("escolher o cadastro de um telefone que já é dele não muda nada", async () => {
    const primeira = await pelaRecepcao(DELE, "Rafael dos Passos");
    const dele = await clienteDaReserva(primeira.ok ? primeira.dados.id : "");

    const { inicio, fim } = faixa();
    const segunda = await criarReservaNaRecepcao({
      salaId: salaContainer,
      telefone: DELE,
      nomeCliente: "Rafael Passos",
      clienteId: dele.clienteId,
      profissaoId: await idDaProfissao("OUTROS"),
      inicio,
      fim,
      operador,
    });

    const nova = await clienteDaReserva(segunda.ok ? segunda.dados.id : "");
    expect(nova.clienteId).toBe(dele.clienteId);

    // Um telefone, um vínculo: nada foi duplicado.
    expect(
      await bancoDeTeste.telefoneDoCliente.count({ where: { telefone: DELE } }),
    ).toBe(1);
  });
});

describe("garantirCliente chamada direto", () => {
  it("devolve sempre o mesmo cadastro para o mesmo telefone", async () => {
    const um = await garantirCliente({ telefone: DELA, nome: "Giovana" });
    const dois = await garantirCliente({ telefone: DELA, nome: "Giovanna" });

    expect(dois).toBe(um);
  });
});
