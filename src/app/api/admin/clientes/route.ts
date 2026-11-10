import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { procurarClientesCadastrados } from "@/lib/clientes";
import { empresaConhecidaDoTelefone } from "@/lib/empresas";
import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/lib/telefone";

import { operadorDaRequisicao } from "../operador";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/clientes — quem ja reservou, para o balcao nao digitar errado.
 *
 * Dois usos, e por isso dois parametros:
 *
 * - "?telefone=..." devolve o nome e a empresa que aquele numero usou, para o
 *   formulario preencher sozinho enquanto a recepcao digita;
 * - "?q=..." PROCURA, por um pedaco do nome ou do telefone, e devolve a lista
 *   de clientes para a recepcao escolher.
 *
 * A busca por nome e o conserto da causa de um problema real: o telefone e
 * obrigatorio na reserva do balcao, e quando a recepcao nao tem o numero do
 * cliente na mao ela digita o da propria recepcao. Isso juntou quatro
 * clientes diferentes num "cliente" so no relatorio, e mandou as
 * confirmacoes e os lembretes deles todos para o WhatsApp da recepcao.
 * Procurar "toca" e mais rapido do que digitar um numero inteiro.
 *
 * So responde para quem esta logado no painel: devolve nome e telefone
 * INTEIRO de cliente. E a equipe olhando os proprios clientes, atras de
 * login — mesma regra do relatorio de clientes.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const procurado = requisicao.nextUrl.searchParams.get("q");

  if (procurado !== null) {
    return NextResponse.json({
      clientes: await procurarClientesCadastrados(procurado),
    });
  }

  const telefone = normalizarTelefone(
    requisicao.nextUrl.searchParams.get("telefone") ?? "",
  );

  // Telefone incompleto nao e erro: a tela consulta enquanto a pessoa digita.
  if (!telefone) {
    return NextResponse.json({ nome: null, empresa: null });
  }

  const ultima = await prisma.reserva.findFirst({
    where: { telefone },
    orderBy: { criadoEm: "desc" },
    select: { nomeCliente: true },
  });

  return NextResponse.json({
    nome: ultima?.nomeCliente ?? null,
    empresa: await empresaConhecidaDoTelefone(telefone),
  });
}
