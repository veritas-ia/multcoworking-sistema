/**
 * Testes do MOTOR DE DISPONIBILIDADE (Fase 3).
 *
 * O relogio fica congelado em todos os testes, para que o resultado nunca
 * dependa do dia em que eles forem rodados.
 *
 * Datas usadas (todas conferidas):
 *   2026-10-05  segunda   (o "hoje" dos testes, 09:00 em Sao Paulo)
 *   2026-10-06  terca     08:00-18:00
 *   2026-10-09  sexta     FECHADO
 *   2026-10-10  sabado    09:00-13:00
 *   2026-12-15  terca     alem dos 60 dias de antecedencia
 *   2018-06-04  segunda   fora do horario de verao (-03:00)
 *   2018-11-05  segunda   DENTRO do antigo horario de verao (-02:00)
 *
 * Precisa do banco no ar e com o seed carregado:
 *   npm run db:up && npm run db:migrate && npm run db:seed
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BLOCO_MINUTOS,
  calcularValor,
  horariosDeTerminoValidos,
  slotsDoDia,
  validarReserva,
} from "@/lib/disponibilidade";
import { OrigemReserva } from "@/generated/prisma/enums";
import { instanteDe } from "@/lib/tempo";

import { bancoDeTeste } from "./apoio/banco";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

const TERCA = "2026-10-06";
const SEXTA = "2026-10-09";
const SABADO = "2026-10-10";
const MUITO_LONGE = "2026-12-15";

const TELEFONE_TESTE = "+5511900000001";
const MOTIVO_TESTE = "TESTE-FASE-3";

let salaCI: string;
let salaReuniao: string;
let salaContainer: string;

async function criarReserva(
  salaId: string,
  data: string,
  horaInicio: string,
  horaFim: string,
): Promise<void> {
  const inicio = instanteDe(data, horaInicio);
  const fim = instanteDe(data, horaFim);
  await bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: "Cliente de Teste",
      telefone: TELEFONE_TESTE,
      inicio,
      fim,
      duracaoMinutos: Math.round((fim.getTime() - inicio.getTime()) / 60_000),
      valor: "100.00",
      origem: OrigemReserva.PUBLICO,
    },
  });
}

async function criarBloqueio(
  salaId: string,
  data: string,
  horaInicio: string,
  horaFim: string,
): Promise<void> {
  await bancoDeTeste.bloqueio.create({
    data: {
      salaId,
      inicio: instanteDe(data, horaInicio),
      fim: instanteDe(data, horaFim),
      motivo: MOTIVO_TESTE,
    },
  });
}

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE_TESTE } });
  await bancoDeTeste.bloqueio.deleteMany({ where: { motivo: MOTIVO_TESTE } });
}

/** Horarios de inicio marcados como disponiveis. */
async function iniciosDisponiveis(salaId: string, data: string): Promise<string[]> {
  const blocos = await slotsDoDia(salaId, data);
  return blocos.filter((b) => b.disponivelParaInicio).map((b) => b.horario);
}

beforeAll(async () => {
  const salas = await bancoDeTeste.sala.findMany({
    where: { slug: { in: ["sala-ci", "sala-de-reuniao", "sala-container"] } },
  });
  const porSlug = new Map(salas.map((s) => [s.slug, s.id]));

  const ci = porSlug.get("sala-ci");
  const reuniao = porSlug.get("sala-de-reuniao");
  const container = porSlug.get("sala-container");

  if (!ci || !reuniao || !container) {
    throw new Error('Salas do seed nao encontradas. Rode "npm run db:seed".');
  }

  salaCI = ci;
  salaReuniao = reuniao;
  salaContainer = container;
});

