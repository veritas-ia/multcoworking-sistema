import type { Agenda } from "./tipos";

/**
 * Contas de calendario para a tela, feitas em cima do texto "AAAA-MM-DD".
 *
 * Por que nao usar o Date do navegador direto: o celular do cliente pode estar
 * em qualquer fuso. Se a tela criasse datas com o relogio do aparelho, um
 * cliente viajando veria o calendario deslocado em um dia. Aqui todo calculo
 * usa Date.UTC — que e so aritmetica de calendario, sem fuso nenhum — e o
 * servidor continua sendo o unico dono do relogio de Sao Paulo.
 */

/**
 * Cabecalho do calendario, na ordem domingo -> sabado.
 *
 * Nao usar a inicial de uma letra so: "segunda", "sexta" e "sabado" viram
 * todas "S", e as colunas de sexta e sabado ficam GRUDADAS. Com sexta fechada
 * e riscada do lado do sabado aberto, quem olha nao tem como saber qual das
 * duas colunas "S" esta bloqueada.
 */
export const DIAS_CURTOS = [
  "dom",
  "seg",
  "ter",
  "qua",
  "qui",
  "sex",
  "sáb",
] as const;

const DIAS_POR_EXTENSO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

type Partes = { ano: number; mes: number; dia: number };

export function partesDe(data: string): Partes {
  const [ano, mes, dia] = data.split("-").map(Number);
  return { ano: ano ?? 0, mes: mes ?? 1, dia: dia ?? 1 };
}

