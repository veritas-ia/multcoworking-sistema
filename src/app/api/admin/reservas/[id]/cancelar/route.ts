import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { cancelarComoAdmin } from "@/lib/agenda-admin";
import { respostaErro } from "@/lib/api";
import { dataLocalDe, horaLocalDe } from "@/lib/tempo";
import { dispararMensagem } from "@/lib/whatsapp";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../../../operador";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reservas/[id]/cancelar
 *
 * O admin cancela SEMPRE, inclusive dentro das 12h — e o CLAUDE.md.
 * Nao pede codigo de WhatsApp: quem esta aqui ja provou quem e no login.
 * O cliente recebe o mesmo aviso de cancelamento do site.
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
  const resultado = await cancelarComoAdmin({ reservaId: id, operador });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalhaAdmin(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  dispararMensagem({
    chave: ChaveTemplate.reserva_cancelada,
    telefone: resultado.dados.telefone,
    reservaId: resultado.dados.id,
    variaveis: {
      nome: resultado.dados.nomeCliente,
      sala: resultado.dados.sala,
      data: dataLocalDe(resultado.dados.inicio),
      inicio: horaLocalDe(resultado.dados.inicio),
      fim: horaLocalDe(resultado.dados.fim),
    },
  });

  return NextResponse.json({ id: resultado.dados.id, status: "CANCELADA" });
}
