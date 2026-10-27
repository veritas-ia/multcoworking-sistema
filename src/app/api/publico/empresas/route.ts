import { NextResponse } from "next/server";

import { listarEmpresasParaEscolher, type EmpresaParaEscolher } from "@/lib/empresas";

export const dynamic = "force-dynamic";

export type RespostaEmpresas = { empresas: EmpresaParaEscolher[] };

/**
 * GET /api/publico/empresas — as empresas mensalistas, para o cliente escolher.
 *
 * SO LEITURA, e so nome e identificador. Nada de telefone, de quantidade de
 * reservas ou de qualquer numero que diga quanto a empresa usa o espaco: isso
 * continua sendo dado do painel.
 *
 * E uma lista PUBLICA por decisao do dono. O motivo esta escrito em
 * "listarEmpresasParaEscolher": sem ela, o funcionario novo de uma mensalista
 * nao tem como se identificar, e a equipe volta a marcar numero por numero.
 */
export async function GET(): Promise<NextResponse<RespostaEmpresas>> {
  return NextResponse.json({ empresas: await listarEmpresasParaEscolher() });
}
