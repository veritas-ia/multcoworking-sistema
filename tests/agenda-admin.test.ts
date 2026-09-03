/**
 * AGENDA DA RECEPCAO (Fase 8).
 *
 * O que estes testes protegem:
 *  1. a recepcao ignora as travas COMERCIAIS (3 por telefone, antecedencia
 *     minima, duracao) mas NAO escapa das travas de INTEGRIDADE (sobreposicao
 *     e intervalo de 30 min);
 *  2. o admin cancela e remarca dentro das 12h, onde o cliente nao consegue;
 *  3. toda acao do admin fica registrada no historico, com nome de quem fez;
 *  4. as rotas da agenda exigem sessao de admin.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getAgenda } from "@/app/api/admin/agenda/route";
import { POST as postCancelarAdmin } from "@/app/api/admin/reservas/[id]/cancelar/route";
import { POST as postReagendarAdmin } from "@/app/api/admin/reservas/[id]/reagendar/route";
import {
  GET as getReserva,
  PATCH as patchReserva,
} from "@/app/api/admin/reservas/[id]/route";
import { POST as postReservaAdmin } from "@/app/api/admin/reservas/route";
import { POST as postCancelarCliente } from "@/app/api/publico/minhas-reservas/[id]/cancelar/route";
import { OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import { validarReserva } from "@/lib/disponibilidade";
import { MAXIMO_DE_RESERVAS_ATIVAS } from "@/lib/reservas";
import { COOKIE_SESSAO, criarSessao } from "@/lib/sessao-cliente";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";
import { aguardarEnviosPendentes } from "@/lib/whatsapp";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

const SEGUNDA = "2026-10-05";
const TERCA = "2026-10-06";
const QUARTA = "2026-10-07";

const CLIENTE = "+5511900000030";
const OPERADOR = "recepcao.teste";

let salaCI: string;
let salaContainer: string;
let operadorId: string;

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
  await bancoDeTeste.logMensagem.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.sessaoCliente.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: OPERADOR } });
}

beforeEach(async () => {
  await limpar();

  const criado = await bancoDeTeste.usuario.create({
    data: {
      nome: "Joana da Recepção",
      usuario: OPERADOR,
      senhaHash: await bcrypt.hash("nao-importa-aqui", 10),
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

async function cookieAdmin(): Promise<string> {
  return `${COOKIE_ADMIN}=${await assinarToken(operadorId)}`;
}

const rota = (id: string) => ({ params: Promise.resolve({ id }) });

async function criarPelaRecepcao(entrada: {
  data: string;
  inicio: string;
  fim: string;
  salaId?: string;
}) {
  return postReservaAdmin(
    pedidoPost(
      "/api/admin/reservas",
      {
        salaId: entrada.salaId ?? salaCI,
        telefone: CLIENTE,
        nome: "Cliente do Balcão",
        data: entrada.data,
        inicio: entrada.inicio,
        fim: entrada.fim,
      },
      { cookie: await cookieAdmin() },
    ),
  );
}

/** Cria uma reserva direto no banco, para montar cenario. */
async function reservaNoBanco(entrada: {
  data: string;
  inicio: string;
  fim: string;
  salaId?: string;
}): Promise<string> {
  const inicio = instanteDe(entrada.data, entrada.inicio);
  const fim = instanteDe(entrada.data, entrada.fim);

  const reserva = await bancoDeTeste.reserva.create({
    data: {
      salaId: entrada.salaId ?? salaCI,
      nomeCliente: "Cliente de Teste",
      telefone: CLIENTE,
      inicio,
      fim,
      duracaoMinutos: Math.round((fim.getTime() - inicio.getTime()) / 60_000),
      valor: "50.00",
      status: StatusReserva.CONFIRMADA,
      origem: OrigemReserva.PUBLICO,
    },
    select: { id: true },
  });

  return reserva.id;
}

// =============================================================================
// 1. As rotas exigem sessao de admin
// =============================================================================

