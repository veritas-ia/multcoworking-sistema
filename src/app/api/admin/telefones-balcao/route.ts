import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  desmarcarTelefoneDeBalcao,
  listarTelefonesDeBalcao,
  marcarTelefoneDeBalcao,
} from "@/lib/telefones-balcao";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

const Marcar = z.object({
  telefone: z.string().min(1, "Informe o telefone."),
  motivo: z
    .string({ error: "Escreva por que este número não é de um cliente." })
    .min(3, "Escreva por que este número não é de um cliente."),
});

/**
 * GET — os telefones marcados como de balcao.
 *
 * Devolve o telefone INTEIRO e todos os nomes que ele carrega: e a equipe
 * olhando os proprios clientes, atras de login, e sem ver os nomes ela nao
 * reconhece o numero. Mesma regra do relatorio de clientes.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  return NextResponse.json({ telefones: await listarTelefonesDeBalcao() });
}

/**
 * POST — marca um numero.
 *
 * NAO altera reserva nenhuma: a marcacao e uma lente na hora de montar o
 * relatorio. Desmarcar devolve tudo como era.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Marcar.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await marcarTelefoneDeBalcao(
    corpo.data.telefone,
    corpo.data.motivo,
    operador.id,
  );

  if (!resultado.ok) {
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json({ telefone: resultado.dados }, { status: 201 });
}

/** DELETE ?telefone=... — desfaz a marcacao. */
export async function DELETE(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const telefone = requisicao.nextUrl.searchParams.get("telefone") ?? "";
  const resultado = await desmarcarTelefoneDeBalcao(telefone);

  if (!resultado.ok) {
    return respostaErro(422, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json({ mensagem: "Marcação removida." });
}
