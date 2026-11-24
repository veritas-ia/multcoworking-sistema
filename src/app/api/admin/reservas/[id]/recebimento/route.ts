import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  desfazerRecebimentoDaReserva,
  registrarRecebimentoDaReserva,
} from "@/lib/financeiro";

import { operadorDaRequisicao } from "../../../operador";
import { statusDoFinanceiro } from "../../../financeiro/status";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  /** "AAAA-MM-DD". Ausente = hoje, decidido pelo SERVIDOR. */
  pagoEm: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.")
    .optional(),
  formaPagamentoId: z.string().min(1).nullish(),
});

/**
 * POST /api/admin/reservas/[id]/recebimento — a recepcao recebeu no balcao.
 *
 * POR QUE ISTO E UM BOTAO E NAO E AUTOMATICO: o sistema nao tem como saber
 * que alguem pagou R$ 40 no balcao — nao existe pagamento online, e nada na
 * reserva registra pagamento. Quem sabe e a pessoa que recebeu.
 *
 * E POR QUE A RESERVA NAO VIRA ENTRADA SOZINHA: o mensalista paga as horas
 * dele no demonstrativo, no fim do ciclo. Se cada reserva virasse entrada, as
 * mesmas horas entrariam DUAS VEZES no caixa — uma como reserva, outra como
 * mensalidade — e cada linha continuaria parecendo certa.
 *
 * Chamar duas vezes NAO cria duas linhas: a segunda devolve a que existe.
 */
export async function POST(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse((await lerCorpo(requisicao)) ?? {});

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await params;
  const feito = await registrarRecebimentoDaReserva({
    reservaId: id,
    pagoEm: corpo.data.pagoEm,
    formaPagamentoId: corpo.data.formaPagamentoId,
    operador,
  });

  return feito.ok
    ? NextResponse.json({ lancamento: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}

/**
 * DELETE /api/admin/reservas/[id]/recebimento — desfaz o recebimento.
 *
 * Apaga a linha do caixa e REGISTRA a acao no historico, com motivo escrito
 * pelo proprio sistema: aqui o "por que" e a acao em si, e pedir texto a cada
 * clique faria a equipe escrever "a" para passar da tela. A evidencia
 * continua existindo, que e o que importa.
 */
export async function DELETE(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await params;
  const feito = await desfazerRecebimentoDaReserva({ reservaId: id, operador });

  return feito.ok
    ? NextResponse.json({ ok: true })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
