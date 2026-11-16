import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PainelDeRelatorios } from "@/components/admin/relatorios/painel-de-relatorios";
import { adminDoToken } from "@/lib/admin";
import { metadadosDoPainel } from "@/lib/metadados";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";
import { dataLocalDe } from "@/lib/tempo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadadosDoPainel("Relatórios");

export default async function PaginaDeRelatorios() {
  // Segunda camada de conferencia: o middleware ja olhou a assinatura do
  // cookie, aqui a gente confirma que o usuario ainda existe no banco.
  const admin = await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value);

  if (!admin) {
    redirect("/admin/login");
  }

  // "Hoje" sai do SERVIDOR, no relogio de Sao Paulo. Se viesse do navegador,
  // um tablet com o fuso errado mostraria o periodo errado.
  const hoje = dataLocalDe(new Date());

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* O <h1> da pagina. Sem ele, quem usa leitor de tela nao tem como
          pular direto para o titulo — as telas do painel comecavam no <h2>.
          Quem diz ONDE a pessoa esta e a barra lateral; este titulo nomeia a
          tela para quem nao ve a barra. */}
      <h1 className="mb-4 text-xl font-bold tracking-tight text-text-primary">
        Relatórios
      </h1>

      <PainelDeRelatorios hoje={hoje} />
    </div>
  );
}
