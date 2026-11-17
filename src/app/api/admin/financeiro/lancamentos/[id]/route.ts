import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro, lerCorpo } from "@/lib/api";
import { editarLancamento, excluirLancamento } from "@/lib/financeiro";
import { z } from "zod";

import { operadorDaRequisicao } from "../../../operador";
import { statusDoFinanceiro } from "../../status";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * TUDO E EDITAVEL, e isso e decisao do dono (17/11/2026): *"entrada e saida
 * vao poder ser editaveis manualmente, ne? Porque seria ideal."*
 *
 * E dinheiro que a propria equipe digitou — erro de digitacao e normal, e
 * travar a correcao faria a equipe parar de usar a tela. O que NAO e editavel
 * no sistema esta noutro lugar e por outra razao: o valor congelado numa
 * reserva antiga e o demonstrativo ja enviado ao cliente.
 */
const Mudanca = z.object({
  descricao: z.string().min(1, "Escreva do que se trata.").optional(),
  valor: z.string().min(1, "Escreva o valor.").optional(),
  categoriaId: z.string().min(1).optional(),
  clienteId: z.string().min(1).nullish(),
  empresaId: z.string().min(1).nullish(),
  fornecedorId: z.string().min(1).nullish(),
  formaPagamentoId: z.string().min(1).nullish(),
  vencimento: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD.").optional(),
  pagoEm: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD.").nullish(),
  observacao: z.string().max(300).nullish(),
});

/** PATCH /api/admin/financeiro/lancamentos/[id] — corrige o lancamento. */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Mudanca.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const { id } = await contexto.params;
  const feito = await editarLancamento(id, corpo.data);

  return feito.ok
    ? NextResponse.json({ lancamento: feito.dados })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}

/**
 * O MOTIVO E OBRIGATORIO na exclusao.
 *
 * Ele vai no CORPO de um DELETE, que e incomum mas correto aqui: na barra de
 * endereco ele apareceria no registro do servidor e em qualquer historico de
 * navegacao, e e um texto que a equipe escreve sobre dinheiro.
 */
const Exclusao = z.object({
  motivo: z.string().min(3, "Escreva por que este lançamento está sendo excluído."),
});

/**
 * DELETE /api/admin/financeiro/lancamentos/[id] — exclui, com evidencia.
 *
 * PARA QUE EXCLUIR EXISTE: lancamento duplicado ou posto na conta errada.
 * Deixa-lo "pendente para sempre" sujaria as contas a pagar, e zerar o valor
 * e impossivel — o banco recusa valor zero, e e bom que recuse.
 *
 * O registro e a exclusao acontecem na MESMA transacao, e o resumo da linha
 * fica CONGELADO: ela nao existira mais para ser consultada. Mesmo desenho da
 * exclusao de reserva.
 */
export async function DELETE(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Exclusao.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(
      400,
      corpo.error.issues[0]?.message ?? "Escreva o motivo da exclusão.",
      "MOTIVO_OBRIGATORIO",
    );
  }

  const { id } = await contexto.params;
  const feito = await excluirLancamento({ id, motivo: corpo.data.motivo, operador });

  return feito.ok
    ? NextResponse.json({ resumo: feito.dados.resumo })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
