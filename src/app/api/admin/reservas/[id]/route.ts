import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { editarCadastro, reservaCompleta } from "@/lib/agenda-admin";
import { lerCorpo, respostaErro } from "@/lib/api";
import { lerHistorico } from "@/lib/historico-reserva";
import { normalizarTelefone } from "@/lib/telefone";
import { dataLocalDe, horaLocalDe, minutosEntre } from "@/lib/tempo";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  nome: z.string().trim().min(2, "Informe o nome do cliente.").max(120, "Nome muito longo."),
  telefone: z.string().min(1, "Informe o telefone do cliente."),
});

/** GET /api/admin/reservas/[id] — tudo sobre a reserva, para o painel lateral. */
export async function GET(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await params;
  const reserva = await reservaCompleta(id);

  if (!reserva) {
    return respostaErro(404, "Reserva não encontrada.", "NAO_ENCONTRADA");
  }

  return NextResponse.json({
    id: reserva.id,
    salaId: reserva.sala.id,
    sala: reserva.sala.nome,
    nomeCliente: reserva.nomeCliente,
    telefone: reserva.telefone,
    data: dataLocalDe(reserva.inicio),
    inicio: horaLocalDe(reserva.inicio),
    fim: horaLocalDe(reserva.fim),
    duracaoMinutos: minutosEntre(reserva.inicio, reserva.fim),
    valor: reserva.valor.toFixed(2),
    status: reserva.status,
    origem: reserva.origem,
    criadoEm: reserva.criadoEm.toISOString(),
    canceladoEm: reserva.canceladoEm?.toISOString() ?? null,
    historico: lerHistorico(reserva.historicoAlteracoes),
  });
}

/**
 * PATCH /api/admin/reservas/[id]  { nome, telefone }
 *
 * Corrige o CADASTRO do cliente. Nao mexe em horario e NAO dispara WhatsApp:
 * arrumar um nome escrito errado nao e novidade para o cliente. Mudar horario
 * e a rota "reagendar", que avisa.
 */
export async function PATCH(
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

  const telefone = normalizarTelefone(corpo.data.telefone);

  if (!telefone) {
    return respostaErro(
      400,
      "Telefone inválido. Use DDD + celular, como (11) 91234-5678.",
      "TELEFONE_INVALIDO",
    );
  }

  const { id } = await params;
  const resultado = await editarCadastro({
    reservaId: id,
    nomeCliente: corpo.data.nome,
    telefone,
    operador,
  });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalhaAdmin(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ id: resultado.dados.id });
}
