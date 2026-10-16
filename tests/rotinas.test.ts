/**
 * ROTINAS AUTOMATICAS (Fase 10).
 *
 * O que estes testes protegem:
 *  1. os lembretes saem 13h e 3h antes — nao mais 24h e 2h;
 *  2. cada lembrete sai UMA VEZ SO, mesmo rodando a rotina varias vezes;
 *  3. lembrete cujo horario ja passou vira "nao aplicavel" e nunca sai;
 *  4. reserva reagendada volta a ter direito ao lembrete no horario novo;
 *  5. as duas mensagens levam o LINK de "Minhas reservas";
 *  6. concluida so pega quem terminou; cancelada nunca vira concluida;
 *  7. a faxina so apaga o que passou do prazo;
 *  8. a CONFIRMACAO AGRUPADA: quem marca varias reservas seguidas recebe UMA
 *     mensagem com o total, e os lembretes continuam individuais.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postReagendarAdmin } from "@/app/api/admin/reservas/[id]/reagendar/route";
import { Prisma } from "@/generated/prisma/client";
import { OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import bcrypt from "bcryptjs";
import {
  faxina,
  HORAS_DO_PRIMEIRO_LEMBRETE,
  HORAS_DO_SEGUNDO_LEMBRETE,
  JANELA_MINUTOS,
  confirmacoesAgrupadas,
  variaveisDaConfirmacaoAgrupada,
  lembrete13h,
  lembrete3h,
  linkDasReservas,
  marcarConcluidas,
  passadaDeRotina,
} from "@/lib/rotinas";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";
import { aguardarEnviosPendentes, renderizarTemplate } from "@/lib/whatsapp";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoPost } from "./apoio/requisicao";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

const CLIENTE = "+5511900000060";
const OPERADOR = "rotinas.teste";

let salaCI: string;
let salaContainer: string;
let salaReuniao: string;
let operadorId: string;

beforeAll(async () => {
  await aquecerConexao();
  const salas = await bancoDeTeste.sala.findMany();
  const porSlug = new Map(salas.map((s) => [s.slug, s.id]));
  salaCI = porSlug.get("sala-ci") ?? "";
  salaContainer = porSlug.get("sala-container") ?? "";
  salaReuniao = porSlug.get("sala-de-reuniao") ?? "";

  if (!salaCI || !salaContainer || !salaReuniao) {
    throw new Error('Salas do seed nao encontradas. Rode "npm run db:seed".');
  }
});

async function limpar(): Promise<void> {
  await aguardarEnviosPendentes();
  await bancoDeTeste.logMensagem.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.codigoVerificacao.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.sessaoCliente.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.tentativaLogin.deleteMany({ where: { usuario: OPERADOR } });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: OPERADOR } });
}

beforeEach(async () => {
  await limpar();
  const criado = await bancoDeTeste.usuario.create({
    data: {
      nome: "Joana da Recepção",
      usuario: OPERADOR,
      senhaHash: await bcrypt.hash("nao-importa", 10),
    },
    select: { id: true },
  });
  operadorId = criado.id;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
});

afterEach(async () => {
  vi.useRealTimers();
  await limpar();
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

// -----------------------------------------------------------------------------

/** Cria uma reserva que comeca daqui a tantas horas. */
async function reservaDaquiA(
  horas: number,
  minutos = 0,
  salaId = salaCI,
): Promise<string> {
  const inicio = new Date(AGORA.getTime() + (horas * 60 + minutos) * 60_000);
  const fim = new Date(inicio.getTime() + 60 * 60_000);

  const reserva = await bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: "Cliente de Teste",
      telefone: CLIENTE,
      inicio,
      fim,
      duracaoMinutos: 60,
      valor: "50.00",
      status: StatusReserva.CONFIRMADA,
      origem: OrigemReserva.ADMIN,
    },
    select: { id: true },
  });

  return reserva.id;
}

async function lerReserva(id: string) {
  return bancoDeTeste.reserva.findUniqueOrThrow({ where: { id } });
}

async function mensagensEnviadas(): Promise<{ tipo: string }[]> {
  await aguardarEnviosPendentes();
  return bancoDeTeste.logMensagem.findMany({
    where: { telefone: CLIENTE },
    select: { tipo: true },
    orderBy: { criadoEm: "asc" },
  });
}

// =============================================================================
// 1. Os novos horarios: 13h e 3h
// =============================================================================

