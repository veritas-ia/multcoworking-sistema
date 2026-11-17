import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { editarEspaco } from "@/lib/financeiro";

import { operadorDaRequisicao } from "../../../operador";
import { statusDoFinanceiro } from "../../status";

export const dynamic = "force-dynamic";

/**
 * NAO EXISTE DELETE aqui: espaco nunca se exclui, mesma regra de salas,
 * empresas, areas de atuacao, clientes, categorias e fornecedores. Apagar
 * tiraria os contratos dele do historico em silencio, e a chave RESTRICT do
 * banco recusaria de todo jeito.
 *
 * E DESLIGAR tem uma trava propria no motor: espaco com contrato VIGENTE nao
 * se desliga. Desligado, ele sai da lista de escolha — mas o contrato
 * continuaria cobrando, e a equipe veria um espaco "fora do ar" gerando
 * dinheiro todo mes.
 */
const Mudanca = z.object({
  nome: z.string().min(1, "Escreva o nome do espaço.").optional(),
  observacao: z.string().max(300).nullish(),
  ativo: z.boolean().optional(),
});

/** PATCH /api/admin/financeiro/espacos/[id] */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Mudanca.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await contexto.params;
  const feito = await editarEspaco(id, corpo.data);

  return feito.ok
    ? NextResponse.json({ espaco: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
