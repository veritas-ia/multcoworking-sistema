import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { editarProduto, ligarOuDesligarProduto, listarProdutos } from "@/lib/emporio";

import { operadorDaRequisicao } from "../../../operador";
import { statusDoEmporio } from "../route";

export const dynamic = "force-dynamic";

/**
 * As tres coisas que se pode mudar num produto. "ativo" vem sozinho quando a
 * tela so liga ou desliga.
 *
 * NAO EXISTE DELETE nesta rota, de proposito: produto nunca se exclui, mesma
 * regra de salas, empresas e areas de atuacao. Apagar tiraria o historico de
 * vendas em silencio, e a chave estrangeira do banco recusaria de todo jeito.
 */
const Mudanca = z.object({
  nome: z.string().min(1, "Escreva o nome do produto.").optional(),
  preco: z.string().min(1, "Escreva o preço.").optional(),
  ativo: z.boolean().optional(),
});

/** PATCH /api/admin/emporio/produtos/[id] — renomeia, muda o preço, liga ou desliga. */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const corpo = Mudanca.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { nome, preco, ativo } = corpo.data;

  if (nome === undefined && preco === undefined && ativo === undefined) {
    return respostaErro(400, "Nada para mudar neste produto.");
  }

  if (ativo !== undefined) {
    const feito = await ligarOuDesligarProduto(id, ativo);

    if (!feito.ok) {
      return respostaErro(
        statusDoEmporio(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
    }
  }

  // Nome e preco andam juntos: a tela manda os dois mesmo quando a pessoa
  // mexeu em um so, e salvar o mesmo nome e aceito de proposito.
  if (nome !== undefined || preco !== undefined) {
    if (nome === undefined || preco === undefined) {
      return respostaErro(400, "Mande o nome e o preço juntos.");
    }

    const feito = await editarProduto(id, { nome, preco });

    return feito.ok
      ? NextResponse.json({ produto: feito.dados })
      : respostaErro(
          statusDoEmporio(feito.falha.codigo),
          feito.falha.motivo,
          feito.falha.codigo,
        );
  }

  const atual = (await listarProdutos()).find((produto) => produto.id === id);

  return atual
    ? NextResponse.json({ produto: atual })
    : respostaErro(404, "Produto não encontrado.", "NAO_ENCONTRADO");
}
