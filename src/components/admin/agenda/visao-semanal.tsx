"use client";

import {
  DIAS_CURTOS,
  diaDaSemanaDe,
  minutosDaHora,
  partesDe,
  semanaDe,
} from "@/components/reserva/datas";
import type { Agenda, Sala } from "@/components/reserva/tipos";
import { cn } from "@/lib/utils";

import type { ItemDaAgenda } from "./tipos";

/** Quanto tempo daquele dia esta ocupado, em minutos. */
function minutosOcupados(itens: ItemDaAgenda[]): number {
  return itens.reduce(
    (total, item) => total + (minutosDaHora(item.fim) - minutosDaHora(item.inicio)),
    0,
  );
}

/**
 * Visao da semana: uma linha por sala, uma coluna por dia.
 *
 * Cada celula mostra quantas reservas e uma barra de quanto do expediente
 * daquele dia esta tomado. Clicar na celula abre o DIA daquela sala — e o
 * caminho natural para chegar na reserva.
 */
export function VisaoSemanal({
  data,
  salas,
  agenda,
  itens,
  aoAbrirDia,
}: {
  data: string;
  salas: Sala[];
  agenda: Agenda;
  itens: ItemDaAgenda[];
  aoAbrirDia: (data: string, salaId: string) => void;
}) {
  const dias = semanaDe(data);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        <div
          className="grid border-b border-border"
          style={{ gridTemplateColumns: `9rem repeat(7, 1fr)` }}
        >
          <span aria-hidden />
          {dias.map((dia) => {
            const aberto = agenda.diasAbertos.some(
              (aberto) => aberto.diaDaSemana === diaDaSemanaDe(dia),
            );
            return (
              <span
                key={dia}
                className={cn(
                  "border-l border-border px-1 py-2 text-center text-xs font-semibold",
                  aberto ? "text-text-primary" : "text-text-secondary",
                )}
              >
                {DIAS_CURTOS[diaDaSemanaDe(dia)]} {partesDe(dia).dia}
                {aberto ? null : (
                  <span className="block text-[10px] font-normal">fechado</span>
                )}
              </span>
            );
          })}
        </div>

        {salas.map((sala) => (
          <div
            key={sala.id}
            className="grid border-b border-border"
            style={{ gridTemplateColumns: `9rem repeat(7, 1fr)` }}
          >
            <span className="px-2 py-3 text-sm font-bold text-text-primary">
              {sala.nome}
            </span>

            {dias.map((dia) => {
              const expediente = agenda.diasAbertos.find(
                (aberto) => aberto.diaDaSemana === diaDaSemanaDe(dia),
              );
              const doDia = itens.filter(
                (item) =>
                  item.salaId === sala.id &&
                  item.data === dia &&
                  item.status !== "CANCELADA",
              );

              const disponivel = expediente
                ? minutosDaHora(expediente.horaFechamento) -
                  minutosDaHora(expediente.horaAbertura)
                : 0;
              const ocupado = minutosOcupados(doDia);
              const proporcao =
                disponivel > 0 ? Math.min(1, ocupado / disponivel) : 0;

              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => aoAbrirDia(dia, sala.id)}
                  aria-label={`${sala.nome}, dia ${partesDe(dia).dia}: ${doDia.length} ${doDia.length === 1 ? "reserva" : "reservas"}`}
                  className={cn(
                    "flex min-h-16 flex-col justify-between gap-1 border-l border-border p-2 text-left",
                    "hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black",
                    !expediente && "bg-bg-secondary",
                  )}
                >
                  <span className="text-sm font-semibold text-text-primary tabular-nums">
                    {doDia.length > 0 ? doDia.length : ""}
                  </span>

                  {expediente ? (
                    <span
                      aria-hidden
                      className="h-1.5 w-full overflow-hidden rounded-full bg-border"
                    >
                      <span
                        className="block h-full rounded-full bg-brand"
                        style={{ width: `${Math.round(proporcao * 100)}%` }}
                      />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
