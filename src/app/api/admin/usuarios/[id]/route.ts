import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  definirAcessoFinanceiro,
  ligarOuDesligarUsuario,
  redefinirSenha,
} from "@/lib/usuarios-admin";

import { porteiroDoFinanceiro } from "../../operador";

export const dynamic = "force-dynamic";

/**
 * Tres acoes chegam por aqui:
 *  - ligar/desligar o acesso;
 *  - definir uma senha nova para OUTRA pessoa (quem esqueceu a dela);
 *  - dar ou tirar o acesso a parte financeira.
 *
 * Uma de cada vez ("strict"): juntas, uma recusa no meio deixaria metade
 * aplicada e a tela mostraria um estado que o banco nao tem.
 */
const Corpo = z.union([
  z.object({ ativo: z.boolean() }).strict(),
  z.object({ novaSenha: z.string() }).strict(),
  z.object({ acessoFinanceiro: z.boolean() }).strict(),
]);

/**
 * Quem nao ve o financeiro tambem nao administra usuarios — sem isso, a
 * pessoa chamaria esta rota e se promoveria sozinha. Ver a rota irma.
 */

/** PATCH /api/admin/usuarios/[id] */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const eu = porta.eu;

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

  if ("acessoFinanceiro" in corpo.data) {
    const resultado = await definirAcessoFinanceiro({
      alvoId: id,
      euId: eu.id,
      acessoFinanceiro: corpo.data.acessoFinanceiro,
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
