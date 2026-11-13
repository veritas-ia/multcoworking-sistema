import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { mudarStatusComoAdmin } from "@/lib/agenda-admin";
import { lerCorpo, respostaErro } from "@/lib/api";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../../../operador";

export const dynamic = "force-dynamic";

/**
 * As TRES mudancas de status que fazem sentido — e nao uma lista solta.
 *
 * Uma caixinha "escolha o status" deixaria marcar como concluida uma reserva
 * de amanha, e deixaria escrever REAGENDADA sem remarcacao nenhuma. Aqui cada
 * caminho tem nome, e o servidor confere se ele faz sentido para aquela
 * reserva — esconder o botao na tela nao para quem manda o pedido direto.
 */
const Corpo = z.object({
  mudanca: z.enum(["CONCLUIR", "REABRIR", "DESFAZER_CANCELAMENTO"]),
});

/** POST /api/admin/reservas/[id]/status */
export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await mudarStatusComoAdmin({
    reservaId: id,
    mudanca: corpo.data.mudanca,
    operador,
  });

  return feito.ok
    ? NextResponse.json(feito.dados)
    : respostaErro(
        statusDaFalhaAdmin(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