describe("as rotas da agenda exigem sessao de admin", () => {
  it("sem cookie nenhum, tudo responde 401", async () => {
    const semSessao = [
      await getAgenda(pedidoGet("/api/admin/agenda", { de: SEGUNDA, ate: SEGUNDA })),
      await postReservaAdmin(pedidoPost("/api/admin/reservas", {})),
      await getReserva(pedidoGet("/api/admin/reservas/qualquer"), rota("qualquer")),
      await patchReserva(pedidoPost("/api/admin/reservas/qualquer", {}), rota("qualquer")),
      await postCancelarAdmin(
        pedidoPost("/api/admin/reservas/qualquer/cancelar", {}),
        rota("qualquer"),
      ),
      await postReagendarAdmin(
        pedidoPost("/api/admin/reservas/qualquer/reagendar", {}),
        rota("qualquer"),
      ),
    ];

    for (const resposta of semSessao) {
      expect(resposta.status).toBe(401);
    }
  });

  it("a sessao de CLIENTE nao serve para a agenda do painel", async () => {
    const sessao = await criarSessao(CLIENTE);
    const cookie = `${COOKIE_SESSAO}=${sessao.token}`;

    const agenda = await getAgenda(
      pedidoGet("/api/admin/agenda", { de: SEGUNDA, ate: SEGUNDA }, { cookie }),
    );
    expect(agenda.status).toBe(401);

    const criar = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", { salaId: salaCI }, { cookie }),
    );
    expect(criar.status).toBe(401);
  });

  it("admin apagado do banco perde acesso mesmo com o cookie no prazo", async () => {
    const cookie = await cookieAdmin();
    await bancoDeTeste.usuario.delete({ where: { id: operadorId } });

    const resposta = await getAgenda(
      pedidoGet("/api/admin/agenda", { de: SEGUNDA, ate: SEGUNDA }, { cookie }),
    );

    expect(resposta.status).toBe(401);
  });
});

// =============================================================================
// 2. Criar pela recepcao: o que cai e o que fica
// =============================================================================

