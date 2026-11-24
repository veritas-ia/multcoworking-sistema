import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro, lerCorpo } from "@/lib/api";
import { editarCategoria } from "@/lib/financeiro";
import { z } from "zod";

import { porteiroDoFinanceiro } from "../../../operador";
import { statusDoFinanceiro } from "../../status";

export const dynamic = "force-dynamic";

/**
 * O que pode mudar numa categoria.
 *
 * O TIPO NAO ESTA AQUI, e isso e regra, nao esquecimento: virar o lado de uma
 * categoria inverteria o sinal de todo lancamento que aponta para ela — meses
 * de caixa mudariam de lado de uma vez, e cada linha continuaria parecendo
 * certa. Para trocar o lado, cria-se outra categoria.
 *
 * O SLUG tambem nao: e ele que amarra a categoria ao que ja esta gravado.
 *
 * NAO EXISTE DELETE nesta rota. Categoria nunca se exclui — mesma regra de
 * salas, empresas, areas de atuacao e clientes. Apagar tiraria os lancamentos
 * dela do relatorio em silencio, e a chave estrangeira RESTRICT do banco
 * recusaria de todo jeito.
 */
const Mudanca = z.object({
  nome: z.string().min(1, "Escreva o nome da categoria.").optional(),
  ativa: z.boolean().optional(),
});

/** PATCH /api/admin/financeiro/categorias/[id] — renomeia, liga ou desliga. */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const corpo = Mudanca.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await contexto.params;
  const feito = await editarCategoria(id, corpo.data);

  return feito.ok
    ? NextResponse.json({ categoria: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
