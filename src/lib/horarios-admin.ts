/**
 * HORARIO DE FUNCIONAMENTO (Fase 11).
 *
 * Regra do CLAUDE.md que manda neste arquivo: mudar o horario NAO apaga
 * reserva nenhuma. O sistema mostra quais reservas ficaram fora do novo
 * horario e deixa a equipe decidir uma a uma.
 *
 * "Ficou fora" aqui quer dizer: a reserva CABIA no horario antigo e NAO cabe
 * mais no novo. Uma reserva que a recepcao ja tinha lancado de proposito fora
 * do expediente (evento pontual, decisao do CLAUDE.md) nao aparece nessa
 * lista: ela nao foi quebrada por esta mudanca, e enche-la de avisos que a
 * equipe ja conhece so faria a lista ser ignorada.
 *
 * As horas so aceitam :00 ou :30 — a mesma grade de meia hora da agenda.
 * O proprio banco tambem cobra isso (ver a migracao "travas_de_horario").
 */
import { StatusReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dataLocalDe, diaDaSemanaDe, horaLocalDe } from "@/lib/tempo";

export type DiaDeFuncionamento = {
  /** 0 = domingo ... 6 = sabado. */
  diaDaSemana: number;
  aberto: boolean;
  /** "HH:MM" no relogio de Sao Paulo. Nulo quando o dia e fechado. */
  horaAbertura: string | null;
  horaFechamento: string | null;
};

export type ReservaForaDoHorario = {
  id: string;
  sala: string;
  nomeCliente: string;
  telefone: string;
  data: string;
  inicio: string;
  fim: string;
  status: StatusReserva;
  /** Explicacao pronta: "sábado passa a ser fechado", por exemplo. */
  motivo: string;
};

export type FalhaDeHorario = { codigo: "REGRA"; motivo: string };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeHorario };

export const NOMES_DOS_DIAS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const FORMATO_DE_HORA = /^([01]\d|2[0-3]):(00|30)$/;

// -----------------------------------------------------------------------------
// Leitura
// -----------------------------------------------------------------------------

export async function listarHorarios(): Promise<DiaDeFuncionamento[]> {
  const linhas = await prisma.horarioFuncionamento.findMany({
    orderBy: { diaDaSemana: "asc" },
  });

  return linhas.map((linha) => ({
    diaDaSemana: linha.diaDaSemana,
    aberto: linha.aberto,
    horaAbertura: linha.horaAbertura,
    horaFechamento: linha.horaFechamento,
  }));
}

// -----------------------------------------------------------------------------
// Conferencia
// -----------------------------------------------------------------------------

export function validarHorarios(dias: DiaDeFuncionamento[]): string | null {
  if (dias.length !== 7) {
    return "É preciso informar os sete dias da semana.";
  }

  const vistos = new Set<number>();

  for (const dia of dias) {
    if (!Number.isInteger(dia.diaDaSemana) || dia.diaDaSemana < 0 || dia.diaDaSemana > 6) {
      return "Dia da semana inválido.";
    }

    if (vistos.has(dia.diaDaSemana)) {
      return `O dia ${NOMES_DOS_DIAS[dia.diaDaSemana]} apareceu duas vezes.`;
    }

    vistos.add(dia.diaDaSemana);

    const nome = NOMES_DOS_DIAS[dia.diaDaSemana];

    if (!dia.aberto) {
      continue;
    }

    if (!dia.horaAbertura || !dia.horaFechamento) {
      return `Preencha a abertura e o fechamento de ${nome}, ou marque o dia como fechado.`;
    }

    if (!FORMATO_DE_HORA.test(dia.horaAbertura) || !FORMATO_DE_HORA.test(dia.horaFechamento)) {
      return `Em ${nome}, use horas terminadas em :00 ou :30 — a agenda é feita de blocos de meia hora.`;
    }

    if (dia.horaAbertura >= dia.horaFechamento) {
      return `Em ${nome}, o fechamento precisa ser depois da abertura.`;
    }
  }

  if (dias.every((dia) => !dia.aberto)) {
    return "Pelo menos um dia da semana precisa ficar aberto.";
  }

  return null;
}

