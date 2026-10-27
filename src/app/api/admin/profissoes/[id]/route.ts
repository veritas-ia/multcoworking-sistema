import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { editarProfissao, moverProfissao } from "@/lib/profissoes";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

const Mudanca = z.object({
  nome: z.string().min(1).optional(),
  ativa: z.boolean().optional(),
  bloqueada: z.boolean().optional(),
  /** Texto vazio volta ao aviso genérico. */
  avisoBloqueio: z.string().max(400).nullish(),
  /** Mover uma posição na lista. */
  mover: z.enum(["SUBIR", "DESCER"]).optional(),
});

/**
 * PATCH /api/admin/profissoes/[id] — renomeia, liga/desliga, bloqueia ou move.
 *
 * NAO EXISTE DELETE, de proposito: as reservas antigas apontam para a area, e
 * apagar deixaria o relatorio sem explicacao. Mesma regra das salas e das
 * empresas — desligar tira das telas de reserva e mantem o historico.
 */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const corpo = Mudanca.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  if (corpo.data.mover) {
    const movida = await moverProfissao(id, corpo.data.mover);

    return movida.ok
      ? NextResponse.json({ profissoes: movida.dados })
      : respostaErro(422, movida.falha.motivo, movida.falha.codigo);
  }

  const resultado = await editarProfissao(id, {
    ...(corpo.data.nome !== undefined ? { nome: corpo.data.nome } : {}),
    ...(corpo.data.ativa !== undefined ? { ativa: corpo.data.ativa } : {}),
    ...(corpo.data.bloqueada !== undefined ? { bloqueada: corpo.data.bloqueada } : {}),
    ...(corpo.data.avisoBloqueio !== undefined
      ? { avisoBloqueio: corpo.data.avisoBloqueio }
      : {}),
  });

  return resultado.ok
    ? NextResponse.json({ profissao: resultado.dados })
    : respostaErro(
        resultado.falha.codigo === "NAO_ENCONTRADA" ? 404 : 422,
        resultado.falha.motivo,
        resultado.falha.codigo,
      );
}
