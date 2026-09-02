import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ipDaRequisicao, respostaErro } from "@/lib/api";
import { telefoneDaSessao } from "@/lib/sessao-cliente";
import { gerarEEnviarCodigo, podeEnviarCodigo } from "@/lib/verificacao";

export const dynamic = "force-dynamic";

/**
 * POST /api/publico/minhas-reservas/codigo
 *
 * Manda um codigo novo para o telefone JA confirmado na sessao. Existe para o
 * cliente nao precisar redigitar o proprio numero na hora de cancelar ou
 * reagendar — e para o numero nao trafegar de novo entre a tela e o servidor.
 *
 * Vale os mesmos limites de envio do CLAUDE.md: 1 por minuto por numero,
 * 5 por hora por numero, 20 por hora por IP.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const telefone = await telefoneDaSessao(requisicao);

  if (!telefone) {
    return respostaErro(
      401,
      "Sua sessão expirou. Confirme seu telefone de novo.",
      "SEM_SESSAO",
    );
  }

  const permissao = await podeEnviarCodigo(telefone, ipDaRequisicao(requisicao));

  if (!permissao.permitido) {
    return respostaErro(429, permissao.motivo, permissao.codigo);
  }

  await gerarEEnviarCodigo(telefone, ipDaRequisicao(requisicao));

  return NextResponse.json({ validadeMinutos: 10 });
}
