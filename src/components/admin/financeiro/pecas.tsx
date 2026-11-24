"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { SituacaoDoLancamento, TipoDeLancamento } from "./tipos";

/**
 * "1250,50" -> 125050 centavos.
 *
 * TODA CONTA DE DINHEIRO NA TELA PASSA POR CENTAVOS. Somar reais em ponto
 * flutuante acumula diferença de um centavo ao longo de muitas linhas, e um
 * caixa com um centavo de diferença faz a equipe desconfiar do número inteiro.
 * O servidor já soma assim — se a tela somasse de outro jeito, os dois
 * números discordariam na mesma página.
 */
export function centavosDe(reais: string): number {
  const limpo = reais.trim().replace(",", ".");
  const numero = Number(limpo);

  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

/** 125050 -> "R$ 1.250,50". */
export function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** "1250.50" -> "R$ 1.250,50". */
export function valorVisivel(reais: string): string {
  return emReais(centavosDe(reais));
}

/** "2026-11-17" -> "17/11". */
export function diaVisivel(dia: string): string {
  const [, mes, numero] = dia.split("-");
  return `${numero}/${mes}`;
}

/** "2026-11-17" -> "17/11/2026". */
export function diaCompleto(dia: string): string {
  return dia.split("-").reverse().join("/");
}

export const NOME_DO_TIPO: Record<TipoDeLancamento, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
};

/**
 * A etiqueta de situação.
 *
 * ATRASADO em vermelho, PAGO discreto, PENDENTE neutro. O atraso é a única
 * coisa aqui que pede ação da equipe hoje — se os três tivessem o mesmo peso
 * visual, a lista não diria onde olhar.
 */
export function Situacao({
  situacao,
  diasDeAtraso,
}: {
  situacao: SituacaoDoLancamento;
  diasDeAtraso: number;
}) {
  if (situacao === "PAGO") {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-bg-secondary px-2 py-0.5 text-xs font-semibold text-text-secondary">
        Pago
      </span>
    );
  }

  if (situacao === "ATRASADO") {
    return (
      <span className="inline-flex items-center rounded-full border border-destructive px-2 py-0.5 text-xs font-semibold text-destructive">
        {diasDeAtraso === 1 ? "1 dia de atraso" : `${diasDeAtraso} dias de atraso`}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-black px-2 py-0.5 text-xs font-semibold text-text-primary">
      A pagar
    </span>
  );
}

/** Lista de opções com etiqueta, no estilo dos outros campos do painel. */
export function Escolha<T extends string>({
  etiqueta,
  valor,
  opcoes,
  aoMudar,
  dica,
  desabilitado,
}: {
  etiqueta: string;
  valor: T;
  opcoes: readonly { valor: T; rotulo: string }[];
  aoMudar: (valor: T) => void;
  dica?: ReactNode;
  desabilitado?: boolean;
}) {
  const id = useId();
  const idDica = `${id}-dica`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-text-primary">
        {etiqueta}
      </label>

      <select
        id={id}
        value={valor}
        disabled={desabilitado}
        aria-describedby={dica ? idDica : undefined}
        onChange={(evento) => aoMudar(evento.target.value as T)}
        className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-base text-text-primary disabled:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>

      {dica ? (
        <p id={idDica} className="text-sm text-text-secondary">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Um número grande com rótulo, para o resumo do período.
 *
 * O número vem SOMADO DO SERVIDOR, em centavos. Esta peça só formata — ela
 * não soma nada, de propósito: duas somas do mesmo número em lugares
 * diferentes é como começam dois valores que discordam na mesma tela.
 */
export function Numero({
  rotulo,
  centavos,
  tom = "neutro",
  ajuda,
}: {
  rotulo: string;
  centavos: number;
  tom?: "neutro" | "entrada" | "saida" | "alerta";
  ajuda?: string;
}) {
  const cores: Record<typeof tom, string> = {
    neutro: "text-text-primary",
    entrada: "text-text-primary",
    saida: "text-text-primary",
    alerta: centavos > 0 ? "text-destructive" : "text-text-primary",
  };

  return (
    <div className="rounded-lg border border-border bg-bg-primary p-4">
      <p className="text-sm text-text-secondary">{rotulo}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", cores[tom])}>
        {/* O SINAL É ESCRITO AQUI, na leitura — nunca gravado no valor. */}
        {tom === "saida" && centavos > 0 ? "− " : ""}
        {emReais(centavos)}
      </p>
      {ajuda ? (
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{ajuda}</p>
      ) : null}
    </div>
  );
}
