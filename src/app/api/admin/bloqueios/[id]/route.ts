import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import {
  editarBloqueio,
  removerBloqueio,
  removerGrupoDeBloqueios,
  tamanhoDoGrupo,
} from "@/lib/bloqueios";
import { lerCorpo, respostaErro } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  dataFim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.")
    .optional(),
  motivo: z.string().trim().max(200, "Motivo muito longo.").optional(),
});

/** GET — os dados do bloqueio, com quantas salas o feriado cobre. */
export async function GET(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await params;
  const bloqueio = await prisma.bloqueio.findUnique({
    where: { id },
    include: { sala: { select: { id: true, nome: true } } },
  });

  if (!bloqueio) {
    return respostaErro(404, "Bloqueio não encontrado.", "NAO_ENCONTRADO");
  }

  return NextResponse.json({
    id: bloqueio.id,
    salaId: bloqueio.sala.id,
    sala: bloqueio.sala.nome,
    data: dataLocalDe(bloqueio.inicio),
    dataFim: dataLocalDe(bloqueio.fim),
    inicio: horaLocalDe(bloqueio.inicio),
    fim: horaLocalDe(bloqueio.fim),
    motivo: bloqueio.motivo,
    grupoId: bloqueio.grupoId,
    /** Quantos bloqueios foram criados junto com este (o feriado inteiro). */
    salasNoGrupo: await tamanhoDoGrupo(bloqueio.grupoId),
  });
}

/** PATCH — muda horário e motivo. */
export async function PATCH(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await params;

  const resultado = await editarBloqueio({
    id,
    inicio: instanteDe(corpo.data.data, corpo.data.inicio),
    fim: instanteDe(corpo.data.dataFim ?? corpo.data.data, corpo.data.fim),
    motivo: corpo.data.motivo?.trim() || null,
  });

  if (!resultado.ok) {
    if (resultado.falha.codigo === "NAO_ENCONTRADO") {
      return respostaErro(404, resultado.falha.motivo, resultado.falha.codigo);
    }
    if (resultado.falha.codigo === "RESERVAS_NO_CAMINHO") {
      return NextResponse.json(
        {
          erro: resultado.falha.motivo,
          codigo: resultado.falha.codigo,
          reservas: resultado.falha.reservas.map((reserva) => ({
            id: reserva.id,
            sala: reserva.sala,
            nomeCliente: reserva.nomeCliente,
            data: dataLocalDe(reserva.inicio),
            inicio: horaLocalDe(reserva.inicio),
            fim: horaLocalDe(reserva.fim),
          })),
        },
        { status: 409 },
      );
    }
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json({ id: resultado.dados.id });
}

/**
 * DELETE — remove o bloqueio.
 * "?grupo=1" remove o feriado inteiro (todas as salas criadas junto).
 */
export async function DELETE(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await params;
  const oGrupoInteiro = requisicao.nextUrl.searchParams.get("grupo") === "1";

  if (!oGrupoInteiro) {
    const resultado = await removerBloqueio(id);
    return resultado.ok
      ? NextResponse.json({ removidos: resultado.dados.removidos })
      : respostaErro(404, resultado.falha.motivo, resultado.falha.codigo);
  }

  const bloqueio = await prisma.bloqueio.findUnique({
    where: { id },
    select: { grupoId: true },
  });

  if (!bloqueio) {
    return respostaErro(404, "Bloqueio não encontrado.", "NAO_ENCONTRADO");
  }

  // Bloqueio antigo, sem grupo: remover "o grupo" e remover ele mesmo.
  if (!bloqueio.grupoId) {
    const resultado = await removerBloqueio(id);
    return resultado.ok
      ? NextResponse.json({ removidos: resultado.dados.removidos })
      : respostaErro(404, resultado.falha.motivo, resultado.falha.codigo);
  }

  const resultado = await removerGrupoDeBloqueios(bloqueio.grupoId);

  return resultado.ok
    ? NextResponse.json({ removidos: resultado.dados.removidos })
    : respostaErro(404, resultado.falha.motivo, resultado.falha.codigo);
}
