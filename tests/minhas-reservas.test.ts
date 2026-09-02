/**
 * AREA "MINHAS RESERVAS" (Fase 6).
 *
 * O que estes testes protegem, em ordem de importancia:
 *  1. ninguem ve nem mexe na reserva de outra pessoa;
 *  2. a regra das 12h e aplicada NO SERVIDOR — burlar a tela nao adianta;
 *  3. cancelar e reagendar exigem um codigo NOVO do WhatsApp na hora;
 *  4. cancelar devolve o horario para a agenda de verdade.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import bcrypt from "bcryptjs";

import { POST as postCancelar } from "@/app/api/publico/minhas-reservas/[id]/cancelar/route";
import { POST as postReagendar } from "@/app/api/publico/minhas-reservas/[id]/reagendar/route";
import { GET as getMinhasReservas } from "@/app/api/publico/minhas-reservas/route";
import { OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import { slotsDoDia } from "@/lib/disponibilidade";
import { COOKIE_SESSAO, criarSessao } from "@/lib/sessao-cliente";
import { instanteDe } from "@/lib/tempo";
import { aguardarEnviosPendentes } from "@/lib/whatsapp";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

const SEGUNDA = "2026-10-05";
const QUARTA = "2026-10-07";
const QUINTA = "2026-10-08";

const EU = "+5511900000010";
const OUTRA_PESSOA = "+5511900000011";

/** O codigo em texto puro que os testes digitam. */
const CODIGO = "123456";

let salaCI: string;
let salaContainer: string;

// -----------------------------------------------------------------------------

beforeAll(async () => {
  await aquecerConexao();

  const salas = await bancoDeTeste.sala.findMany({
    where: { slug: { in: ["sala-ci", "sala-container"] } },
  });
  const porSlug = new Map(salas.map((s) => [s.slug, s.id]));
  const ci = porSlug.get("sala-ci");
  const container = porSlug.get("sala-container");

  if (!ci || !container) {
    throw new Error('Salas do seed nao encontradas. Rode "npm run db:seed".');
  }

  salaCI = ci;
  salaContainer = container;
});

async function limpar(): Promise<void> {
  await aguardarEnviosPendentes();
  const telefones = { in: [EU, OUTRA_PESSOA] };
  await bancoDeTeste.logMensagem.deleteMany({ where: { telefone: telefones } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: telefones } });
  await bancoDeTeste.codigoVerificacao.deleteMany({ where: { telefone: telefones } });
  await bancoDeTeste.sessaoCliente.deleteMany({ where: { telefone: telefones } });
}

