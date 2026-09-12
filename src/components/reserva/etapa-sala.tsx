"use client";

import { cn } from "@/lib/utils";

import { CarrosselDeFotos } from "./carrossel-de-fotos";
import { emReais } from "./datas";
import { TituloDaEtapa } from "./pecas";
import type { Sala } from "./tipos";

/**
 * Etapa 1 — cartoes de sala com fotos, nome, capacidade e preco por hora.
 *
 * Sala sem foto nao ganha moldura vazia: o carrossel simplesmente nao e
 * desenhado, e o cartao fica igual ao que sempre foi.
 */
export function EtapaSala({
  salas,
  salaEscolhida,
  horaInicioNoturno,
  aoEscolher,
}: {
  salas: Sala[];
  salaEscolhida: string | null;
  /** A partir de que hora vale o preco noturno, para o cartao explicar. */
  horaInicioNoturno: string;
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
            /* O carrossel e o botao sao IRMAOS dentro do cartao, e nao um
               dentro do outro. Botao dentro de botao e HTML invalido: o
               teclado e o leitor de tela se perdem, e o toque na seta
               escolheria a sala sem querer. A moldura do cartao fica no <li>,
               entao visualmente continua sendo uma peca so. */
            <li
              key={sala.id}
              className={cn(
                "overflow-hidden rounded-xl border transition-colors duration-150",
                escolhida
                  ? "border-black bg-brand"
                  : "border-border bg-bg-primary hover:border-black",
              )}
            >
              <CarrosselDeFotos fotos={sala.fotos} nomeDaSala={sala.nome} />

              <button
                type="button"
                aria-pressed={escolhida}
                onClick={() => aoEscolher(sala.id)}
                className={cn(
                  "flex w-full flex-col gap-2 p-4 text-left",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black",
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

                  {/* O preco muda depois do horario da faixa noturna. Mostrar
                      so o de dia faria o cliente descobrir a diferenca na
                      etapa do resumo, ja com o horario escolhido. */}
                  {sala.precoPorHoraNoturno !== sala.precoPorHora ? (
                    <span
                      className={
                        escolhida ? "text-black" : "text-text-secondary"
                      }
                    >
                      {emReais(Math.round(Number(sala.precoPorHoraNoturno) * 100))} após
                      as {horaInicioNoturno.slice(0, 2)}h
                    </span>
                  ) : null}

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
