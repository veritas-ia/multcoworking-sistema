import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { listarHorarios, salvarHorarios } from "@/lib/horarios-admin";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Dia = z.object({
  diaDaSemana: z.number().int().min(0).max(6),
  aberto: z.boolean(),
  horaAbertura: z.union([z.string(), z.null()]),
  horaFechamento: z.union([z.string(), z.null()]),
});

/** Os sete dias vem sempre juntos: o expediente e uma coisa so. */
const Corpo = z.object({ horarios: z.array(Dia).length(7, "Informe os sete dias.") });

/** GET /api/admin/horarios */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({ horarios: await listarHorarios() });
}

/**
 * PUT /api/admin/horarios
 *
 * Grava e devolve, junto, as reservas que ficaram fora do novo horario. Elas
 * NAO sao canceladas: a equipe resolve uma a uma na agenda (CLAUDE.md).
 */
export async function PUT(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await salvarHorarios(corpo.data.horarios);

  if (!resultado.ok) {
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json(resultado.dados);
}
