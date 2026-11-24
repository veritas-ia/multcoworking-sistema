import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Emporio } from "@/components/admin/emporio/emporio";
import { Carregando } from "@/components/ui/avisos";
import { adminDoToken } from "@/lib/admin";
import { metadadosDoPainel } from "@/lib/metadados";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";
import { dataLocalDe } from "@/lib/tempo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadadosDoPainel("Empório");

export default async function PaginaDoEmporio() {
  // Segunda camada de conferencia: o middleware ja olhou a assinatura do
  // cookie, aqui a gente confirma que o usuario ainda existe no banco.
  const admin = await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value);

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="mb-4 text-xl font-bold tracking-tight text-text-primary">
        Empório
      </h1>

      {/* useSearchParams precisa de Suspense para o Next poder gerar a pagina. */}
      <Suspense fallback={<Carregando texto="Abrindo o empório…" />}>
        {/*
          O DIA DE HOJE SAI DAQUI, do relogio de Sao Paulo, e nao do navegador:
          a ficha e sempre do passado, e um navegador em outro fuso ofereceria
          um dia que o servidor recusa por estar no futuro.
        */}
        <Emporio hoje={dataLocalDe(new Date())} />
      </Suspense>
    </div>
  );
}
