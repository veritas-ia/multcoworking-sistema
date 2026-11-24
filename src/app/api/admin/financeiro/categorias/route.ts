import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro, lerCorpo } from "@/lib/api";
import {
  criarCategoria,
  listarCategorias,
  reordenarCategorias,
  TipoDeLancamento,
} from "@/lib/financeiro";
import { z } from "zod";

import { porteiroDoFinanceiro } from "../../operador";
import { statusDoFinanceiro } from "../status";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/financeiro/categorias — as categorias dos dois lados.
 *
 * Vem tudo, inclusive as desligadas: o painel precisa delas para religar. A
 * tela de lancamento pede "?ativas=1" — categoria desligada nao se escolhe.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const parametros = requisicao.nextUrl.searchParams;
  const pedido = parametros.get("tipo");
  const tipo =
    pedido === TipoDeLancamento.ENTRADA || pedido === TipoDeLancamento.SAIDA
      ? pedido
      : undefined;

  return NextResponse.json({
    categorias: await listarCategorias({
      tipo,
      somenteAtivas: parametros.get("ativas") === "1",
    }),
  });
}

/**
 * O que a tela manda para criar.
 *
 * O TIPO NAO TEM PADRAO, de proposito: um silencioso poria uma despesa do
 * lado das receitas, e o caixa do mes somaria para o lado errado.
 */
const Nova = z.object({
  nome: z.string().min(1, "Escreva o nome da categoria."),
  tipo: z.enum([TipoDeLancamento.ENTRADA, TipoDeLancamento.SAIDA]),
});

/** POST /api/admin/financeiro/categorias — cadastra uma categoria. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const corpo = Nova.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await criarCategoria(corpo.data);

  return feito.ok
    ? NextResponse.json({ categoria: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}

const Ordem = z.object({
  ids: z.array(z.string().min(1)).min(1, "Informe a ordem das categorias."),
});

/**
 * PUT /api/admin/financeiro/categorias — grava a ordem de UM lado.
 *
 * A lista daquele lado vem COMPLETA e e regravada em bloco, para nunca haver
 * duas categorias na mesma posicao. Misturar os dois lados e recusado pelo
 * motor: a ordem e por lado, e as duas listas aparecem separadas na tela.
 */
export async function PUT(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const corpo = Ordem.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await reordenarCategorias(corpo.data.ids);

  return feito.ok
    ? NextResponse.json({ categorias: await listarCategorias() })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
