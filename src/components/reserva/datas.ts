/**
 * Contas de calendario para a tela, feitas em cima do texto "AAAA-MM-DD".
 *
 * Por que nao usar o Date do navegador direto: o celular do cliente pode estar
 * em qualquer fuso. Se a tela criasse datas com o relogio do aparelho, um
 * cliente viajando veria o calendario deslocado em um dia. Aqui todo calculo
 * usa Date.UTC — que e so aritmetica de calendario, sem fuso nenhum — e o
 * servidor continua sendo o unico dono do relogio de Sao Paulo.
 */

export const DIAS_CURTOS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

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
