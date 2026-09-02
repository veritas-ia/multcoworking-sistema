import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type Aparencia = "primario" | "secundario" | "texto";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  aparencia?: Aparencia;
  /** Ocupa toda a largura — o padrao no celular. */
  largura?: "total" | "conteudo";
};

/**
 * Botao do sistema.
 *
 * Regra do CLAUDE.md: botao primario e o amarelo da marca com texto PRETO.
 * Altura minima de 48px porque a maior parte do trafego e dedo em celular.
 */
const APARENCIAS: Record<Aparencia, string> = {
  primario:
    "bg-brand text-brand-foreground font-semibold hover:brightness-95 active:brightness-90",
  secundario:
    "bg-bg-primary text-text-primary font-semibold border border-border hover:bg-bg-secondary",
  texto: "text-text-primary underline underline-offset-4 hover:text-black",
};

export function Botao({
  aparencia = "primario",
  largura = "total",
  className,
  type = "button",
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 text-base",
        "transition-[filter,background-color] duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100",
        APARENCIAS[aparencia],
        largura === "total" && "w-full",
        className,
      )}
      {...resto}
    />
  );
}
