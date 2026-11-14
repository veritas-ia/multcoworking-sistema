import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { listarAcoes, TipoDeAcao } from "@/lib/acoes";
import { respostaErro } from "@/lib/api";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/acoes — o historico de acoes da equipe.
 *
 * SO LEITURA. Nao existe POST, PATCH nem DELETE aqui de proposito: um
 * registro de evidencia que pode ser criado a mao, editado ou apagado nao e
 * evidencia. As acoes nascem dentro da propria operacao que elas registram.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const pedido = requisicao.nextUrl.searchParams.get("tipo");
  const tipo =
    pedido === TipoDeAcao.RESERVA_EXCLUIDA ||
    pedido === TipoDeAcao.RESERVA_STATUS_ALTERADO
      ? pedido
      : undefined;

  return NextResponse.json({ acoes: await listarAcoes({ tipo }) });
}