describe("os lembretes são 13h e 3h", () => {
  it("as constantes valem 13 e 3", () => {
    expect(HORAS_DO_PRIMEIRO_LEMBRETE).toBe(13);
    expect(HORAS_DO_SEGUNDO_LEMBRETE).toBe(3);
  });

  it("manda o de 13h para quem começa em 13 horas", async () => {
    const id = await reservaDaquiA(13);

    const resultado = await lembrete13h(AGORA);

    expect(resultado.enviados).toBe(1);
    expect((await lerReserva(id)).lembrete13hEnviadoEm).not.toBeNull();
    await expect(mensagensEnviadas()).resolves.toEqual([{ tipo: "lembrete_13h" }]);
  });

  it("manda o de 3h para quem começa em 3 horas", async () => {
    const id = await reservaDaquiA(3);

    const resultado = await lembrete3h(AGORA);

    expect(resultado.enviados).toBe(1);
    expect((await lerReserva(id)).lembrete3hEnviadoEm).not.toBeNull();
    await expect(mensagensEnviadas()).resolves.toEqual([{ tipo: "lembrete_3h" }]);
  });

  it("NÃO manda o de 13h para quem começa em 24 horas (o valor antigo)", async () => {
    await reservaDaquiA(24);

    const resultado = await lembrete13h(AGORA);

    expect(resultado.enviados).toBe(0);
    await expect(mensagensEnviadas()).resolves.toEqual([]);
  });

  it("NÃO manda o de 3h para quem começa em 2 horas (o valor antigo)", async () => {
    await reservaDaquiA(2);

    const resultado = await lembrete3h(AGORA);

    expect(resultado.enviados).toBe(0);
  });

  it("a janela de tolerância pega os 15 minutos de cada lado", async () => {
    // Uma sala para cada: reservas a 20 minutos de distancia nao cabem na
    // mesma sala (sobreposicao + os 30 min de intervalo).
    //
    // 12h50 e 13h10 estao DENTRO da janela (13h ± 15 min).
    // 13h20 esta FORA — passou dos 15 minutos.
    await reservaDaquiA(12, 50, salaCI);
    await reservaDaquiA(13, 10, salaContainer);
    await reservaDaquiA(13, 20, salaReuniao);

    const resultado = await lembrete13h(AGORA);

    expect(JANELA_MINUTOS).toBe(15);
    expect(resultado.enviados).toBe(2);
  });
});

// =============================================================================
// 2. Uma vez so — idempotencia
// =============================================================================

describe("cada lembrete sai uma vez só", () => {
  it("rodar a rotina três vezes seguidas manda uma mensagem só", async () => {
    await reservaDaquiA(13);

    await lembrete13h(AGORA);
    await lembrete13h(AGORA);
    await lembrete13h(AGORA);

    await expect(mensagensEnviadas()).resolves.toHaveLength(1);
  });

  it("duas passadas ao mesmo tempo não duplicam", async () => {
    await reservaDaquiA(13);

    // O "marcar primeiro" e o que segura isso: so um dos dois consegue o UPDATE.
    await Promise.all([lembrete13h(AGORA), lembrete13h(AGORA)]);

    await expect(mensagensEnviadas()).resolves.toHaveLength(1);
  });

  it("os dois lembretes são independentes", async () => {
    const id = await reservaDaquiA(13);
    await lembrete13h(AGORA);

    const depoisDo13 = await lerReserva(id);
    expect(depoisDo13.lembrete13hEnviadoEm).not.toBeNull();
    // O de 3h ainda nao saiu — a reserva so comeca em 13 horas.
    expect(depoisDo13.lembrete3hEnviadoEm).toBeNull();
    expect(depoisDo13.lembrete3hNaoAplicavel).toBe(false);
  });
});

// =============================================================================
// 3. "Nao aplicavel"
// =============================================================================

