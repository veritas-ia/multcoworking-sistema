import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { buscar } from "@/lib/demonstrativos";
import { gerarPdfDoDemonstrativo, nomeDoArquivo } from "@/lib/pdf-demonstrativo";

import { operadorDaRequisicao } from "../../../operador";

export const dynamic = "force-dynamic";

/**
 * GET — baixa o PDF do demonstrativo.
 *
 * Gerado NA HORA a partir do que ficou congelado na emissao, e nao guardado
 * como arquivo: o conteudo nao muda, entao guardar um arquivo so criaria uma
 * segunda copia para manter em dia. E atras de login, porque o documento tem
 * nome de cliente e valor pago.
 */
export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const dados = await buscar(id);

  if (!dados) {
    return respostaErro(404, "Demonstrativo não encontrado.", "NAO_ENCONTRADO");
  }

  const pdf = await gerarPdfDoDemonstrativo(dados);

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(dados)}"`,
      "Cache-Control": "no-store",
    },
  });
}
