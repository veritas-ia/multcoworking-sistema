import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro, lerCorpo } from "@/lib/api";
import {
  hojeLocal,
  lancar,
  listarLancamentos,
  listarCategorias,
  listarFornecedores,
  resumir,
  TipoDeLancamento,
  type SituacaoDoLancamento,
} from "@/lib/financeiro";
import { listarFormasDePagamento } from "@/lib/emporio";
import { z } from "zod";

import { operadorDaRequisicao } from "../../operador";
import { statusDoFinanceiro } from "../status";

export const dynamic = "force-dynamic";

const DIA = /^\d{4}-\d{2}-\d{2}$/;

const SITUACOES: readonly SituacaoDoLancamento[] = ["PAGO", "PENDENTE", "ATRASADO"];

/**
 * GET /api/admin/financeiro/lancamentos — as contas de um periodo.
 *
 * "base" escolhe QUAL DATA MANDA, e isso e uma escolha de leitura, nao um
 * detalhe tecnico:
 *
 *  - "vencimento" (o padrao) e a visao de CONTAS: o que vence neste mes, pago
 *    ou nao. E com ela que a equipe trabalha no dia a dia;
 *  - "pagamento" e a visao de CAIXA: o que entrou e saiu de verdade.
 *
 * Uma conta de outubro paga em novembro e despesa de outubro e caixa de
 * novembro. Misturar as duas visoes num filtro so daria um numero que nao
 * bate com nenhuma das duas.
 *
 * O RESUMO VEM JUNTO, somado no servidor em centavos. Somar na tela abriria
 * uma segunda conta do mesmo numero, e um dia as duas discordariam.
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

  const tipoPedido = p.get("tipo");
  const tipo =
    tipoPedido === TipoDeLancamento.ENTRADA || tipoPedido === TipoDeLancamento.SAIDA
      ? tipoPedido
      : undefined;

  const situacaoPedida = p.get("situacao");
  const situacao = SITUACOES.find((uma) => uma === situacaoPedida);

  const lancamentos = await listarLancamentos({
    de,
    ate,
    base: p.get("base") === "pagamento" ? "pagamento" : "vencimento",
    tipo,
    categoriaId: p.get("categoriaId") ?? undefined,
    clienteId: p.get("clienteId") ?? undefined,
    empresaId: p.get("empresaId") ?? undefined,
    fornecedorId: p.get("fornecedorId") ?? undefined,
    situacao,
  });

  return NextResponse.json({
    lancamentos,
    resumo: resumir(lancamentos),
    /*
     * O QUE A TELA PRECISA PARA O FORMULARIO vai junto: sem isto seriam tres
     * idas a mais ao servidor so para desenhar os seletores.
     *
     * So as ATIVAS: categoria ou fornecedor desligado nao se escolhe num
     * lancamento novo — mas os lancamentos antigos deles continuam de pe, e e
     * por isso que a lista acima nao filtra nada disso.
     */
    categorias: await listarCategorias({ somenteAtivas: true }),
    fornecedores: await listarFornecedores({ somenteAtivos: true }),
    formasDePagamento: await listarFormasDePagamento({ somenteAtivas: true }),
    /*
     * "hoje" SAI DO SERVIDOR, no relogio de Sao Paulo. E ele que decide o que
     * esta atrasado; recalcular no navegador poria a regra de fuso em dois
     * lugares, e o navegador do operador pode estar em outro.
     */
    hoje: hojeLocal(),
  });
}

/**
 * O que a tela manda para lancar.
 *
 * REPARE NO QUE NAO ESTA AQUI: o LADO (entrada ou saida). Ele e o tipo da
 * categoria escolhida. Se a tela pudesse mandar, um pedido montado a mao
 * poria uma despesa do lado das receitas e o caixa do mes somaria errado.
 */
const Novo = z.object({
  descricao: z.string().min(1, "Escreva do que se trata."),
  /** Em reais, como a tela digita. O servidor converte para centavos. */
  valor: z.string().min(1, "Escreva o valor."),
  categoriaId: z.string().min(1, "Escolha a categoria."),
  clienteId: z.string().min(1).nullish(),
  empresaId: z.string().min(1).nullish(),
  fornecedorId: z.string().min(1).nullish(),
  formaPagamentoId: z.string().min(1).nullish(),
  vencimento: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD."),
  /** Preenchido = ja aconteceu. Nulo = pendente. */
  pagoEm: z.string().regex(DIA, "Use a data no formato AAAA-MM-DD.").nullish(),
  observacao: z.string().max(300).nullish(),
});

/** POST /api/admin/financeiro/lancamentos — lanca uma entrada ou uma saida. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Novo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await lancar(corpo.data, operador);

  return feito.ok
    ? NextResponse.json({ lancamento: feito.dados }, { status: 201 })
    : respostaErro(
        statusDoFinanceiro(feito.falha.codigo),
        feito.falha.motivo,
        feito.falha.codigo,
      );
}
