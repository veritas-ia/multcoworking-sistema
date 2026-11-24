import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { gerarMensalidades } from "@/lib/financeiro";

import { porteiroDoFinanceiro } from "../../../operador";
import { statusDoFinanceiro } from "../../status";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  /** "2026-12" — o MES cobrado, nao o vencimento. */
  competencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Informe o mês como 2026-12."),
});

/**
 * POST /api/admin/financeiro/mensalidades/gerar
 *
 * E ACAO DA EQUIPE, e nao rotina automatica, por uma razao pratica: a previa
 * roda com CRON_ATIVO="false" e uma rotina simplesmente nao aconteceria la —
 * pior, ninguem veria que nao aconteceu. Um botao acontece quando a pessoa
 * clica, na frente dela, com o resultado na tela.
 *
 * E IDEMPOTENTE: clicar duas vezes em "gerar dezembro" nao cobra em dobro. A
 * trava e o indice unico (contrato, competencia) no banco — sem ele, dois
 * cliques dobrariam a receita do mes e cada linha continuaria parecendo certa.
 *
 * A resposta traz o RELATORIO: quantas nasceram, quantas ja existiam e quais
 * contratos ficaram de fora, com o motivo. Mesmo desenho do relatorio da serie
 * recorrente — a equipe precisa saber o que NAO entrou.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const operador = porta.eu;

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await gerarMensalidades({
    competencia: corpo.data.competencia,
    operador,
  });

  return feito.ok
    ? NextResponse.json({ relatorio: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
