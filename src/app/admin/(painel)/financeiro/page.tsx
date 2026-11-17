import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Financeiro } from "@/components/admin/financeiro/financeiro";
import { AvisoVazio, Carregando } from "@/components/ui/avisos";
import { adminDoToken } from "@/lib/admin";
import { metadadosDoPainel } from "@/lib/metadados";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";
import { dataLocalDe } from "@/lib/tempo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadadosDoPainel("Financeiro");

export default async function PaginaDoFinanceiro() {
  // Segunda camada de conferencia: o middleware ja olhou a assinatura do
  // cookie, aqui a gente confirma que o usuario ainda existe no banco.
  const admin = await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value);

  if (!admin) {
    redirect("/admin/login");
  }

  /**
   * A TRANCA DE VERDADE, junto com a das rotas.
   *
   * Esconder os itens na barra lateral nao para ninguem: basta digitar o
   * endereco. E a recusa e uma TELA, e nao um redirecionamento calado — quem
   * tem o endereco salvo acharia que o sistema quebrou.
   */
  if (!admin.acessoFinanceiro) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <h1 className="mb-3 text-xl font-bold tracking-tight text-text-primary">
          Área restrita
        </h1>
        <AvisoVazio>
          O seu acesso não inclui a parte financeira. Se você precisa entrar
          aqui, peça a um administrador para liberar em Configurações →
          Usuários.
        </AvisoVazio>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-xl font-bold tracking-tight text-text-primary">
        Financeiro
      </h1>

      {/* useSearchParams precisa de Suspense para o Next poder gerar a pagina. */}
      <Suspense fallback={<Carregando texto="Abrindo o financeiro…" />}>
        {/* O dia de hoje sai daqui, do relogio de Sao Paulo — nao do navegador. */}
        <Financeiro hoje={dataLocalDe(new Date())} />
      </Suspense>
    </div>
  );
}
