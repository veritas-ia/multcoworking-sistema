import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { lerCorpo, respostaErro } from "@/lib/api";
import { serieporExtenso, type Frequencia, type SemanaDoMes } from "@/lib/datas-recorrencia";
import { prisma } from "@/lib/prisma";
import { criarSerie } from "@/lib/recorrencias";
import { normalizarTelefone } from "@/lib/telefone";

import { dispararMensagem } from "@/lib/whatsapp";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  salaId: z.string().min(1, "Escolha uma sala."),
  profissao: z.enum(["MARKETING", "JURIDICO", "CONTABIL", "SAUDE", "OUTROS"], {
    message: "Escolha a área de atuação do cliente.",
  }),
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
    profissao: corpo.data.profissao,
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

  // UMA mensagem para a serie inteira, nao uma por ocorrencia.
  //
  // Mandar 17 confirmacoes seguidas para a mesma pessoa parecia defeito do
  // sistema e arriscava o limite de rajada do WhatsApp. Os LEMBRETES (24h e 2h)
  // continuam individuais, um por ocorrencia — esses fazem sentido separados.
  if (resultado.dados.criadas.length > 0) {
    const datas = resultado.dados.criadas.map((ocorrencia) => ocorrencia.data);
    const primeira = datas[0] ?? corpo.data.dataInicio;
    const ultima = datas[datas.length - 1] ?? corpo.data.dataFim;

    dispararMensagem({
      chave: ChaveTemplate.serie_confirmada,
      telefone,
      // A serie inteira fica registrada na primeira ocorrencia: o LogMensagem
      // aponta para uma reserva de verdade, e nao para lugar nenhum.
      reservaId: resultado.dados.criadas[0]?.id ?? null,
      variaveis: {
        nome: corpo.data.nome,
        sala: sala?.nome ?? "",
        dias: diasPorExtenso(corpo.data.diasDaSemana, corpo.data.frequencia, corpo.data.semanaDoMes ?? null),
        inicio: corpo.data.inicio,
        fim: corpo.data.fim,
        periodo: `${emDiaEMes(primeira)} a ${emDiaEMes(ultima)}`,
        quantidade: String(resultado.dados.criadas.length),
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

/** "2026-10-06" -> "06/10". */
function emDiaEMes(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}

/** "toda terça e quarta" -> "terça e quarta"; a frequência entra junto. */
function diasPorExtenso(
  diasDaSemana: number[],
  frequencia: Frequencia,
  semanaDoMes: SemanaDoMes | null,
): string {
  return serieporExtenso({
    diasDaSemana,
    frequencia,
    semanaDoMes,
    dataInicio: "",
    dataFim: "",
  });
}
