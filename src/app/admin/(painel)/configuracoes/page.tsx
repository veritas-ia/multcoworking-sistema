import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Configuracoes } from "@/components/admin/configuracoes/configuracoes";
import { Carregando } from "@/components/ui/avisos";
import { adminDoToken } from "@/lib/admin";
import { metadadosDoPainel } from "@/lib/metadados";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadadosDoPainel("Configurações");

export default async function PaginaDeConfiguracoes() {
  // Segunda camada de conferencia: o middleware ja olhou a assinatura do
  // cookie, aqui a gente confirma que o usuario ainda existe no banco.
  const admin = await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value);

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* O <h1> da pagina. Sem ele, quem usa leitor de tela nao tem como
          pular direto para o titulo — as telas do painel comecavam no <h2>.
          Quem diz ONDE a pessoa esta e a barra lateral; este titulo nomeia a
          tela para quem nao ve a barra. */}
      <h1 className="mb-4 text-xl font-bold tracking-tight text-text-primary">
        Configurações
      </h1>

      {/* useSearchParams precisa de Suspense para o Next poder gerar a pagina. */}
      <Suspense fallback={<Carregando texto="Abrindo as configurações…" />}>
        <Configuracoes />
      </Suspense>
    </div>
  );
}
