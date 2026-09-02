import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { reagendarComoAdmin } from "@/lib/agenda-admin";
import { lerCorpo, respostaErro } from "@/lib/api";
import { dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";
import { dispararMensagem } from "@/lib/whatsapp";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  salaId: z.string().min(1, "Escolha uma sala."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
});

/**
 * POST /api/admin/reservas/[id]/reagendar
 *
 * Sem a trava de 12h que o cliente tem. O valor e recalculado pelo preco
 * atual da sala, igual ao reagendamento do cliente (Fase 6), e o cliente
 * recebe o WhatsApp de remarcacao com o valor NOVO.
 */
export async function POST(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await params;

  const resultado = await reagendarComoAdmin({
    reservaId: id,
    salaId: corpo.data.salaId,
    inicio: instanteDe(corpo.data.data, corpo.data.inicio),
    fim: instanteDe(corpo.data.data, corpo.data.fim),
    operador,
  });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalhaAdmin(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  dispararMensagem({
    chave: ChaveTemplate.reserva_reagendada,
    telefone: resultado.dados.telefone,
    reservaId: resultado.dados.id,
    variaveis: {
      nome: resultado.dados.nomeCliente,
      sala: resultado.dados.sala,
      data: dataLocalDe(resultado.dados.inicio),
      inicio: horaLocalDe(resultado.dados.inicio),
      fim: horaLocalDe(resultado.dados.fim),
      valor: `R$ ${resultado.dados.valor.replace(".", ",")}`,
    },
  });

  return NextResponse.json({
    id: resultado.dados.id,
    sala: resultado.dados.sala,
    data: dataLocalDe(resultado.dados.inicio),
    inicio: horaLocalDe(resultado.dados.inicio),
    fim: horaLocalDe(resultado.dados.fim),
    valor: resultado.dados.valor,
    status: "REAGENDADA",
  });
}
