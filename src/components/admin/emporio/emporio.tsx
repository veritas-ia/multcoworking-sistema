"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { itensDoEmporio, type AbaDoEmporio } from "@/lib/menu-admin";
import { cn } from "@/lib/utils";

import { AbaDeContagem } from "./aba-contagem";
import { AbaDeLancamento } from "./aba-lancar";
import { AbaDeMovimentos } from "./aba-movimentos";
import { AbaDeProdutos } from "./aba-produtos";

type Aba = {
  id: AbaDoEmporio;
  rotulo: string;
  conteudo: (hoje: string) => ReactNode;
};

/**
 * O conteudo de cada aba.
 *
 * "Record<AbaDoEmporio, ...>" NAO E DETALHE: e ele que faz o compilador
 * recusar uma aba sem conteudo e um conteudo sem aba. A barra lateral monta
 * os itens a partir da MESMA lista — sem esta trava, acrescentar uma aba e
 * esquecer o menu (ou o contrario) daria um item que leva a lugar nenhum, sem
 * erro em lugar nenhum. Mesma decisao da tela de Configuracoes.
 */
const CONTEUDOS: Record<AbaDoEmporio, (hoje: string) => ReactNode> = {
  lancar: (hoje) => <AbaDeLancamento hoje={hoje} />,
  contagem: (hoje) => <AbaDeContagem hoje={hoje} />,
  produtos: () => <AbaDeProdutos />,
  movimentos: () => <AbaDeMovimentos />,
};

/**
 * As abas de /admin/emporio.
 *
 * A aba escolhida vai no endereco (?aba=contagem) e nao so na memoria da
 * tela: assim recarregar a pagina, ou mandar o link para uma colega, cai no
 * mesmo lugar — e e isso que permite cada aba ser um item da barra lateral.
 */
const ABAS: readonly Aba[] = itensDoEmporio().map((item) => ({
  id: item.aba,
  rotulo: item.rotulo,
  conteudo: CONTEUDOS[item.aba],
}));

/**
 * "hoje" VEM DO SERVIDOR, e nao de `new Date()` no navegador.
 *
 * E o dia no relogio de Sao Paulo, usado como valor inicial e como teto dos
 * campos de data. O navegador do operador pode estar em outro fuso, e ai o
 * sistema ofereceria um dia que o servidor recusa por estar no futuro — um
 * erro que a pessoa nao teria como entender. Mesma regra do `jaTerminou` da
 * agenda: quem decide fato que depende de hora e o servidor.
 */
export function Emporio({ hoje }: { hoje: string }) {
  const navegador = useRouter();
  const busca = useSearchParams();

  const pedida = busca.get("aba");
  const atual = ABAS.find((aba) => aba.id === pedida) ?? ABAS[0];

  function trocarPara(id: string) {
    const nova = new URLSearchParams(busca.toString());
    nova.set("aba", id);
    navegador.replace(`/admin/emporio?${nova}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Seções do empório"
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

      <div
        role="tabpanel"
        id={`painel-${atual.id}`}
        aria-labelledby={`aba-${atual.id}`}
      >
        {atual.conteudo(hoje)}
      </div>
    </div>
  );
}
