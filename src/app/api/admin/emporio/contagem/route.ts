import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  CategoriaDoProduto,
  prepararContagem,
  registrarContagem,
  TipoDeControle,
} from "@/lib/emporio";

import { operadorDaRequisicao } from "../../operador";
import { statusDoEmporio } from "../produtos/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/emporio/contagem — a ficha em branco para preencher.
 *
 * Vem com o que o sistema ESPERA encontrar em cada produto, para a pessoa ver
 * a diferenca na hora de digitar e nao depois, quando ja fechou a tela.
 *
 * Os filtros existem porque as fichas FISICAS sao tres — chocolate, geladeira
 * e cafe —, contadas em horarios diferentes. Quem conta a geladeira as 9h40
 * nao quer a lista do chocolate na frente.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const parametros = requisicao.nextUrl.searchParams;
  const categoriaPedida = parametros.get("categoria");
  const controlePedido = parametros.get("controle");

  const categoria =
    categoriaPedida === CategoriaDoProduto.COMIDA ||
    categoriaPedida === CategoriaDoProduto.BEBIDA
      ? categoriaPedida
      : undefined;

  const controle =
    controlePedido === TipoDeControle.ESTOQUE ||
    controlePedido === TipoDeControle.CONTADOR
      ? controlePedido
      : undefined;

  return NextResponse.json({
    linhas: await prepararContagem({ categoria, controle }),
  });
}

const Corpo = z.object({
  /** O dia da FICHA, não o do lançamento: a ficha é lida no dia seguinte. */
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  horario: z
    .string()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Use a hora como 09:40.")
    .nullish(),
  /** O campo "FALTOU" da ficha, escrito à mão. */
  observacao: z.string().trim().max(300).nullish(),
  itens: z
    .array(
      z.object({
        produtoId: z.string().min(1),
        quantidade: z.number().int().min(0, "A quantidade não pode ser negativa."),
      }),
    )
    .min(1, "Informe ao menos um produto."),
});

/**
 * POST /api/admin/emporio/contagem — grava a ficha e RECONCILIA o estoque.
 *
 * A contagem nao substitui os movimentos: ela gera um AJUSTE com a diferenca,
 * e o estoque continua sendo a soma deles. Duas fontes de verdade para o mesmo
 * numero sao o comeco de dois numeros que discordam na mesma tela.
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

  const feito = await registrarContagem({
    dia: corpo.data.dia,
    horario: corpo.data.horario,
    observacao: corpo.data.observacao,
    itens: corpo.data.itens,
    usuarioId: operador.id,
  });

  return feito.ok
    ? NextResponse.json({ contagem: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoEmporio(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
