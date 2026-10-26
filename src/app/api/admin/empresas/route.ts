import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import {
  criarEmpresa,
  listarClientesConhecidos,
  listarEmpresas,
  sugerirAgrupamentos,
  vincularTelefone,
} from "@/lib/empresas";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../operador";

export const dynamic = "force-dynamic";

const Nova = z.object({ nome: z.string().min(1, "Escreva o nome da empresa.") });

const Vinculo = z.object({
  telefone: z.string().min(1, "Informe o telefone."),
  /** Nulo DESVINCULA o telefone da empresa em que estava. */
  empresaId: z.union([z.string().min(1), z.null()]),
});

/**
 * GET /api/admin/empresas
 *
 * Devolve as empresas, TODOS os telefones que já reservaram (com os nomes que
 * cada um usou) e as sugestões de agrupamento. Tudo numa resposta só porque a
 * tela precisa dos três juntos para a equipe decidir.
 *
 * Só para quem está logado: a lista tem nome e telefone de cliente.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const [empresas, clientes] = await Promise.all([
    listarEmpresas(),
    listarClientesConhecidos(),
  ]);

  return NextResponse.json({
    empresas,
    clientes,
    sugestoes: sugerirAgrupamentos(clientes),
  });
}

/** POST /api/admin/empresas — cadastra uma empresa. */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Nova.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await criarEmpresa(corpo.data.nome);

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalhaAdmin(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json({ empresa: resultado.dados }, { status: 201 });
}

/** PUT /api/admin/empresas — marca um telefone como de uma empresa. */
export async function PUT(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Vinculo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado = await vincularTelefone(corpo.data.telefone, corpo.data.empresaId);

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalhaAdmin(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  return NextResponse.json(resultado.dados);
}
