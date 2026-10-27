import { NextResponse } from "next/server";

import {
  listarProfissoesParaEscolher,
  type OpcaoDeProfissao,
} from "@/lib/profissoes";

export const dynamic = "force-dynamic";

export type RespostaProfissoes = { profissoes: OpcaoDeProfissao[] };

/**
 * GET /api/publico/profissoes — as areas de atuacao, para o cliente escolher.
 *
 * SO LEITURA, e so o que a tela precisa para desenhar o campo: nome, se esta
 * bloqueada e o aviso que explica a recusa. Nenhum numero sobre o uso do
 * espaco sai por aqui.
 *
 * A BLOQUEADA VEM NA LISTA de proposito. Esconder faria o cliente da area
 * juridica procurar a opcao dele, nao achar e escolher "Outros" — e a reserva
 * passaria. Aparecendo, a recusa explica o motivo e ele fala com a recepcao.
 */
export async function GET(): Promise<NextResponse<RespostaProfissoes>> {
  return NextResponse.json({ profissoes: await listarProfissoesParaEscolher() });
}
