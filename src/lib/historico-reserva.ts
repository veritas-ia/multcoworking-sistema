/**
 * HISTORICO DE ALTERACOES DA RESERVA.
 *
 * Cada mudanca vira uma linha guardada no campo "historicoAlteracoes".
 * O CLAUDE.md exige guardar o historico dos reagendamentos; a Fase 8
 * acrescentou a exigencia de registrar QUEM fez cada acao.
 *
 * Compatibilidade: as linhas gravadas na Fase 6 nao tem o campo "quem".
 * A leitura trata isso como "o proprio cliente" — que e o que era.
 */
import type { Prisma } from "@/generated/prisma/client";

export type AcaoDoHistorico = "CRIADA" | "REAGENDADA" | "CANCELADA" | "EDITADA";

export type AutorDaAcao =
  | { por: "CLIENTE" }
  | { por: "ADMIN"; quemId: string | null; quemNome: string };

export type Momento = {
  salaId: string;
  inicio: string;
  fim: string;
  valor: string;
};

export type EntradaDeHistorico = AutorDaAcao & {
  /** Instante da acao, em ISO. */
  em: string;
  acao: AcaoDoHistorico;
  /** Como estava antes. */
  de?: Momento;
  /** Como ficou. So no reagendamento. */
  para?: Momento;
  /** Campos trocados numa edicao de cadastro (nome, telefone). */
  camposEditados?: string[];
};

/** Acrescenta uma linha sem perder o que ja estava la. */
export function historicoCom(
  atual: Prisma.JsonValue,
  nova: EntradaDeHistorico,
): Prisma.InputJsonValue {
  const anterior = Array.isArray(atual) ? atual : [];
  return [...anterior, nova] as Prisma.InputJsonValue;
}

/**
 * Le o historico guardado, descartando o que estiver corrompido.
 *
 * O campo e JSON livre no banco: se alguem mexer na mao e deixar lixo, a tela
 * do painel nao pode quebrar por causa disso.
 */
export function lerHistorico(atual: Prisma.JsonValue): EntradaDeHistorico[] {
  if (!Array.isArray(atual)) {
    return [];
  }

  return atual.filter((linha): linha is EntradaDeHistorico => {
    if (typeof linha !== "object" || linha === null) {
      return false;
    }
    const candidata = linha as Partial<EntradaDeHistorico>;
    return typeof candidata.em === "string" && typeof candidata.acao === "string";
  });
}

/** Nome de quem fez a acao, pronto para a tela. */
export function autorPorExtenso(entrada: EntradaDeHistorico): string {
  if (entrada.por === "ADMIN") {
    return entrada.quemNome || "equipe";
  }
  return "cliente";
}
