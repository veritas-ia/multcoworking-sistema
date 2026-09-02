import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { adminDoToken } from "@/lib/admin";
import { respostaErro } from "@/lib/api";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/eu — quem esta logado no painel.
 *
 * O middleware ja barrou quem nao tem cookie assinado. Aqui a conferencia e
 * refeita CONTRA O BANCO: um usuario apagado nao passa, mesmo com o cookie
 * ainda dentro do prazo.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const admin = await adminDoToken(requisicao.cookies.get(COOKIE_ADMIN)?.value);

  if (!admin) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({ nome: admin.nome, usuario: admin.usuario });
}
