import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { definirFotoDoProduto, removerFotoDoProduto } from "@/lib/emporio";

import { operadorDaRequisicao } from "../../../../operador";
import { statusDoEmporio } from "../../route";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/emporio/produtos/[id]/foto — envia a imagem do produto.
 *
 * O ARQUIVO PASSA POR AQUI e so entao vai para o Cloudinary, assinado com o
 * segredo do servidor. Nunca direto do navegador: quem tem esse segredo pode
 * apagar tudo que esta la. Mesma regra das fotos das salas.
 *
 * UMA foto por produto: enviar de novo TROCA a anterior. A antiga so e apagada
 * depois que a nova chegou — apagando antes, uma falha no envio deixaria o
 * produto sem imagem nenhuma, que e pior do que ficar com a velha.
 */
export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;

  let formulario: FormData;

  try {
    formulario = await requisicao.formData();
  } catch {
    return respostaErro(400, "Não foi possível ler o arquivo enviado.");
  }

  const arquivo = formulario.get("arquivo");

  if (!(arquivo instanceof Blob) || arquivo.size === 0) {
    return respostaErro(400, "Escolha uma imagem para enviar.");
  }

  const feito = await definirFotoDoProduto(id, arquivo);

  return feito.ok
    ? NextResponse.json({ produto: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoEmporio(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}

/**
 * DELETE /api/admin/emporio/produtos/[id]/foto — tira a imagem.
 *
 * A imagem sai do produto MESMO QUE o Cloudinary recuse apagar o arquivo: uma
 * instabilidade la fora nao pode deixar no ar uma foto que a equipe quer fora.
 * A resposta diz se o arquivo tambem saiu, para a tela poder avisar.
 *
 * Isto NAO apaga o produto — produto nunca se exclui.
 */
export async function DELETE(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const feito = await removerFotoDoProduto(id);

  return feito.ok
    ? NextResponse.json({ arquivoApagado: feito.dados.arquivoApagado })
    : respostaErro(
        statusDoEmporio(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
