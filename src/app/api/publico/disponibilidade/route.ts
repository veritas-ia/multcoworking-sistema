import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { respostaErro } from "@/lib/api";
import { slotsDoDia } from "@/lib/disponibilidade";
import { ehDonoDaReserva } from "@/lib/minhas-reservas";
import { telefoneDaSessao } from "@/lib/sessao-cliente";

export const dynamic = "force-dynamic";

const Parametros = z.object({
  salaId: z.string().min(1, "Informe a sala."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
});

/**
 * GET /api/publico/disponibilidade?salaId=...&data=AAAA-MM-DD
 * Devolve so os blocos e se dao para comecar uma reserva.
 * Nunca diz de quem e a reserva nem por que o horario esta bloqueado.
 *
 * Aceita "&reservaId=..." no reagendamento (Fase 6), para a reserva que esta
 * sendo remarcada nao aparecer ocupando o proprio horario. O identificador so
 * e aceito se pertencer ao telefone da sessao; caso contrario e ignorado em
 * silencio, para ninguem sondar reservas alheias.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const parametros = Parametros.safeParse({
    salaId: requisicao.nextUrl.searchParams.get("salaId") ?? "",
    data: requisicao.nextUrl.searchParams.get("data") ?? "",
  });

  if (!parametros.success) {
    return respostaErro(400, parametros.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const blocos = await slotsDoDia(
    parametros.data.salaId,
    parametros.data.data,
    await reservaAIgnorar(requisicao),
  );

  return NextResponse.json({ data: parametros.data.data, blocos });
}

/**
 * O identificador de reserva a ignorar na grade, ou undefined.
 * So devolve algo quando quem pediu e o dono da reserva.
 */
async function reservaAIgnorar(
  requisicao: NextRequest,
): Promise<string | undefined> {
  const reservaId = requisicao.nextUrl.searchParams.get("reservaId");

  if (!reservaId) {
    return undefined;
  }

  const telefone = await telefoneDaSessao(requisicao);

  if (!telefone || !(await ehDonoDaReserva(reservaId, telefone))) {
    return undefined;
  }

  return reservaId;
}
