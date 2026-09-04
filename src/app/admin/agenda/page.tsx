import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AgendaDoPainel } from "@/components/admin/agenda/agenda";
import { BotaoSair } from "@/components/admin/botao-sair";
import { Carregando } from "@/components/ui/avisos";
import { adminDoToken } from "@/lib/admin";
import { metadadosDoPainel } from "@/lib/metadados";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";
import { dataLocalDe } from "@/lib/tempo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadadosDoPainel("Agenda");

export default async function PaginaDaAgenda() {
  // Segunda camada de conferencia: o middleware ja olhou a assinatura do
  // cookie, aqui a gente confirma que o usuario ainda existe no banco.
  const admin = await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value);

  if (!admin) {
    redirect("/admin/login");
  }

  // "Hoje" e calculado no SERVIDOR, no relogio de Sao Paulo. Se viesse do
  // navegador, um tablet com o fuso errado mostraria o dia errado.
  const hoje = dataLocalDe(new Date());

  return (
    <div className="flex min-h-dvh flex-col bg-bg-secondary">
      <header className="border-b border-border bg-bg-primary">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-2 w-10 rounded-full bg-brand" />
            <Link
              href="/admin"
              className="text-base font-bold text-text-primary hover:underline"
            >
              Painel
            </Link>
            <span aria-hidden className="text-text-secondary">
              /
            </span>
            {/* O <h1> da pagina. Sem ele, quem usa leitor de tela nao tem
                como pular direto para o titulo — as telas do painel comecavam
                no <h2>. O visual continua igual. */}
            <h1 className="text-base text-text-secondary">Agenda</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">{admin.nome}</span>
            <BotaoSair />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {/* useSearchParams precisa de Suspense para o Next poder gerar a pagina. */}
        <Suspense fallback={<Carregando texto="Abrindo a agenda…" />}>
          <AgendaDoPainel hoje={hoje} />
        </Suspense>
      </main>
    </div>
  );
}
