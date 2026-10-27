import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { criarProfissao, listarProfissoesDoPainel } from "@/lib/profissoes";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Nova = z.object({ nome: z.string().min(1, "Escreva o nome da área.") });

/** GET /api/admin/profissoes — todas, inclusive as desligadas. */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({ profissoes: await listarProfissoesDoPainel() });
}

/** POST /api/admin/profissoes — cria uma área nova. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Nova.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await criarProfissao(corpo.data.nome);

  return resultado.ok
    ? NextResponse.json({ profissao: resultado.dados }, { status: 201 })
    : respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
}
