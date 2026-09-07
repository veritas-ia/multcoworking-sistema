/**
 * Testes das TRAVAS DO BANCO (Fase 2).
 *
 * Aqui nao se testa codigo da aplicacao: testa-se se o proprio PostgreSQL
 * recusa horarios invalidos. E esta a garantia de que duas pessoas nao
 * conseguem reservar a mesma sala no mesmo horario.
 *
 * Precisa do banco no ar: `npm run db:up`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OrigemReserva, StatusReserva } from "@/generated/prisma/enums";

import { aquecerConexao, bancoDeTeste, emUtc, maisMinutos } from "./apoio/banco";

const TELEFONE = "+5511987654321";

let salaA: string;
let salaB: string;

/** Cria uma reserva coerente com as regras de linha (duracao, valor, telefone). */
async function criarReserva(opcoes: {
  salaId: string;
  inicio: Date;
  minutos: number;
  status?: StatusReserva;
}): Promise<string> {
  const status = opcoes.status ?? StatusReserva.CONFIRMADA;
  const reserva = await bancoDeTeste.reserva.create({
    data: {
      salaId: opcoes.salaId,
      nomeCliente: "Cliente de Teste",
      telefone: TELEFONE,
      inicio: opcoes.inicio,
      fim: maisMinutos(opcoes.inicio, opcoes.minutos),
      duracaoMinutos: opcoes.minutos,
      valor: "100.00",
      status,
      origem: OrigemReserva.PUBLICO,
      canceladoEm: status === StatusReserva.CANCELADA ? new Date() : null,
    },
  });
  return reserva.id;
}

async function criarBloqueio(opcoes: {
  salaId: string;
  inicio: Date;
  minutos: number;
}): Promise<string> {
  const bloqueio = await bancoDeTeste.bloqueio.create({
    data: {
      salaId: opcoes.salaId,
      inicio: opcoes.inicio,
      fim: maisMinutos(opcoes.inicio, opcoes.minutos),
      motivo: "manutenção",
    },
  });
  return bloqueio.id;
}

beforeAll(async () => {
  await aquecerConexao();

  const a = await bancoDeTeste.sala.upsert({
    where: { slug: "teste-sala-a" },
    create: {
      slug: "teste-sala-a",
      nome: "Sala de Teste A",
      precoPorHora: "10.00",
      precoPorHoraNoturno: "10.00",
      ordem: 900,
      ativa: false,
    },
    update: {},
  });
  const b = await bancoDeTeste.sala.upsert({
    where: { slug: "teste-sala-b" },
    create: {
      slug: "teste-sala-b",
      nome: "Sala de Teste B",
      precoPorHora: "10.00",
      precoPorHoraNoturno: "10.00",
      ordem: 901,
      ativa: false,
    },
    update: {},
  });
  salaA = a.id;
  salaB = b.id;
});

beforeEach(async () => {
  await bancoDeTeste.reserva.deleteMany({ where: { salaId: { in: [salaA, salaB] } } });
  await bancoDeTeste.bloqueio.deleteMany({ where: { salaId: { in: [salaA, salaB] } } });
});

afterAll(async () => {
  await bancoDeTeste.reserva.deleteMany({ where: { salaId: { in: [salaA, salaB] } } });
  await bancoDeTeste.bloqueio.deleteMany({ where: { salaId: { in: [salaA, salaB] } } });
  await bancoDeTeste.sala.deleteMany({
    where: { slug: { in: ["teste-sala-a", "teste-sala-b"] } },
  });
  await bancoDeTeste.$disconnect();
});

// Terca-feira, 10:00 no horario de Sao Paulo (= 13:00 UTC).
const DEZ_HORAS = emUtc("2026-10-06T13:00:00.000Z");

describe("trava 1 — nada se sobrepoe na mesma sala", () => {
  it("recusa duas reservas no mesmo horario", async () => {
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 }),
    ).rejects.toThrow(/ocupacao_sem_sobreposicao|ocupacao_intervalo_entre_reservas/);
  });

  it("recusa reserva que invade o fim de outra", async () => {
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 120 });

    await expect(
      criarReserva({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, 60),
        minutos: 60,
      }),
    ).rejects.toThrow(/ocupacao_/);
  });

  it("permite o mesmo horario em salas diferentes (agendas independentes)", async () => {
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarReserva({ salaId: salaB, inicio: DEZ_HORAS, minutos: 60 }),
    ).resolves.toBeTypeOf("string");
  });
});