beforeEach(async () => {
  // Congela apenas o relogio; a rede e o banco continuam normais.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  await limpar();
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

// =============================================================================

describe("slotsDoDia — a grade do dia", () => {
  it("monta 20 blocos de 30 min numa terca (08:00 às 18:00)", async () => {
    const blocos = await slotsDoDia(salaCI, TERCA);

    expect(BLOCO_MINUTOS).toBe(30);
    expect(blocos).toHaveLength(20);
    expect(blocos[0]?.horario).toBe("08:00");
    expect(blocos[1]?.horario).toBe("08:30");
    expect(blocos.at(-1)?.horario).toBe("17:30");
  });

  it("nao oferece o ultimo bloco do dia, onde nao cabe 1 hora", async () => {
    const blocos = await slotsDoDia(salaCI, TERCA);

    expect(blocos.at(-1)).toEqual({ horario: "17:30", disponivelParaInicio: false });
    expect(blocos.at(-2)).toEqual({ horario: "17:00", disponivelParaInicio: true });
  });

  it("devolve nenhum bloco na sexta-feira, que é fechada", async () => {
    expect(await slotsDoDia(salaCI, SEXTA)).toEqual([]);
  });

  it("monta 8 blocos no sábado (09:00 às 13:00)", async () => {
    const blocos = await slotsDoDia(salaCI, SABADO);

    expect(blocos).toHaveLength(8);
    expect(blocos[0]?.horario).toBe("09:00");
    expect(blocos.at(-1)?.horario).toBe("12:30");
  });
});

describe("limites do dia — abertura e fechamento", () => {
  it("aceita reserva colada no horário de abertura (08:00 às 09:00)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "08:00"),
      fim: instanteDe(TERCA, "09:00"),
    });

    expect(resultado.valido).toBe(true);
    expect(resultado.motivo).toBeNull();
  });

  it("aceita reserva que termina exatamente no fechamento (17:00 às 18:00)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "17:00"),
      fim: instanteDe(TERCA, "18:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("recusa reserva que ultrapassa o fechamento (17:30 às 18:30)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "17:30"),
      fim: instanteDe(TERCA, "18:30"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("DEPOIS_DO_FECHAMENTO");
    expect(resultado.motivo).toContain("18:00");
  });

  it("recusa reserva antes da abertura (07:00 às 08:00)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "07:00"),
      fim: instanteDe(TERCA, "08:00"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("ANTES_DA_ABERTURA");
  });

  it("recusa qualquer reserva na sexta-feira", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(SEXTA, "10:00"),
      fim: instanteDe(SEXTA, "11:00"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("DIA_FECHADO");
  });
});

