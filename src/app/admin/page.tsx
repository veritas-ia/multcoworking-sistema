import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BotaoSair } from "@/components/admin/botao-sair";
import { adminDoToken } from "@/lib/admin";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel | Coworking",
  robots: { index: false, follow: false },
};

export default async function PaginaDoPainel() {
  // Segunda camada: o middleware conferiu a assinatura do cookie; aqui a
  // gente confirma que o usuario ainda existe no banco.
  const admin = await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value);

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg-secondary">
      <header className="border-b border-border bg-bg-primary">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-2 w-10 rounded-full bg-brand" />
            <h1 className="text-base font-bold text-text-primary">Painel</h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary">{admin.nome}</span>
            <BotaoSair />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">
          Painel — em construção
        </h2>
        <p className="max-w-md text-sm text-text-secondary">
          O login e a proteção das rotas já estão funcionando. A agenda
          administrativa chega na próxima fase.
        </p>
      </main>
    </div>
  );
}