describe("trava 2 — 30 minutos de folga entre duas reservas", () => {
  it("recusa reserva colada no fim da anterior (folga zero)", async () => {
    // 10:00-11:00 e depois 11:00-12:00 -> nao sobra folga.
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarReserva({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, 60),
        minutos: 60,
      }),
    ).rejects.toThrow(/ocupacao_/);
  });

  it("aceita reserva com exatamente 30 min de folga depois", async () => {
    // 10:00-11:00 e depois 11:30-12:30.
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarReserva({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, 90),
        minutos: 60,
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("aceita reserva com exatamente 30 min de folga antes (regra simetrica)", async () => {
    // Primeiro cria a das 10:00; depois tenta a das 08:30-09:30.
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarReserva({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, -90),
        minutos: 60,
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("recusa reserva que termina 30 min depois de comecar a anterior (folga insuficiente antes)", async () => {
    // Reserva das 10:00-11:00 ja existe; tenta 09:00-10:00 -> folga zero antes.
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarReserva({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, -60),
        minutos: 60,
      }),
    ).rejects.toThrow(/ocupacao_/);
  });
});

describe("bloqueios administrativos", () => {
  it("recusa reserva em cima de um bloqueio", async () => {
    await criarBloqueio({ salaId: salaA, inicio: DEZ_HORAS, minutos: 120 });

    await expect(
      criarReserva({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, 60),
        minutos: 60,
      }),
    ).rejects.toThrow(/ocupacao_sem_sobreposicao/);
  });

  it("aceita reserva comecando no minuto exato em que o bloqueio termina (bloqueio nao exige folga)", async () => {
    // Bloqueio 10:00-11:00, reserva 11:00-12:00.
    await criarBloqueio({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarReserva({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, 60),
        minutos: 60,
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("aceita bloqueio comecando no minuto exato em que a reserva termina", async () => {
    await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      criarBloqueio({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, 60),
        minutos: 60,
      }),
    ).resolves.toBeTypeOf("string");
  });

  it("recusa dois bloqueios sobrepostos na mesma sala", async () => {
    await criarBloqueio({ salaId: salaA, inicio: DEZ_HORAS, minutos: 120 });

    await expect(
      criarBloqueio({
        salaId: salaA,
        inicio: maisMinutos(DEZ_HORAS, 60),
        minutos: 60,
      }),
    ).rejects.toThrow(/ocupacao_sem_sobreposicao/);
  });
});

describe("mudanca de status libera ou ocupa o horario", () => {
  it("reserva cancelada libera o horario", async () => {
    const id = await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await bancoDeTeste.reserva.update({
      where: { id },
      data: { status: StatusReserva.CANCELADA, canceladoEm: new Date() },
    });

    await expect(
      criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 }),
    ).resolves.toBeTypeOf("string");
  });

  it("reserva concluida libera o horario", async () => {
    const id = await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await bancoDeTeste.reserva.update({
      where: { id },
      data: { status: StatusReserva.CONCLUIDA },
    });

    await expect(
      criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 }),
    ).resolves.toBeTypeOf("string");
  });

  it("reagendar para um horario livre funciona", async () => {
    const id = await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

    await expect(
      bancoDeTeste.reserva.update({
        where: { id },
        data: {
          inicio: maisMinutos(DEZ_HORAS, 180),
          fim: maisMinutos(DEZ_HORAS, 240),
          status: StatusReserva.REAGENDADA,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("reagendar para cima de outra reserva e recusado", async () => {
    const id = await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });
    await criarReserva({
      salaId: salaA,
      inicio: maisMinutos(DEZ_HORAS, 180),
      minutos: 60,
    });

    await expect(
      bancoDeTeste.reserva.update({
        where: { id },
        data: {
          inicio: maisMinutos(DEZ_HORAS, 180),
          fim: maisMinutos(DEZ_HORAS, 240),
          status: StatusReserva.REAGENDADA,
        },
      }),
    ).rejects.toThrow(/ocupacao_/);
  });
});

describe("coerencia dos dados", () => {
  it("recusa reserva fora da grade de 30 em 30 minutos", async () => {
    await expect(
      criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 75 }),
    ).rejects.toThrow(/reserva_duracao_na_grade/);
  });

  it("ACEITA 30 minutos: o minimo de 1 hora saiu do banco na Fase 8", async () => {
    // A trava antiga misturava a grade de 30 min (integridade) com o minimo
    // de 1 hora (politica comercial). A politica passou para a aplicacao, que
    // sabe QUEM esta marcando: o cliente do site continua preso a 1 hora
    // (ver tests/disponibilidade.test.ts), a recepcao nao.
    const id = await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 30 });

    expect(id).toBeTruthy();
    await bancoDeTeste.reserva.delete({ where: { id } });
  });

  it("recusa telefone fora do formato internacional", async () => {
    await expect(
      bancoDeTeste.reserva.create({
        data: {
          salaId: salaA,
          nomeCliente: "Cliente de Teste",
          telefone: "11987654321",
          inicio: DEZ_HORAS,
          fim: maisMinutos(DEZ_HORAS, 60),
          duracaoMinutos: 60,
          valor: "100.00",
          origem: OrigemReserva.PUBLICO,
        },
      }),
    ).rejects.toThrow(/reserva_telefone_e164/);
  });

  it("recusa horario de funcionamento com minuto quebrado", async () => {
    await expect(
      bancoDeTeste.$executeRawUnsafe(
        `INSERT INTO horarios_funcionamento (id, dia_da_semana, aberto, hora_abertura, hora_fechamento, atualizado_em)
         VALUES ('teste-horario', 9, true, '08:15', '18:00', now())`,
      ),
    ).rejects.toThrow(/horario_formato_valido|horario_dia_valido/);
  });
});

