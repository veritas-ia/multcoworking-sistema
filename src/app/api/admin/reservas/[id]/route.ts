import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { editarCadastro, excluirReserva, reservaCompleta } from "@/lib/agenda-admin";
import { lerCorpo, respostaErro } from "@/lib/api";
import { lerHistorico } from "@/lib/historico-reserva";
import { prisma } from "@/lib/prisma";
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
    recorrenciaId: reserva.recorrenciaId,
    /**
     * Se o horario de termino ja passou.
     *
     * QUEM DECIDE E O SERVIDOR, e nao a tela. A conta depende do relogio de
     * Sao Paulo, e refaze-la no navegador significaria ter a regra de fuso em
     * dois lugares — e o navegador do operador pode estar em outro fuso. A
     * tela so lê isto para saber quais botoes de status mostrar.
     */
    jaTerminou: reserva.fim <= new Date(),
    /**
     * O RECEBIMENTO NO BALCAO, quando houve (Fase 16, Parte B).
     *
     * NULO e o normal, e nao falta de informacao: a maioria das reservas e de
     * mensalista, que paga no fim do mes pelo demonstrativo. Marcar aqui
     * TAMBEM contaria o mesmo dinheiro duas vezes.
     *
     * Sai da linha do caixa ligada a esta reserva — nao de um campo da
     * reserva. O dinheiro vive no financeiro; aqui e so a leitura dele.
     */
    recebimento: await recebimentoDaReserva(reserva.id),
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

const Exclusao = z.object({
  motivo: z
    .string()
    .trim()
    .min(3, "Escreva por que esta reserva está sendo excluída.")
    .max(200),
});

/**
 * DELETE /api/admin/reservas/[id] — apaga a reserva de vez.
 *
 * PARA QUE SERVE: lancamento errado — sala trocada, dia trocado, duplicada.
 * Cancelar nao resolve esse caso: a reserva cancelada CONTINUA contando como
 * reserva no relatorio, entao um engano cancelado infla o numero e suja o
 * historico do cliente com um cancelamento que nunca existiu.
 *
 * O MOTIVO VEM NO CORPO, e e obrigatorio. Um DELETE normalmente nao tem
 * corpo, mas aqui ele carrega a unica coisa que sobra depois: a explicacao.
 * Sem ela, o registro de evidencia nao explicaria nada daqui a seis meses.
 *
 * A acao e gravada no historico ANTES de apagar, na mesma transacao.
 */
export async function DELETE(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await params;
  const corpo = Exclusao.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await excluirReserva({
    reservaId: id,
    motivo: corpo.data.motivo,
    operador,
  });

  return feito.ok
    ? NextResponse.json(feito.dados)
    : respostaErro(
        statusDaFalhaAdmin(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}

/**
 * O recebimento desta reserva, lido do financeiro.
 *
 * Consulta propria, e nao um campo gravado na reserva: o lancamento e que
 * manda, e duplicar o valor aqui criaria dois numeros para o mesmo dinheiro.
 */
async function recebimentoDaReserva(reservaId: string): Promise<{
  lancamentoId: string;
  valor: string;
  pagoEm: string | null;
  formaPagamento: string | null;
} | null> {
  const linha = await prisma.lancamento.findUnique({
    where: { reservaId },
    select: {
      id: true,
      valor: true,
      pagoEm: true,
      formaPagamento: { select: { nome: true } },
    },
  });

  return linha
    ? {
        lancamentoId: linha.id,
        valor: linha.valor.toFixed(2),
        // A coluna e DATE: o Prisma a entrega como meia-noite UTC, e ler com
        // a regra de fuso daqui voltaria um dia.
        pagoEm: linha.pagoEm ? linha.pagoEm.toISOString().slice(0, 10) : null,
        formaPagamento: linha.formaPagamento?.nome ?? null,
      }
    : null;
}
