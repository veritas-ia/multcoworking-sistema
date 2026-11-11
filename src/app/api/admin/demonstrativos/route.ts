import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { listar, montarDoPeriodo, salvar } from "@/lib/demonstrativos";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const DATA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.");
const VALOR = z
  .string()
  .regex(/^\d+([.,]\d{1,2})?$/, "Use um valor como 30 ou 30,50.")
  .transform((v) => v.replace(",", "."));

const LinhaExtra = z.object({
  descricao: z.string().trim().min(1, "Escreva o que é esta linha.").max(120),
  valor: VALOR,
});

/**
 * GET — a PRE-VISUALIZACAO do demonstrativo, montada a partir das reservas,
 * ou a LISTA dos que ja foram emitidos.
 *
 * A pre-visualizacao nao grava nada: a gestao mexe no periodo e no preco a
 * vontade, e so salva quando estiver certo.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const p = requisicao.nextUrl.searchParams;
  const clienteId = p.get("clienteId");
  const empresaId = p.get("empresaId");
  const de = p.get("de");
  const ate = p.get("ate");

  if ((!clienteId && !empresaId) || !de || !ate) {
    return NextResponse.json({ emitidos: await listar({ clienteId, empresaId }) });
  }

  const entrada = z.object({ de: DATA, ate: DATA }).safeParse({ de, ate });

  if (!entrada.success) {
    return respostaErro(400, entrada.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const feito = await montarDoPeriodo({
    clienteId,
    empresaId,
    de: entrada.data.de,
    ate: entrada.data.ate,
    valorHora: p.get("valorHora") ?? undefined,
  });

  return feito.ok
    ? NextResponse.json({ demonstrativo: feito.dados })
    : respostaErro(422, feito.falha.motivo, feito.falha.codigo);
}

const Corpo = z.object({
  /** Preenchido ao reeditar um demonstrativo ja salvo. */
  id: z.string().min(1).nullish(),
  /** UM dos dois: o documento é de uma pessoa ou de uma empresa inteira. */
  clienteId: z.string().min(1).nullish(),
  empresaId: z.string().min(1).nullish(),
  de: DATA,
  ate: DATA,
  /**
   * O preco por hora combinado. OPCIONAL: em branco, o documento soma o
   * valor que cada reserva ja tem gravado.
   */
  valorHora: VALOR.nullish(),
  linhasExtras: z.array(LinhaExtra).max(30),
  /**
   * O total escrito a mao, quando houve renegociacao. Vazio e o normal:
   * vale a soma que o sistema faz.
   */
  totalAjustado: VALOR.nullish(),
  /** Guarda este preco como o padrao do cliente para a proxima vez. */
  lembrarPreco: z.boolean().default(true),
});

/** POST — salva o demonstrativo, congelando a tabela de horas como esta agora. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  if (!corpo.data.clienteId && !corpo.data.empresaId) {
    return respostaErro(400, "Escolha o cliente ou a empresa.");
  }

  const feito = await salvar({
    id: corpo.data.id ?? null,
    clienteId: corpo.data.clienteId ?? null,
    empresaId: corpo.data.empresaId ?? null,
    de: corpo.data.de,
    ate: corpo.data.ate,
    valorHora: corpo.data.valorHora ?? null,
    linhasExtras: corpo.data.linhasExtras,
    totalAjustado: corpo.data.totalAjustado ?? null,
    lembrarPreco: corpo.data.lembrarPreco,
  });

  return feito.ok
    ? NextResponse.json({ demonstrativo: feito.dados }, { status: 201 })
    : respostaErro(422, feito.falha.motivo, feito.falha.codigo);
}
