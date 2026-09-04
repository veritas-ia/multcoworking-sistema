import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { FormularioDeLogin } from "@/components/admin/formulario-de-login";
import { adminDoToken } from "@/lib/admin";
import { NOME_DA_MARCA } from "@/lib/marca";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Entrar no painel | ${NOME_DA_MARCA}`,
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** So aceita voltar para dentro do painel: "voltarPara" nao pode virar
 *  um pulo para outro site. */
function destinoSeguro(bruto: string | string[] | undefined): string {
  const valor = typeof bruto === "string" ? bruto : "";
  return valor.startsWith("/admin") && !valor.startsWith("//") ? valor : "/admin";
}

export default async function PaginaDeLogin({ searchParams }: Props) {
  // Quem ja esta logado nao precisa ver a tela de login.
  if (await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value)) {
    redirect("/admin");
  }

  const parametros = await searchParams;

  return <FormularioDeLogin voltarPara={destinoSeguro(parametros.voltarPara)} />;
}
