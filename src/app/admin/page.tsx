import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import Link from "next/link";

import { BotaoSair } from "@/components/admin/botao-sair";
import { adminDoToken } from "@/lib/admin";
import { metadadosDoPainel } from "@/lib/metadados";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = metadadosDoPainel("Painel");

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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
        <h2 className="text-xl font-bold tracking-tight text-text-primary">
          O que você quer fazer?
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Atalho
            href="/admin/agenda"
            titulo="Agenda"
            descricao="Ver o dia, a semana ou o mês. Lançar reserva, bloquear horário e criar série."
          />
          <Atalho
            href="/admin/relatorios"
            titulo="Relatórios"
            descricao="Quantas reservas, em quais salas, em que dias e horários. Só consulta — não altera nada."
          />
          <Atalho
            href="/admin/configuracoes"
            titulo="Configurações"
            descricao="Salas e preços, horário de funcionamento, regras de reserva, mensagens do WhatsApp e usuários do painel."
          />
        </div>
      </main>
    </div>
  );
}

/** Cartao de atalho da tela inicial do painel. */
function Atalho({
  href,
  titulo,
  descricao,
}: {
  href: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg-primary p-4 hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      <span className="text-base font-bold text-text-primary">{titulo}</span>
      <span className="text-sm leading-relaxed text-text-secondary">{descricao}</span>
    </Link>
  );
}