describe("duração", () => {
  it("recusa reserva de 30 minutos", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "10:30"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("DURACAO_MINIMA");
  });

  it("recusa horário fora da grade de 30 em 30 minutos", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "10:15"),
      fim: instanteDe(TERCA, "11:15"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("FORA_DA_GRADE");
  });

  it("recusa 2h30 na Sala de Reunião, que tem teto de 120 minutos", async () => {
    const resultado = await validarReserva({
      salaId: salaReuniao,
      inicio: instanteDe(TERCA, "09:00"),
      fim: instanteDe(TERCA, "11:30"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("DURACAO_MAXIMA_DA_SALA");
    expect(resultado.motivo).toContain("120");
  });

  it("aceita exatamente 2h na Sala de Reunião", async () => {
    const resultado = await validarReserva({
      salaId: salaReuniao,
      inicio: instanteDe(TERCA, "09:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("aceita 2h30 na Sala CI, que não tem teto", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "09:00"),
      fim: instanteDe(TERCA, "11:30"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("na Sala de Reunião só oferece términos até 2h depois do início", async () => {
    expect(await horariosDeTerminoValidos(salaReuniao, TERCA, "09:00")).toEqual([
      "10:00",
      "10:30",
      "11:00",
    ]);
  });
});

describe("sábado — o dia curto", () => {
  it("às 12:00 o único término possível é 13:00", async () => {
    expect(await horariosDeTerminoValidos(salaCI, SABADO, "12:00")).toEqual(["13:00"]);
  });

  it("às 12:30 não sobra término nenhum: caberia só 30 min, e o mínimo é 60", async () => {
    expect(await horariosDeTerminoValidos(salaCI, SABADO, "12:30")).toEqual([]);
  });

  it("o bloco das 12:30 aparece na grade, mas marcado como indisponível", async () => {
    const blocos = await slotsDoDia(salaCI, SABADO);

    expect(blocos.at(-1)).toEqual({ horario: "12:30", disponivelParaInicio: false });
    expect(blocos.at(-2)).toEqual({ horario: "12:00", disponivelParaInicio: true });
  });

  it("às 09:00 oferece términos de 10:00 até 13:00", async () => {
    expect(await horariosDeTerminoValidos(salaCI, SABADO, "09:00")).toEqual([
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
    ]);
  });
});

describe("intervalo de 30 minutos entre reservas", () => {
  beforeEach(async () => {
    // Reserva de referencia: terca, 10:00 as 11:00, na Sala CI.
    await criarReserva(salaCI, TERCA, "10:00", "11:00");
  });

  it("recusa reserva colada logo DEPOIS da existente (11:00)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "11:00"),
      fim: instanteDe(TERCA, "12:00"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("INTERVALO_ENTRE_RESERVAS");
    expect(resultado.motivo).toContain("30");
  });

  it("aceita reserva com exatamente 30 min de folga depois (11:30)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "11:30"),
      fim: instanteDe(TERCA, "12:30"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("recusa reserva colada logo ANTES da existente (09:00 às 10:00)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "09:00"),
      fim: instanteDe(TERCA, "10:00"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("INTERVALO_ENTRE_RESERVAS");
  });

  it("aceita reserva com exatamente 30 min de folga antes (08:30 às 09:30)", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "08:30"),
      fim: instanteDe(TERCA, "09:30"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("recusa reserva por cima da existente", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "10:30"),
      fim: instanteDe(TERCA, "11:30"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("HORARIO_OCUPADO");
  });

  it("a grade do dia esconde os blocos sem folga suficiente", async () => {
    // Reserva 10:00-11:00 -> some 09:00, 09:30, 10:00, 10:30 e 11:00.
    expect(await iniciosDisponiveis(salaCI, TERCA)).toEqual([
      "08:00",
      "08:30",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
    ]);
  });

  it("a reserva de uma sala não atrapalha a outra (agendas independentes)", async () => {
    const resultado = await validarReserva({
      salaId: salaContainer,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("reserva cancelada libera o horário", async () => {
    await bancoDeTeste.reserva.updateMany({
      where: { telefone: TELEFONE_TESTE },
      data: { status: "CANCELADA", canceladoEm: new Date() },
    });

    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("reserva concluída libera o horário", async () => {
    await bancoDeTeste.reserva.updateMany({
      where: { telefone: TELEFONE_TESTE },
      data: { status: "CONCLUIDA" },
    });

    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.valido).toBe(true);
  });
});

describe("bloqueios administrativos — ocupam, mas não exigem folga", () => {
  beforeEach(async () => {
    // Bloqueio: terca, 14:00 as 15:00, na Sala CI.
    await criarBloqueio(salaCI, TERCA, "14:00", "15:00");
  });

  it("aceita reserva começando no minuto exato em que o bloqueio termina", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "15:00"),
      fim: instanteDe(TERCA, "16:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("aceita reserva terminando no minuto exato em que o bloqueio começa", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "13:00"),
      fim: instanteDe(TERCA, "14:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("recusa reserva por cima do bloqueio", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(TERCA, "14:30"),
      fim: instanteDe(TERCA, "15:30"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("HORARIO_OCUPADO");
  });

  it("na grade, só somem os blocos realmente cobertos pelo bloqueio", async () => {
    const disponiveis = await iniciosDisponiveis(salaCI, TERCA);

    expect(disponiveis).toContain("13:00");
    expect(disponiveis).toContain("15:00");
    expect(disponiveis).not.toContain("14:00");
    expect(disponiveis).not.toContain("14:30");
  });
});

describe("antecedência", () => {
  it("recusa reserva com menos de 1h de antecedência", async () => {
    // Agora sao 09:00 de segunda; tenta reservar as 09:30 do mesmo dia.
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe("2026-10-05", "09:30"),
      fim: instanteDe("2026-10-05", "10:30"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("ANTECEDENCIA_MINIMA");
  });

  it("aceita reserva com exatamente 1h de antecedência", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe("2026-10-05", "10:00"),
      fim: instanteDe("2026-10-05", "11:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("recusa reserva no passado", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe("2026-10-05", "08:00"),
      fim: instanteDe("2026-10-05", "09:00"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("NO_PASSADO");
  });

  it("recusa reserva a mais de 60 dias de distância", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(MUITO_LONGE, "10:00"),
      fim: instanteDe(MUITO_LONGE, "11:00"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("ANTECEDENCIA_MAXIMA");
    expect(resultado.motivo).toContain("60");
  });

  it("no dia de hoje, a grade só oferece blocos que ainda respeitam a antecedência", async () => {
    const disponiveis = await iniciosDisponiveis(salaCI, "2026-10-05");

    expect(disponiveis).not.toContain("08:00");
    expect(disponiveis).not.toContain("09:30");
    expect(disponiveis[0]).toBe("10:00");
  });
});

describe("cálculo do valor", () => {
  it("cobra 1 hora da Sala CI (R$ 50/h) como R$ 50,00", async () => {
    const valor = await calcularValor(
      salaCI,
      instanteDe(TERCA, "10:00"),
      instanteDe(TERCA, "11:00"),
    );
    expect(valor.toFixed(2)).toBe("50.00");
  });

  it("cobra 1h30 da Sala CI como R$ 75,00", async () => {
    const valor = await calcularValor(
      salaCI,
      instanteDe(TERCA, "10:00"),
      instanteDe(TERCA, "11:30"),
    );
    expect(valor.toFixed(2)).toBe("75.00");
  });

  it("cobra 3h da Sala CI como R$ 150,00", async () => {
    const valor = await calcularValor(
      salaCI,
      instanteDe(TERCA, "10:00"),
      instanteDe(TERCA, "13:00"),
    );
    expect(valor.toFixed(2)).toBe("150.00");
  });

  it("cobra 1h30 da Sala de Reunião (R$ 80/h) como R$ 120,00", async () => {
    const valor = await calcularValor(
      salaReuniao,
      instanteDe(TERCA, "10:00"),
      instanteDe(TERCA, "11:30"),
    );
    expect(valor.toFixed(2)).toBe("120.00");
  });

  it("cobra 1h30 da Sala Container (R$ 40/h) como R$ 60,00", async () => {
    const valor = await calcularValor(
      salaContainer,
      instanteDe(TERCA, "10:00"),
      instanteDe(TERCA, "11:30"),
    );
    expect(valor.toFixed(2)).toBe("60.00");
  });
});

describe("virada do horário de verão", () => {
  const SEGUNDA_SEM_VERAO = "2018-06-04";
  const SEGUNDA_COM_VERAO = "2018-11-05";

  beforeEach(() => {
    // Relogio congelado ANTES das duas datas, para nao caírem no passado.
    vi.setSystemTime(new Date("2018-10-01T12:00:00.000Z"));
  });

  it("08:00 vale 11:00 UTC fora do horário de verão", () => {
    expect(instanteDe(SEGUNDA_SEM_VERAO, "08:00").toISOString()).toBe(
      "2018-06-04T11:00:00.000Z",
    );
  });

  it("08:00 vale 10:00 UTC dentro do horário de verão (uma hora a menos)", () => {
    expect(instanteDe(SEGUNDA_COM_VERAO, "08:00").toISOString()).toBe(
      "2018-11-05T10:00:00.000Z",
    );
  });

  it("a grade do dia continua com 20 blocos das 08:00 às 17:30 dentro do horário de verão", async () => {
    const blocos = await slotsDoDia(salaCI, SEGUNDA_COM_VERAO);

    expect(blocos).toHaveLength(20);
    expect(blocos[0]?.horario).toBe("08:00");
    expect(blocos.at(-1)?.horario).toBe("17:30");
  });

  it("valida normalmente uma reserva dentro do horário de verão", async () => {
    const resultado = await validarReserva({
      salaId: salaCI,
      inicio: instanteDe(SEGUNDA_COM_VERAO, "08:00"),
      fim: instanteDe(SEGUNDA_COM_VERAO, "09:00"),
    });

    expect(resultado.valido).toBe(true);
  });

  it("o Brasil não tem mais horário de verão: em 2026 o fuso é -03:00 o ano todo", () => {
    expect(instanteDe("2026-01-15", "08:00").toISOString()).toBe(
      "2026-01-15T11:00:00.000Z",
    );
    expect(instanteDe("2026-07-15", "08:00").toISOString()).toBe(
      "2026-07-15T11:00:00.000Z",
    );
  });
});

describe("sala inexistente ou desativada", () => {
  it("recusa sala que não existe", async () => {
    const resultado = await validarReserva({
      salaId: "01999999-9999-7999-8999-999999999999",
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("SALA_INEXISTENTE");
  });

  it("não devolve grade para sala que não existe", async () => {
    expect(await slotsDoDia("01999999-9999-7999-8999-999999999999", TERCA)).toEqual([]);
  });
});
