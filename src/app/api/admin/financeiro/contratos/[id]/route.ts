import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { editarContrato } from "@/lib/financeiro";

import { operadorDaRequisicao } from "../../../operador";
import { statusDoFinanceiro } from "../../status";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * NAO EXISTE DELETE aqui: contrato nao se exclui, desliga-se. Desligado, ele
 * para de gerar cobranca e o historico fica inteiro.
 *
 * E AUMENTAR O VALOR NAO RETROAGE: as cobrancas ja geradas ficam com o valor
 * que era, porque ele viajou para o lancamento e congelou la. Mesma regra do
 * valor da reserva e do preco do emporio.
 */
const Mudanca = z.object({
  clienteId: z.string().min(1).nullish(),
  empresaId: z.string().min(1).nullish(),
  espacoId: z.string().min(1).nullish(),
  valorMensal: z.string().min(1).optional(),
  diaVencimento: z.number().int().min(1).max(31).optional(),
  cotaHoras: z.number().int().nullish(),
  inicio: z.string().regex(DIA).optional(),
  fim: z.string().regex(DIA).nullish(),
  observacao: z.string().max(300).nullish(),
  ativo: z.boolean().optional(),
});

/** PATCH /api/admin/financeiro/contratos/[id] */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Mudanca.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await contexto.params;
  const feito = await editarContrato(id, corpo.data);

  return feito.ok
    ? NextResponse.json({ contrato: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
