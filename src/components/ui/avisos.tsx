import { cn } from "@/lib/utils";

import { Botao } from "./botao";

/** Bloco de "carregando" com a mesma altura do conteudo que vai substituir. */
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 py-12 text-text-secondary"
    >
      <span
        aria-hidden
        className="size-7 animate-spin rounded-full border-2 border-border border-t-brand"
      />
      <span className="text-sm">{texto}</span>
    </div>
  );
}

/**
 * Erro com botao de tentar de novo.
 *
 * Fica dentro de uma regiao "aria-live" no fluxo, para o leitor de tela
 * anunciar o problema sem que a pessoa precise ir procurar.
 */
export function AvisoDeErro({
  mensagem,
  aoTentarDeNovo,
  className,
}: {
  mensagem: string;
  aoTentarDeNovo?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-destructive bg-bg-primary p-4",
        className,
      )}
    >
      <p className="text-sm font-medium text-destructive">{mensagem}</p>
      {aoTentarDeNovo ? (
        <Botao aparencia="secundario" largura="conteudo" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Botao>
      ) : null}
    </div>
  );
}

/** Aviso neutro: "não há horários neste dia", por exemplo. */
export function AvisoVazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-bg-secondary p-4 text-center text-sm text-text-secondary">
      {children}
    </p>
  );
}
