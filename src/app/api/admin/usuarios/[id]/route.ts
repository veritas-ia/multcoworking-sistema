import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { ligarOuDesligarUsuario, redefinirSenha } from "@/lib/usuarios-admin";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

/**
 * Duas acoes chegam por aqui:
 *  - ligar/desligar o acesso;
 *  - definir uma senha nova para OUTRA pessoa (quem esqueceu a dela).
 */
const Corpo = z.union([
  z.object({ ativo: z.boolean() }).strict(),
  z.object({ novaSenha: z.string() }).strict(),
]);

/** PATCH /api/admin/usuarios/[id] */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const eu = await operadorDaRequisicao(requisicao);

  if (!eu) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  if ("novaSenha" in corpo.data) {
    const resultado = await redefinirSenha({
      alvoId: id,
      euId: eu.id,
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

  const resultado = await ligarOuDesligarUsuario({
    alvoId: id,
    euId: eu.id,
    ativo: corpo.data.ativo,
  });

  if (!resultado.ok) {
    return respostaErro(
      resultado.falha.codigo === "NAO_ENCONTRADO" ? 404 : 422,
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ usuario: resultado.dados });
}
