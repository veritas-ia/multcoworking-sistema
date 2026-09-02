import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { lerCorpo, respostaErro } from "@/lib/api";
import { cancelarReserva } from "@/lib/minhas-reservas";
import { telefoneDaSessao } from "@/lib/sessao-cliente";
import { dataLocalDe, horaLocalDe } from "@/lib/tempo";
import { confirmarCodigo } from "@/lib/verificacao";
import { dispararMensagem } from "@/lib/whatsapp";

import { statusDaFalha } from "../../falhas";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  codigo: z.string().regex(/^\d{6}$/, "O código tem 6 dígitos."),
});

/**
 * POST /api/publico/minhas-reservas/[id]/cancelar  { codigo }
 *
 * Cancelar e acao destrutiva: o CLAUDE.md exige um codigo NOVO do WhatsApp na
 * hora, mesmo com a sessao de 30 dias valida. O codigo e conferido ANTES de
 * qualquer leitura da reserva — sem codigo bom, nada acontece e nada e dito.
 */
export async function POST(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const telefone = await telefoneDaSessao(requisicao);

  if (!telefone) {
    return respostaErro(401, "Sua sessão expirou. Confirme seu telefone de novo.", "SEM_SESSAO");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const codigo = await confirmarCodigo(telefone, corpo.data.codigo);

  if (!codigo.confirmado) {
    return respostaErro(
      codigo.codigo === "NUMERO_BLOQUEADO" ? 429 : 401,
      codigo.motivo,
      codigo.codigo,
    );
  }

  const { id } = await params;
  const resultado = await cancelarReserva({ reservaId: id, telefone });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalha(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  dispararMensagem({
    chave: ChaveTemplate.reserva_cancelada,
    telefone,
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
