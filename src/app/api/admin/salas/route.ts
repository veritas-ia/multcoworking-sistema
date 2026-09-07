import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { criarSala, listarSalas } from "@/lib/salas-admin";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/** Campo em branco vira nulo: e assim que a tela diz "sem limite". */
const Opcional = z.union([z.number().int(), z.null()]);

const CorpoDaSala = z.object({
  nome: z.string().trim().min(1, "Escreva o nome da sala."),
  capacidade: Opcional,
  precoPorHora: z.number(),
  precoPorHoraNoturno: z.number(),
  precoPorHoraNoturnoGrupo: z.union([z.number(), z.null()]),
  pessoasParaGrupo: Opcional,
  aceitaDiaria: z.boolean(),
  precoDiaria: z.union([z.number(), z.null()]),
  duracaoMaximaMinutos: Opcional,
  ordem: z.number().int(),
});

/** GET /api/admin/salas */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({ salas: await listarSalas() });
}

/** POST /api/admin/salas — cadastra uma sala nova. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = CorpoDaSala.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await criarSala(corpo.data);

  if (!resultado.ok) {
    return respostaErro(
      resultado.falha.codigo === "NOME_REPETIDO" ? 409 : 422,
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ sala: resultado.dados }, { status: 201 });
}
