import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { respostaErro } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { cancelarSerie } from "@/lib/recorrencias";
import { dataLocalDe, horaLocalDe } from "@/lib/tempo";
import { dispararMensagem } from "@/lib/whatsapp";

import { operadorDaRequisicao } from "../../../operador";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/recorrencias/[id]/cancelar
 *
 * Cancela a SERIE INTEIRA: todas as ocorrencias ativas que ainda nao
 * comecaram. O que ja passou fica no historico como esteve.
 *
 * Para cancelar UMA ocorrencia so, a rota e a de sempre:
 * /api/admin/reservas/[id]/cancelar.
 */
export async function POST(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await params;

  // Quais serao canceladas — precisa ser lido ANTES, para avisar o cliente
  // de cada uma depois que o cancelamento acontecer.
  const antes = await prisma.reserva.findMany({
    where: {
      recorrenciaId: id,
      status: { in: ["CONFIRMADA", "REAGENDADA"] },
      inicio: { gt: new Date() },
    },
    include: { sala: { select: { nome: true } } },
  });

  const resultado = await cancelarSerie({ recorrenciaId: id, operador });

  if (!resultado.ok) {
    return respostaErro(404, resultado.falha.motivo, resultado.falha.codigo);
  }

  for (const reserva of antes) {
    dispararMensagem({
      chave: ChaveTemplate.reserva_cancelada,
      telefone: reserva.telefone,
      reservaId: reserva.id,
      variaveis: {
        nome: reserva.nomeCliente,
        sala: reserva.sala.nome,
        data: dataLocalDe(reserva.inicio),
        inicio: horaLocalDe(reserva.inicio),
        fim: horaLocalDe(reserva.fim),
      },
    });
  }

  return NextResponse.json({ canceladas: resultado.dados.canceladas });
}
