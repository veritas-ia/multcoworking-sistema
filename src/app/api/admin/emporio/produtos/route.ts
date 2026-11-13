import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { cloudinaryConfigurado } from "@/lib/cloudinary";
import { criarProduto, listarProdutos, reordenarProdutos } from "@/lib/emporio";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

export function statusDoEmporio(codigo: string): number {
  if (codigo === "NAO_ENCONTRADO") {
    return 404;
  }
  // "Sem Cloudinary" e 503: nao e culpa de quem pediu, e passa a funcionar
  // quando as variaveis forem preenchidas no servidor.
  return codigo === "CLOUDINARY_DESLIGADO" ? 503 : 422;
}

/**
 * GET /api/admin/emporio/produtos — o catalogo, com o estoque de cada um.
 *
 * "somenteAtivos" e para a tela de LANCAMENTO: produto desligado nao se vende.
 * Sem o parametro vem tudo, que e o que a tela de cadastro precisa — senao a
 * equipe nao conseguiria religar o que desligou.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const somenteAtivos = requisicao.nextUrl.searchParams.get("ativos") === "1";

  return NextResponse.json({
    produtos: await listarProdutos({ somenteAtivos }),
    // A tela usa isto para avisar que o envio de imagem esta indisponivel,
    // em vez de deixar a pessoa escolher um arquivo e levar erro depois.
    envioDeImagemDisponivel: cloudinaryConfigurado(),
  });
}

const Novo = z.object({
  nome: z.string().min(1, "Escreva o nome do produto."),
  preco: z.string().min(1, "Escreva o preço."),
});

/** POST /api/admin/emporio/produtos — cadastra um produto. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Novo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await criarProduto(corpo.data);

  return feito.ok
    ? NextResponse.json({ produto: feito.dados }, { status: 201 })
    : respostaErro(statusDoEmporio(feito.falha.codigo), feito.falha.motivo, feito.falha.codigo);
}

const Ordem = z.object({
  ids: z.array(z.string().min(1)).min(1, "Informe a ordem dos produtos."),
});

/**
 * PUT /api/admin/emporio/produtos — grava a ordem da lista.
 *
 * A lista vem COMPLETA e e regravada em bloco, para nunca haver dois produtos
 * com a mesma posicao. Mesma regra das areas de atuacao.
 */
export async function PUT(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Ordem.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await reordenarProdutos(corpo.data.ids);

  return feito.ok
    ? NextResponse.json({ produtos: await listarProdutos() })
    : respostaErro(statusDoEmporio(feito.falha.codigo), feito.falha.motivo, feito.falha.codigo);
}
