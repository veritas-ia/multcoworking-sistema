import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro, lerCorpo } from "@/lib/api";
import { marcarPagamento } from "@/lib/financeiro";
import { z } from "zod";

import { operadorDaRequisicao } from "../../../../operador";
import { statusDoFinanceiro } from "../../../status";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Marcar como pago e uma ACAO PROPRIA, e nao "editar o campo da data".
 *
 * E o que a equipe faz dezenas de vezes por mes: abrir o formulario inteiro
 * para preencher uma data so seria atrito a cada conta paga.
 *
 * "pagoEm: null" DESMARCA — marcar errado acontece, e a linha volta a
 * pendente (ou a atrasada, se o vencimento ja passou). Nada mais e tocado.
 */
const Corpo = z.object({
  pagoEm: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD.").nullable(),
  formaPagamentoId: z.string().min(1).nullish(),
});

/** PATCH /api/admin/financeiro/lancamentos/[id]/pagamento */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await contexto.params;
  const feito = await marcarPagamento(id, corpo.data);

  return feito.ok
    ? NextResponse.json({ lancamento: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
