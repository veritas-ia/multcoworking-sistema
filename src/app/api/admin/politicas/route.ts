import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { POLITICAS, lerPoliticas, salvarPoliticas } from "@/lib/politicas";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  politicaCancelamento: z.string(),
  avisoDoValor: z.string(),
});

/** GET /api/admin/politicas */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({ definicoes: POLITICAS, textos: await lerPoliticas() });
}

/** PATCH /api/admin/politicas */
export async function PATCH(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await salvarPoliticas(corpo.data);

  if (!resultado.ok) {
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json({ definicoes: POLITICAS, textos: resultado.dados });
}
