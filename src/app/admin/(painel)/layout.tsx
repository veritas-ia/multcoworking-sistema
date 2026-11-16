import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import {
  BarraLateral,
  BotaoDoMenu,
  ProvedorDaBarra,
} from "@/components/admin/barra-lateral";
import { BotaoSair } from "@/components/admin/botao-sair";
import { adminDoToken } from "@/lib/admin";
import { COOKIE_ADMIN } from "@/lib/sessao-admin";

export const dynamic = "force-dynamic";

/**
 * A MOLDURA DO PAINEL.
 *
 * POR QUE ELA EXISTE: ate 16/11/2026 cada uma das cinco telas do painel
 * carregava a PROPRIA copia de um cabecalho, e trocar de secao exigia voltar
 * para a tela inicial. Pior: as onze abas de Configuracoes ficavam escondidas
 * atras de um cartao so — onze destinos que ninguem via.
 *
 * POR QUE NUM GRUPO DE ROTAS "(painel)": o /admin/login tambem mora sob
 * /admin, e quem ainda nao entrou nao pode ver a barra lateral — seria
 * mostrar a estrutura do sistema para quem esta de fora. O grupo nao aparece
 * no endereco: /admin/agenda continua /admin/agenda.
 *
 * A CONFERENCIA DE SESSAO DE CADA PAGINA CONTINUA, alem desta. Sao camadas de
 * proposito, e esta NAO substitui as outras: o middleware olha a assinatura
 * do cookie, esta olha o banco antes de desenhar a moldura, e a pagina olha
 * de novo antes de buscar os dados dela. Cada uma custa uma consulta
 * indexada; tirar qualquer uma economiza isso e abre uma porta.
 */
export default async function LayoutDoPainel({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await adminDoToken((await cookies()).get(COOKIE_ADMIN)?.value);

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <ProvedorDaBarra>
      <div className="flex min-h-dvh bg-bg-secondary">
        {/*
          Suspense porque a barra le o endereco ("?aba=clientes") para saber
          qual item acender, e o Next exige o limite para isso. O espaco vazio
          segura a coluna no monitor para a pagina nao pular ao carregar.
        */}
        <Suspense fallback={<div className="hidden w-64 shrink-0 lg:block" />}>
          <BarraLateral nomeDoAdmin={admin.nome} />
        </Suspense>

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            O cabecalho SOME no monitor: ali a barra ja diz onde a pessoa esta
            e quem ela e. Ele existe para o celular e o tablet em pe, onde a
            barra fica escondida — sem ele nao haveria como abrir o menu nem
            sair.
          */}
          <header className="flex items-center justify-between gap-3 border-b border-border bg-bg-primary px-4 py-3 lg:hidden">
            <BotaoDoMenu />
            <BotaoSair />
          </header>

          <main className="min-w-0 flex-1 px-4 py-5 lg:px-6">{children}</main>
        </div>
      </div>
    </ProvedorDaBarra>
  );
}
