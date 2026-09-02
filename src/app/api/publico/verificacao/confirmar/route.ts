import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { COOKIE_SESSAO, criarSessao, opcoesDoCookie } from "@/lib/sessao-cliente";
import { normalizarTelefone } from "@/lib/telefone";
import { confirmarCodigo } from "@/lib/verificacao";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  telefone: z.string().min(1, "Informe o telefone."),
  codigo: z.string().regex(/^\d{6}$/, "O código tem 6 dígitos."),
});

/**
 * POST /api/publico/verificacao/confirmar  { telefone, codigo }
 *
 * Dando certo, grava a sessao e devolve o cookie httpOnly de 30 dias.
 * O valor do cookie so existe no navegador: o banco guarda so o embaralhado.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const telefone = normalizarTelefone(corpo.data.telefone);

  if (!telefone) {
    return respostaErro(400, "Telefone inválido.", "TELEFONE_INVALIDO");
  }

  const resultado = await confirmarCodigo(telefone, corpo.data.codigo);

  if (!resultado.confirmado) {
    const status = resultado.codigo === "NUMERO_BLOQUEADO" ? 429 : 401;
    return respostaErro(status, resultado.motivo, resultado.codigo);
  }

  const sessao = await criarSessao(telefone);

  const resposta = NextResponse.json({
    mensagem: "Telefone confirmado.",
    expiraEm: sessao.expiraEm.toISOString(),
  });

  resposta.cookies.set(COOKIE_SESSAO, sessao.token, opcoesDoCookie(sessao.expiraEm));

  return resposta;
}
