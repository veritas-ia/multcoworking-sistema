import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { reservasQueFicamForaDoHorario, validarHorarios } from "@/lib/horarios-admin";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

const Dia = z.object({
  diaDaSemana: z.number().int().min(0).max(6),
  aberto: z.boolean(),
  horaAbertura: z.union([z.string(), z.null()]),
  horaFechamento: z.union([z.string(), z.null()]),
});

const Corpo = z.object({ horarios: z.array(Dia).length(7, "Informe os sete dias.") });

/**
 * POST /api/admin/horarios/conferir
 *
 * Diz o que ACONTECERIA sem gravar nada. A tela chama antes de salvar, para a
 * equipe ver as reservas afetadas e decidir com a informacao na frente — e nao
 * descobrir depois que ja mudou.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const erro = validarHorarios(corpo.data.horarios);

  if (erro) {
    return respostaErro(422, erro, "REGRA");
  }

  return NextResponse.json({
    reservas: await reservasQueFicamForaDoHorario(corpo.data.horarios),
  });
}
