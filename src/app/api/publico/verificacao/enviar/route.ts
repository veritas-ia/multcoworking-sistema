import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ipDaRequisicao, lerCorpo, respostaErro } from "@/lib/api";
import { normalizarTelefone } from "@/lib/telefone";
import { gerarEEnviarCodigo, podeEnviarCodigo } from "@/lib/verificacao";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  telefone: z.string().min(1, "Informe o telefone."),
});

/**
 * POST /api/publico/verificacao/enviar  { telefone }
 *
 * Sempre responde a mesma coisa quando o pedido e aceito, para nao revelar
 * se o numero ja usou o sistema antes. As unicas respostas diferentes sao
 * telefone mal digitado (400) e limite de envios estourado (429) — ambas
 * falam sobre o proprio pedido de quem esta na tela, nao sobre terceiros.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, "Informe o telefone.");
  }

  const telefone = normalizarTelefone(corpo.data.telefone);

  if (!telefone) {
    return respostaErro(
      400,
      "Telefone inválido. Use DDD + celular, como (11) 91234-5678.",
      "TELEFONE_INVALIDO",
    );
  }

  const permissao = await podeEnviarCodigo(telefone, ipDaRequisicao(requisicao));

  if (!permissao.permitido) {
    return respostaErro(429, permissao.motivo, permissao.codigo);
  }

  await gerarEEnviarCodigo(telefone, ipDaRequisicao(requisicao));

  return NextResponse.json({
    mensagem: "Se o número estiver correto, você receberá um código no WhatsApp.",
    validadeMinutos: 10,
  });
}
