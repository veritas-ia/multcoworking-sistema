import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { hojeLocal, montarPainelFinanceiro } from "@/lib/financeiro";

import { operadorDaRequisicao } from "../../operador";
import { statusDoFinanceiro } from "../status";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/financeiro/painel?competencia=2026-12
 *
 * SÓ LEITURA, e isto e regra — mesma do dashboard de relatorios: nao existe
 * metodo de escrita neste arquivo, e nada aqui altera lancamento, contrato ou
 * configuracao.
 *
 * O "hoje" vai na resposta porque e o servidor que decide o que esta atrasado
 * e qual mes abrir. Refazer essa conta no navegador poria a regra de fuso em
 * dois lugares, e o do operador pode estar em outro.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const p = requisicao.nextUrl.searchParams;

  const feito = await montarPainelFinanceiro({
    competencia: p.get("competencia") ?? undefined,
    quantosMeses: p.get("meses") ? Number(p.get("meses")) : undefined,
  });

  return feito.ok
    ? NextResponse.json({ painel: feito.dados, hoje: hojeLocal() })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
