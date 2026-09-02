/**
 * Utilidades comuns das rotas publicas.
 *
 * Regra de ouro da area publica (CLAUDE.md): nunca devolver nome, telefone
 * ou motivo de bloqueio de ninguem. So "disponivel" / "indisponivel".
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export type CorpoErro = { erro: string; codigo?: string };

export function respostaErro(
  status: number,
  erro: string,
  codigo?: string,
): NextResponse<CorpoErro> {
  return NextResponse.json(codigo ? { erro, codigo } : { erro }, { status });
}

/** Endereco de rede de quem fez o pedido, para os limites por IP. */
export function ipDaRequisicao(requisicao: NextRequest): string | null {
  const encaminhado = requisicao.headers.get("x-forwarded-for");
  if (encaminhado) {
    const primeiro = encaminhado.split(",")[0]?.trim();
    if (primeiro) {
      return primeiro;
    }
  }
  return requisicao.headers.get("x-real-ip");
}

/** Le o corpo JSON sem deixar um corpo malformado virar erro 500. */
export async function lerCorpo(requisicao: NextRequest): Promise<unknown> {
  try {
    return await requisicao.json();
  } catch {
    return null;
  }
}
