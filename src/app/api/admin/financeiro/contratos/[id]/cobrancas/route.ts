import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { cobrancasDoContrato } from "@/lib/financeiro";

import { porteiroDoFinanceiro } from "../../../../operador";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/financeiro/contratos/[id]/cobrancas
 *
 * O extrato do mensalista: o que ja foi cobrado, o que ele pagou e o que esta
 * em atraso. A situacao de cada linha vem CALCULADA pelo servidor — nao existe
 * coluna de status, ela sai do vencimento e da data de pagamento.
 */
export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const { id } = await contexto.params;

  return NextResponse.json({ cobrancas: await cobrancasDoContrato(id) });
}
