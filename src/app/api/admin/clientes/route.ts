import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/lib/telefone";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/clientes?telefone=...
 *
 * O nome que este telefone usou na ULTIMA reserva, para o formulario da
 * recepcao preencher sozinho.
 *
 * Existe pelo mesmo motivo do campo travado no site: a mesma pessoa vinha
 * sendo cadastrada de varios jeitos ("Prestare", "Prestare Karen",
 * "Prestare - Karen"), e metade dessas reservas foi lancada pelo balcao. O
 * agrupamento do relatorio sempre foi pelo telefone, entao os numeros nunca
 * estiveram errados — o que suja e a busca e a leitura da equipe.
 *
 * So responde para quem esta logado no painel: devolve nome de cliente.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const telefone = normalizarTelefone(
    requisicao.nextUrl.searchParams.get("telefone") ?? "",
  );

  // Telefone incompleto nao e erro: a tela consulta enquanto a pessoa digita.
  if (!telefone) {
    return NextResponse.json({ nome: null });
  }

  const ultima = await prisma.reserva.findFirst({
    where: { telefone },
    orderBy: { criadoEm: "desc" },
    select: { nomeCliente: true },
  });

  return NextResponse.json({ nome: ultima?.nomeCliente ?? null });
}
