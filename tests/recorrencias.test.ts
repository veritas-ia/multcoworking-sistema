/**
 * RESERVAS RECORRENTES (Fase 9, parte 2).
 *
 * O que estes testes protegem:
 *  1. as contas de data: semanal em varios dias, quinzenal pulando as semanas
 *     alternadas, mensal por ORDINAL ("a primeira terca"), nunca por dia do mes;
 *  2. ocorrencia em conflito e PULADA e aparece no relatorio — nunca derruba
 *     a serie inteira;
 *  3. dia fechado e pulado de proposito, mesmo a recepcao podendo lancar
 *     avulso em dia fechado;
 *  4. cancelar UMA ocorrencia nao mexe nas outras; cancelar a SERIE pega todas
 *     as futuras e deixa as passadas em paz.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import bcrypt from "bcryptjs";

import { POST as postCancelarReserva } from "@/app/api/admin/reservas/[id]/cancelar/route";
import { POST as postCancelarSerie } from "@/app/api/admin/recorrencias/[id]/cancelar/route";
import { GET as getSerie } from "@/app/api/admin/recorrencias/[id]/route";
import { POST as postSerie } from "@/app/api/admin/recorrencias/route";
import { OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import {
  datasDaSerie,
  diaDaSemanaDoMes,
  serieporExtenso,
} from "@/lib/datas-recorrencia";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { dataLocalDe, instanteDe } from "@/lib/tempo";
import { aguardarEnviosPendentes, renderizarTemplate } from "@/lib/whatsapp";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

const CLIENTE = "+5511900000050";
const OPERADOR = "recorrencias.teste";

let salaCI: string;
let operadorId: string;

beforeAll(async () => {
  await aquecerConexao();
  const salas = await bancoDeTeste.sala.findMany();
  const porSlug = new Map(salas.map((s) => [s.slug, s.id]));
  const ci = porSlug.get("sala-ci");
  if (!ci) {
    throw new Error('Salas do seed nao encontradas. Rode "npm run db:seed".');
  }
  salaCI = ci;
});

async function limpar(): Promise<void> {
  await aguardarEnviosPendentes();
  await bancoDeTeste.logMensagem.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: CLIENTE } });
  await bancoDeTeste.recorrencia.deleteMany({ where: { telefone: CLIENTE } });
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

type Entrada = {
  diasDaSemana: number[];
  frequencia: "SEMANAL" | "QUINZENAL" | "MENSAL";
  semanaDoMes?: number | null;
  dataInicio: string;
  dataFim: string;
  inicio?: string;
  fim?: string;
  salaId?: string;
};

async function criarSeriePelaRota(entrada: Entrada) {
  return postSerie(
    pedidoPost(
      "/api/admin/recorrencias",
      {
        salaId: entrada.salaId ?? salaCI,
        telefone: CLIENTE,
        nome: "Cliente Recorrente",
        inicio: entrada.inicio ?? "09:00",
        fim: entrada.fim ?? "10:00",
        diasDaSemana: entrada.diasDaSemana,
        frequencia: entrada.frequencia,
        semanaDoMes: entrada.semanaDoMes ?? null,
        dataInicio: entrada.dataInicio,
        dataFim: entrada.dataFim,
      },
      { cookie: await cookieAdmin() },
    ),
  );
}

/** As datas das ocorrencias criadas, em ordem. */
async function datasCriadas(recorrenciaId: string): Promise<string[]> {
  const reservas = await bancoDeTeste.reserva.findMany({
    where: { recorrenciaId },
    orderBy: { inicio: "asc" },
    select: { inicio: true },
  });
  return reservas.map((reserva) => dataLocalDe(reserva.inicio));
}

// =============================================================================
// 1. As contas de data (modulo puro)
// =============================================================================

