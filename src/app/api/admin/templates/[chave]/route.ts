import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { salvarTemplate } from "@/lib/templates-admin";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({ texto: z.string() });

/** PATCH /api/admin/templates/[chave] — grava um modelo. */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ chave: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { chave } = await contexto.params;
  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await salvarTemplate(chave, corpo.data.texto);

  if (!resultado.ok) {
    return respostaErro(
      resultado.falha.codigo === "NAO_ENCONTRADO" ? 404 : 422,
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ template: resultado.dados });
}
