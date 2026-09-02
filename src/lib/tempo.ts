/**
 * Conversao entre "hora do relogio em Sao Paulo" e "instante universal".
 *
 * Regra do projeto: o banco guarda instantes em UTC; toda conta de agenda
 * acontece no fuso de Sao Paulo. Este arquivo e a unica ponte entre os dois.
 * Nenhum outro lugar do sistema pode assumir que o servidor esta em -03:00.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const FUSO = "America/Sao_Paulo";

/** Data no formato "AAAA-MM-DD" (dia do calendario em Sao Paulo). */
export type DataLocal = string;

/** Hora no formato "HH:MM" (relogio de Sao Paulo). */
export type HoraLocal = string;

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validarDataLocal(data: string): DataLocal {
  if (!FORMATO_DATA.test(data)) {
    throw new Error(`Data invalida: "${data}". Use o formato AAAA-MM-DD.`);
  }
  return data;
}

export function validarHoraLocal(hora: string): HoraLocal {
  if (!FORMATO_HORA.test(hora)) {
    throw new Error(`Hora invalida: "${hora}". Use o formato HH:MM.`);
  }
  return hora;
}

/** "2026-10-06" + "08:00" -> o instante universal correspondente. */
export function instanteDe(data: DataLocal, hora: HoraLocal): Date {
  validarDataLocal(data);
  validarHoraLocal(hora);
  return fromZonedTime(`${data}T${hora}:00.000`, FUSO);
}

/** Instante universal -> "08:00" no relogio de Sao Paulo. */
export function horaLocalDe(instante: Date): HoraLocal {
  return formatInTimeZone(instante, FUSO, "HH:mm");
}

/** Instante universal -> "2026-10-06" no calendario de Sao Paulo. */
export function dataLocalDe(instante: Date): DataLocal {
  return formatInTimeZone(instante, FUSO, "yyyy-MM-dd");
}

/**
 * Dia da semana de uma data local: 0 = domingo ... 6 = sabado.
 * Usa o meio-dia para nao esbarrar em viradas de horario de verao,
 * que sempre acontecem de madrugada.
 */
export function diaDaSemanaDe(data: DataLocal): number {
  const meioDia = instanteDe(data, "12:00");
  const isoSegundaAteDomingo = Number(formatInTimeZone(meioDia, FUSO, "i"));
  return isoSegundaAteDomingo === 7 ? 0 : isoSegundaAteDomingo;
}

/** Soma minutos a um instante. */
export function somarMinutos(instante: Date, minutos: number): Date {
  return new Date(instante.getTime() + minutos * 60_000);
}

/** Diferenca entre dois instantes, em minutos. */
export function minutosEntre(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / 60_000);
}
