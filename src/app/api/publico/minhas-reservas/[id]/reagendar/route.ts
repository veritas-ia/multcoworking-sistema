import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { lerCorpo, respostaErro } from "@/lib/api";
import { reagendarReserva } from "@/lib/minhas-reservas";
import { telefoneDaSessao } from "@/lib/sessao-cliente";
import { dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";
import { confirmarCodigo } from "@/lib/verificacao";
import { dispararMensagem } from "@/lib/whatsapp";

import { statusDaFalha } from "../../falhas";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  codigo: z.string().regex(/^\d{6}$/, "O código tem 6 dígitos."),
  salaId: z.string().min(1, "Escolha uma sala."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
});

/**
 * POST /api/publico/minhas-reservas/[id]/reagendar
 *   { codigo, salaId, data, inicio, fim }
 *
 * Igual ao cancelar: codigo NOVO do WhatsApp conferido antes de tudo.
 * A reserva continua sendo a mesma (mesmo id), muda de horario, pode mudar
 * de sala, vira REAGENDADA e tem o valor recalculado com o preco atual.
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
  const resultado = await reagendarReserva({
    reservaId: id,
    telefone,
    salaId: corpo.data.salaId,
    inicio: instanteDe(corpo.data.data, corpo.data.inicio),
    fim: instanteDe(corpo.data.data, corpo.data.fim),
  });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalha(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  // O valor da mensagem e o NOVO, recalculado — nunca o antigo.
  dispararMensagem({
    chave: ChaveTemplate.reserva_reagendada,
    telefone,
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
    valorEstimado: resultado.dados.valor,
    status: "REAGENDADA",
  });
}
