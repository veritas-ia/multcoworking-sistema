"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { todosOsItens, type AbaDeConfiguracao } from "@/lib/menu-admin";
import { cn } from "@/lib/utils";

import { AbaDeAcoes } from "./aba-acoes";
import { AbaDeMensagens } from "./aba-mensagens";
import { AbaDeParametros } from "./aba-parametros";
import { AbaDePoliticas } from "./aba-politicas";
import { AbaDeHorarios } from "./aba-horarios";
import { AbaDeClientes } from "./aba-clientes";
import { AbaDeEmpresas } from "./aba-empresas";
import { AbaDeProfissoes } from "./aba-profissoes";
import { AbaDeSalas } from "./aba-salas";
import { AbaDeTelefonesDeBalcao } from "./aba-telefones-balcao";
import { AbaDeUsuarios } from "./aba-usuarios";

type Aba = {
  id: AbaDeConfiguracao;
  rotulo: string;
  conteudo: () => ReactNode;
};

/**
 * O conteudo de cada aba.
 *
 * "Record<AbaDeConfiguracao, ...>" NAO E DETALHE: e ele que faz o compilador
 * recusar uma aba sem conteudo e um conteudo sem aba. A barra lateral monta
 * os itens a partir da MESMA lista de abas — sem esta trava, acrescentar uma
 * aba e esquecer o menu (ou o contrario) daria um item que leva a lugar
 * nenhum, sem erro em lugar nenhum.
 */
const CONTEUDOS: Record<AbaDeConfiguracao, () => ReactNode> = {
  salas: () => <AbaDeSalas />,
  horarios: () => <AbaDeHorarios />,
  parametros: () => <AbaDeParametros />,
  politicas: () => <AbaDePoliticas />,
  mensagens: () => <AbaDeMensagens />,
  clientes: () => <AbaDeClientes />,
  empresas: () => <AbaDeEmpresas />,
  profissoes: () => <AbaDeProfissoes />,
  "telefones-balcao": () => <AbaDeTelefonesDeBalcao />,
  usuarios: () => <AbaDeUsuarios />,
  acoes: () => <AbaDeAcoes />,
};

/**
 * As abas de /admin/configuracoes.
 *
 * A aba escolhida vai no endereco (?aba=parametros) e nao so na memoria da
 * tela: assim recarregar a pagina, ou mandar o link para uma colega, cai no
 * mesmo lugar.
 */
const ABAS: readonly Aba[] = todosOsItens()
  .filter((item) => item.aba !== null)
  .map((item) => ({
    id: item.aba!,
    rotulo: item.rotulo,
    conteudo: CONTEUDOS[item.aba!],
  }));

export function Configuracoes() {
  const navegador = useRouter();
  const busca = useSearchParams();

  const pedida = busca.get("aba");
  const atual = ABAS.find((aba) => aba.id === pedida) ?? ABAS[0];

  function trocarPara(id: string) {
    const nova = new URLSearchParams(busca.toString());
    nova.set("aba", id);
    navegador.replace(`/admin/configuracoes?${nova}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Seções das configurações"
        className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-bg-primary p-1.5"
      >
        {ABAS.map((aba) => {
          const selecionada = aba.id === atual.id;

          return (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`aba-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`painel-${aba.id}`}
              onClick={() => trocarPara(aba.id)}
              className={cn(
                "min-h-11 rounded-md px-3.5 text-sm font-semibold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                selecionada
                  ? "bg-brand text-brand-foreground"
                  : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
              )}
            >
              {aba.rotulo}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`painel-${atual.id}`} aria-labelledby={`aba-${atual.id}`}>
        {atual.conteudo()}
      </div>
    </div>
  );
}
