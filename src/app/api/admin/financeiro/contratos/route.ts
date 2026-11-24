import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  criarContrato,
  hojeLocal,
  listarContratos,
  listarEspacos,
} from "@/lib/financeiro";

import { porteiroDoFinanceiro } from "../../operador";
import { statusDoFinanceiro } from "../status";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/financeiro/contratos — os contratos de mensalidade.
 *
 * O "vigente" de cada um vem DECIDIDO pelo servidor, no relogio de Sao Paulo:
 * refazer a conta no navegador poria a regra de fuso em dois lugares, e o do
 * operador pode estar em outro.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  return NextResponse.json({
    contratos: await listarContratos({
      somenteVigentes: requisicao.nextUrl.searchParams.get("vigentes") === "1",
    }),
    // Vai junto: a tela precisa dos espacos no formulario, e seria uma segunda
    // ida ao servidor para nada. So os ativos — espaco desligado nao se
    // escolhe num contrato novo.
    espacos: await listarEspacos({ somenteAtivos: true }),
    hoje: hojeLocal(),
  });
}

/**
 * O que a tela manda.
 *
 * O PAGADOR E UM DOS DOIS, nunca os dois: quem cobra isso e o motor, e o banco
 * tambem. Nenhum deixaria a cobranca sem dono; os dois deixariam a tela sem
 * saber para quem emitir.
 */
const Novo = z.object({
  clienteId: z.string().min(1).nullish(),
  empresaId: z.string().min(1).nullish(),
  espacoId: z.string().min(1).nullish(),
  valorMensal: z.string().min(1, "Escreva o valor da mensalidade."),
  diaVencimento: z.number().int().min(1).max(31),
  /** NULO = sem horas inclusas. Zero e recusado pelo motor. */
  cotaHoras: z.number().int().nullish(),
  inicio: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD."),
  fim: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD.").nullish(),
  observacao: z.string().max(300).nullish(),
});

/** POST /api/admin/financeiro/contratos — cadastra um contrato. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const porta = await porteiroDoFinanceiro(requisicao);

  if ("recusa" in porta) {
    return porta.recusa;
  }

  const corpo = Novo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await criarContrato(corpo.data);

  return feito.ok
    ? NextResponse.json({ contrato: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
