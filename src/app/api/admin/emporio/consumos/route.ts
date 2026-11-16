import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  lancarConsumo,
  listarConsumos,
  listarFormasDePagamento,
  MomentoDoPagamento,
} from "@/lib/emporio";

import { operadorDaRequisicao } from "../../operador";
import { statusDoEmporio } from "../produtos/route";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/admin/emporio/consumos — o que foi lancado no periodo.
 *
 * E a tela de conferencia contra a ficha fisica: a recepcionista lanca e olha
 * a lista do dia para ver se bate com o papel.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const p = requisicao.nextUrl.searchParams;
  const de = p.get("de");
  const ate = p.get("ate");

  if (!de || !ate || !DIA.test(de) || !DIA.test(ate)) {
    return respostaErro(400, "Informe o período no formato AAAA-MM-DD.");
  }

  if (ate < de) {
    return respostaErro(400, "A data final precisa ser igual ou depois da inicial.");
  }

  const pedido = p.get("momento");
  const momento =
    pedido === MomentoDoPagamento.NA_HORA ||
    pedido === MomentoDoPagamento.NA_MENSALIDADE
      ? pedido
      : undefined;

  return NextResponse.json({
    consumos: await listarConsumos({
      de,
      ate,
      clienteId: p.get("clienteId") ?? undefined,
      momento,
    }),
    // Vão junto: a tela precisa delas no formulário, e seriam uma segunda
    // ida ao servidor para nada.
    formasDePagamento: await listarFormasDePagamento({ somenteAtivas: true }),
  });
}

/**
 * O que a tela manda.
 *
 * REPARE NO QUE NAO ESTA AQUI: o VALOR. Ele e calculado no servidor, a partir
 * do preco do produto. Aceitar o total de quem chama devolveria exatamente o
 * problema que este lancamento veio resolver — um numero digitado que ninguem
 * confere.
 */
const Novo = z.object({
  /** O CADASTRO, nunca um nome digitado. */
  clienteId: z.string().min(1, "Escolha o cliente."),
  produtoId: z.string().min(1, "Escolha o produto."),
  quantidade: z.number().int().positive("A quantidade precisa ser maior que zero."),
  /** O dia da FICHA, não o do lançamento. */
  dia: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD."),
  hora: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Use a hora como 09:40."),
  salaId: z.string().min(1).nullish(),
  momento: z.enum([
    MomentoDoPagamento.NA_HORA,
    MomentoDoPagamento.NA_MENSALIDADE,
  ]),
  formaPagamentoId: z.string().min(1).nullish(),
});

/** POST /api/admin/emporio/consumos — lança uma linha da ficha. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Novo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await lancarConsumo({
    ...corpo.data,
    salaId: corpo.data.salaId ?? null,
    formaPagamentoId: corpo.data.formaPagamentoId ?? null,
    usuarioId: operador.id,
  });

  return feito.ok
    ? NextResponse.json({ consumo: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoEmporio(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