describe("criar reserva pela recepcao", () => {
  it("ignora o limite de 3 reservas por telefone", async () => {
    await reservaNoBanco({ data: TERCA, inicio: "08:00", fim: "09:00" });
    await reservaNoBanco({ data: TERCA, inicio: "11:00", fim: "12:00" });
    await reservaNoBanco({ data: TERCA, inicio: "14:00", fim: "15:00" });

    const ativas = await bancoDeTeste.reserva.count({
      where: {
        telefone: CLIENTE,
        status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
        inicio: { gt: new Date() },
      },
    });
    expect(ativas).toBe(MAXIMO_DE_RESERVAS_ATIVAS);

    // O cliente seria barrado aqui. A recepcao passa.
    const resposta = await criarPelaRecepcao({
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
    });

    expect(resposta.status).toBe(201);
  });

  it("ignora a antecedencia minima de 1 hora", async () => {
    // Agora sao 09:00. As 09:30 e cedo demais para o cliente do site.
    const resposta = await criarPelaRecepcao({
      data: SEGUNDA,
      inicio: "09:30",
      fim: "10:30",
    });

    expect(resposta.status).toBe(201);
  });

  it("deixa lancar no passado, para acertar a agenda depois do fato", async () => {
    // Agora sao 09:00; esta reserva foi das 08:00 as 09:00 de hoje.
    const resposta = await criarPelaRecepcao({
      data: SEGUNDA,
      inicio: "08:00",
      fim: "09:00",
    });

    expect(resposta.status).toBe(201);
  });

  it("deixa lancar menos de 1 hora", async () => {
    const resposta = await criarPelaRecepcao({
      data: QUARTA,
      inicio: "10:00",
      fim: "10:30",
    });

    expect(resposta.status).toBe(201);
    const corpo = await resposta.json();
    expect(corpo.inicio).toBe("10:00");
    expect(corpo.fim).toBe("10:30");
  });

  it("deixa passar do teto de duracao da sala", async () => {
    const reuniao = await bancoDeTeste.sala.findUniqueOrThrow({
      where: { slug: "sala-de-reuniao" },
    });
    expect(reuniao.duracaoMaximaMinutos).toBe(120);

    // 3 horas numa sala com teto de 2: o site recusaria.
    const resposta = await criarPelaRecepcao({
      data: QUARTA,
      inicio: "09:00",
      fim: "12:00",
      salaId: reuniao.id,
    });

    expect(resposta.status).toBe(201);
  });

  it("marca a origem como ADMIN e registra quem criou", async () => {
    const corpo = await (
      await criarPelaRecepcao({ data: QUARTA, inicio: "10:00", fim: "11:00" })
    ).json();

    const reserva = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: corpo.id },
    });

    expect(reserva.origem).toBe(OrigemReserva.ADMIN);

    const historico = reserva.historicoAlteracoes as {
      acao: string;
      por: string;
      quemNome: string;
    }[];
    expect(historico).toHaveLength(1);
    expect(historico[0]).toMatchObject({
      acao: "CRIADA",
      por: "ADMIN",
      quemNome: "Joana da Recepção",
    });
  });

  // --- o que NAO cai ---------------------------------------------------------

  it("NAO escapa da trava de sobreposicao", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    const resposta = await criarPelaRecepcao({
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
    });

    expect(resposta.status).toBe(409);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "HORARIO_TOMADO" });
  });

  it("NAO escapa do intervalo de 30 min entre reservas", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    // 11:00 as 12:00 encosta na anterior: falta a folga de 30 min.
    const resposta = await criarPelaRecepcao({
      data: QUARTA,
      inicio: "11:00",
      fim: "12:00",
    });

    expect(resposta.status).not.toBe(201);

    // Com a folga, passa.
    const comFolga = await criarPelaRecepcao({
      data: QUARTA,
      inicio: "11:30",
      fim: "12:30",
    });
    expect(comFolga.status).toBe(201);
  });

  it("DEIXA marcar em dia fechado (regra mudou na Fase 9)", async () => {
    // 2026-10-09 e uma sexta, e sexta o coworking nao abre.
    //
    // Ate a Fase 8 isto era recusado. Na Fase 9 o dono do projeto liberou o
    // expediente para a recepcao: e o caso do evento pontual que a equipe
    // sabe que vai abrir. O CLIENTE continua barrado — ver tests/bloqueios.test.ts.
    const resposta = await criarPelaRecepcao({
      data: "2026-10-09",
      inicio: "10:00",
      fim: "11:00",
    });

    expect(resposta.status).toBe(201);
  });

  it("recusa telefone mal digitado", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost(
        "/api/admin/reservas",
        {
          salaId: salaCI,
          telefone: "1234",
          nome: "Fulano",
          data: QUARTA,
          inicio: "10:00",
          fim: "11:00",
        },
        { cookie: await cookieAdmin() },
      ),
    );

    expect(resposta.status).toBe(400);
  });
});

// =============================================================================
// 3. Admin age dentro das 12h
// =============================================================================

