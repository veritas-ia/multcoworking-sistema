"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { itensDoFinanceiro, type AbaDoFinanceiro } from "@/lib/menu-admin";
import { cn } from "@/lib/utils";

import { AbaDeCategorias } from "./aba-categorias";
import { AbaDeContas } from "./aba-contas";
import { AbaDeEspacos } from "./aba-espacos";
import { AbaDeFornecedores } from "./aba-fornecedores";
import { AbaDeMensalidades } from "./aba-mensalidades";
import { AbaDoPainel } from "./aba-painel";

type Aba = {
  id: AbaDoFinanceiro;
  rotulo: string;
  conteudo: (hoje: string) => ReactNode;
};

/**
 * O conteudo de cada aba.
 *
 * "Record<AbaDoFinanceiro, ...>" e o que faz o COMPILADOR recusar uma aba sem
 * conteudo e um item de menu que nao leva a lugar nenhum. Mesma decisao de
 * Configuracoes e do Emporio — e ja conferido removendo uma aba de proposito
 * nas duas.
 */
const CONTEUDOS: Record<AbaDoFinanceiro, (hoje: string) => ReactNode> = {
  painel: (hoje) => <AbaDoPainel hoje={hoje} />,
  contas: (hoje) => <AbaDeContas hoje={hoje} />,
  mensalidades: (hoje) => <AbaDeMensalidades hoje={hoje} />,
  espacos: () => <AbaDeEspacos />,
  categorias: () => <AbaDeCategorias />,
  fornecedores: () => <AbaDeFornecedores />,
};

const ABAS: readonly Aba[] = itensDoFinanceiro().map((item) => ({
  id: item.aba,
  rotulo: item.rotulo,
  conteudo: CONTEUDOS[item.aba],
}));

/**
 * "hoje" VEM DO SERVIDOR, no relogio de Sao Paulo.
 *
 * E ele que diz qual mes abrir e que data propor ao marcar uma conta como
 * paga. O navegador do operador pode estar em outro fuso — e ai a tela
 * abriria o mes errado na virada, ou marcaria o pagamento no dia errado.
 */
export function Financeiro({ hoje }: { hoje: string }) {
  const navegador = useRouter();
  const busca = useSearchParams();

  const pedida = busca.get("aba");
  const atual = ABAS.find((aba) => aba.id === pedida) ?? ABAS[0];

  function trocarPara(id: string) {
    const nova = new URLSearchParams(busca.toString());
    nova.set("aba", id);
    navegador.replace(`/admin/financeiro?${nova}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Seções do financeiro"
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
