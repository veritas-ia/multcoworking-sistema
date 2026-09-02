import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { autenticar } from "@/lib/admin";
import { ipDaRequisicao, lerCorpo, respostaErro } from "@/lib/api";
import {
  assinarToken,
  COOKIE_ADMIN,
  opcoesDoCookieAdmin,
  opcoesParaApagarCookieAdmin,
} from "@/lib/sessao-admin";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  usuario: z.string().trim().min(1, "Informe o usuário."),
  senha: z.string().min(1, "Informe a senha."),
});

/**
 * POST /api/admin/sessao  { usuario, senha }
 *
 * Entrar no painel. E uma das DUAS rotas que o middleware deixa passar sem
 * sessao — a outra e a propria tela de login.
 *
 * Login e por NOME DE USUARIO, nunca e-mail (decisao do CLAUDE.md).
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await autenticar({
    usuario: corpo.data.usuario,
    senha: corpo.data.senha,
    ip: ipDaRequisicao(requisicao),
  });

  if (!resultado.autenticado) {
    return respostaErro(
      resultado.codigo === "BLOQUEADO" ? 429 : 401,
      resultado.motivo,
      resultado.codigo,
    );
  }

  const resposta = NextResponse.json({ nome: resultado.nome });

  resposta.cookies.set(
    COOKIE_ADMIN,
    await assinarToken(resultado.usuarioId),
    opcoesDoCookieAdmin(),
  );

  return resposta;
}

/** DELETE /api/admin/sessao — sair do painel. */
export function DELETE(): NextResponse {
  const resposta = NextResponse.json({ mensagem: "Você saiu do painel." });
  resposta.cookies.set(COOKIE_ADMIN, "", opcoesParaApagarCookieAdmin());
  return resposta;
}