describe("lembrete cujo horário já passou", () => {
  it("vira 'não aplicável' e não é enviado", async () => {
    // Reserva daqui a 2 horas: o lembrete de 13h nunca vai poder sair.
    const id = await reservaDaquiA(2);

    const resultado = await lembrete13h(AGORA);

    expect(resultado.enviados).toBe(0);
    expect(resultado.naoAplicaveis).toBe(1);

    const reserva = await lerReserva(id);
    expect(reserva.lembrete13hNaoAplicavel).toBe(true);
    expect(reserva.lembrete13hEnviadoEm).toBeNull();
    await expect(mensagensEnviadas()).resolves.toEqual([]);
  });

  it("marcar 'não aplicável' acontece uma vez só", async () => {
    await reservaDaquiA(2);

    const primeira = await lembrete13h(AGORA);
    const segunda = await lembrete13h(AGORA);

    expect(primeira.naoAplicaveis).toBe(1);
    expect(segunda.naoAplicaveis).toBe(0);
  });

  it("reserva lançada no passado não gera lembrete nenhum", async () => {
    // A recepcao pode lancar no passado desde a Fase 8.
    const id = await reservaDaquiA(-5);

    await lembrete13h(AGORA);
    await lembrete3h(AGORA);

    const reserva = await lerReserva(id);
    expect(reserva.lembrete13hNaoAplicavel).toBe(true);
    expect(reserva.lembrete3hNaoAplicavel).toBe(true);
    await expect(mensagensEnviadas()).resolves.toEqual([]);
  });
});

// =============================================================================
// 4. Reagendamento devolve o direito ao lembrete
// =============================================================================

