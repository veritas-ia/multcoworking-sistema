import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { itensDaAgenda } from "@/lib/agenda-admin";
import { respostaErro } from "@/lib/api";
import { dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Parametros = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  salaId: z.string().optional(),
});

/**
 * GET /api/admin/agenda?de=AAAA-MM-DD&ate=AAAA-MM-DD&salaId=...
 *
 * Reservas e bloqueios do periodo. Area protegida: aqui o telefone completo
 * do cliente PODE aparecer (o CLAUDE.md proibe isso apenas no publico).
 *
 * "ate" e inclusivo: quem pede de 01 a 01 recebe o dia 01 inteiro.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const parametros = Parametros.safeParse({
    de: requisicao.nextUrl.searchParams.get("de") ?? "",
    ate: requisicao.nextUrl.searchParams.get("ate") ?? "",
    salaId: requisicao.nextUrl.searchParams.get("salaId") ?? undefined,
  });

  if (!parametros.success) {
    return respostaErro(400, parametros.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const itens = await itensDaAgenda({
    de: instanteDe(parametros.data.de, "00:00"),
    // O dia final entra inteiro: vai ate a meia-noite do dia seguinte.
    ate: new Date(instanteDe(parametros.data.ate, "00:00").getTime() + 24 * 60 * 60_000),
    salaId: parametros.data.salaId || undefined,
  });

  return NextResponse.json({
    itens: itens.map((item) => ({
      ...item,
      data: dataLocalDe(item.inicio),
      inicio: horaLocalDe(item.inicio),
      fim: horaLocalDe(item.fim),
      inicioIso: item.inicio.toISOString(),
      fimIso: item.fim.toISOString(),
    })),
  });
}
