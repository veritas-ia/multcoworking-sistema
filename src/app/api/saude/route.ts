import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/saude — "o sistema esta de pe?"
 *
 * Quem pergunta e o EasyPanel, de tempos em tempos. Se a resposta parar de
 * chegar, ele reinicia o container sozinho.
 *
 * A conferencia inclui o BANCO de proposito. Um site que responde a pagina mas
 * perdeu a conexao com o banco esta quebrado para o cliente — ele so descobre
 * ao tentar reservar. Sem a pergunta ao banco, o painel do servidor diria
 * "tudo certo" o tempo todo.
 *
 * A resposta nao conta NADA sobre o sistema por dentro: quem estiver de fora
 * ve so "ok" ou "erro". Versao, endereco do banco e mensagem de falha ficam
 * de fora — endereco publico nao e lugar de dar pista para quem procura alvo.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    return NextResponse.json({ estado: "erro", banco: "erro" }, { status: 503 });
  }

  return NextResponse.json({ estado: "ok", banco: "ok" });
}
