/**
 * CONTAS DE DATA DAS SERIES RECORRENTES (Fase 9).
 *
 * Modulo puro: nao encosta no banco nem em fuso horario. Trabalha com o texto
 * "AAAA-MM-DD" e aritmetica de calendario (Date.UTC), pelo mesmo motivo do
 * calendario da area publica — assim a conta nao muda conforme o relogio da
 * maquina.
 *
 * Regra de ouro do CLAUDE.md: a base e SEMPRE dia da semana, NUNCA dia do
 * numero do mes. "Toda primeira terca", nunca "todo dia 15".
 */

export type Frequencia = "SEMANAL" | "QUINZENAL" | "MENSAL";

/** 1, 2, 3 = primeira/segunda/terceira do mes; -1 = ultima. */
export type SemanaDoMes = 1 | 2 | 3 | -1;

export type Serie = {
  /** 0 = domingo ... 6 = sabado. Um ou mais. */
  diasDaSemana: number[];
  frequencia: Frequencia;
  /** Obrigatorio quando a frequencia e MENSAL. */
  semanaDoMes?: SemanaDoMes | null;
  dataInicio: string;
  dataFim: string;
};

/** Quantos dias tem o mes. */
function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function partes(data: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = data.split("-").map(Number);
  return { ano: ano ?? 0, mes: mes ?? 1, dia: dia ?? 1 };
}

function montar(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** 0 = domingo ... 6 = sabado. */
export function diaDaSemana(data: string): number {
  const { ano, mes, dia } = partes(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function somarDias(data: string, dias: number): string {
  const { ano, mes, dia } = partes(data);
  const base = new Date(Date.UTC(ano, mes - 1, dia));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Diferenca em dias inteiros entre duas datas. */
function diasEntre(de: string, ate: string): number {
  const a = partes(de);
  const b = partes(ate);
  const inicio = Date.UTC(a.ano, a.mes - 1, a.dia);
  const fim = Date.UTC(b.ano, b.mes - 1, b.dia);
  return Math.round((fim - inicio) / 86_400_000);
}

/**
 * A data do N-esimo dia-da-semana daquele mes.
 *
 * ordinal 1..3 conta do comeco; -1 pega o ULTIMO. Devolve null quando o mes
 * nao tem aquela ocorrencia (ex.: a "terceira segunda" existe sempre, mas
 * pedir a quinta nao existiria).
 *
 * O caso que costuma dar errado e a "ultima": num mes com 5 tercas, a ultima
 * e a quinta, nao a quarta. Por isso ela e calculada de tras para frente.
 */
export function diaDaSemanaDoMes(
  ano: number,
  mes: number,
  dia: number,
  ordinal: SemanaDoMes,
): string | null {
  if (ordinal === -1) {
    const ultimo = diasNoMes(ano, mes);
    for (let numero = ultimo; numero >= 1; numero -= 1) {
      const data = montar(ano, mes, numero);
      if (diaDaSemana(data) === dia) {
        return data;
      }
    }
    return null;
  }

  let encontradas = 0;
  const total = diasNoMes(ano, mes);

  for (let numero = 1; numero <= total; numero += 1) {
    const data = montar(ano, mes, numero);
    if (diaDaSemana(data) === dia) {
      encontradas += 1;
      if (encontradas === ordinal) {
        return data;
      }
    }
  }

  return null;
}

/**
 * Todas as datas que a serie produz, em ordem.
 *
 * SEMANAL   — todo dia escolhido, toda semana.
 * QUINZENAL — todo dia escolhido, em semanas SIM e semanas NAO, contadas a
 *             partir da semana da data de inicio.
 * MENSAL    — em cada mes do periodo, o N-esimo dia-da-semana escolhido.
 *
 * Datas fora do periodo pedido nunca entram. Duplicatas nao acontecem porque
 * cada data e visitada uma vez so.
 */
export function datasDaSerie(serie: Serie): string[] {
  if (serie.diasDaSemana.length === 0 || serie.dataFim < serie.dataInicio) {
    return [];
  }

  const dias = new Set(serie.diasDaSemana);

  if (serie.frequencia === "MENSAL") {
    return datasMensais(serie, dias);
  }

  const datas: string[] = [];
  // Para a quinzenal, a semana zero e a da data de inicio. O domingo dessa
  // semana e a referencia: assim "quinzenal" nao depende do dia em que a
  // pessoa comecou a contar.
  const domingoDeReferencia = somarDias(
    serie.dataInicio,
    -diaDaSemana(serie.dataInicio),
  );

  for (
    let data = serie.dataInicio;
    data <= serie.dataFim;
    data = somarDias(data, 1)
  ) {
    if (!dias.has(diaDaSemana(data))) {
      continue;
    }

    if (serie.frequencia === "QUINZENAL") {
      const semanas = Math.floor(diasEntre(domingoDeReferencia, data) / 7);
      if (semanas % 2 !== 0) {
        continue;
      }
    }

    datas.push(data);
  }

  return datas;
}

function datasMensais(serie: Serie, dias: Set<number>): string[] {
  const ordinal = serie.semanaDoMes;

  if (!ordinal) {
    return [];
  }

  const datas: string[] = [];
  const inicio = partes(serie.dataInicio);
  const fim = partes(serie.dataFim);

  const primeiroMes = inicio.ano * 12 + inicio.mes - 1;
  const ultimoMes = fim.ano * 12 + fim.mes - 1;

  for (let contador = primeiroMes; contador <= ultimoMes; contador += 1) {
    const ano = Math.floor(contador / 12);
    const mes = (contador % 12) + 1;

    for (const dia of [...dias].sort((a, b) => a - b)) {
      const data = diaDaSemanaDoMes(ano, mes, dia, ordinal);

      if (data && data >= serie.dataInicio && data <= serie.dataFim) {
        datas.push(data);
      }
    }
  }

  return datas.sort();
}

const NOMES = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
] as const;

const ORDINAIS: Record<number, string> = {
  1: "primeira",
  2: "segunda",
  3: "terceira",
  [-1]: "última",
};

/** "toda terça e quarta" / "a primeira terça de cada mês" — para a tela. */
export function serieporExtenso(serie: Serie): string {
  const dias = [...serie.diasDaSemana]
    .sort((a, b) => a - b)
    .map((dia) => NOMES[dia] ?? "");

  const lista =
    dias.length === 1
      ? dias[0]
      : `${dias.slice(0, -1).join(", ")} e ${dias[dias.length - 1]}`;

  if (serie.frequencia === "MENSAL") {
    const ordinal = ORDINAIS[serie.semanaDoMes ?? 1] ?? "primeira";
    return `a ${ordinal} ${lista} de cada mês`;
  }

  if (serie.frequencia === "QUINZENAL") {
    return `${lista}, a cada duas semanas`;
  }

  return `toda ${lista}`;
}
