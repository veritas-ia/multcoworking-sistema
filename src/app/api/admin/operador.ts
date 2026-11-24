import type { NextRequest, NextResponse } from "next/server";

import { respostaErro } from "@/lib/api";
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

/**
 * A PORTA DA PARTE FINANCEIRA (17/11/2026).
 *
 * Devolve o operador, ou a recusa pronta para a rota responder.
 *
 * POR QUE ISTO E O QUE VALE: a barra lateral esconde os itens e a tela recusa
 * a entrada, mas as duas coisas sao do NAVEGADOR. Quem souber o endereco de
 * uma rota manda o pedido direto e passa por cima das duas. A conferencia que
 * tranca de verdade e esta, no servidor, lendo o banco a cada pedido.
 *
 * E 403, e nao 401: a pessoa ESTA logada, o acesso dela e que nao chega ali.
 * Devolvendo 401, a tela a mandaria para o login e ela ficaria num laco,
 * entrando de novo e sendo recusada de novo, sem entender por que.
 */
export async function porteiroDoFinanceiro(
  requisicao: NextRequest,
): Promise<{ eu: Operador } | { recusa: NextResponse }> {
  const admin = await adminDoToken(requisicao.cookies.get(COOKIE_ADMIN)?.value);

  if (!admin) {
    return {
      recusa: respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN"),
    };
  }

  if (!admin.acessoFinanceiro) {
    return {
      recusa: respostaErro(
        403,
        "O seu acesso não inclui a parte financeira. Peça a um administrador para liberar em Configurações → Usuários.",
        "SEM_ACESSO_FINANCEIRO",
      ),
    };
  }

  return { eu: { id: admin.id, nome: admin.nome } };
}
