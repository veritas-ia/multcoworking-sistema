"use client";

import { Botao } from "@/components/ui/botao";
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
 *
 * Quem avanca e o botao "Reservar agora", e nao o cartao inteiro. Antes o
 * cartao era um <button> gigante; com um botao dentro dele o HTML ficaria
 * invalido (botao dentro de botao), o teclado pararia duas vezes no mesmo
 * cartao e o leitor de tela anunciaria duas acoes iguais. Uma acao visivel
 * por cartao e mais clara do que uma area invisivel que faz a mesma coisa.
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

              <div className="flex flex-col gap-2 p-4">
                <span className="text-lg font-bold text-text-primary">
                  {sala.nome}
                </span>

                {/* No celular o botao desce e ocupa a largura toda; a partir
                    do "sm" ele fica a direita, na mesma linha dos precos. */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
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

                  {/* Cartao escolhido fica amarelo: o botao amarelo sumiria
                      dentro dele, entao vira o branco de borda preta. */}
                  <Botao
                    aparencia={escolhida ? "secundario" : "primario"}
                    largura="conteudo"
                    aria-label={`Reservar a ${sala.nome}`}
                    onClick={() => aoEscolher(sala.id)}
                    className="w-full shrink-0 sm:w-auto"
                  >
                    Reservar agora
                  </Botao>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
