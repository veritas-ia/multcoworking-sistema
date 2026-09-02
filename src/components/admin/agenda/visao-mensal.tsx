"use client";

import {
  DIAS_CURTOS,
  dataPorExtenso,
  diaDaSemanaDe,
  diasNoMes,
  minutosDaHora,
  montarData,
  partesDe,
} from "@/components/reserva/datas";
import type { Agenda } from "@/components/reserva/tipos";
import { cn } from "@/lib/utils";

import type { ItemDaAgenda } from "./tipos";

/**
 * Calendario do mes com indicador de ocupacao por dia.
 *
 * Clicar num dia leva para a visao DIARIA daquele dia — e o comeco do caminho
 * que a recepcao usa o tempo todo: mes -> dia -> reserva -> acao.
 */
export function VisaoMensal({
  mes,
  hoje,
  agenda,
  itens,
  aoAbrirDia,
}: {
  /** "AAAA-MM". */
  mes: string;
  hoje: string;
  agenda: Agenda;
  itens: ItemDaAgenda[];
  aoAbrirDia: (data: string) => void;
}) {
  const { ano, mes: numeroDoMes } = partesDe(`${mes}-01`);
  const total = diasNoMes(ano, numeroDoMes);
  const casasVazias = diaDaSemanaDe(`${mes}-01`);

  return (
    <div className="grid grid-cols-7 gap-1">
      {DIAS_CURTOS.map((dia, indice) => (
        <span
          key={indice}
          aria-hidden
          className="pb-1 text-center text-xs font-semibold text-text-secondary"
        >
          {dia}
        </span>
      ))}

      {Array.from({ length: casasVazias }, (_, indice) => (
        <span key={`vazio-${indice}`} aria-hidden />
      ))}

      {Array.from({ length: total }, (_, indice) => {
        const data = montarData(ano, numeroDoMes, indice + 1);
        const expediente = agenda.diasAbertos.find(
          (aberto) => aberto.diaDaSemana === diaDaSemanaDe(data),
        );

        const doDia = itens.filter(
          (item) => item.data === data && item.status !== "CANCELADA",
        );

        const disponivel = expediente
          ? minutosDaHora(expediente.horaFechamento) -
            minutosDaHora(expediente.horaAbertura)
          : 0;
        const ocupado = doDia.reduce(
          (soma, item) => soma + (minutosDaHora(item.fim) - minutosDaHora(item.inicio)),
          0,
        );
        const proporcao = disponivel > 0 ? Math.min(1, ocupado / disponivel) : 0;

        return (
          <button
            key={data}
            type="button"
            onClick={() => aoAbrirDia(data)}
            aria-label={`${dataPorExtenso(data)}: ${doDia.length} ${doDia.length === 1 ? "reserva" : "reservas"}${expediente ? "" : ", fechado"}`}
            className={cn(
              "flex min-h-16 flex-col items-stretch gap-1 rounded-lg border p-1.5 text-left",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
              expediente
                ? "border-border bg-bg-primary hover:border-black"
                : "border-dashed border-border bg-bg-secondary",
              data === hoje && "ring-2 ring-black",
            )}
          >
            <span
              className={cn(
                "text-sm tabular-nums",
                data === hoje
                  ? "font-bold text-text-primary"
                  : expediente
                    ? "text-text-primary"
                    : "text-text-secondary",
              )}
            >
              {indice + 1}
            </span>

            {doDia.length > 0 ? (
              <>
                <span className="text-xs font-semibold text-text-secondary tabular-nums">
                  {doDia.length}
                </span>
                <span
                  aria-hidden
                  className="mt-auto h-1.5 w-full overflow-hidden rounded-full bg-border"
                >
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${Math.round(proporcao * 100)}%` }}
                  />
                </span>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
