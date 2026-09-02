import type { MotivoFalha } from "@/lib/minhas-reservas";

/** Que codigo HTTP cada recusa vira. */
export function statusDaFalha(codigo: MotivoFalha): number {
  switch (codigo) {
    // Reserva inexistente e reserva de outra pessoa respondem igual.
    case "NAO_ENCONTRADA":
      return 404;
    // Conflito com o estado atual da agenda.
    case "JA_ENCERRADA":
    case "HORARIO_TOMADO":
      return 409;
    // A regra em si nao permite.
    default:
      return 422;
  }
}
