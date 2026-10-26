import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { editarEmpresa } from "@/lib/empresas";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  nome: z.string().min(1).optional(),
  ativa: z.boolean().optional(),
});

/**
 * PATCH /api/admin/empresas/[id] — renomeia ou liga/desliga.
 *
 * Nao existe DELETE de proposito: apagar a empresa levaria junto os vinculos
 * e o historico dela sumiria do relatorio sem aviso. Desligar tira dos
 * relatorios novos e mantem o passado — mesma regra das salas (Fase 11).
 */
export async function PATCH(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await params;
  const resultado = await editarEmpresa(id, corpo.data);

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalhaAdmin(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ empresa: resultado.dados });
}
