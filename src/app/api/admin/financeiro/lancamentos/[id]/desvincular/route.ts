import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { desvincular } from "@/lib/financeiro";

import { porteiroDoFinanceiro } from "../../../../operador";
import { statusDoFinanceiro } from "../../../status";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/financeiro/lancamentos/[id]/desvincular
 *
 * A linha solta da origem e vira manual, editavel a vontade. E a saida de
 * emergencia que o dono pediu quando perguntou se tudo seria editavel: nada
 * fica trancado para sempre, so nao se solta sem perceber.
 *
 * A LINHA DO EMPORIO E RECUSADA pelo motor, e nao por esquecimento: ela e
 * RECALCULADA a cada consumo lancado naquele dia. Solta-la nao a tornaria
 * editavel de verdade — o proximo consumo criaria outra linha ao lado, e o
 * dinheiro do dia apareceria DUAS VEZES no caixa.
 */
export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const { id } = await contexto.params;
  const feito = await desvincular(id);

  return feito.ok
    ? NextResponse.json({ lancamento: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
