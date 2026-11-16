import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import Link from "next/link";

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
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-bold tracking-tight text-text-primary">
        Olá, {admin.nome.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
        Tudo fica no menu ao lado. Os atalhos abaixo são os quatro mais usados
        — eles existem principalmente para o celular, onde o menu fica
        escondido atrás do botão.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Atalho
          href="/admin/agenda"
          titulo="Agenda"
          descricao="Ver o dia, a semana ou o mês. Lançar reserva, bloquear horário e criar série."
        />
        <Atalho
          href="/admin/demonstrativos"
          titulo="Controle de horas"
          descricao="O demonstrativo mensal do cliente, em PDF, com o total somado pelo sistema."
        />
        <Atalho
          href="/admin/relatorios"
          titulo="Relatórios"
          descricao="Quantas reservas, em quais salas, em que dias e horários. Só consulta."
        />
        <Atalho
          href="/admin/configuracoes?aba=clientes"
          titulo="Clientes"
          descricao="Quem já reservou, com as horas de cada um. Juntar cadastros e ligar telefone."
        />
      </div>
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
