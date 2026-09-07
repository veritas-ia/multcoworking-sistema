/**
 * BLOQUEIOS ADMINISTRATIVOS (Fase 9, parte 1).
 *
 * O que estes testes protegem:
 *  1. bloqueio NAO exige o intervalo de 30 min — uma reserva pode comecar no
 *     minuto exato em que o bloqueio termina (decisao do CLAUDE.md);
 *  2. o publico ve "indisponivel", NUNCA o motivo do bloqueio;
 *  3. bloqueio em cima de reserva ativa e barrado, com a lista de quem
 *     atrapalha, ate a equipe resolver;
 *  4. a recepcao lanca em dia fechado, o cliente nao;
 *  5. o feriado em varias salas sai junto e pode ser removido junto.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getBloqueio, DELETE as deleteBloqueio, PATCH as patchBloqueio } from "@/app/api/admin/bloqueios/[id]/route";
import { GET as conferirBloqueio, POST as postBloqueio } from "@/app/api/admin/bloqueios/route";
import { POST as postReservaAdmin } from "@/app/api/admin/reservas/route";
import { GET as getDisponibilidade } from "@/app/api/publico/disponibilidade/route";
import { OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import { validarReserva } from "@/lib/disponibilidade";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";
import { aguardarEnviosPendentes } from "@/lib/whatsapp";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

const QUARTA = "2026-10-07";
/** Um dia FECHADO. Era a sexta; desde a ampliacao do expediente, e o domingo. */
const SEXTA_FECHADA = "2026-10-11";
const CLIENTE = "+5511900000040";
const OPERADOR = "bloqueios.teste";
const MOTIVO_SECRETO = "Dedetização — não contar ao cliente";

let salaCI: string;
let salaContainer: string;
let salaReuniao: string;
let operadorId: string;

beforeAll(async () => {
  await aquecerConexao();

  const salas = await bancoDeTeste.sala.findMany();
  const porSlug = new Map(salas.map((s) => [s.slug, s.id]));
  const ci = porSlug.get("sala-ci");
  const container = porSlug.get("sala-container");
  const reuniao = porSlug.get("sala-de-reuniao");

  if (!ci || !container || !reuniao) {
    throw new Error('Salas do seed nao encontradas. Rode "npm run db:seed".');
  }

  salaCI = ci;
  salaContainer = container;
  salaReuniao = reuniao;
});

async function limpar(): Promise<void> {
  await aguardarEnviosPendentes();
  await bancoDeTeste.logMensagem.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.bloqueio.deleteMany({
    where: { OR: [{ motivo: { contains: "teste" } }, { motivo: MOTIVO_SECRETO }] },
  });
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

async function cookieAdmin(): Promise<string> {
  return `${COOKIE_ADMIN}=${await assinarToken(operadorId)}`;
}

const rota = (id: string) => ({ params: Promise.resolve({ id }) });

async function criarBloqueioPelaRota(entrada: {
  salaIds: string[];
  data: string;
  inicio: string;
  fim: string;
  motivo?: string;
}) {
  return postBloqueio(
    pedidoPost("/api/admin/bloqueios", entrada, { cookie: await cookieAdmin() }),
  );
}

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
// 1. Bloqueio nao exige os 30 minutos
// =============================================================================

describe("bloqueio nao exige o intervalo de 30 minutos", () => {
  it("uma reserva pode comecar no minuto exato em que o bloqueio termina", async () => {
    const criado = await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "09:00",
      fim: "10:00",
      motivo: "bloqueio de teste",
    });
    expect(criado.status).toBe(201);

    // 10:00 encosta no fim do bloqueio. Entre DUAS RESERVAS isso seria
    // recusado; contra um bloqueio, nao.
    const validacao = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(QUARTA, "10:00"),
      fim: instanteDe(QUARTA, "11:00"),
    });

    expect(validacao.valido).toBe(true);
  });

  it("e pode terminar no minuto exato em que o bloqueio comeca", async () => {
    await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "11:00",
      fim: "12:00",
      motivo: "bloqueio de teste",
    });

    const validacao = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(QUARTA, "10:00"),
      fim: instanteDe(QUARTA, "11:00"),
    });

    expect(validacao.valido).toBe(true);
  });

  it("mas continua proibido invadir o bloqueio", async () => {
    await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
      motivo: "bloqueio de teste",
    });

    const validacao = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(QUARTA, "10:30"),
      fim: instanteDe(QUARTA, "11:30"),
    });

    expect(validacao.valido).toBe(false);
    expect(validacao.codigo).toBe("HORARIO_OCUPADO");
  });
});

