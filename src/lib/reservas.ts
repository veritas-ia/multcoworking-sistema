/**
 * Criacao de reservas do lado do servidor.
 *
 * Camadas de protecao, nesta ordem:
 *  1. Motor da Fase 3 revalida TODAS as regras de agenda.
 *  2. Trava por telefone (advisory lock) impede que dois pedidos simultaneos
 *     furem o limite de 3 reservas ativas.
 *  3. As exclusion constraints do banco (Fase 2) sao a palavra final sobre
 *     sobreposicao de horario.
 */
import { StatusReserva } from "@/generated/prisma/enums";
import { calcularValor, validarReserva } from "@/lib/disponibilidade";
import { prisma } from "@/lib/prisma";
import { minutosEntre } from "@/lib/tempo";

export const MAXIMO_DE_RESERVAS_ATIVAS = 3;

export type FalhaAoReservar =
  | { tipo: "REGRA"; codigo: string; motivo: string }
  | { tipo: "LIMITE_DE_RESERVAS"; motivo: string }
  | { tipo: "HORARIO_TOMADO"; motivo: string };

export type ResultadoCriacao =
  | { criada: true; reservaId: string; valor: string }
  | { criada: false; falha: FalhaAoReservar };

/**
 * O banco recusou por sobreposicao de horario?
 * 23P01 e o codigo do PostgreSQL para violacao de exclusion constraint.
 */
export function ehConflitoDeHorario(erro: unknown): boolean {
  const texto =
    erro instanceof Error ? `${erro.message}` : typeof erro === "string" ? erro : "";
  return (
    texto.includes("23P01") ||
    texto.includes("ocupacao_sem_sobreposicao") ||
    texto.includes("ocupacao_intervalo_entre_reservas")
  );
}

/** Quantas reservas ativas e futuras este telefone ja tem. */
export async function contarReservasAtivas(telefone: string): Promise<number> {
  return prisma.reserva.count({
    where: {
      telefone,
      status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
      inicio: { gt: new Date() },
    },
  });
}

export async function criarReservaPublica(entrada: {
  salaId: string;
  telefone: string;
  nomeCliente: string;
  inicio: Date;
  fim: Date;
}): Promise<ResultadoCriacao> {
  const validacao = await validarReserva({
    salaId: entrada.salaId,
    inicio: entrada.inicio,
    fim: entrada.fim,
  });

  if (!validacao.valido) {
    return {
      criada: false,
      falha: {
        tipo: "REGRA",
        codigo: validacao.codigo ?? "INVALIDO",
        motivo: validacao.motivo ?? "Horário inválido.",
      },
    };
  }

  const valor = await calcularValor(entrada.salaId, entrada.inicio, entrada.fim);

  try {
    const reservaId = await prisma.$transaction(async (tx) => {
      // Segura este telefone ate o fim da transacao: dois pedidos ao mesmo
      // tempo entram em fila em vez de contarem as reservas ao mesmo tempo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entrada.telefone}))`;

      const ativas = await tx.reserva.count({
        where: {
          telefone: entrada.telefone,
          status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
          inicio: { gt: new Date() },
        },
      });

      if (ativas >= MAXIMO_DE_RESERVAS_ATIVAS) {
        throw new LimiteDeReservasAtingido();
      }

      const reserva = await tx.reserva.create({
        data: {
          salaId: entrada.salaId,
          nomeCliente: entrada.nomeCliente,
          telefone: entrada.telefone,
          inicio: entrada.inicio,
          fim: entrada.fim,
          duracaoMinutos: minutosEntre(entrada.inicio, entrada.fim),
          valor,
          status: StatusReserva.CONFIRMADA,
          origem: "PUBLICO",
        },
        select: { id: true },
      });

      return reserva.id;
    });

    return { criada: true, reservaId, valor: valor.toFixed(2) };
  } catch (erro: unknown) {
    if (erro instanceof LimiteDeReservasAtingido) {
      return {
        criada: false,
        falha: {
          tipo: "LIMITE_DE_RESERVAS",
          motivo: `Você já tem ${MAXIMO_DE_RESERVAS_ATIVAS} reservas ativas. Cancele uma para marcar outra.`,
        },
      };
    }

    if (ehConflitoDeHorario(erro)) {
      return {
        criada: false,
        falha: {
          tipo: "HORARIO_TOMADO",
          motivo: "Este horário acabou de ser reservado. Escolha outro, por favor.",
        },
      };
    }

    throw erro;
  }
}

class LimiteDeReservasAtingido extends Error {
  constructor() {
    super("Limite de reservas ativas atingido.");
    this.name = "LimiteDeReservasAtingido";
  }
}