beforeEach(async () => {
  await limpar();
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
// Apoio
// -----------------------------------------------------------------------------

async function cookieDe(telefone: string): Promise<string> {
  const sessao = await criarSessao(telefone);
  return `${COOKIE_SESSAO}=${sessao.token}`;
}

/** Cria um codigo valido de verdade, com o hash que o sistema espera. */
async function codigoValidoPara(telefone: string): Promise<void> {
  await bancoDeTeste.codigoVerificacao.create({
    data: {
      telefone,
      codigoHash: await bcrypt.hash(CODIGO, 10),
      expiraEm: new Date(Date.now() + 10 * 60_000),
    },
  });
}

async function criarReserva(entrada: {
  telefone: string;
  salaId?: string;
  data: string;
  inicio: string;
  fim: string;
  status?: StatusReserva;
}): Promise<string> {
  const inicio = instanteDe(entrada.data, entrada.inicio);
  const fim = instanteDe(entrada.data, entrada.fim);

  const reserva = await bancoDeTeste.reserva.create({
    data: {
      salaId: entrada.salaId ?? salaCI,
      nomeCliente: "Cliente de Teste",
      telefone: entrada.telefone,
      inicio,
      fim,
      duracaoMinutos: Math.round((fim.getTime() - inicio.getTime()) / 60_000),
      valor: "50.00",
      status: entrada.status ?? StatusReserva.CONFIRMADA,
      // O banco exige as duas coisas juntas: quem esta CANCELADA tem de ter
      // data de cancelamento (check "reserva_cancelamento_coerente", Fase 2).
      canceladoEm:
        entrada.status === StatusReserva.CANCELADA ? new Date() : null,
      origem: OrigemReserva.PUBLICO,
    },
    select: { id: true },
  });

  return reserva.id;
}

const rota = (id: string) => ({ params: Promise.resolve({ id }) });

// =============================================================================
// 1. Cada um so ve o que e seu
// =============================================================================

describe("o cliente so ve as proprias reservas", () => {
  it("nao mostra a reserva de outro telefone", async () => {
    await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await criarReserva({
      telefone: OUTRA_PESSOA,
      salaId: salaContainer,
      data: QUARTA,
      inicio: "14:00",
      fim: "15:00",
    });

    const resposta = await getMinhasReservas(
      pedidoGet("/api/publico/minhas-reservas", {}, { cookie: await cookieDe(EU) }),
    );
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.futuras).toHaveLength(1);
    expect(corpo.futuras[0].inicio).toBe("10:00");

    // Nem o nome, nem o telefone, nem o horario da outra pessoa aparecem.
    const texto = JSON.stringify(corpo);
    expect(texto).not.toContain(OUTRA_PESSOA);
    expect(texto).not.toContain("14:00");
  });

  it("exige sessao para listar", async () => {
    const resposta = await getMinhasReservas(pedidoGet("/api/publico/minhas-reservas"));

    expect(resposta.status).toBe(401);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "SEM_SESSAO" });
  });

  it("separa futuras do historico e ordena por data", async () => {
    await criarReserva({ telefone: EU, data: QUINTA, inicio: "10:00", fim: "11:00" });
    await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await criarReserva({
      telefone: EU,
      data: QUARTA,
      inicio: "15:00",
      fim: "16:00",
      status: StatusReserva.CANCELADA,
    });

    const corpo = await (
      await getMinhasReservas(
        pedidoGet("/api/publico/minhas-reservas", {}, { cookie: await cookieDe(EU) }),
      )
    ).json();

    expect(corpo.futuras.map((r: { data: string }) => r.data)).toEqual([QUARTA, QUINTA]);
    expect(corpo.historico).toHaveLength(1);
    expect(corpo.historico[0].status).toBe("CANCELADA");
  });

  it("nao deixa cancelar a reserva de outra pessoa (responde igual a inexistente)", async () => {
    const daOutraPessoa = await criarReserva({
      telefone: OUTRA_PESSOA,
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
    });
    await codigoValidoPara(EU);

    const resposta = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${daOutraPessoa}/cancelar`, { codigo: CODIGO }, {
        cookie: await cookieDe(EU),
      }),
      rota(daOutraPessoa),
    );

    expect(resposta.status).toBe(404);

    // E ela continua de pe.
    const ainda = await bancoDeTeste.reserva.findUnique({ where: { id: daOutraPessoa } });
    expect(ainda?.status).toBe(StatusReserva.CONFIRMADA);
  });
});

// =============================================================================
// 2. A regra das 12h, aplicada no servidor
// =============================================================================

describe("regra das 12h no cancelamento", () => {
  it("cancela quando falta MAIS de 12h", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);

    const resposta = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${id}/cancelar`, { codigo: CODIGO }, {
        cookie: await cookieDe(EU),
      }),
      rota(id),
    );

    expect(resposta.status).toBe(200);

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.status).toBe(StatusReserva.CANCELADA);
    expect(reserva?.canceladoEm).not.toBeNull();
  });

  it("RECUSA quando faltam 12h ou menos, mesmo com codigo bom", async () => {
    // Reserva hoje as 17:00; agora sao 09:00 -> faltam 8h.
    const id = await criarReserva({ telefone: EU, data: SEGUNDA, inicio: "17:00", fim: "18:00" });
    await codigoValidoPara(EU);

    const resposta = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${id}/cancelar`, { codigo: CODIGO }, {
        cookie: await cookieDe(EU),
      }),
      rota(id),
    );

    expect(resposta.status).toBe(422);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "FORA_DO_PRAZO" });

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.status).toBe(StatusReserva.CONFIRMADA);
  });

  it("a lista marca podeAlterar de acordo com o prazo", async () => {
    await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await criarReserva({ telefone: EU, data: SEGUNDA, inicio: "17:00", fim: "18:00" });

    const corpo = await (
      await getMinhasReservas(
        pedidoGet("/api/publico/minhas-reservas", {}, { cookie: await cookieDe(EU) }),
      )
    ).json();

    const porData = new Map(
      corpo.futuras.map((r: { data: string; podeAlterar: boolean }) => [r.data, r.podeAlterar]),
    );

    expect(porData.get(SEGUNDA)).toBe(false); // faltam 8h
    expect(porData.get(QUARTA)).toBe(true); // faltam mais de 2 dias
    expect(corpo.janelaCancelamentoHoras).toBe(12);
  });

  it("nao cancela duas vezes", async () => {
    const id = await criarReserva({
      telefone: EU,
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
      status: StatusReserva.CANCELADA,
    });
    await codigoValidoPara(EU);

    const resposta = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${id}/cancelar`, { codigo: CODIGO }, {
        cookie: await cookieDe(EU),
      }),
      rota(id),
    );

    expect(resposta.status).toBe(409);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "JA_ENCERRADA" });
  });
});

