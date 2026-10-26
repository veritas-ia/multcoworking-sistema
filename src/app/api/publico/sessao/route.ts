import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  COOKIE_SESSAO,
  encerrarSessao,
  opcoesParaApagarCookie,
  telefoneDaSessao,
} from "@/lib/sessao-cliente";
import { prisma } from "@/lib/prisma";
import { mascararTelefone } from "@/lib/telefone";

export const dynamic = "force-dynamic";

export type RespostaSessao = {
  identificado: boolean;
  /** "(11) 9****-4321" ou nulo. NUNCA o telefone inteiro. */
  telefoneMascarado: string | null;
  /**
   * O nome que este telefone usou na ultima reserva. Nulo na primeira vez.
   *
   * Serve para o formulario ja vir preenchido, em vez de deixar a pessoa
   * reescrever o nome a cada reserva. A mesma cliente ja se escreveu de
   * quatro jeitos ("Prestare", "Prestare Karen", "Prestare - Karen"...), e
   * isso suja a busca e o relatorio do painel.
   *
   * Nao e dado novo exposto: e o proprio nome de quem esta com o cookie na
   * mao, e a resposta sai do cookie, nunca de um parametro.
   */
  nomeConhecido: string | null;
};

/**
 * GET /api/publico/sessao
 *
 * Responde apenas sobre quem esta com o cookie na mao, e mesmo assim
 * escondendo o meio do numero. Nao existe jeito de perguntar por outra pessoa:
 * a resposta sai do cookie, nao de um parametro.
 */
export async function GET(
  requisicao: NextRequest,
): Promise<NextResponse<RespostaSessao>> {
  const telefone = await telefoneDaSessao(requisicao);

  const ultima = telefone
    ? await prisma.reserva.findFirst({
        where: { telefone },
        orderBy: { criadoEm: "desc" },
        select: { nomeCliente: true },
      })
    : null;

  return NextResponse.json({
    identificado: telefone !== null,
    telefoneMascarado: telefone ? mascararTelefone(telefone) : null,
    nomeConhecido: ultima?.nomeCliente ?? null,
  });
}

/**
 * DELETE /api/publico/sessao — o "trocar numero" da tela.
 * Apaga a sessao do banco e o cookie do navegador.
 */
export async function DELETE(requisicao: NextRequest): Promise<NextResponse> {
  await encerrarSessao(requisicao);

  const resposta = NextResponse.json({ mensagem: "Sessão encerrada." });
  resposta.cookies.set(COOKIE_SESSAO, "", opcoesParaApagarCookie());

  return resposta;
}