describe("reagendar zera os lembretes", () => {
  it("a reserva volta a ter direito ao lembrete no horário novo", async () => {
    const id = await reservaDaquiA(13);

    await lembrete13h(AGORA);
    expect((await lerReserva(id)).lembrete13hEnviadoEm).not.toBeNull();

    // A equipe remarca para daqui a tres dias.
    const resposta = await postReagendarAdmin(
      pedidoPost(
        `/api/admin/reservas/${id}/reagendar`,
        { salaId: salaCI, data: "2026-10-08", inicio: "14:00", fim: "15:00" },
        { cookie: `${COOKIE_ADMIN}=${await assinarToken(operadorId)}` },
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(resposta.status).toBe(200);

    const remarcada = await lerReserva(id);
    expect(remarcada.lembrete13hEnviadoEm).toBeNull();
    expect(remarcada.lembrete13hNaoAplicavel).toBe(false);

    // E o lembrete sai de novo, na hora certa do horario novo.
    const treseHorasAntes = new Date(
      instanteDe("2026-10-08", "14:00").getTime() - 13 * 60 * 60_000,
    );
    const resultado = await lembrete13h(treseHorasAntes);
    expect(resultado.enviados).toBe(1);
  });
});

// =============================================================================
// 5. O link de "Minhas reservas"
// =============================================================================

describe("as duas mensagens levam o link", () => {
  it("o link aponta para a área do cliente", () => {
    expect(linkDasReservas()).toMatch(/\/minhas-reservas$/);
  });

  it("os dois modelos usam a variável {{link}}", async () => {
    const modelos = await bancoDeTeste.templateMensagem.findMany({
      where: { chave: { in: ["lembrete_13h", "lembrete_3h"] } },
    });

    expect(modelos).toHaveLength(2);
    for (const modelo of modelos) {
      expect(modelo.texto).toContain("{{link}}");
    }
  });

  it("o texto final traz o endereço, sem variável por trocar", async () => {
    const modelo = await bancoDeTeste.templateMensagem.findUniqueOrThrow({
      where: { chave: "lembrete_13h" },
    });

    const texto = renderizarTemplate(modelo.texto, {
      nome: "Maria",
      sala: "Sala CI",
      data: "2026-10-06",
      inicio: "10:00",
      fim: "11:00",
      link: linkDasReservas(),
    });

    expect(texto).toContain("/minhas-reservas");
    expect(texto).not.toContain("{{");
  });
});

// =============================================================================
// 6. Marcar concluidas
// =============================================================================

describe("marcar concluídas", () => {
  it("pega quem já terminou", async () => {
    const id = await reservaDaquiA(-3); // comecou 3h atras, terminou 2h atras

    const resultado = await marcarConcluidas(AGORA);

    expect(resultado.concluidas).toBe(1);
    expect((await lerReserva(id)).status).toBe(StatusReserva.CONCLUIDA);
  });

  it("não mexe em quem ainda não terminou", async () => {
    const id = await reservaDaquiA(2);

    const resultado = await marcarConcluidas(AGORA);

    expect(resultado.concluidas).toBe(0);
    expect((await lerReserva(id)).status).toBe(StatusReserva.CONFIRMADA);
  });

  it("CANCELADA nunca vira concluída", async () => {
    const id = await reservaDaquiA(-3);
    await bancoDeTeste.reserva.update({
      where: { id },
      data: { status: StatusReserva.CANCELADA, canceladoEm: AGORA },
    });

    await marcarConcluidas(AGORA);

    expect((await lerReserva(id)).status).toBe(StatusReserva.CANCELADA);
  });

  it("rodar duas vezes não muda nada", async () => {
    await reservaDaquiA(-3);

    const primeira = await marcarConcluidas(AGORA);
    const segunda = await marcarConcluidas(AGORA);

    expect(primeira.concluidas).toBe(1);
    expect(segunda.concluidas).toBe(0);
  });

  it("REAGENDADA também é concluída quando termina", async () => {
    const id = await reservaDaquiA(-3);
    await bancoDeTeste.reserva.update({
      where: { id },
      data: { status: StatusReserva.REAGENDADA },
    });

    await marcarConcluidas(AGORA);

    expect((await lerReserva(id)).status).toBe(StatusReserva.CONCLUIDA);
  });
});


// =============================================================================
// 8. Confirmacao agrupada (16/10/2026)
// =============================================================================

describe("confirmação agrupada", () => {
  /** Reserva do SITE, com confirmacao pendente e criada ha tantos minutos. */
  async function reservaDoSite(entrada: {
    diasAFrente: number;
    valor: string;
    criadaHaMinutos: number;
    salaId?: string;
    telefone?: string;
  }): Promise<string> {
    const inicio = new Date(AGORA.getTime() + entrada.diasAFrente * 24 * 60 * 60_000);
    const fim = new Date(inicio.getTime() + 60 * 60_000);

    const reserva = await bancoDeTeste.reserva.create({
      data: {
        salaId: entrada.salaId ?? salaCI,
        nomeCliente: "Cliente de Teste",
        telefone: entrada.telefone ?? CLIENTE,
        inicio,
        fim,
        duracaoMinutos: 60,
        valor: entrada.valor,
        status: StatusReserva.CONFIRMADA,
        origem: OrigemReserva.PUBLICO,
        criadoEm: new Date(AGORA.getTime() - entrada.criadaHaMinutos * 60_000),
        confirmacaoEnviadaEm: null,
      },
      select: { id: true },
    });

    return reserva.id;
  }

  it("ESPERA enquanto a janela de 3 minutos está aberta", async () => {
    await reservaDoSite({ diasAFrente: 4, valor: "40.00", criadaHaMinutos: 1 });

    const resultado = await confirmacoesAgrupadas(AGORA);

    expect(resultado.enviados).toBe(0);
    expect(await mensagensEnviadas()).toHaveLength(0);
  });

  it("UMA reserva usa o texto de sempre", async () => {
    await reservaDoSite({ diasAFrente: 4, valor: "40.00", criadaHaMinutos: 5 });

    await confirmacoesAgrupadas(AGORA);

    const enviadas = await mensagensEnviadas();
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0]?.tipo).toBe("reserva_confirmada");
  });

  it("TRÊS reservas de dias diferentes viram UMA mensagem com o total", async () => {
    // O caso real: a cliente marcou tres de uma vez, para tres dias, e
    // recebeu tres mensagens sem nenhum total.
    await reservaDoSite({ diasAFrente: 4, valor: "40.00", criadaHaMinutos: 6 });
    await reservaDoSite({ diasAFrente: 5, valor: "75.00", criadaHaMinutos: 5, salaId: salaContainer });
    await reservaDoSite({ diasAFrente: 6, valor: "35.50", criadaHaMinutos: 4, salaId: salaReuniao });

    const resultado = await confirmacoesAgrupadas(AGORA);

    expect(resultado.enviados).toBe(1);

    const enviadas = await mensagensEnviadas();
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0]?.tipo).toBe("reservas_confirmadas");
  });

  it("a janela é DESLIZANTE: uma reserva nova segura as anteriores", async () => {
    // A primeira ja tem 6 minutos, mas a ultima tem 1: a pessoa ainda esta
    // marcando. Mandar agora quebraria a leva em duas mensagens.
    await reservaDoSite({ diasAFrente: 4, valor: "40.00", criadaHaMinutos: 6 });
    await reservaDoSite({ diasAFrente: 5, valor: "40.00", criadaHaMinutos: 1, salaId: salaContainer });

    expect((await confirmacoesAgrupadas(AGORA)).enviados).toBe(0);

    // Tres minutos depois, a janela fecha e sai UMA mensagem com as duas.
    const depois = new Date(AGORA.getTime() + 3 * 60_000);
    expect((await confirmacoesAgrupadas(depois)).enviados).toBe(1);
    expect(await mensagensEnviadas()).toHaveLength(1);
  });

  it("manda UMA VEZ SÓ, mesmo rodando a rotina de novo", async () => {
    await reservaDoSite({ diasAFrente: 4, valor: "40.00", criadaHaMinutos: 5 });
    await reservaDoSite({ diasAFrente: 5, valor: "40.00", criadaHaMinutos: 5, salaId: salaContainer });

    await confirmacoesAgrupadas(AGORA);
    await confirmacoesAgrupadas(AGORA);
    await confirmacoesAgrupadas(AGORA);

    expect(await mensagensEnviadas()).toHaveLength(1);
  });

  it("NÃO mexe nas reservas da recepção: elas já confirmaram na hora", async () => {
    await reservaDaquiA(100); // origem ADMIN

    const resultado = await confirmacoesAgrupadas(AGORA);

    expect(resultado.enviados).toBe(0);
    expect(await mensagensEnviadas()).toHaveLength(0);
  });

  it("separa por TELEFONE: duas pessoas, duas mensagens", async () => {
    const OUTRA = "+5511900000061";

    await reservaDoSite({ diasAFrente: 4, valor: "40.00", criadaHaMinutos: 5 });
    await reservaDoSite({
      diasAFrente: 5, valor: "40.00", criadaHaMinutos: 5,
      salaId: salaContainer, telefone: OUTRA,
    });

    try {
      expect((await confirmacoesAgrupadas(AGORA)).enviados).toBe(2);
    } finally {
      await aguardarEnviosPendentes();
      await bancoDeTeste.logMensagem.deleteMany({ where: { telefone: OUTRA } });
      await bancoDeTeste.reserva.deleteMany({ where: { telefone: OUTRA } });
    }
  });

  it("O TOTAL está certo e a lista tem os três dias", () => {
    // O numero que importa: se o total sair errado, sai errado em silencio —
    // a mensagem continua bonita e ninguem percebe.
    const variaveis = variaveisDaConfirmacaoAgrupada([
      {
        nomeCliente: "Maria",
        inicio: instanteDe("2026-10-20", "09:00"),
        fim: instanteDe("2026-10-20", "11:00"),
        valor: new Prisma.Decimal("40.00"),
        sala: { nome: "Sala Privativa" },
      },
      {
        nomeCliente: "Maria",
        inicio: instanteDe("2026-10-21", "14:00"),
        fim: instanteDe("2026-10-21", "16:00"),
        valor: new Prisma.Decimal("75.00"),
        sala: { nome: "Sala Container" },
      },
      {
        nomeCliente: "Maria",
        inicio: instanteDe("2026-10-22", "09:00"),
        fim: instanteDe("2026-10-22", "10:00"),
        valor: new Prisma.Decimal("35.50"),
        sala: { nome: "Sala de Reunião" },
      },
    ]);

    expect(variaveis.quantidade).toBe("3");
    // 40 + 75 + 35,50 = R$ 150,50
    expect(variaveis.valor).toBe("R$ 150,50");

    // Uma linha por reserva, com o dia de CADA uma.
    expect(variaveis.lista).toContain("20/10 (terça-feira)");
    expect(variaveis.lista).toContain("21/10 (quarta-feira)");
    expect(variaveis.lista).toContain("22/10 (quinta-feira)");
    expect(variaveis.lista?.split("\n")).toHaveLength(3);
  });

  it("soma centavos sem acumular diferença", () => {
    const tres = Array.from({ length: 3 }, () => ({
      nomeCliente: "Maria",
      inicio: instanteDe("2026-10-20", "09:00"),
      fim: instanteDe("2026-10-20", "10:00"),
      valor: new Prisma.Decimal("33.33"),
      sala: { nome: "Sala Privativa" },
    }));

    expect(variaveisDaConfirmacaoAgrupada(tres).valor).toBe("R$ 99,99");
  });

  it("os LEMBRETES continuam individuais, um por reserva", async () => {
    // O ponto que o dono fez questao: a confirmacao junta, o lembrete nao.
    // Duas reservas na janela do lembrete de 13h -> DOIS lembretes.
    await reservaDaquiA(HORAS_DO_PRIMEIRO_LEMBRETE);
    await reservaDaquiA(HORAS_DO_PRIMEIRO_LEMBRETE, 10, salaContainer);

    const resultado = await lembrete13h(AGORA);

    expect(resultado.enviados).toBe(2);
    expect(await mensagensEnviadas()).toHaveLength(2);
  });
});

