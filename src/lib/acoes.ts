/**
 * O HISTORICO DE ACOES: o que a equipe fez, guardado para sempre.
 *
 * POR QUE ISTO EXISTE
 *
 * Passou a ser possivel EXCLUIR uma reserva lancada por engano. Excluir apaga
 * a prova — e a prova e o que permite responder, tres meses depois, "por que o
 * relatorio de outubro mudou?" ou "cade a reserva da Toca do dia 14?".
 *
 * Pedido do dono, com a palavra dele: *"mesmo que exclua, a gente pelo menos
 * tem esse dado. Olha: foi excluída uma reserva no horário tal, no dia tal, de
 * um cliente tal. Pelo menos a gente sabe que aconteceu essa ação. Aí sim, é
 * uma evidência."*
 *
 * DUAS REGRAS QUE NAO PODEM MUDAR
 *
 * 1. O RESUMO E CONGELADO no momento da acao. A reserva excluida nao existe
 *    mais para ser consultada, e o cliente dela pode ter sido desligado
 *    depois. Montar a frase na hora de LER deixaria o historico em branco
 *    justamente no caso que mais importa.
 *
 * 2. ESTE REGISTRO NUNCA SE APAGA. Nao existe funcao aqui que o remova, nao
 *    existe rota, e a faxina diaria nao o toca. Um registro de evidencia que
 *    pode ser apagado nao e evidencia.
 */
import type { Prisma } from "@/generated/prisma/client";
import { TipoDeAcao } from "@/generated/prisma/enums";

import { prisma } from "./prisma";

export { TipoDeAcao };

/** Uma acao, como a tela de historico mostra. */
export type AcaoNaLista = {
  id: string;
  tipo: TipoDeAcao;
  /** A frase pronta, escrita no momento da acao. */
  resumo: string;
  motivo: string | null;
  /** Quem fez. Vem gravado na linha, e nao da tabela de usuarios. */
  usuarioNome: string;
  /** O detalhe congelado: sala, cliente, telefone, dia, horario, valor… */
  dados: Record<string, unknown>;
  criadoEm: Date;
};

/**
 * Grava uma acao.
 *
 * Recebe o "tx" para rodar DENTRO da transacao de quem chama: numa exclusao,
 * ou as duas coisas acontecem (o registro nasce e a reserva some) ou nenhuma.
 * Gravando por fora, uma falha no meio deixaria a reserva apagada sem registro
 * nenhum — exatamente o que este modulo existe para impedir.
 */
export async function registrarAcao(
  tx: Prisma.TransactionClient,
  entrada: {
    tipo: TipoDeAcao;
    resumo: string;
    dados: Prisma.InputJsonValue;
    usuario: { id: string; nome: string };
    motivo?: string | null;
  },
): Promise<void> {
  await tx.acaoRegistrada.create({
    data: {
      tipo: entrada.tipo,
      resumo: entrada.resumo,
      dados: entrada.dados,
      usuarioId: entrada.usuario.id,
      // O nome vai GRAVADO na linha: o usuario pode ser desligado, e a
      // evidencia nao pode virar "alguem fez isso".
      usuarioNome: entrada.usuario.nome,
      motivo: entrada.motivo?.trim() || null,
    },
  });
}

/**
 * As acoes, da mais recente para a mais antiga.
 *
 * Sem filtro de periodo de proposito: a lista e curta (so acoes destrutivas
 * entram) e quem procura aqui esta procurando uma coisa especifica que nao
 * sabe quando aconteceu.
 */
export async function listarAcoes(opcoes?: {
  tipo?: TipoDeAcao;
  limite?: number;
}): Promise<AcaoNaLista[]> {
  const linhas = await prisma.acaoRegistrada.findMany({
    where: opcoes?.tipo ? { tipo: opcoes.tipo } : {},
    orderBy: { criadoEm: "desc" },
    take: opcoes?.limite ?? 200,
  });

  return linhas.map((linha) => ({
    id: linha.id,
    tipo: linha.tipo,
    resumo: linha.resumo,
    motivo: linha.motivo,
    usuarioNome: linha.usuarioNome,
    dados: linha.dados as Record<string, unknown>,
    criadoEm: linha.criadoEm,
  }));
}
