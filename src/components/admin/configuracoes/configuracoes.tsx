"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { AbaDeParametros } from "./aba-parametros";

type Aba = {
  id: string;
  rotulo: string;
  conteudo: () => ReactNode;
};

/**
 * As abas de /admin/configuracoes.
 *
 * A aba escolhida vai no endereco (?aba=parametros) e nao so na memoria da
 * tela: assim recarregar a pagina, ou mandar o link para uma colega, cai no
 * mesmo lugar.
 */
const ABAS: readonly Aba[] = [
  { id: "parametros", rotulo: "Parâmetros", conteudo: () => <AbaDeParametros /> },
];

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