export function montarData(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** 0 = domingo ... 6 = sabado. */
export function diaDaSemanaDe(data: string): number {
  const { ano, mes, dia } = partesDe(data);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** "AAAA-MM" — usado para comparar e navegar entre meses. */
export function mesDe(data: string): string {
  return data.slice(0, 7);
}

export function somarMeses(mes: string, quantidade: number): string {
  const [ano, numero] = mes.split("-").map(Number);
  const total = (ano ?? 0) * 12 + (numero ?? 1) - 1 + quantidade;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** "2026-10" -> "Outubro de 2026". */
export function nomeDoMes(mes: string): string {
  const [ano, numero] = mes.split("-").map(Number);
  const nome = MESES[(numero ?? 1) - 1] ?? "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${ano}`;
}

/** "2026-10-06" -> "terça-feira, 6 de outubro de 2026". */
export function dataPorExtenso(data: string): string {
  const { ano, mes, dia } = partesDe(data);
  return `${DIAS_POR_EXTENSO[diaDaSemanaDe(data)]}, ${dia} de ${MESES[mes - 1]} de ${ano}`;
}

/** "2026-10-06" -> "ter, 6 de outubro". Versao curta, para o resumo. */
export function dataCurta(data: string): string {
  const { mes, dia } = partesDe(data);
  return `${DIAS_POR_EXTENSO[diaDaSemanaDe(data)].slice(0, 3)}, ${dia} de ${MESES[mes - 1]}`;
}

/** Minutos entre duas horas "HH:MM" do mesmo dia. */
export function minutosEntreHoras(inicio: string, fim: string): number {
  return emMinutos(fim) - emMinutos(inicio);
}

function emMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 60 -> "1 hora"; 90 -> "1h30"; 120 -> "2 horas". */
export function duracaoPorExtenso(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (resto === 0) {
    return horas === 1 ? "1 hora" : `${horas} horas`;
  }
  if (horas === 0) {
    return `${resto} minutos`;
  }
  return `${horas}h${String(resto).padStart(2, "0")}`;
}

/** Centavos -> "R$ 120,00". */
export function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Valor estimado da reserva, em centavos.
 * Mesma conta do servidor: preco da hora proporcional aos minutos.
 * O valor que vale e sempre o que o servidor devolve na confirmacao.
 */
export function valorEstimadoEmCentavos(
  precoPorHora: string,
  minutos: number,
): number {
  const centavosDaHora = Math.round(Number(precoPorHora) * 100);
  return Math.round((centavosDaHora * minutos) / 60);
}

// -----------------------------------------------------------------------------
// Quais dias podem ser escolhidos
// -----------------------------------------------------------------------------

/**
 * Por que aquele dia nao pode ser escolhido. Nulo quando pode.
 *
 * A lista de dias fechados vem do banco (tabela HorarioFuncionamento, via
 * /api/publico/agenda). Nada aqui e chumbado: se a equipe passar a abrir na
 * sexta, esta funcao acompanha sozinha.
 */
export function motivoDoBloqueioDoDia(data: string, agenda: Agenda): string | null {
  if (data < agenda.primeiraData) {
    return "cedo demais para reservar";
  }
  if (data > agenda.ultimaData) {
    return `só dá para reservar até ${agenda.antecedenciaMaximaDias} dias à frente`;
  }
  if (agenda.diasFechados.includes(diaDaSemanaDe(data))) {
    return "fechado";
  }
  return null;
}

// -----------------------------------------------------------------------------
// Resumo do horario de funcionamento
// -----------------------------------------------------------------------------

/** Ordem em que a gente le a semana no Brasil: segunda primeiro, domingo por ultimo. */
const ORDEM_DA_SEMANA = [1, 2, 3, 4, 5, 6, 0];

const NOMES_CURTOS: Record<number, string> = {
  0: "dom",
  1: "seg",
  2: "ter",
  3: "qua",
  4: "qui",
  5: "sex",
  6: "sáb",
};

/** "08:00" -> "08h"; "13:30" -> "13h30". */
function emHoras(hora: string): string {
  const [h, m] = hora.split(":");
  return m === "00" ? `${h}h` : `${h}h${m}`;
}

/** ["seg","ter","qua","qui"] -> "Seg a qui"; ["sex","dom"] -> "Sex e dom". */
function juntarDias(dias: string[], comoIntervalo: boolean): string {
  const texto =
    dias.length === 1
      ? dias[0]
      : comoIntervalo && dias.length > 2
        ? `${dias[0]} a ${dias[dias.length - 1]}`
        : `${dias.slice(0, -1).join(", ")} e ${dias[dias.length - 1]}`;

  return `${(texto ?? "").charAt(0).toUpperCase()}${(texto ?? "").slice(1)}`;
}

/**
 * Uma linha so com o horario da casa, juntando os dias iguais:
 * "Seg a qui: 08h–18h · Sáb: 09h–13h · Sex e dom: fechado."
 *
 * Os dias abertos entram em blocos seguidos que compartilham o mesmo horario;
 * os fechados vao todos juntos no fim, mesmo sem serem seguidos.
 */
export function resumoDoFuncionamento(agenda: Agenda): string {
  const horarioDoDia = new Map(
    agenda.diasAbertos.map((dia) => [
      dia.diaDaSemana,
      `${emHoras(dia.horaAbertura)}–${emHoras(dia.horaFechamento)}`,
    ]),
  );

  const partes: string[] = [];
  let bloco: { horario: string; dias: string[] } | null = null;

  for (const dia of ORDEM_DA_SEMANA) {
    const horario = horarioDoDia.get(dia);

    if (horario === undefined) {
      // Dia fechado: fecha o bloco aberto que estava em andamento.
      if (bloco) {
        partes.push(`${juntarDias(bloco.dias, true)}: ${bloco.horario}`);
        bloco = null;
      }
      continue;
    }

    if (bloco && bloco.horario === horario) {
      bloco.dias.push(NOMES_CURTOS[dia] ?? "");
    } else {
      if (bloco) {
        partes.push(`${juntarDias(bloco.dias, true)}: ${bloco.horario}`);
      }
      bloco = { horario, dias: [NOMES_CURTOS[dia] ?? ""] };
    }
  }

  if (bloco) {
    partes.push(`${juntarDias(bloco.dias, true)}: ${bloco.horario}`);
  }

  const fechados = ORDEM_DA_SEMANA.filter((dia) => !horarioDoDia.has(dia)).map(
    (dia) => NOMES_CURTOS[dia] ?? "",
  );

  if (fechados.length > 0) {
    partes.push(`${juntarDias(fechados, false)}: fechado`);
  }

  return `${partes.join(" · ")}.`;
}
