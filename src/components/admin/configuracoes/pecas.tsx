"use client";

import type { ReactNode } from "react";

import { Botao } from "@/components/ui/botao";
import { cn } from "@/lib/utils";

/** Cartao branco com titulo e explicacao, usado por todas as abas. */
export function Secao({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-bg-primary p-4 sm:p-5",
        className,
      )}
    >
      <h2 className="text-base font-bold text-text-primary">{titulo}</h2>
      {descricao ? (
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{descricao}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Bloco de informacao que a equipe le mas nao muda.
 *
 * Existe porque esconder um numero que governa o sistema e pior do que
 * mostra-lo travado: quando um cliente reclama que "o codigo nao chega", a
 * recepcao precisa saber que existe um bloqueio de 15 minutos.
 */
export function CaixaInformativa({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">{titulo}</h3>
      <div className="mt-2 space-y-1.5 text-sm leading-relaxed text-text-secondary">
        {children}
      </div>
    </div>
  );
}

export type Situacao =
  | { tipo: "parado" }
  | { tipo: "salvando" }
  | { tipo: "salvo"; mensagem: string }
  | { tipo: "erro"; mensagem: string };

/**
 * Botao de salvar com o recado do que aconteceu logo ao lado.
 *
 * O recado fica dentro de uma regiao "aria-live": quem usa leitor de tela
 * ouve "salvo" sem precisar sair procurando o aviso na pagina.
 */
export function BarraDeSalvar({
  situacao,
  alterado,
  aoSalvar,
  aoDescartar,
  rotulo = "Salvar alterações",
}: {
  situacao: Situacao;
  alterado: boolean;
  aoSalvar: () => void;
  aoDescartar?: () => void;
  rotulo?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      <p
        aria-live="polite"
        className={cn(
          "text-sm sm:mr-auto",
          situacao.tipo === "erro" ? "font-medium text-destructive" : "text-text-secondary",
        )}
      >
        {situacao.tipo === "erro" || situacao.tipo === "salvo" ? situacao.mensagem : ""}
        {situacao.tipo === "parado" && alterado ? "Há alterações não salvas." : ""}
      </p>

      {aoDescartar && alterado ? (
        <Botao
          aparencia="secundario"
          largura="conteudo"
          onClick={aoDescartar}
          disabled={situacao.tipo === "salvando"}
        >
          Descartar
        </Botao>
      ) : null}

      <Botao
        largura="conteudo"
        onClick={aoSalvar}
        disabled={!alterado || situacao.tipo === "salvando"}
      >
        {situacao.tipo === "salvando" ? "Salvando…" : rotulo}
      </Botao>
    </div>
  );
}