describe("contas de data da serie", () => {
  it("semanal em dois dias gera os dois, toda semana", () => {
    const datas = datasDaSerie({
      diasDaSemana: [2, 3],
      frequencia: "SEMANAL",
      dataInicio: "2026-10-06",
      dataFim: "2026-10-31",
    });

    expect(datas).toEqual([
      "2026-10-06", "2026-10-07",
      "2026-10-13", "2026-10-14",
      "2026-10-20", "2026-10-21",
      "2026-10-27", "2026-10-28",
    ]);
  });

  it("quinzenal pula as semanas alternadas", () => {
    const datas = datasDaSerie({
      diasDaSemana: [2],
      frequencia: "QUINZENAL",
      dataInicio: "2026-10-06",
      dataFim: "2026-11-30",
    });

    // 06/10, depois 20/10, 03/11, 17/11 — de duas em duas semanas.
    expect(datas).toEqual(["2026-10-06", "2026-10-20", "2026-11-03", "2026-11-17"]);
  });

  it("mensal 'primeira terça' cai na data certa de cada mês", () => {
    const datas = datasDaSerie({
      diasDaSemana: [2],
      frequencia: "MENSAL",
      semanaDoMes: 1,
      dataInicio: "2026-10-01",
      dataFim: "2027-01-31",
    });

    expect(datas).toEqual(["2026-10-06", "2026-11-03", "2026-12-01", "2027-01-05"]);
  });

  it("mensal 'última terça' acerta o mês com 5 terças", () => {
    // Setembro/2026 tem 5 tercas: 1, 8, 15, 22 e 29. A ultima e a quinta.
    expect(diaDaSemanaDoMes(2026, 9, 2, -1)).toBe("2026-09-29");
    // Novembro/2026 tem 4: a ultima e a quarta.
    expect(diaDaSemanaDoMes(2026, 11, 2, -1)).toBe("2026-11-24");
  });

  it("nunca usa dia do número do mês", () => {
    // "Primeira terca" cai em dias diferentes a cada mes — e o ponto.
    const datas = datasDaSerie({
      diasDaSemana: [2],
      frequencia: "MENSAL",
      semanaDoMes: 1,
      dataInicio: "2026-10-01",
      dataFim: "2026-12-31",
    });

    const diasDoMes = datas.map((data) => Number(data.slice(8)));
    expect(new Set(diasDoMes).size).toBeGreaterThan(1);
  });

  it("escreve a série em português", () => {
    expect(
      serieporExtenso({
        diasDaSemana: [2, 3],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-31",
      }),
    ).toBe("toda terça e quarta");

    expect(
      serieporExtenso({
        diasDaSemana: [2],
        frequencia: "MENSAL",
        semanaDoMes: -1,
        dataInicio: "2026-10-06",
        dataFim: "2026-12-31",
      }),
    ).toBe("a última terça de cada mês");
  });
});

// =============================================================================
// 2. Criacao das ocorrencias
// =============================================================================

describe("criar a série pela recepção", () => {
  it("terça e quarta por um mês gera as reservas certas", async () => {
    const resposta = await criarSeriePelaRota({
      diasDaSemana: [2, 3],
      frequencia: "SEMANAL",
      dataInicio: "2026-10-06",
      dataFim: "2026-10-31",
    });

    expect(resposta.status).toBe(201);
    const corpo = await resposta.json();

    expect(corpo.criadas).toHaveLength(8);
    expect(corpo.puladas).toHaveLength(0);
    expect(corpo.resumo).toBe("toda terça e quarta");

    await expect(datasCriadas(corpo.recorrenciaId)).resolves.toEqual([
      "2026-10-06", "2026-10-07",
      "2026-10-13", "2026-10-14",
      "2026-10-20", "2026-10-21",
      "2026-10-27", "2026-10-28",
    ]);
  });

  it("cada ocorrência é uma reserva normal, ligada à série e com origem ADMIN", async () => {
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-20",
      })
    ).json();

    const reservas = await bancoDeTeste.reserva.findMany({
      where: { recorrenciaId: corpo.recorrenciaId },
    });

    expect(reservas).toHaveLength(3);
    for (const reserva of reservas) {
      expect(reserva.origem).toBe(OrigemReserva.ADMIN);
      expect(reserva.status).toBe(StatusReserva.CONFIRMADA);
      expect(reserva.recorrenciaId).toBe(corpo.recorrenciaId);
      expect(reserva.valor.toFixed(2)).toBe("40.00");
    }
  });

  it("quinzenal cria metade das ocorrências da semanal", async () => {
    const semanal = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-11-30",
      })
    ).json();

    await limpar();
    await bancoDeTeste.usuario.create({
      data: { nome: "Joana", usuario: OPERADOR, senhaHash: await bcrypt.hash("x", 10) },
    });
    operadorId = (
      await bancoDeTeste.usuario.findUniqueOrThrow({ where: { usuario: OPERADOR } })
    ).id;

    const quinzenal = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "QUINZENAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-11-30",
      })
    ).json();

    expect(semanal.criadas).toHaveLength(8);
    expect(quinzenal.criadas).toHaveLength(4);
  });

  it("mensal 'primeira terça' cria uma por mês", async () => {
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "MENSAL",
        semanaDoMes: 1,
        dataInicio: "2026-10-01",
        dataFim: "2026-12-31",
      })
    ).json();

    expect(corpo.criadas).toHaveLength(3);
    await expect(datasCriadas(corpo.recorrenciaId)).resolves.toEqual([
      "2026-10-06",
      "2026-11-03",
      "2026-12-01",
    ]);
  });

  it("exige a semana do mês quando a frequência é mensal", async () => {
    const resposta = await criarSeriePelaRota({
      diasDaSemana: [2],
      frequencia: "MENSAL",
      semanaDoMes: null,
      dataInicio: "2026-10-01",
      dataFim: "2026-12-31",
    });

    expect(resposta.status).toBe(422);
  });

  it("a rota exige sessão de admin", async () => {
    const semSessao = [
      await postSerie(pedidoPost("/api/admin/recorrencias", {})),
      await getSerie(pedidoGet("/api/admin/recorrencias/x"), rota("x")),
      await postCancelarSerie(pedidoPost("/api/admin/recorrencias/x/cancelar", {}), rota("x")),
    ];

    for (const resposta of semSessao) {
      expect(resposta.status).toBe(401);
    }
  });
});

