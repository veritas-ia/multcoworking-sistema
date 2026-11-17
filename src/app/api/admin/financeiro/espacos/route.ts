import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { criarEspaco, listarEspacos, reordenarEspacos } from "@/lib/financeiro";

import { porteiroDoFinanceiro } from "../../operador";
import { statusDoFinanceiro } from "../status";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/financeiro/espacos — as salas alugadas por MES.
 *
 * NAO SAO AS SALAS DA AGENDA, e isto e o ponto: "salas" e a tabela da agenda,
 * e uma linha ali aparece no site publico para qualquer um reservar. Pondo os
 * espacos mensais la, um cliente poderia reservar por hora a sala que outro
 * aluga por mes.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  return NextResponse.json({
    espacos: await listarEspacos({
      somenteAtivos: requisicao.nextUrl.searchParams.get("ativos") === "1",
    }),
  });
}

const Novo = z.object({
  nome: z.string().min(1, "Escreva o nome do espaço."),
  observacao: z.string().max(300).nullish(),
});

/** POST /api/admin/financeiro/espacos — cadastra um espaco. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const corpo = Novo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await criarEspaco(corpo.data);

  return feito.ok
    ? NextResponse.json({ espaco: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}

const Ordem = z.object({
  ids: z.array(z.string().min(1)).min(1, "Informe a ordem dos espaços."),
});

/** PUT /api/admin/financeiro/espacos — grava a ordem da lista inteira. */
export async function PUT(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const corpo = Ordem.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await reordenarEspacos(corpo.data.ids);

  return feito.ok
    ? NextResponse.json({ espacos: await listarEspacos() })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