// =============================================================================
// 2. O publico nunca ve o motivo
// =============================================================================

describe("privacidade do bloqueio", () => {
  it("a area publica nao devolve o motivo em lugar nenhum", async () => {
    await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
      motivo: MOTIVO_SECRETO,
    });

    const resposta = await getDisponibilidade(
      pedidoGet("/api/publico/disponibilidade", { salaId: salaCI, data: QUARTA }),
    );
    const texto = JSON.stringify(await resposta.json());

    expect(texto).not.toContain(MOTIVO_SECRETO);
    expect(texto).not.toContain("Dedetização");
    expect(texto.toLowerCase()).not.toContain("motivo");
    // O horario aparece apenas como indisponivel para inicio.
    expect(texto).toContain('"horario":"10:00","disponivelParaInicio":false');
  });

  it("o admin ve o motivo", async () => {
    const criado = await (await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "10:00",
      fim: "11:00",
      motivo: MOTIVO_SECRETO,
    })).json();

    const corpo = await (
      await getBloqueio(
        pedidoGet(`/api/admin/bloqueios/${criado.ids[0]}`, {}, { cookie: await cookieAdmin() }),
        rota(criado.ids[0]),
      )
    ).json();

    expect(corpo.motivo).toBe(MOTIVO_SECRETO);
  });

  it("as rotas de bloqueio exigem sessao de admin", async () => {
    const semSessao = [
      await postBloqueio(pedidoPost("/api/admin/bloqueios", {})),
      await conferirBloqueio(pedidoGet("/api/admin/bloqueios")),
      await getBloqueio(pedidoGet("/api/admin/bloqueios/x"), rota("x")),
      await patchBloqueio(pedidoPost("/api/admin/bloqueios/x", {}), rota("x")),
      await deleteBloqueio(pedidoGet("/api/admin/bloqueios/x"), rota("x")),
    ];

    for (const resposta of semSessao) {
      expect(resposta.status).toBe(401);
    }
  });
});

// =============================================================================
// 3. Bloqueio sobre reserva existente e barrado
// =============================================================================

describe("bloqueio em cima de reserva ativa", () => {
  it("e recusado e devolve a lista de reservas afetadas", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    const resposta = await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "09:00",
      fim: "12:00",
      motivo: "bloqueio de teste",
    });

    expect(resposta.status).toBe(409);

    const corpo = await resposta.json();
    expect(corpo.codigo).toBe("RESERVAS_NO_CAMINHO");
    expect(corpo.reservas).toHaveLength(1);
    expect(corpo.reservas[0]).toMatchObject({
      nomeCliente: "Cliente de Teste",
      inicio: "10:00",
      fim: "11:00",
    });

    // E nao criou nada.
    expect(await bancoDeTeste.bloqueio.count({ where: { salaId: salaCI } })).toBe(0);
  });

  it("um feriado em 3 salas nao cria NENHUM se uma delas tiver reserva", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00", salaId: salaContainer });

    const resposta = await criarBloqueioPelaRota({
      salaIds: [salaCI, salaContainer, salaReuniao],
      data: QUARTA,
      inicio: "08:00",
      fim: "18:00",
      motivo: "feriado de teste",
    });

    expect(resposta.status).toBe(409);
    // Tudo ou nada: nem a Sala CI, que estava livre, foi bloqueada.
    expect(await bancoDeTeste.bloqueio.count()).toBe(0);
  });

  it("depois de cancelar a reserva, o bloqueio passa", async () => {
    const id = await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    const barrado = await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "09:00",
      fim: "12:00",
      motivo: "bloqueio de teste",
    });
    expect(barrado.status).toBe(409);

    await bancoDeTeste.reserva.update({
      where: { id },
      data: { status: StatusReserva.CANCELADA, canceladoEm: new Date() },
    });

    const passou = await criarBloqueioPelaRota({
      salaIds: [salaCI],
      data: QUARTA,
      inicio: "09:00",
      fim: "12:00",
      motivo: "bloqueio de teste",
    });
    expect(passou.status).toBe(201);
  });

  it("a rota de conferencia mostra o problema antes de tentar", async () => {
    await reservaNoBanco({ data: QUARTA, inicio: "10:00", fim: "11:00" });

    const corpo = await (
      await conferirBloqueio(
        pedidoGet(
          "/api/admin/bloqueios",
          { salaId: salaCI, data: QUARTA, inicio: "09:00", fim: "12:00" },
          { cookie: await cookieAdmin() },
        ),
      )
    ).json();

    expect(corpo.reservas).toHaveLength(1);
    expect(corpo.reservas[0].nomeCliente).toBe("Cliente de Teste");
  });
});