// =============================================================================
// 3. O que e pulado, e o relatorio
// =============================================================================

describe("ocorrências puladas e o relatório", () => {
  it("pula a ocorrência que bate em reserva existente e diz qual foi", async () => {
    // Reserva avulsa bem em cima da segunda terca da serie.
    await bancoDeTeste.reserva.create({
      data: {
        salaId: salaCI,
        nomeCliente: "Quem chegou antes",
        telefone: CLIENTE,
        inicio: instanteDe("2026-10-13", "09:00"),
        fim: instanteDe("2026-10-13", "10:00"),
        duracaoMinutos: 60,
        valor: "50.00",
        status: StatusReserva.CONFIRMADA,
        origem: OrigemReserva.PUBLICO,
      },
    });

    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-27",
      })
    ).json();

    // 4 tercas no periodo; a de 13/10 foi pulada.
    expect(corpo.criadas).toHaveLength(3);
    expect(corpo.puladas).toHaveLength(1);
    expect(corpo.puladas[0]).toMatchObject({ data: "2026-10-13", tipo: "CONFLITO" });

    // E as outras tres entraram normalmente.
    await expect(datasCriadas(corpo.recorrenciaId)).resolves.toEqual([
      "2026-10-06",
      "2026-10-20",
      "2026-10-27",
    ]);
  });

  it("pula os dias fechados e informa quantos", async () => {
    // Sexta e domingo sao fechados. A serie pede sexta.
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [5],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-31",
      })
    ).json();

    expect(corpo.criadas).toHaveLength(0);
    expect(corpo.puladas).toHaveLength(4);
    for (const pulada of corpo.puladas) {
      expect(pulada.tipo).toBe("DIA_FECHADO");
    }
  });

  it("uma série mista cria os dias abertos e pula os fechados", async () => {
    // Terca (aberta) e sexta (fechada), no mesmo periodo.
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2, 5],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-31",
      })
    ).json();

    expect(corpo.criadas).toHaveLength(4);
    expect(corpo.puladas.filter((p: { tipo: string }) => p.tipo === "DIA_FECHADO")).toHaveLength(4);
  });

  it("um conflito no meio não derruba a série inteira", async () => {
    await bancoDeTeste.reserva.create({
      data: {
        salaId: salaCI,
        nomeCliente: "Atravessador",
        telefone: CLIENTE,
        inicio: instanteDe("2026-10-13", "09:00"),
        fim: instanteDe("2026-10-13", "10:00"),
        duracaoMinutos: 60,
        valor: "50.00",
        status: StatusReserva.CONFIRMADA,
        origem: OrigemReserva.PUBLICO,
      },
    });

    const resposta = await criarSeriePelaRota({
      diasDaSemana: [2],
      frequencia: "SEMANAL",
      dataInicio: "2026-10-06",
      dataFim: "2026-10-27",
    });

    // A serie foi criada mesmo assim.
    expect(resposta.status).toBe(201);
    const corpo = await resposta.json();
    expect(corpo.criadas.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// 4. Cancelar uma ocorrencia vs a serie inteira
// =============================================================================

describe("cancelar uma ocorrência ou a série", () => {
  it("cancelar UMA ocorrência não mexe nas outras", async () => {
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-27",
      })
    ).json();

    const primeira = corpo.criadas[0].id;

    const resposta = await postCancelarReserva(
      pedidoPost(`/api/admin/reservas/${primeira}/cancelar`, {}, { cookie: await cookieAdmin() }),
      rota(primeira),
    );
    expect(resposta.status).toBe(200);

    const ativas = await bancoDeTeste.reserva.count({
      where: {
        recorrenciaId: corpo.recorrenciaId,
        status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
      },
    });
    expect(ativas).toBe(3);

    // A serie continua ativa.
    const serie = await bancoDeTeste.recorrencia.findUniqueOrThrow({
      where: { id: corpo.recorrenciaId },
    });
    expect(serie.ativa).toBe(true);
  });

  it("cancelar a SÉRIE pega todas as futuras de uma vez", async () => {
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-27",
      })
    ).json();

    const resposta = await postCancelarSerie(
      pedidoPost(
        `/api/admin/recorrencias/${corpo.recorrenciaId}/cancelar`,
        {},
        { cookie: await cookieAdmin() },
      ),
      rota(corpo.recorrenciaId),
    );

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toMatchObject({ canceladas: 4 });

    const ativas = await bancoDeTeste.reserva.count({
      where: {
        recorrenciaId: corpo.recorrenciaId,
        status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
      },
    });
    expect(ativas).toBe(0);

    const serie = await bancoDeTeste.recorrencia.findUniqueOrThrow({
      where: { id: corpo.recorrenciaId },
    });
    expect(serie.ativa).toBe(false);
  });

  it("cancelar a série NÃO mexe no que já passou", async () => {
    // Serie que comecou antes de "agora" (05/10 09:00).
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "SEMANAL",
        dataInicio: "2026-09-29",
        dataFim: "2026-10-13",
      })
    ).json();

    // 29/09 ja passou; 06/10 e 13/10 estao no futuro.
    expect(corpo.criadas).toHaveLength(3);

    await postCancelarSerie(
      pedidoPost(
        `/api/admin/recorrencias/${corpo.recorrenciaId}/cancelar`,
        {},
        { cookie: await cookieAdmin() },
      ),
      rota(corpo.recorrenciaId),
    );

    const passada = await bancoDeTeste.reserva.findFirstOrThrow({
      where: { recorrenciaId: corpo.recorrenciaId, inicio: { lt: AGORA } },
    });
    expect(passada.status).toBe(StatusReserva.CONFIRMADA);

    const futurasCanceladas = await bancoDeTeste.reserva.count({
      where: {
        recorrenciaId: corpo.recorrenciaId,
        inicio: { gt: AGORA },
        status: StatusReserva.CANCELADA,
      },
    });
    expect(futurasCanceladas).toBe(2);
  });

  it("o resumo da série diz quantas seriam afetadas", async () => {
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-27",
      })
    ).json();

    const resumo = await (
      await getSerie(
        pedidoGet(`/api/admin/recorrencias/${corpo.recorrenciaId}`, {}, { cookie: await cookieAdmin() }),
        rota(corpo.recorrenciaId),
      )
    ).json();

    expect(resumo.total).toBe(4);
    expect(resumo.futurasAtivas).toBe(4);
    expect(resumo.resumo).toBe("toda terça");
  });
});

