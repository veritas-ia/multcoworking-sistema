import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  juntarClientes,
  ligarOuDesligarCliente,
  listarClientes,
  renomearCliente,
  separarTelefone,
  sugerirJuncoes,
} from "@/lib/clientes-painel";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/**
 * O cadastro de clientes, em Configuracoes (Fase 14, parte B).
 *
 * Rota SEPARADA de "/api/admin/clientes", que serve a busca do balcao: ali a
 * pergunta e "qual telefone usar nesta reserva", aqui e "quem sao os meus
 * clientes". Misturar as duas numa rota so faria cada mudanca de uma ter de
 * ser conferida contra a outra.
 *
 * Devolve o telefone INTEIRO: e a equipe olhando os proprios clientes, atras
 * de login — mesma regra do relatorio de clientes.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const [clientes, sugestoes] = await Promise.all([
    listarClientes(),
    sugerirJuncoes(),
  ]);

  return NextResponse.json({ clientes, sugestoes });
}

const Acao = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("renomear"),
    id: z.string().min(1),
    nome: z.string().min(1, "Informe o nome."),
  }),
  z.object({
    acao: z.literal("ligar"),
    id: z.string().min(1),
    ativo: z.boolean(),
  }),
  z.object({
    acao: z.literal("juntar"),
    principalId: z.string().min(1),
    absorvidoId: z.string().min(1),
  }),
  z.object({
    acao: z.literal("separar"),
    telefone: z.string().min(1),
    nome: z.string().min(1, "Informe o nome do cadastro novo."),
  }),
]);

/**
 * POST — as quatro acoes do painel.
 *
 * Numa rota so, com a acao no corpo, porque as quatro mexem no mesmo
 * conjunto de cadastros e a tela recarrega a lista inteira depois de
 * qualquer uma delas.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Acao.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const pedido = corpo.data;

  if (pedido.acao === "renomear") {
    const feito = await renomearCliente(pedido.id, pedido.nome);
    return feito.ok
      ? NextResponse.json({ mensagem: "Nome atualizado." })
      : respostaErro(422, feito.falha.motivo, feito.falha.codigo);
  }

  if (pedido.acao === "ligar") {
    const feito = await ligarOuDesligarCliente(pedido.id, pedido.ativo);
    return feito.ok
      ? NextResponse.json({ mensagem: pedido.ativo ? "Cliente ligado." : "Cliente desligado." })
      : respostaErro(422, feito.falha.motivo, feito.falha.codigo);
  }

  if (pedido.acao === "juntar") {
    const feito = await juntarClientes(pedido.principalId, pedido.absorvidoId);
    return feito.ok
      ? NextResponse.json({ juncao: feito.dados })
      : respostaErro(422, feito.falha.motivo, feito.falha.codigo);
  }

  const feito = await separarTelefone(pedido.telefone, pedido.nome);
  return feito.ok
    ? NextResponse.json({ separacao: feito.dados })
    : respostaErro(422, feito.falha.motivo, feito.falha.codigo);
}