describe("admin nao tem a trava de 12h", () => {
  it("cancela uma reserva que comeca em 8 horas", async () => {
    // Agora 09:00, reserva as 17:00 de hoje: faltam 8h.
    const id = await reservaNoBanco({ data: SEGUNDA, inicio: "17:00", fim: "18:00" });

    const resposta = await postCancelarAdmin(
      pedidoPost(`/api/admin/reservas/${id}/cancelar`, {}, { cookie: await cookieAdmin() }),
      rota(id),
    );

    expect(resposta.status).toBe(200);

    const reserva = await bancoDeTeste.reserva.findUniqueOrThrow({ where: { id } });
    expect(reserva.status).toBe(StatusReserva.CANCELADA);
    expect(reserva.canceladoEm).not.toBeNull();
  });

  it("o CLIENTE continua barrado na mesma reserva", async () => {
    const id = await reservaNoBanco({ data: SEGUNDA, inicio: "17:00", fim: "18:00" });
    const sessao = await criarSessao(CLIENTE);

    // Codigo valido, so para chegar na regra das 12h.
    await bancoDeTeste.codigoVerificacao.create({
      data: {
        telefone: CLIENTE,
        codigoHash: await bcrypt.hash("123456", 10),
        expiraEm: new Date(Date.now() + 10 * 60_000),
      },
    });

    const resposta = await postCancelarCliente(
      pedidoPost(
        `/api/publico/minhas-reservas/${id}/cancelar`,
        { codigo: "123456" },
        { cookie: `${COOKIE_SESSAO}=${sessao.token}` },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(422);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "FORA_DO_PRAZO" });

    await bancoDeTeste.codigoVerificacao.deleteMany({ where: { telefone: CLIENTE } });
  });

  it("remarca dentro das 12h e pode remarcar para hoje mesmo", async () => {
    const id = await reservaNoBanco({ data: SEGUNDA, inicio: "17:00", fim: "18:00" });

    const resposta = await postReagendarAdmin(
      pedidoPost(
        `/api/admin/reservas/${id}/reagendar`,
        { salaId: salaCI, data: SEGUNDA, inicio: "14:00", fim: "15:00" },
        { cookie: await cookieAdmin() },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(200);

    const reserva = await bancoDeTeste.reserva.findUniqueOrThrow({ where: { id } });
    expect(reserva.status).toBe(StatusReserva.REAGENDADA);
    expect(reserva.inicio).toEqual(instanteDe(SEGUNDA, "14:00"));
    // Lembretes zerados, como manda o CLAUDE.md.
    expect(reserva.lembrete24hEnviadoEm).toBeNull();
  });

  it("remarcar recalcula o valor pelo preco atual da sala", async () => {
    const id = await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    const corpo = await (
      await postReagendarAdmin(
        pedidoPost(
          `/api/admin/reservas/${id}/reagendar`,
          { salaId: salaContainer, data: QUARTA, inicio: "14:00", fim: "16:00" },
          { cookie: await cookieAdmin() },
        ),
        rota(id),
      )
    ).json();

    // Sala Container: 40/h por 2h = 80.
    expect(corpo.valor).toBe("80.00");
  });

  it("nao remarca reserva ja cancelada", async () => {
    const id = await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });
    await bancoDeTeste.reserva.update({
      where: { id },
      data: { status: StatusReserva.CANCELADA, canceladoEm: new Date() },
    });

    const resposta = await postReagendarAdmin(
      pedidoPost(
        `/api/admin/reservas/${id}/reagendar`,
        { salaId: salaCI, data: QUARTA, inicio: "14:00", fim: "15:00" },
        { cookie: await cookieAdmin() },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(409);
  });
});

// =============================================================================
// 4. Historico com autor
// =============================================================================

describe("o historico registra quem fez e quando", () => {
  it("guarda o nome do admin no cancelamento", async () => {
    const id = await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    await postCancelarAdmin(
      pedidoPost(`/api/admin/reservas/${id}/cancelar`, {}, { cookie: await cookieAdmin() }),
      rota(id),
    );

    const corpo = await (
      await getReserva(
        pedidoGet(`/api/admin/reservas/${id}`, {}, { cookie: await cookieAdmin() }),
        rota(id),
      )
    ).json();

    expect(corpo.historico).toHaveLength(1);
    expect(corpo.historico[0]).toMatchObject({
      acao: "CANCELADA",
      por: "ADMIN",
      quemId: operadorId,
      quemNome: "Joana da Recepção",
    });
    expect(new Date(corpo.historico[0].em).getTime()).toBe(AGORA.getTime());
  });

  it("guarda o horario anterior no reagendamento", async () => {
    const id = await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    await postReagendarAdmin(
      pedidoPost(
        `/api/admin/reservas/${id}/reagendar`,
        { salaId: salaCI, data: QUARTA, inicio: "14:00", fim: "15:00" },
        { cookie: await cookieAdmin() },
      ),
      rota(id),
    );

    const corpo = await (
      await getReserva(
        pedidoGet(`/api/admin/reservas/${id}`, {}, { cookie: await cookieAdmin() }),
        rota(id),
      )
    ).json();

    expect(corpo.historico[0]).toMatchObject({ acao: "REAGENDADA", por: "ADMIN" });
    expect(corpo.historico[0].de.inicio).toBe(instanteDe(QUARTA, "10:00").toISOString());
    expect(corpo.historico[0].para.inicio).toBe(instanteDe(QUARTA, "14:00").toISOString());
  });

  it("editar cadastro registra quais campos mudaram e nao mexe no horario", async () => {
    const id = await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    const resposta = await patchReserva(
      pedidoPost(
        `/api/admin/reservas/${id}`,
        { nome: "Nome Corrigido", telefone: CLIENTE },
        { cookie: await cookieAdmin() },
      ),
      rota(id),
    );

    expect(resposta.status).toBe(200);

    const reserva = await bancoDeTeste.reserva.findUniqueOrThrow({ where: { id } });
    expect(reserva.nomeCliente).toBe("Nome Corrigido");
    expect(reserva.inicio).toEqual(instanteDe(QUARTA, "10:00"));
    expect(reserva.status).toBe(StatusReserva.CONFIRMADA);

    const historico = reserva.historicoAlteracoes as {
      acao: string;
      camposEditados: string[];
    }[];
    expect(historico[0]).toMatchObject({ acao: "EDITADA", camposEditados: ["nome"] });
  });

  it("editar sem mudar nada nao suja o historico", async () => {
    const id = await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    await patchReserva(
      pedidoPost(
        `/api/admin/reservas/${id}`,
        { nome: "Cliente de Teste", telefone: CLIENTE },
        { cookie: await cookieAdmin() },
      ),
      rota(id),
    );

    const reserva = await bancoDeTeste.reserva.findUniqueOrThrow({ where: { id } });
    expect(reserva.historicoAlteracoes).toEqual([]);
  });
});

// =============================================================================
// 5. Leitura da agenda
// =============================================================================

describe("leitura da agenda", () => {
  it("traz reservas e bloqueios do periodo, com telefone completo", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    const bloqueio = await bancoDeTeste.bloqueio.create({
      data: {
        salaId: salaCI,
        inicio: instanteDe(QUARTA, "15:00"),
        fim: instanteDe(QUARTA, "16:00"),
        motivo: "Manutenção do ar-condicionado",
      },
      select: { id: true },
    });

    const corpo = await (
      await getAgenda(
        pedidoGet("/api/admin/agenda", { de: QUARTA, ate: QUARTA }, { cookie: await cookieAdmin() }),
      )
    ).json();

    const reserva = corpo.itens.find((i: { tipo: string }) => i.tipo === "RESERVA");
    const bloqueado = corpo.itens.find((i: { tipo: string }) => i.tipo === "BLOQUEIO");

    // Area protegida: o telefone completo PODE aparecer aqui.
    expect(reserva.telefone).toBe(CLIENTE);
    expect(reserva.inicio).toBe("10:00");
    expect(bloqueado.motivo).toBe("Manutenção do ar-condicionado");

    await bancoDeTeste.bloqueio.delete({ where: { id: bloqueio.id } });
  });

  it("o filtro por sala funciona", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00", salaId: salaCI });
    await reservaNoBanco({
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
      salaId: salaContainer,
    });

    const corpo = await (
      await getAgenda(
        pedidoGet(
          "/api/admin/agenda",
          { de: QUARTA, ate: QUARTA, salaId: salaContainer },
          { cookie: await cookieAdmin() },
        ),
      )
    ).json();

    expect(corpo.itens).toHaveLength(1);
    expect(corpo.itens[0].salaId).toBe(salaContainer);
  });

  it("o dia final entra inteiro", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "17:00", fim: "18:00" });

    const corpo = await (
      await getAgenda(
        pedidoGet("/api/admin/agenda", { de: TERCA, ate: QUARTA }, { cookie: await cookieAdmin() }),
      )
    ).json();

    expect(corpo.itens).toHaveLength(1);
  });
});

// =============================================================================
// 6. A regra de 1 hora nao morreu — so mudou de lugar
// =============================================================================

describe("o minimo de 1 hora continua valendo para o CLIENTE", () => {
  it("o motor recusa 30 minutos no modo CLIENTE e aceita no modo ADMIN", async () => {
    const inicio = instanteDe(QUARTA, "10:00");
    const fim = instanteDe(QUARTA, "10:30");

    const comoCliente = await validarReserva({ salaId: salaCI, inicio, fim });
    expect(comoCliente.valido).toBe(false);
    expect(comoCliente.codigo).toBe("DURACAO_MINIMA");

    const comoAdmin = await validarReserva({
      salaId: salaCI,
      inicio,
      fim,
      modo: "ADMIN",
    });
    expect(comoAdmin.valido).toBe(true);
  });
});
