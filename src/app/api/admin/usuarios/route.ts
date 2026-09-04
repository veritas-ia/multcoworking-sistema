import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { criarUsuario, listarUsuarios } from "@/lib/usuarios-admin";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  nome: z.string().trim().min(1, "Escreva o nome da pessoa."),
  usuario: z.string().trim().min(1, "Escreva o nome de usuário."),
  senha: z.string(),
});

/** GET /api/admin/usuarios */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const eu = await operadorDaRequisicao(requisicao);

  if (!eu) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({ usuarios: await listarUsuarios(eu.id) });
}

/** POST /api/admin/usuarios — cria um acesso novo ao painel. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const eu = await operadorDaRequisicao(requisicao);

  if (!eu) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await criarUsuario(corpo.data, eu.id);

  if (!resultado.ok) {
    return respostaErro(
      resultado.falha.codigo === "NOME_REPETIDO" ? 409 : 422,
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ usuario: resultado.dados }, { status: 201 });
}