// =============================================================================
// 4. Dia fechado: recepcao pode, cliente nao
// =============================================================================

describe("dia fechado", () => {
  it("a recepcao consegue lancar reserva na sexta (dia fechado)", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost(
        "/api/admin/reservas",
        {
          salaId: salaCI,
          telefone: CLIENTE,
          nome: "Evento Interno",
          data: SEXTA_FECHADA,
          inicio: "10:00",
          fim: "12:00",
        },
        { cookie: await cookieAdmin() },
      ),
    );

    expect(resposta.status).toBe(201);
  });

  it("o CLIENTE continua barrado no mesmo dia e horario", async () => {
    const validacao = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(SEXTA_FECHADA, "10:00"),
      fim: instanteDe(SEXTA_FECHADA, "12:00"),
    });

    expect(validacao.valido).toBe(false);
    expect(validacao.codigo).toBe("DIA_FECHADO");
  });

  it("a recepcao tambem pode lancar fora do horario de funcionamento", async () => {
    // Quarta fecha as 22:00. A recepcao marca das 22:30 as 23:30 — depois do
    // expediente, para um evento pontual que a equipe sabe que vai abrir.
    const resposta = await postReservaAdmin(
      pedidoPost(
        "/api/admin/reservas",
        {
          salaId: salaCI,
          telefone: CLIENTE,
          nome: "Evento à Noite",
          data: QUARTA,
          inicio: "22:30",
          fim: "23:30",
        },
        { cookie: await cookieAdmin() },
      ),
    );

    expect(resposta.status).toBe(201);

    const doCliente = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(QUARTA, "22:30"),
      fim: instanteDe(QUARTA, "23:30"),
    });
    expect(doCliente.valido).toBe(false);
    expect(doCliente.codigo).toBe("DEPOIS_DO_FECHAMENTO");
  });

  it("mesmo em dia fechado, a recepcao NAO sobrepoe reserva", async () => {
    await postReservaAdmin(
      pedidoPost(
        "/api/admin/reservas",
        {
          salaId: salaCI,
          telefone: CLIENTE,
          nome: "Primeiro",
          data: SEXTA_FECHADA,
          inicio: "10:00",
          fim: "12:00",
        },
        { cookie: await cookieAdmin() },
      ),
    );

    const segundo = await postReservaAdmin(
      pedidoPost(
        "/api/admin/reservas",
        {
          salaId: salaCI,
          telefone: CLIENTE,
          nome: "Segundo",
          data: SEXTA_FECHADA,
          inicio: "11:00",
          fim: "13:00",
        },
        { cookie: await cookieAdmin() },
      ),
    );

    expect(segundo.status).toBe(409);
  });
});

// =============================================================================
// 5. Feriado em grupo
// =============================================================================

