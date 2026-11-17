import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro, lerCorpo } from "@/lib/api";
import { criarFornecedor, listarFornecedores } from "@/lib/financeiro";
import { z } from "zod";

import { porteiroDoFinanceiro } from "../../operador";
import { statusDoFinanceiro } from "../status";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/financeiro/fornecedores — quem recebe o dinheiro das saidas.
 *
 * Separado de Cliente de proposito: cliente e quem PAGA ao coworking, e
 * misturar os dois faria o relatorio de clientes mostrar a empresa de limpeza
 * como se fosse cliente.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  return NextResponse.json({
    fornecedores: await listarFornecedores({
      somenteAtivos: requisicao.nextUrl.searchParams.get("ativos") === "1",
    }),
  });
}

const Novo = z.object({
  nome: z.string().min(1, "Escreva o nome do fornecedor."),
  observacao: z.string().max(300).nullish(),
});

/** POST /api/admin/financeiro/fornecedores — cadastra um fornecedor. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const corpo = Novo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await criarFornecedor(corpo.data);

  return feito.ok
    ? NextResponse.json({ fornecedor: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
