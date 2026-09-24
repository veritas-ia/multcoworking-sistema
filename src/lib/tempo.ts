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

/** Como o cliente le o dia da semana nas mensagens de WhatsApp. */
const DIAS_POR_EXTENSO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

/**
 * Instante universal -> "15/09 (terça-feira)", no relogio de Sao Paulo.
 *
 * E assim que a data aparece nas mensagens de WhatsApp. O formato do banco
 * ("2026-09-15") e otimo para o sistema e frio para quem le no celular; e o
 * dia da semana e o que faz a pessoa se situar sem abrir o calendario.
 *
 * Sem o ano de proposito: as reservas ficam a no maximo 60 dias de distancia
 * (antecedencia maxima), entao o ano so ocuparia espaco.
 *
 * O FUSO importa aqui. Uma reserva das 21h de segunda e, em UTC, meia-noite
 * de terca — se a conversa fosse feita no fuso do servidor, a mensagem diria
 * o dia errado, e justamente nas reservas do fim da tarde.
 */
export function dataAmigavelDe(instante: Date): string {
  const data = dataLocalDe(instante);
  const [, mes, dia] = data.split("-");

  return `${dia}/${mes} (${DIAS_POR_EXTENSO[diaDaSemanaDe(data)]})`;
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
