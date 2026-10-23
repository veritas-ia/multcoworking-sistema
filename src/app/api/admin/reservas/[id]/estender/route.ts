import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { esticarTerminoComoAdmin } from "@/lib/agenda-admin";
import { lerCorpo, respostaErro } from "@/lib/api";
import { dataAmigavelDe, dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";
import { dispararMensagem } from "@/lib/whatsapp";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  /** O dia da reserva, para montar o instante no fuso de Sao Paulo. */
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  /** O NOVO termino. Precisa ser depois do atual. */
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
});

/** "30 minutos", "1 hora", "1 hora e 30 minutos". */
function tempoPorExtenso(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  const pedacos: string[] = [];

  if (horas > 0) {
    pedacos.push(horas === 1 ? "1 hora" : `${horas} horas`);
  }

  if (resto > 0) {
    pedacos.push(`${resto} minutos`);
  }

  return pedacos.join(" e ");
}

/**
 * POST /api/admin/reservas/[id]/estender
 *
 * O cliente ficou mais tempo do que reservou. A equipe estica o termino, o
 * valor do tempo extra e somado ao que ja estava congelado, e o cliente
 * recebe um WhatsApp com o horario novo e o valor atualizado.
 *
 * NAO e um reagendamento: o status nao muda, e lembrete e avaliacao nao sao
 * tocados. Ver "esticarTerminoComoAdmin".
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

  const resultado = await esticarTerminoComoAdmin({
    reservaId: id,
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
    chave: ChaveTemplate.reserva_estendida,
    telefone: resultado.dados.telefone,
    reservaId: resultado.dados.id,
    variaveis: {
      nome: resultado.dados.nomeCliente,
      sala: resultado.dados.sala,
      data: dataAmigavelDe(resultado.dados.inicio),
      inicio: horaLocalDe(resultado.dados.inicio),
      fim: horaLocalDe(resultado.dados.fim),
      extra: tempoPorExtenso(resultado.dados.minutosExtras),
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
    valorAnterior: resultado.dados.valorAnterior,
    valorExtra: resultado.dados.valorExtra,
    minutosExtras: resultado.dados.minutosExtras,
  });
}
