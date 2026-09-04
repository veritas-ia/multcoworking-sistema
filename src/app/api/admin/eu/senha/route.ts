import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { trocarPropriaSenha } from "@/lib/usuarios-admin";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  senhaAtual: z.string(),
  novaSenha: z.string(),
});

/**
 * PATCH /api/admin/eu/senha — troca a senha de quem esta logado.
 *
 * Pede a senha atual de proposito: sem isso, um computador esquecido aberto no
 * balcao viraria uma conta roubada em dois cliques.
 */
export async function PATCH(requisicao: NextRequest): Promise<NextResponse> {
  const eu = await operadorDaRequisicao(requisicao);

  if (!eu) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await trocarPropriaSenha({
    euId: eu.id,
    senhaAtual: corpo.data.senhaAtual,
    novaSenha: corpo.data.novaSenha,
  });

  if (!resultado.ok) {
    return respostaErro(
      resultado.falha.codigo === "NAO_ENCONTRADO" ? 404 : 422,
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ trocada: true });
}
