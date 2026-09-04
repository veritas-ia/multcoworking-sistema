"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { TOTAL_DE_ETAPAS } from "./tipos";

/** Barra de progresso do fluxo, com o numero da etapa escrito ao lado. */
export function BarraDeProgresso({
  numero,
  titulo,
}: {
  numero: number;
  titulo: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-text-primary">{titulo}</span>
        <span className="shrink-0 text-xs text-text-secondary">
          Etapa {numero} de {TOTAL_DE_ETAPAS}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={numero}
        aria-valuemin={1}
        aria-valuemax={TOTAL_DE_ETAPAS}
        aria-label={`Etapa ${numero} de ${TOTAL_DE_ETAPAS}: ${titulo}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${(numero / TOTAL_DE_ETAPAS) * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Cabecalho de uma etapa: pergunta grande e uma linha de apoio. */
export function TituloDaEtapa({
  children,
  apoio,
}: {
  children: ReactNode;
  apoio?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold tracking-tight text-text-primary">
        {children}
      </h1>
      {apoio ? <p className="text-sm text-text-secondary">{apoio}</p> : null}
    </div>
  );
}

/**
 * Quadradinho das grades (dias do calendario e horarios).
 *
 * Um item bloqueado continua alcancavel pelo teclado de proposito: saber que
 * as 10:00 estao ocupadas e informacao util. Ele so nao responde ao clique.
 * Por isso "aria-disabled" em vez de "disabled", que tiraria o item do caminho
 * do teclado e esconderia essa informacao de quem usa leitor de tela.
 */
export function BotaoDaGrade({
  children,
  rotulo,
  bloqueado = false,
  selecionado = false,
  aoEscolher,
  className,
}: {
  children: ReactNode;
  rotulo: string;
  bloqueado?: boolean;
  selecionado?: boolean;
  aoEscolher: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-disabled={bloqueado || undefined}
      aria-pressed={selecionado}
      onClick={bloqueado ? undefined : aoEscolher}
      className={cn(
        "flex min-h-12 items-center justify-center rounded-lg border text-base tabular-nums",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
        bloqueado
          ? "cursor-not-allowed border-dashed border-border bg-bg-secondary text-text-secondary line-through"
          : selecionado
            ? "border-black bg-brand font-bold text-black"
            : "border-border bg-bg-primary text-text-primary hover:border-black",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Uma linha "rotulo — valor" do resumo e da confirmacao. */
export function LinhaDeResumo({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: ReactNode;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-text-secondary">{rotulo}</dt>
      <dd
        className={cn(
          "text-right text-text-primary",
          destaque ? "text-lg font-bold" : "font-semibold",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

/**
 * A politica de cancelamento, mostrada antes de confirmar.
 *
 * O texto vem pronto do servidor (editavel no painel, Fase 11) — esta tela nao
 * sabe qual e o prazo nem precisa saber.
 */
export function PoliticaDeCancelamento({ texto }: { texto: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <h2 className="text-sm font-bold text-text-primary">
        Política de cancelamento
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-text-secondary">
        {texto}
      </p>
    </div>
  );
}
