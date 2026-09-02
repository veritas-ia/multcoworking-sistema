/**
 * PORTEIRO DO PAINEL (Fase 7).
 *
 * Vale para TUDO que esta sob /admin e sob /api/admin:
 *   - pagina sem sessao de admin  -> manda para /admin/login
 *   - rota de API sem sessao      -> 401, sem redirecionar
 *
 * O que fica de fora esta em ROTAS_ABERTAS, e so isso. A tela de login e o
 * proprio endereco que cria a sessao precisam ficar acessiveis, senao entrar
 * viraria impossivel.
 *
 * IMPORTANTE: o middleware roda num ambiente restrito, sem Prisma. Ele confere
 * apenas a ASSINATURA do cookie. Quem confirma que o usuario ainda existe no
 * banco e cada pagina/rota do painel, com "adminDoToken" — defesa em duas
 * camadas, nao uma so.
 *
 * A sessao do CLIENTE (cookie "sessao_cliente") nao serve aqui: este arquivo
 * so olha o cookie "sessao_admin". Sao mundos separados.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { COOKIE_ADMIN, lerToken } from "@/lib/sessao-admin";

/** Os unicos enderecos do painel que dispensam sessao. */
const ROTAS_ABERTAS = ["/admin/login", "/api/admin/sessao"];

function ehAberta(caminho: string): boolean {
  return ROTAS_ABERTAS.some(
    (aberta) => caminho === aberta || caminho.startsWith(`${aberta}/`),
  );
}

export async function middleware(requisicao: NextRequest): Promise<NextResponse> {
  const { pathname } = requisicao.nextUrl;

  if (ehAberta(pathname)) {
    return NextResponse.next();
  }

  const token = await lerToken(requisicao.cookies.get(COOKIE_ADMIN)?.value);

  if (token) {
    return NextResponse.next();
  }

  // API: responde erro. Redirecionar uma chamada de programa so faria a tela
  // receber o HTML do login no lugar dos dados, o que confunde muito mais.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { erro: "Faça login no painel para continuar.", codigo: "SEM_SESSAO_ADMIN" },
      { status: 401 },
    );
  }

  const login = new URL("/admin/login", requisicao.nextUrl);
  // Guarda para onde a pessoa queria ir, para voltar ali depois de entrar.
  if (pathname !== "/admin") {
    login.searchParams.set("voltarPara", pathname);
  }

  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