describe("duas pessoas reservando ao mesmo tempo", () => {
  it("aceita exatamente uma das duas tentativas simultaneas", async () => {
    // Duas transacoes disparadas juntas, no mesmo horario e na mesma sala.
    // Sem a trava do banco, as duas passariam.
    const tentativa = () =>
      bancoDeTeste.$transaction(async (tx) => {
        await tx.reserva.create({
          data: {
            salaId: salaA,
            nomeCliente: "Cliente de Teste",
            telefone: TELEFONE,
            inicio: DEZ_HORAS,
            fim: maisMinutos(DEZ_HORAS, 60),
            duracaoMinutos: 60,
            valor: "100.00",
            origem: OrigemReserva.PUBLICO,
          },
        });
      });

    const resultados = await Promise.allSettled([tentativa(), tentativa()]);

    const aceitas = resultados.filter((r) => r.status === "fulfilled");
    const recusadas = resultados.filter((r) => r.status === "rejected");

    expect(aceitas).toHaveLength(1);
    expect(recusadas).toHaveLength(1);
    expect(
      await bancoDeTeste.reserva.count({ where: { salaId: salaA } }),
    ).toBe(1);
  });
});

describe("folga configuravel no painel", () => {
  it("passa a exigir 60 min de folga quando intervaloMinutos vira 60", async () => {
    await bancoDeTeste.configuracao.update({
      where: { chave: "intervaloMinutos" },
      data: { valor: "60" },
    });

    try {
      await criarReserva({ salaId: salaA, inicio: DEZ_HORAS, minutos: 60 });

      // 30 min de folga deixam de bastar...
      await expect(
        criarReserva({
          salaId: salaA,
          inicio: maisMinutos(DEZ_HORAS, 90),
          minutos: 60,
        }),
      ).rejects.toThrow(/ocupacao_intervalo_entre_reservas/);

      // ...e 60 min passam a ser o minimo.
      await expect(
        criarReserva({
          salaId: salaA,
          inicio: maisMinutos(DEZ_HORAS, 120),
          minutos: 60,
        }),
      ).resolves.toBeTypeOf("string");
    } finally {
      await bancoDeTeste.configuracao.update({
        where: { chave: "intervaloMinutos" },
        data: { valor: "30" },
      });
    }
  });
});

describe("o banco grava horários no instante certo", () => {
  /**
   * Teste de regressao de um bug real: com o container do Postgres em
   * America/Sao_Paulo, o driver gravava tudo 3 HORAS ADIANTADO. O erro era
   * invisivel comparando Node com Node, porque leitura e escrita passavam
   * pelo mesmo caminho torto. So o epoch calculado DENTRO do banco denuncia.
   */
  it("grava o mesmo instante que o relógio do Node, sem desvio de fuso", async () => {
    const agoraNode = Date.now();

    const reserva = await bancoDeTeste.reserva.create({
      data: {
        salaId: salaA,
        nomeCliente: "Cliente de Teste",
        telefone: TELEFONE,
        inicio: new Date(agoraNode + 86_400_000),
        fim: new Date(agoraNode + 86_400_000 + 3_600_000),
        duracaoMinutos: 60,
        valor: "100.00",
        origem: OrigemReserva.PUBLICO,
      },
    });

    const [linha] = await bancoDeTeste.$queryRaw<{ desvio: string }[]>`
      SELECT (extract(epoch from criado_em) - ${agoraNode / 1000}::float8)::text AS desvio
      FROM reservas WHERE id = ${reserva.id}
    `;

    // Tolerancia de 5 segundos para o tempo da propria gravacao.
    expect(Math.abs(Number(linha?.desvio ?? 99999))).toBeLessThan(5);
  });

  it("o relógio do banco bate com o relógio do Node", async () => {
    const agoraNode = Date.now();

    const [linha] = await bancoDeTeste.$queryRaw<{ desvio: string }[]>`
      SELECT (extract(epoch from now()) - ${agoraNode / 1000}::float8)::text AS desvio
    `;

    expect(Math.abs(Number(linha?.desvio ?? 99999))).toBeLessThan(5);
  });

  it("o fuso da sessão do banco é UTC", async () => {
    const [linha] = await bancoDeTeste.$queryRaw<{ fuso: string }[]>`
      SELECT current_setting('TimeZone') AS fuso
    `;
    expect(linha?.fuso).toBe("UTC");
  });
});