// =============================================================================
// 7. Faxina
// =============================================================================

describe("faxina", () => {
  it("apaga código vencido há mais de 24h e mantém o recente", async () => {
    await bancoDeTeste.codigoVerificacao.create({
      data: {
        telefone: CLIENTE,
        codigoHash: "qualquer-coisa",
        expiraEm: new Date(AGORA.getTime() - 48 * 60 * 60_000),
      },
    });
    await bancoDeTeste.codigoVerificacao.create({
      data: {
        telefone: CLIENTE,
        codigoHash: "ainda-vale",
        expiraEm: new Date(AGORA.getTime() + 10 * 60_000),
      },
    });

    await faxina(AGORA);

    // O contador da faxina e global (pega lixo de qualquer telefone), entao a
    // conferencia e sobre as linhas DESTE teste.
    const sobraram = await bancoDeTeste.codigoVerificacao.findMany({
      where: { telefone: CLIENTE },
      select: { codigoHash: true },
    });

    expect(sobraram).toHaveLength(1);
    expect(sobraram[0]?.codigoHash).toBe("ainda-vale");
  });

  it("apaga sessão de cliente vencida e mantém a válida", async () => {
    await bancoDeTeste.sessaoCliente.create({
      data: {
        telefone: CLIENTE,
        tokenHash: `vencida-${Date.now()}`,
        expiraEm: new Date(AGORA.getTime() - 60_000),
      },
    });
    await bancoDeTeste.sessaoCliente.create({
      data: {
        telefone: CLIENTE,
        tokenHash: `valida-${Date.now()}`,
        expiraEm: new Date(AGORA.getTime() + 30 * 24 * 60 * 60_000),
      },
    });

    await faxina(AGORA);

    const sobraram = await bancoDeTeste.sessaoCliente.findMany({
      where: { telefone: CLIENTE },
      select: { tokenHash: true },
    });

    expect(sobraram).toHaveLength(1);
    expect(sobraram[0]?.tokenHash).toContain("valida-");
  });

  it("apaga tentativa de login antiga e mantém a de agora", async () => {
    await bancoDeTeste.tentativaLogin.create({
      data: {
        usuario: OPERADOR,
        sucesso: false,
        criadoEm: new Date(AGORA.getTime() - 48 * 60 * 60_000),
      },
    });
    await bancoDeTeste.tentativaLogin.create({
      data: { usuario: OPERADOR, sucesso: false, criadoEm: AGORA },
    });

    await faxina(AGORA);

    const sobraram = await bancoDeTeste.tentativaLogin.findMany({
      where: { usuario: OPERADOR },
      select: { criadoEm: true },
    });

    expect(sobraram).toHaveLength(1);
    expect(sobraram[0]?.criadoEm.getTime()).toBe(AGORA.getTime());
  });

  it("NÃO apaga logs de mensagem (decisão em aberto, item 9)", async () => {
    const reservaId = await reservaDaquiA(-100);
    await bancoDeTeste.logMensagem.create({
      data: {
        reservaId,
        telefone: CLIENTE,
        tipo: "reserva_confirmada",
        status: "ENVIADA",
        criadoEm: new Date(AGORA.getTime() - 200 * 24 * 60 * 60_000),
      },
    });

    await faxina(AGORA);

    expect(await bancoDeTeste.logMensagem.count({ where: { telefone: CLIENTE } })).toBe(1);
  });
});

// =============================================================================
// 8. A passada completa
// =============================================================================

describe("a passada de 5 em 5 minutos", () => {
  it("faz as três coisas de uma vez", async () => {
    await reservaDaquiA(13); // recebe o lembrete de 13h
    await reservaDaquiA(3); // recebe o de 3h
    await reservaDaquiA(-3); // ja terminou: vira concluida

    const resumo = await passadaDeRotina(AGORA);

    expect(resumo.lembrete13h.enviados).toBe(1);
    expect(resumo.lembrete3h.enviados).toBe(1);
    expect(resumo.concluidas).toBe(1);
  });

  it("rodar a passada duas vezes não repete nada", async () => {
    await reservaDaquiA(13);
    await reservaDaquiA(3);

    await passadaDeRotina(AGORA);
    const segunda = await passadaDeRotina(AGORA);

    expect(segunda.lembrete13h.enviados).toBe(0);
    expect(segunda.lembrete3h.enviados).toBe(0);
    await expect(mensagensEnviadas()).resolves.toHaveLength(2);
  });
});