/** A reserva cabe dentro deste horario? */
function cabeNoHorario(
  dias: Map<number, DiaDeFuncionamento>,
  reserva: { inicio: Date; fim: Date },
): boolean {
  const data = dataLocalDe(reserva.inicio);
  const dia = dias.get(diaDaSemanaDe(data));

  if (!dia?.aberto || !dia.horaAbertura || !dia.horaFechamento) {
    return false;
  }

  // Reserva que atravessa a meia-noite nunca cabe num expediente de um dia so.
  if (dataLocalDe(reserva.fim) !== data && horaLocalDe(reserva.fim) !== "00:00") {
    return false;
  }

  const inicio = horaLocalDe(reserva.inicio);
  const fim = horaLocalDe(reserva.fim);

  return inicio >= dia.horaAbertura && fim <= dia.horaFechamento;
}

function motivoDe(
  novo: Map<number, DiaDeFuncionamento>,
  reserva: { inicio: Date; fim: Date },
): string {
  const data = dataLocalDe(reserva.inicio);
  const dia = novo.get(diaDaSemanaDe(data));
  const nome = NOMES_DOS_DIAS[diaDaSemanaDe(data)];

  if (!dia?.aberto || !dia.horaAbertura || !dia.horaFechamento) {
    return `${nome} passa a ser dia fechado`;
  }

  if (horaLocalDe(reserva.inicio) < dia.horaAbertura) {
    return `começa antes da nova abertura (${dia.horaAbertura})`;
  }

  return `termina depois do novo fechamento (${dia.horaFechamento})`;
}

function comoMapa(dias: DiaDeFuncionamento[]): Map<number, DiaDeFuncionamento> {
  return new Map(dias.map((dia) => [dia.diaDaSemana, dia]));
}

/**
 * Quais reservas futuras o novo horario deixaria de fora.
 *
 * So entram as que CABIAM no horario atual: as que ja estavam fora antes da
 * mudanca foram lancadas assim de proposito pela recepcao.
 */
export async function reservasQueFicamForaDoHorario(
  novos: DiaDeFuncionamento[],
): Promise<ReservaForaDoHorario[]> {
  const atuais = comoMapa(await listarHorarios());
  const novo = comoMapa(novos);

  const reservas = await prisma.reserva.findMany({
    where: {
      inicio: { gte: new Date() },
      status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
    },
    include: { sala: { select: { nome: true } } },
    orderBy: { inicio: "asc" },
  });

  return reservas
    .filter(
      (reserva) => cabeNoHorario(atuais, reserva) && !cabeNoHorario(novo, reserva),
    )
    .map((reserva) => ({
      id: reserva.id,
      sala: reserva.sala.nome,
      nomeCliente: reserva.nomeCliente,
      telefone: reserva.telefone,
      data: dataLocalDe(reserva.inicio),
      inicio: horaLocalDe(reserva.inicio),
      fim: horaLocalDe(reserva.fim),
      status: reserva.status,
      motivo: motivoDe(novo, reserva),
    }));
}

// -----------------------------------------------------------------------------
// Escrita
// -----------------------------------------------------------------------------

/**
 * Grava o novo horario.
 *
 * Devolve junto a lista de reservas que ficaram fora — elas NAO sao mexidas.
 * Quem decide o que fazer com cada uma e a equipe, na agenda.
 */
export async function salvarHorarios(
  novos: DiaDeFuncionamento[],
): Promise<Resultado<{ horarios: DiaDeFuncionamento[]; reservasForaDoHorario: ReservaForaDoHorario[] }>> {
  const erro = validarHorarios(novos);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  // Levantadas ANTES de gravar: depois da gravacao o horario antigo ja nao
  // existe para comparar.
  const afetadas = await reservasQueFicamForaDoHorario(novos);

  await prisma.$transaction(
    novos.map((dia) =>
      prisma.horarioFuncionamento.update({
        where: { diaDaSemana: dia.diaDaSemana },
        data: {
          aberto: dia.aberto,
          horaAbertura: dia.aberto ? dia.horaAbertura : null,
          horaFechamento: dia.aberto ? dia.horaFechamento : null,
        },
      }),
    ),
  );

  return {
    ok: true,
    dados: { horarios: await listarHorarios(), reservasForaDoHorario: afetadas },
  };
}
