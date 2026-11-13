import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  extratoDoProduto,
  registrarMovimento,
  TipoMovimentoEstoque,
} from "@/lib/emporio";

import { operadorDaRequisicao } from "../../../../operador";
import { statusDoEmporio } from "../../route";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/emporio/produtos/[id]/estoque — o extrato do produto.
 *
 * E isto que responde "por que o estoque esta em 3?". Sem o extrato, um numero
 * errado nao tem como ser explicado nem corrigido com confianca.
 */
export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;

  return NextResponse.json({ movimentos: await extratoDoProduto(id) });
}

/**
 * O movimento, como a tela manda.
 *
 * A QUANTIDADE E SEMPRE POSITIVA aqui, e o sinal sai do tipo no servidor.
 * Aceitar o sinal de quem chama convidaria ao erro de uma REPOSICAO negativa,
 * que somaria para o lado errado — e o numero continuaria parecendo certo.
 *
 * VENDA nao entra por esta rota: ela nasce do lancamento do consumo, que grava
 * quem consumiu, quando e por quanto. Deixar vender por aqui criaria saida de
 * estoque sem dono, e o emporio pararia de bater com o que foi cobrado.
 */
const Movimento = z.object({
  tipo: z.enum([
    TipoMovimentoEstoque.REPOSICAO,
    TipoMovimentoEstoque.PERDA,
    TipoMovimentoEstoque.AJUSTE,
  ]),
  quantidade: z.number().int().positive("A quantidade precisa ser maior que zero."),
  motivo: z.string().max(160).nullish(),
  /** So no AJUSTE: verdadeiro quando a contagem na prateleira deu MENOS. */
  paraBaixo: z.boolean().optional(),
});

/** POST /api/admin/emporio/produtos/[id]/estoque — lança um movimento. */
export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const corpo = Movimento.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await registrarMovimento({
    produtoId: id,
    tipo: corpo.data.tipo,
    quantidade: corpo.data.quantidade,
    motivo: corpo.data.motivo ?? null,
    paraBaixo: corpo.data.paraBaixo,
    // Quem lancou fica gravado: o extrato precisa dizer de quem foi a conta.
    usuarioId: operador.id,
  });

  return feito.ok
    ? NextResponse.json(
        { estoque: feito.dados.estoque, movimentos: await extratoDoProduto(id) },
        { status: 201 },
      )
    : respostaErro(
        statusDoEmporio(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