// =============================================================================
// 3. Codigo novo do WhatsApp e obrigatorio
// =============================================================================

describe("acoes destrutivas exigem codigo novo", () => {
  it("sem codigo no pedido, recusa", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });

    const resposta = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${id}/cancelar`, {}, {
        cookie: await cookieDe(EU),
      }),
      rota(id),
    );

    expect(resposta.status).toBe(400);
    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.status).toBe(StatusReserva.CONFIRMADA);
  });

  it("codigo errado nao cancela, mesmo com a sessao de 30 dias valida", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);

    const resposta = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${id}/cancelar`, { codigo: "999999" }, {
        cookie: await cookieDe(EU),
      }),
      rota(id),
    );

    expect(resposta.status).toBe(401);
    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.status).toBe(StatusReserva.CONFIRMADA);
  });

  it("o codigo vale UMA vez: nao serve para cancelar e depois reagendar", async () => {
    const primeira = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    const segunda = await criarReserva({ telefone: EU, data: QUINTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);
    const cookie = await cookieDe(EU);

    const primeiroUso = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${primeira}/cancelar`, { codigo: CODIGO }, { cookie }),
      rota(primeira),
    );
    expect(primeiroUso.status).toBe(200);

    const segundoUso = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${segunda}/cancelar`, { codigo: CODIGO }, { cookie }),
      rota(segunda),
    );

    expect(segundoUso.status).toBe(401);
    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id: segunda } });
    expect(reserva?.status).toBe(StatusReserva.CONFIRMADA);
  });

  it("reagendar tambem exige codigo novo", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });

    const resposta = await postReagendar(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/reagendar`,
        { salaId: salaCI, data: QUINTA, inicio: "14:00", fim: "15:00" },
        { cookie: await cookieDe(EU) },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(400);

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.status).toBe(StatusReserva.CONFIRMADA);
    expect(reserva?.inicio).toEqual(instanteDe(QUARTA, "10:00"));
  });
});

// =============================================================================
// 4. Reagendamento
// =============================================================================

describe("reagendamento", () => {
  it("move a reserva, marca REAGENDADA e guarda o historico", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);

    const resposta = await postReagendar(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/reagendar`,
        { codigo: CODIGO, salaId: salaCI, data: QUINTA, inicio: "14:00", fim: "16:00" },
        { cookie: await cookieDe(EU) },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(200);

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });

    // Continua sendo a MESMA reserva.
    expect(reserva?.id).toBe(id);
    expect(reserva?.status).toBe(StatusReserva.REAGENDADA);
    expect(reserva?.inicio).toEqual(instanteDe(QUINTA, "14:00"));
    expect(reserva?.duracaoMinutos).toBe(120);

    // O horario anterior ficou registrado.
    const historico = reserva?.historicoAlteracoes as { acao: string; de?: { inicio: string } }[];
    expect(historico).toHaveLength(1);
    expect(historico[0]?.acao).toBe("REAGENDADA");
    expect(historico[0]?.de?.inicio).toBe(instanteDe(QUARTA, "10:00").toISOString());
  });

  it("recalcula o valor com o preco atual da sala", async () => {
    // Criada com valor "50.00" chumbado. Sala CI custa 50/h: 2h = 100.
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);

    const corpo = await (
      await postReagendar(
        pedidoPost(
          `/api/publico/minhas-reservas/${id}/reagendar`,
          { codigo: CODIGO, salaId: salaCI, data: QUINTA, inicio: "14:00", fim: "16:00" },
          { cookie: await cookieDe(EU) },
        ),
        rota(id),
      )
    ).json();

    expect(corpo.valorEstimado).toBe("100.00");

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.valor.toFixed(2)).toBe("100.00");
  });

  it("zera os lembretes ja enviados, para valerem no horario novo", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await bancoDeTeste.reserva.update({
      where: { id },
      data: { lembrete24hEnviadoEm: AGORA, lembrete2hEnviadoEm: AGORA },
    });
    await codigoValidoPara(EU);

    await postReagendar(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/reagendar`,
        { codigo: CODIGO, salaId: salaCI, data: QUINTA, inicio: "14:00", fim: "15:00" },
        { cookie: await cookieDe(EU) },
      ),
      rota(id),
    );

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.lembrete24hEnviadoEm).toBeNull();
    expect(reserva?.lembrete2hEnviadoEm).toBeNull();
  });

  it("deixa trocar de sala", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);

    const resposta = await postReagendar(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/reagendar`,
        { codigo: CODIGO, salaId: salaContainer, data: QUINTA, inicio: "14:00", fim: "15:00" },
        { cookie: await cookieDe(EU) },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(200);

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.salaId).toBe(salaContainer);
    // Sala Container custa 40/h: 1h = 40.
    expect(reserva?.valor.toFixed(2)).toBe("40.00");
  });

  it("nao briga com o proprio horario ao andar 30 minutos", async () => {
    // Sem o "ignore esta reserva" no motor, isto seria recusado: a reserva
    // bateria nela mesma, tanto na sobreposicao quanto no intervalo de 30 min.
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);

    const resposta = await postReagendar(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/reagendar`,
        { codigo: CODIGO, salaId: salaCI, data: QUARTA, inicio: "10:30", fim: "11:30" },
        { cookie: await cookieDe(EU) },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(200);
    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.inicio).toEqual(instanteDe(QUARTA, "10:30"));
  });

  it("RECUSA reagendar uma reserva que ja esta dentro das 12h", async () => {
    const id = await criarReserva({ telefone: EU, data: SEGUNDA, inicio: "17:00", fim: "18:00" });
    await codigoValidoPara(EU);

    const resposta = await postReagendar(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/reagendar`,
        { codigo: CODIGO, salaId: salaCI, data: QUINTA, inicio: "14:00", fim: "15:00" },
        { cookie: await cookieDe(EU) },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(422);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "FORA_DO_PRAZO" });
  });

  it("RECUSA quando o NOVO horario esta a menos de 12h", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });
    await codigoValidoPara(EU);

    const resposta = await postReagendar(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/reagendar`,
        // Hoje as 17:00: faltam 8h.
        { codigo: CODIGO, salaId: salaCI, data: SEGUNDA, inicio: "17:00", fim: "18:00" },
        { cookie: await cookieDe(EU) },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(422);
    await expect(resposta.json()).resolves.toMatchObject({
      codigo: "NOVO_HORARIO_FORA_DO_PRAZO",
    });

    const reserva = await bancoDeTeste.reserva.findUnique({ where: { id } });
    expect(reserva?.inicio).toEqual(instanteDe(QUARTA, "10:00"));
  });
});

// =============================================================================
// 5. O horario volta para a agenda
// =============================================================================

describe("cancelar devolve o horario para a agenda", () => {
  it("o bloco cancelado volta a aceitar reserva", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });

    const ocupado = await slotsDoDia(salaCI, QUARTA);
    expect(ocupado.find((b) => b.horario === "10:00")?.disponivelParaInicio).toBe(false);

    await codigoValidoPara(EU);
    const resposta = await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${id}/cancelar`, { codigo: CODIGO }, {
        cookie: await cookieDe(EU),
      }),
      rota(id),
    );
    expect(resposta.status).toBe(200);

    const livre = await slotsDoDia(salaCI, QUARTA);
    expect(livre.find((b) => b.horario === "10:00")?.disponivelParaInicio).toBe(true);
  });

  it("a trava do banco tambem solta o horario na hora", async () => {
    const id = await criarReserva({ telefone: EU, data: QUARTA, inicio: "10:00", fim: "11:00" });

    const antes = await bancoDeTeste.$queryRaw<
      { total: bigint }[]
    >`SELECT count(*) AS total FROM "ocupacao_salas" WHERE "origem_id" = ${id}`;
    expect(Number(antes[0]?.total)).toBe(1);

    await codigoValidoPara(EU);
    await postCancelar(
      pedidoPost(`/api/publico/minhas-reservas/${id}/cancelar`, { codigo: CODIGO }, {
        cookie: await cookieDe(EU),
      }),
      rota(id),
    );

    const depois = await bancoDeTeste.$queryRaw<
      { total: bigint }[]
    >`SELECT count(*) AS total FROM "ocupacao_salas" WHERE "origem_id" = ${id}`;
    expect(Number(depois[0]?.total)).toBe(0);
  });
});
