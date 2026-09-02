import type { NextRequest } from "next/server";

import { adminDoToken } from "@/lib/admin";
import type { Operador } from "@/lib/agenda-admin";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";

/**
 * Quem esta operando o painel, conferido CONTRA O BANCO.
 *
 * O middleware ja barrou quem nao tem cookie assinado, mas ele nao alcanca o
 * banco. Toda rota do painel repete a conferencia aqui — assim um usuario
 * apagado nao consegue agir mesmo com o cookie ainda no prazo, e a gente tem
 * o nome de verdade para gravar no historico.
 */
export async function operadorDaRequisicao(
  requisicao: NextRequest,
): Promise<Operador | null> {
  const admin = await adminDoToken(requisicao.cookies.get(COOKIE_ADMIN)?.value);
  return admin ? { id: admin.id, nome: admin.nome } : null;
}

/** Que codigo HTTP cada recusa vira. */
export function statusDaFalhaAdmin(codigo: string): number {
  if (codigo === "NAO_ENCONTRADA") {
    return 404;
  }
  if (codigo === "JA_ENCERRADA" || codigo === "HORARIO_TOMADO") {
    return 409;
  }
  return 422;
}
