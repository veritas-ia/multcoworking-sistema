import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { serieporExtenso, type Frequencia, type SemanaDoMes } from "@/lib/datas-recorrencia";
import { resumoDaSerie } from "@/lib/recorrencias";
import { dataLocalDe } from "@/lib/tempo";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/recorrencias/[id]
 *
 * Os dados da serie, para a tela conseguir perguntar "só esta ocorrência ou a
 * série inteira?" — e dizer quantas reservas futuras seriam afetadas.
 */
export async function GET(
  requisicao: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await params;
  const resumo = await resumoDaSerie(id);

  if (!resumo) {
    return respostaErro(404, "Série não encontrada.", "NAO_ENCONTRADA");
  }

  const { recorrencia, total, futurasAtivas } = resumo;

  return NextResponse.json({
    id: recorrencia.id,
    sala: recorrencia.sala.nome,
    nomeCliente: recorrencia.nomeCliente,
    telefone: recorrencia.telefone,
    inicio: recorrencia.horaInicio,
    fim: recorrencia.horaFim,
    dataInicio: dataLocalDe(recorrencia.dataInicio),
    dataFim: dataLocalDe(recorrencia.dataFim),
    ativa: recorrencia.ativa,
    /** "toda terça e quarta", "a última sexta de cada mês"... */
    resumo: serieporExtenso({
      diasDaSemana: recorrencia.diasDaSemana,
      frequencia: recorrencia.frequencia as Frequencia,
      semanaDoMes: (recorrencia.semanaDoMes ?? null) as SemanaDoMes | null,
      dataInicio: dataLocalDe(recorrencia.dataInicio),
      dataFim: dataLocalDe(recorrencia.dataFim),
    }),
    /** Quantas ocorrências a série tem no total. */
    total,
    /** Quantas ainda estão de pé e no futuro — as que um cancelamento pegaria. */
    futurasAtivas,
  });
}
