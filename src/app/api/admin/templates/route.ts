import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { MAXIMO_DE_CARACTERES, listarTemplates } from "@/lib/templates-admin";

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
  });
}
