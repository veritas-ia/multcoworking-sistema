import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  lerIntervaloEntreReservas,
  lerParametros,
  salvarParametros,
} from "@/lib/configuracoes";
import {
  LIMITE_POR_HORA_POR_IP,
  LIMITE_POR_HORA_POR_NUMERO,
  LIMITE_POR_MINUTO_POR_NUMERO,
  MAXIMO_DE_TENTATIVAS,
  MINUTOS_DE_BLOQUEIO,
  MINUTOS_DE_VALIDADE,
} from "@/lib/verificacao";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/**
 * Os quatro numeros vem sempre juntos, e nao um a um: eles se conferem em
 * conjunto (antecedencia minima x maxima, duracao minima x duracao maxima das
 * salas). Receber um de cada vez obrigaria a validar contra um estado que a
 * equipe ainda esta no meio de mudar.
 */
const Corpo = z.object({
  duracaoMinimaMinutos: z.number().int(),
  janelaCancelamentoHoras: z.number().int(),
  antecedenciaMinimaMinutos: z.number().int(),
  antecedenciaMaximaDias: z.number().int(),
});

/** O que a tela mostra sem deixar editar. Ver o comentario de configuracoes.ts. */
async function somenteLeitura() {
  return {
    intervaloMinutos: await lerIntervaloEntreReservas(),
    codigoWhatsapp: {
      minutosDeValidade: MINUTOS_DE_VALIDADE,
      maximoDeTentativas: MAXIMO_DE_TENTATIVAS,
      minutosDeBloqueio: MINUTOS_DE_BLOQUEIO,
      porMinutoPorNumero: LIMITE_POR_MINUTO_POR_NUMERO,
      porHoraPorNumero: LIMITE_POR_HORA_POR_NUMERO,
      porHoraPorIp: LIMITE_POR_HORA_POR_IP,
    },
  };
}

/** GET /api/admin/parametros */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({
    parametros: await lerParametros(),
    ...(await somenteLeitura()),
  });
}

/** PATCH /api/admin/parametros — grava os quatro de uma vez. */
export async function PATCH(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await salvarParametros(corpo.data);

  if (!resultado.ok) {
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json({
    parametros: resultado.dados,
    ...(await somenteLeitura()),
  });
}