// =============================================================================
// 5. UMA mensagem para a serie inteira
// =============================================================================

describe("WhatsApp da série", () => {
  it("manda UMA mensagem só, não uma por ocorrência", async () => {
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [2, 3],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-31",
      })
    ).json();

    expect(corpo.criadas).toHaveLength(8);

    await aguardarEnviosPendentes();

    const enviadas = await bancoDeTeste.logMensagem.findMany({
      where: { telefone: CLIENTE },
    });

    // Oito reservas, UMA mensagem.
    expect(enviadas).toHaveLength(1);
    expect(enviadas[0]?.tipo).toBe("serie_confirmada");
  });

  it("o texto da mensagem resume a série: dias, horário, período e quantidade", async () => {
    // O LogMensagem guarda quem/qual/quando, mas NAO o texto enviado. Entao
    // aqui a gente monta a mensagem com o modelo real do banco e as mesmas
    // variaveis que a rota usa, e confere o que o cliente leria.
    const modelo = await bancoDeTeste.templateMensagem.findUniqueOrThrow({
      where: { chave: "serie_confirmada" },
    });

    const texto = renderizarTemplate(modelo.texto, {
      nome: "Cliente Recorrente",
      sala: "Sala CI",
      dias: serieporExtenso({
        diasDaSemana: [2, 3],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-31",
      }),
      inicio: "09:00",
      fim: "10:00",
      periodo: "06/10 a 28/10",
      quantidade: "8",
    });

    expect(texto).toContain("Sala CI");
    expect(texto).toContain("terça e quarta");
    expect(texto).toContain("09:00");
    expect(texto).toContain("06/10 a 28/10");
    expect(texto).toContain("8 datas");
    // Nenhuma variavel ficou por trocar.
    expect(texto).not.toContain("{{");
  });

  it("série sem nenhuma ocorrência criada não manda mensagem nenhuma", async () => {
    // So sextas: o coworking nao abre, entao nada e criado.
    const corpo = await (
      await criarSeriePelaRota({
        diasDaSemana: [5],
        frequencia: "SEMANAL",
        dataInicio: "2026-10-06",
        dataFim: "2026-10-31",
      })
    ).json();

    expect(corpo.criadas).toHaveLength(0);

    await aguardarEnviosPendentes();

    const enviadas = await bancoDeTeste.logMensagem.count({
      where: { telefone: CLIENTE },
    });
    expect(enviadas).toBe(0);
  });
});
