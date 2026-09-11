import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  MAXIMO_DE_CARACTERES,
  lerLinkDeAvaliacao,
  listarTemplates,
  salvarLinkDeAvaliacao,
} from "@/lib/templates-admin";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/** GET /api/admin/templates — os sete modelos, com previa e variaveis. */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({
    templates: await listarTemplates(),
    maximoDeCaracteres: MAXIMO_DE_CARACTERES,
    linkAvaliacao: await lerLinkDeAvaliacao(),
  });
}

const CorpoDoLink = z.object({ link: z.string() });

/**
 * PATCH /api/admin/templates — grava o link de avaliacao do Google.
 *
 * Fica nesta rota, e nao nos parametros, porque e onde quem edita a mensagem
 * de avaliacao vai procurar por ele.
 */
export async function PATCH(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = CorpoDoLink.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await salvarLinkDeAvaliacao(corpo.data.link);

  if (!resultado.ok) {
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json({ linkAvaliacao: resultado.dados.link });
}