describe("feriado em varias salas", () => {
  it("cria um bloqueio por sala, todos no mesmo grupo", async () => {
    const corpo = await (
      await criarBloqueioPelaRota({
        salaIds: [salaCI, salaContainer, salaReuniao],
        data: QUARTA,
        inicio: "00:00",
        fim: "23:30",
        motivo: "feriado de teste",
      })
    ).json();

    expect(corpo.ids).toHaveLength(3);
    expect(corpo.salas).toHaveLength(3);

    const noBanco = await bancoDeTeste.bloqueio.findMany({
      where: { grupoId: corpo.grupoId },
    });
    expect(noBanco).toHaveLength(3);
  });

  it("remover so de uma sala deixa as outras duas", async () => {
    const corpo = await (
      await criarBloqueioPelaRota({
        salaIds: [salaCI, salaContainer, salaReuniao],
        data: QUARTA,
        inicio: "00:00",
        fim: "23:30",
        motivo: "feriado de teste",
      })
    ).json();

    const resposta = await deleteBloqueio(
      pedidoGet(`/api/admin/bloqueios/${corpo.ids[0]}`, {}, { cookie: await cookieAdmin() }),
      rota(corpo.ids[0]),
    );

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({ removidos: 1 });
    expect(await bancoDeTeste.bloqueio.count({ where: { grupoId: corpo.grupoId } })).toBe(2);
  });

  it("remover o feriado inteiro tira as tres de uma vez", async () => {
    const corpo = await (
      await criarBloqueioPelaRota({
        salaIds: [salaCI, salaContainer, salaReuniao],
        data: QUARTA,
        inicio: "00:00",
        fim: "23:30",
        motivo: "feriado de teste",
      })
    ).json();

    const requisicao = pedidoGet(
      `/api/admin/bloqueios/${corpo.ids[0]}`,
      { grupo: "1" },
      { cookie: await cookieAdmin() },
    );

    const resposta = await deleteBloqueio(requisicao, rota(corpo.ids[0]));

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({ removidos: 3 });
    expect(await bancoDeTeste.bloqueio.count({ where: { grupoId: corpo.grupoId } })).toBe(0);
  });

  it("o detalhe informa quantas salas o feriado cobre", async () => {
    const corpo = await (
      await criarBloqueioPelaRota({
        salaIds: [salaCI, salaContainer],
        data: QUARTA,
        inicio: "00:00",
        fim: "23:30",
        motivo: "feriado de teste",
      })
    ).json();

    const detalhe = await (
      await getBloqueio(
        pedidoGet(`/api/admin/bloqueios/${corpo.ids[0]}`, {}, { cookie: await cookieAdmin() }),
        rota(corpo.ids[0]),
      )
    ).json();

    expect(detalhe.salasNoGrupo).toBe(2);
  });

  it("remover o bloqueio devolve o horario para a agenda", async () => {
    const corpo = await (
      await criarBloqueioPelaRota({
        salaIds: [salaCI],
        data: QUARTA,
        inicio: "10:00",
        fim: "11:00",
        motivo: "bloqueio de teste",
      })
    ).json();

    const ocupado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(QUARTA, "10:00"),
      fim: instanteDe(QUARTA, "11:00"),
    });
    expect(ocupado.valido).toBe(false);

    await deleteBloqueio(
      pedidoGet(`/api/admin/bloqueios/${corpo.ids[0]}`, {}, { cookie: await cookieAdmin() }),
      rota(corpo.ids[0]),
    );

    const livre = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(QUARTA, "10:00"),
      fim: instanteDe(QUARTA, "11:00"),
    });
    expect(livre.valido).toBe(true);
  });
});

// =============================================================================
// 6. Editar bloqueio
// =============================================================================

describe("editar bloqueio", () => {
  it("muda horario e motivo", async () => {
    const corpo = await (
      await criarBloqueioPelaRota({
        salaIds: [salaCI],
        data: QUARTA,
        inicio: "10:00",
        fim: "11:00",
        motivo: "bloqueio de teste",
      })
    ).json();

    const resposta = await patchBloqueio(
      pedidoPost(
        `/api/admin/bloqueios/${corpo.ids[0]}`,
        { data: QUARTA, inicio: "14:00", fim: "16:00", motivo: "outro motivo de teste" },
        { cookie: await cookieAdmin() },
      ),
      rota(corpo.ids[0]),
    );

    expect(resposta.status).toBe(200);

    const noBanco = await bancoDeTeste.bloqueio.findUniqueOrThrow({
      where: { id: corpo.ids[0] },
    });
    expect(noBanco.inicio).toEqual(instanteDe(QUARTA, "14:00"));
    expect(noBanco.motivo).toBe("outro motivo de teste");
  });

  it("nao deixa mover o bloqueio para cima de uma reserva", async () => {
    const corpo = await (
      await criarBloqueioPelaRota({
        salaIds: [salaCI],
        data: QUARTA,
        inicio: "08:00",
        fim: "09:00",
        motivo: "bloqueio de teste",
      })
    ).json();

    await reservaNoBanco({ data: QUARTA, inicio: "14:00", fim: "15:00" });

    const resposta = await patchBloqueio(
      pedidoPost(
        `/api/admin/bloqueios/${corpo.ids[0]}`,
        { data: QUARTA, inicio: "14:00", fim: "15:00", motivo: "bloqueio de teste" },
        { cookie: await cookieAdmin() },
      ),
      rota(corpo.ids[0]),
    );

    expect(resposta.status).toBe(409);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "RESERVAS_NO_CAMINHO" });
  });
});
