import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro, lerCorpo } from "@/lib/api";
import { editarFornecedor } from "@/lib/financeiro";
import { z } from "zod";

import { porteiroDoFinanceiro } from "../../../operador";
import { statusDoFinanceiro } from "../../status";

export const dynamic = "force-dynamic";

/**
 * NAO EXISTE DELETE aqui, de proposito: fornecedor nunca se exclui, mesma
 * regra de salas, empresas, areas de atuacao e clientes. Apagar tiraria as
 * despesas dele do relatorio em silencio, e a chave RESTRICT do banco
 * recusaria de todo jeito. Desligar tira das telas e o historico fica.
 */
const Mudanca = z.object({
  nome: z.string().min(1, "Escreva o nome do fornecedor.").optional(),
  observacao: z.string().max(300).nullish(),
  ativo: z.boolean().optional(),
});

/** PATCH /api/admin/financeiro/fornecedores/[id] — renomeia, anota, desliga. */
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
  const feito = await editarFornecedor(id, corpo.data);

  return feito.ok
    ? NextResponse.json({ fornecedor: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
