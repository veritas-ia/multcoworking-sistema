"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  etiqueta: string;
  /** Texto de apoio embaixo do campo. */
  dica?: ReactNode;
  /** Mensagem de erro. Quando existe, o campo fica marcado como invalido. */
  erro?: string | null;
};

/**
 * Campo de formulario com etiqueta sempre visivel.
 *
 * A etiqueta e um <label> de verdade ligado ao campo: quem usa leitor de tela
 * ouve o nome do campo, e quem toca na etiqueta cai dentro do campo.
 */
export function Campo({ etiqueta, dica, erro, className, ...resto }: Props) {
  const id = useId();
  const idDica = `${id}-dica`;
  const idErro = `${id}-erro`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-text-primary">
        {etiqueta}
      </label>

      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={cn(dica && idDica, erro && idErro) || undefined}
        className={cn(
          "min-h-12 w-full rounded-lg border bg-bg-primary px-4 py-3 text-base text-text-primary",
          "placeholder:text-text-secondary/70",
          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black",
          erro ? "border-destructive" : "border-border",
          className,
        )}
        {...resto}
      />

      {dica ? (
        <p id={idDica} className="text-sm text-text-secondary">
          {dica}
        </p>
      ) : null}

      {erro ? (
        <p id={idErro} className="text-sm font-medium text-destructive">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
