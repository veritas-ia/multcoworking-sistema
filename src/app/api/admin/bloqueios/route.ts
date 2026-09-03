import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { criarBloqueio, reservasNoCaminho } from "@/lib/bloqueios";
import { lerCorpo, respostaErro } from "@/lib/api";
import { dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/**
 * Um bloqueio vai de uma data/hora a outra. "Dia inteiro" e so um atalho da
 * tela: ela manda 00:00 as 23:59 do mesmo dia.
 */
const Corpo = z.object({
  /** Uma ou mais salas. Um feriado manda todas de uma vez. */
  salaIds: z.array(z.string().min(1)).min(1, "Escolha pelo menos uma sala."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  /** Fim no mesmo dia. "24:00" nao existe: o dia inteiro vai ate 23:59. */
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  motivo: z.string().trim().max(200, "Motivo muito longo.").optional(),
  /** Data final, para bloquear varios dias seguidos. Padrao: o mesmo dia. */
  dataFim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.")
    .optional(),
});

/**
 * POST /api/admin/bloqueios
 *
 * Se houver reserva ativa no periodo, NAO cria nada e devolve a lista de
 * reservas afetadas — a equipe precisa cancelar ou remarcar cada uma antes.
 * Nunca bloqueia "metade" de um feriado.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const inicio = instanteDe(corpo.data.data, corpo.data.inicio);
  const fim = instanteDe(corpo.data.dataFim ?? corpo.data.data, corpo.data.fim);

  const resultado = await criarBloqueio({
    salaIds: corpo.data.salaIds,
    inicio,
    fim,
    motivo: corpo.data.motivo?.trim() || null,
    operador,
  });

  if (!resultado.ok) {
    if (resultado.falha.codigo === "RESERVAS_NO_CAMINHO") {
      return NextResponse.json(
        {
          erro: resultado.falha.motivo,
          codigo: resultado.falha.codigo,
          reservas: resultado.falha.reservas.map((reserva) => ({
            id: reserva.id,
            sala: reserva.sala,
            nomeCliente: reserva.nomeCliente,
            telefone: reserva.telefone,
            data: dataLocalDe(reserva.inicio),
            inicio: horaLocalDe(reserva.inicio),
            fim: horaLocalDe(reserva.fim),
            status: reserva.status,
          })),
        },
        { status: 409 },
      );
    }

    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json(
    {
      grupoId: resultado.dados.grupoId,
      ids: resultado.dados.ids,
      salas: resultado.dados.salas,
    },
    { status: 201 },
  );
}

/**
 * GET /api/admin/bloqueios/conferir?... — quais reservas atrapalhariam.
 *
 * A tela chama antes de mostrar o botao de confirmar, para a equipe ja ver o
 * problema sem precisar tentar e levar erro.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const parametros = requisicao.nextUrl.searchParams;
  const salaIds = parametros.getAll("salaId");
  const data = parametros.get("data") ?? "";
  const inicio = parametros.get("inicio") ?? "";
  const fim = parametros.get("fim") ?? "";
  const dataFim = parametros.get("dataFim") ?? data;

  const conferencia = Corpo.safeParse({ salaIds, data, inicio, fim, dataFim });

  if (!conferencia.success) {
    return respostaErro(400, conferencia.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const reservas = await reservasNoCaminho({
    salaIds,
    inicio: instanteDe(data, inicio),
    fim: instanteDe(dataFim, fim),
  });

  return NextResponse.json({
    reservas: reservas.map((reserva) => ({
      id: reserva.id,
      sala: reserva.sala,
      nomeCliente: reserva.nomeCliente,
      telefone: reserva.telefone,
      data: dataLocalDe(reserva.inicio),
      inicio: horaLocalDe(reserva.inicio),
      fim: horaLocalDe(reserva.fim),
      status: reserva.status,
    })),
  });
}
