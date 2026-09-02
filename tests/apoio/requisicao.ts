import { NextRequest } from "next/server";

const BASE = "http://localhost:3000";

/** Monta um pedido POST com corpo JSON, opcionalmente com cookie de sessao. */
export function pedidoPost(
  caminho: string,
  corpo: unknown,
  opcoes: { cookie?: string; ip?: string } = {},
): NextRequest {
  const cabecalhos = new Headers({ "Content-Type": "application/json" });
  if (opcoes.cookie) {
    cabecalhos.set("cookie", opcoes.cookie);
  }
  cabecalhos.set("x-forwarded-for", opcoes.ip ?? "203.0.113.10");

  return new NextRequest(`${BASE}${caminho}`, {
    method: "POST",
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });
}

/** Monta um pedido GET com parametros de busca. */
export function pedidoGet(
  caminho: string,
  parametros: Record<string, string> = {},
): NextRequest {
  const url = new URL(`${BASE}${caminho}`);
  for (const [chave, valor] of Object.entries(parametros)) {
    url.searchParams.set(chave, valor);
  }
  return new NextRequest(url, { method: "GET" });
}
