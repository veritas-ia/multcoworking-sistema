import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { respostaErro } from "@/lib/api";
import { compararPeriodos, diasNoPeriodo } from "@/lib/relatorios";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/** Um ano de cada vez: periodo maior vira consulta lenta sem servir a ninguem. */
const MAXIMO_DE_DIAS = 366;

const DATA = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.");

const Busca = z.object({
  de: DATA,
  ate: DATA,
  /** Periodo de comparacao. Sem ele, vale o periodo anterior do mesmo tamanho. */
  compararDe: DATA.optional(),
  compararAte: DATA.optional(),
});

/**
 * GET /api/admin/relatorios — os numeros do dashboard.
 *
 * SO LEITURA: esta rota nao tem POST, PATCH nem DELETE, e o modulo que ela
 * usa nao grava nada. O dashboard responde perguntas, nao mexe na agenda.
 *
 * E SEM DINHEIRO: nenhum valor de reserva sai daqui (decisao do dono). Quem
 * garante isso e a lista fechada de campos em "relatorios.ts", e nao esta
 * rota.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const parametros = requisicao.nextUrl.searchParams;

  const busca = Busca.safeParse({
    de: parametros.get("de") ?? "",
    ate: parametros.get("ate") ?? "",
    compararDe: parametros.get("compararDe") ?? undefined,
    compararAte: parametros.get("compararAte") ?? undefined,
  });

  if (!busca.success) {
    return respostaErro(400, busca.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const periodo = { de: busca.data.de, ate: busca.data.ate };

  if (periodo.ate < periodo.de) {
    return respostaErro(422, "A data final precisa ser igual ou depois da inicial.");
  }

  if (diasNoPeriodo(periodo) > MAXIMO_DE_DIAS) {
    return respostaErro(422, "Escolha um período de no máximo um ano.");
  }

  const comparacao =
    busca.data.compararDe && busca.data.compararAte
      ? { de: busca.data.compararDe, ate: busca.data.compararAte }
      : undefined;

  if (comparacao && comparacao.ate < comparacao.de) {
    return respostaErro(422, "O período de comparação está invertido.");
  }

  return NextResponse.json(await compararPeriodos(periodo, comparacao));
}
