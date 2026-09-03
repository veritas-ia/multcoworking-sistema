import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { lerCorpo, respostaErro } from "@/lib/api";
import { serieporExtenso } from "@/lib/datas-recorrencia";
import { prisma } from "@/lib/prisma";
import { criarSerie } from "@/lib/recorrencias";
import { normalizarTelefone } from "@/lib/telefone";
import { dataLocalDe, horaLocalDe } from "@/lib/tempo";
import { dispararMensagem } from "@/lib/whatsapp";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  salaId: z.string().min(1, "Escolha uma sala."),
  telefone: z.string().min(1, "Informe o telefone do cliente."),
  nome: z.string().trim().min(2, "Informe o nome do cliente.").max(120, "Nome muito longo."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  diasDaSemana: z
    .array(z.number().int().min(0).max(6))
    .min(1, "Escolha pelo menos um dia da semana."),
  frequencia: z.enum(["SEMANAL", "QUINZENAL", "MENSAL"]),
  /** 1, 2, 3 = primeira/segunda/terceira; -1 = ultima. So na mensal. */
  semanaDoMes: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(-1)]).nullish(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
});

/**
 * POST /api/admin/recorrencias — cria a serie e todas as ocorrencias.
 *
 * A resposta e um RELATORIO: o que entrou e o que ficou de fora, com o motivo.
 * Ocorrencia que esbarra em horario ocupado e pulada; ela nunca derruba a
 * serie inteira. Dias fechados sao pulados de proposito (decisao da Fase 9):
 * uma serie de meses nao pode criar reservas em feriados sozinha.
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

  const telefone = normalizarTelefone(corpo.data.telefone);

  if (!telefone) {
    return respostaErro(
      400,
      "Telefone inválido. Use DDD + celular, como (11) 91234-5678.",
      "TELEFONE_INVALIDO",
    );
  }

  const resultado = await criarSerie({
    salaId: corpo.data.salaId,
    telefone,
    nomeCliente: corpo.data.nome,
    horaInicio: corpo.data.inicio,
    horaFim: corpo.data.fim,
    diasDaSemana: corpo.data.diasDaSemana,
    frequencia: corpo.data.frequencia,
    semanaDoMes: corpo.data.semanaDoMes ?? null,
    dataInicio: corpo.data.dataInicio,
    dataFim: corpo.data.dataFim,
    operador,
  });

  if (!resultado.ok) {
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  const sala = await prisma.sala.findUnique({
    where: { id: corpo.data.salaId },
    select: { nome: true },
  });

  // Cada ocorrencia avisa o cliente, como manda a Fase 9. Os envios saem em
  // fila, sem segurar a resposta desta rota.
  for (const ocorrencia of resultado.dados.criadas) {
    const reserva = await prisma.reserva.findUnique({
      where: { id: ocorrencia.id },
      select: { inicio: true, fim: true, valor: true },
    });

    if (!reserva) {
      continue;
    }

    dispararMensagem({
      chave: ChaveTemplate.reserva_confirmada,
      telefone,
      reservaId: ocorrencia.id,
      variaveis: {
        nome: corpo.data.nome,
        sala: sala?.nome ?? "",
        data: dataLocalDe(reserva.inicio),
        inicio: horaLocalDe(reserva.inicio),
        fim: horaLocalDe(reserva.fim),
        valor: `R$ ${reserva.valor.toFixed(2).replace(".", ",")}`,
      },
    });
  }

  return NextResponse.json(
    {
      recorrenciaId: resultado.dados.recorrenciaId,
      resumo: serieporExtenso({
        diasDaSemana: corpo.data.diasDaSemana,
        frequencia: corpo.data.frequencia,
        semanaDoMes: corpo.data.semanaDoMes ?? null,
        dataInicio: corpo.data.dataInicio,
        dataFim: corpo.data.dataFim,
      }),
      criadas: resultado.dados.criadas,
      puladas: resultado.dados.puladas,
    },
    { status: 201 },
  );
}
