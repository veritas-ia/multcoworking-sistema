"use client";

import { cn } from "@/lib/utils";

import { emReais } from "./datas";
import { TituloDaEtapa } from "./pecas";
import type { Sala } from "./tipos";

/** Etapa 1 — cartoes de sala com nome, capacidade e preco por hora. */
export function EtapaSala({
  salas,
  salaEscolhida,
  aoEscolher,
}: {
  salas: Sala[];
  salaEscolhida: string | null;
  aoEscolher: (salaId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <TituloDaEtapa apoio="Escolha o espaço que você quer reservar.">
        Qual sala?
      </TituloDaEtapa>

      <ul className="flex flex-col gap-3">
        {salas.map((sala) => {
          const escolhida = sala.id === salaEscolhida;

          return (
            <li key={sala.id}>
              <button
                type="button"
                aria-pressed={escolhida}
                onClick={() => aoEscolher(sala.id)}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                  escolhida
                    ? "border-black bg-brand"
                    : "border-border bg-bg-primary hover:border-black",
                )}
              >
                <span className="text-lg font-bold text-text-primary">
                  {sala.nome}
                </span>

                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span
                    className={
                      escolhida ? "font-semibold text-black" : "text-text-secondary"
                    }
                  >
                    {emReais(Math.round(Number(sala.precoPorHora) * 100))} por hora
                  </span>

                  {sala.capacidade !== null ? (
                    <span
                      className={
                        escolhida ? "text-black" : "text-text-secondary"
                      }
                    >
                      até {sala.capacidade}{" "}
                      {sala.capacidade === 1 ? "pessoa" : "pessoas"}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
