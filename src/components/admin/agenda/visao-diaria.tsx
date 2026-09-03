"use client";

import {
  blocosEntre,
  dataPorExtenso,
  minutosDaHora,
} from "@/components/reserva/datas";
import type { Agenda, Sala } from "@/components/reserva/tipos";
import { AvisoVazio } from "@/components/ui/avisos";
import { cn } from "@/lib/utils";

import { estiloDoItem } from "./cores";
import type { ItemDaAgenda } from "./tipos";

const ALTURA_DO_BLOCO = 44;

/**
 * Visao do dia: uma coluna por sala, uma linha a cada 30 minutos.
 *
 * A faixa de horas mostrada vai do expediente do dia, esticada quando existe
 * algo fora dele — uma reserva antiga lancada pela recepcao, por exemplo.
 * Nao esconder o que existe e mais importante do que a grade ficar bonita.
 */
export function VisaoDiaria({
  data,
  salas,
  agenda,
  itens,
  aoAbrirItem,
}: {
  data: string;
  salas: Sala[];
  agenda: Agenda;
  itens: ItemDaAgenda[];
  aoAbrirItem: (item: ItemDaAgenda) => void;
}) {
  const diaDaSemana = new Date(`${data}T12:00:00Z`).getUTCDay();
  const expediente = agenda.diasAbertos.find((dia) => dia.diaDaSemana === diaDaSemana);

  const horarios = itens.flatMap((item) => [item.inicio, item.fim]);
  const inicioDaFaixa = menor([expediente?.horaAbertura ?? "08:00", ...horarios]);
  const fimDaFaixa = maior([expediente?.horaFechamento ?? "18:00", ...horarios]);

  const blocos = blocosEntre(inicioDaFaixa, fimDaFaixa);

  if (salas.length === 0) {
    return <AvisoVazio>Nenhuma sala para mostrar.</AvisoVazio>;
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold text-text-primary">
        {dataPorExtenso(data)}
        {expediente ? (
          <span className="ml-2 text-sm font-normal text-text-secondary">
            {expediente.horaAbertura}–{expediente.horaFechamento}
          </span>
        ) : (
          <span className="ml-2 text-sm font-normal text-text-secondary">
            fechado neste dia
          </span>
        )}
      </h2>

      {/* Rola na horizontal no tablet quando ha 3 salas. */}
      <div className="overflow-x-auto">
        <div className="min-w-[540px]">
          <div
            className="grid border-b border-border"
            style={{ gridTemplateColumns: `4.5rem repeat(${salas.length}, 1fr)` }}
          >
            <span aria-hidden />
            {salas.map((sala) => (
              <span
                key={sala.id}
                className="border-l border-border px-2 py-2 text-center text-sm font-bold text-text-primary"
              >
                {sala.nome}
              </span>
            ))}
          </div>

          <div
            className="relative grid"
            style={{
              gridTemplateColumns: `4.5rem repeat(${salas.length}, 1fr)`,
              gridTemplateRows: `repeat(${blocos.length}, ${ALTURA_DO_BLOCO}px)`,
            }}
          >
            {/* Coluna das horas */}
            {blocos.map((hora, linha) => (
              <span
                key={hora}
                style={{ gridColumn: 1, gridRow: linha + 1 }}
                className="-mt-2 pr-2 text-right text-xs text-text-secondary tabular-nums"
              >
                {hora.endsWith(":00") ? hora : ""}
              </span>
            ))}

            {/* Fundo: uma celula por sala e bloco, sombreada fora do expediente */}
            {salas.map((sala, coluna) =>
              blocos.map((hora, linha) => {
                const foraDoExpediente =
                  !expediente ||
                  hora < expediente.horaAbertura ||
                  hora >= expediente.horaFechamento;

                return (
                  <span
                    key={`${sala.id}-${hora}`}
                    style={{ gridColumn: coluna + 2, gridRow: linha + 1 }}
                    className={cn(
                      "border-b border-l border-border",
                      hora.endsWith(":00") ? "border-b-border" : "border-b-border/40",
                      foraDoExpediente && "bg-bg-secondary",
                    )}
                  />
                );
              }),
            )}

            {/* Reservas e bloqueios por cima */}
            {salas.map((sala, coluna) =>
              itens
                .filter((item) => item.salaId === sala.id)
                .map((item) => {
                  const linhaInicial =
                    (minutosDaHora(item.inicio) - minutosDaHora(inicioDaFaixa)) / 30;
                  const linhas = Math.max(
                    1,
                    (minutosDaHora(item.fim) - minutosDaHora(item.inicio)) / 30,
                  );
                  const estilo = estiloDoItem(item.tipo, item.status);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => aoAbrirItem(item)}
                      style={{
                        gridColumn: coluna + 2,
                        gridRow: `${Math.floor(linhaInicial) + 1} / span ${linhas}`,
                      }}
                      className={cn(
                        "m-0.5 flex flex-col items-start gap-0.5 overflow-hidden rounded-md border p-1.5 text-left text-xs",
                        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black",
                        "hover:brightness-95",
                        estilo.caixa,
                      )}
                    >
                      <span className="font-semibold tabular-nums">
                        {item.inicio}–{item.fim}
                      </span>
                      <span className="flex w-full items-center gap-1 truncate">
                        {item.recorrenciaId ? (
                          // Simbolo de repeticao: diz que esta reserva faz parte
                          // de uma serie, sem depender so de cor.
                          <span aria-label="parte de uma série" title="parte de uma série">
                            ⟳
                          </span>
                        ) : null}
                        <span className="truncate">
                          {item.tipo === "BLOQUEIO"
                            ? (item.motivo ?? "Bloqueio")
                            : item.nomeCliente}
                        </span>
                      </span>
                    </button>
                  );
                }),
            )}
          </div>
        </div>
      </div>

      {itens.length === 0 ? (
        <AvisoVazio>Nenhuma reserva neste dia.</AvisoVazio>
      ) : null}
    </div>
  );
}

function menor(horas: string[]): string {
  return horas.reduce((menorAte, hora) => (hora < menorAte ? hora : menorAte));
}

function maior(horas: string[]): string {
  return horas.reduce((maiorAte, hora) => (hora > maiorAte ? hora : maiorAte));
}
