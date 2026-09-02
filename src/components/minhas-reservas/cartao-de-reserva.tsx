"use client";

import { Botao } from "@/components/ui/botao";
import {
  dataPorExtenso,
  duracaoPorExtenso,
  emReais,
  minutosEntreHoras,
} from "@/components/reserva/datas";
import { cn } from "@/lib/utils";

import type { ReservaDoCliente } from "./api";

const ROTULO_DO_STATUS: Record<string, string> = {
  CONFIRMADA: "Confirmada",
  REAGENDADA: "Remarcada",
  CANCELADA: "Cancelada",
  CONCLUIDA: "Concluída",
};

/**
 * Um cartao de reserva.
 *
 * Os botoes so aparecem para reserva futura e ativa. Quando faltam 12h ou
 * menos, eles ficam desabilitados COM a explicacao ao lado — nao some da tela,
 * senao a pessoa fica procurando o botao que desapareceu.
 */
export function CartaoDeReserva({
  reserva,
  janelaHoras,
  encerrada,
  aoCancelar,
  aoReagendar,
}: {
  reserva: ReservaDoCliente;
  janelaHoras: number;
  encerrada: boolean;
  aoCancelar: () => void;
  aoReagendar: () => void;
}) {
  const minutos = minutosEntreHoras(reserva.inicio, reserva.fim);
  const cancelada = reserva.status === "CANCELADA";

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-bg-primary p-4",
        encerrada && "bg-bg-secondary",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-text-primary">{reserva.sala}</h3>
        <span
          className={cn(
            "rounded-md px-2 py-1 text-xs font-semibold",
            cancelada
              ? "bg-bg-secondary text-text-secondary line-through"
              : encerrada
                ? "bg-bg-primary text-text-secondary"
                : "bg-brand text-black",
          )}
        >
          {ROTULO_DO_STATUS[reserva.status] ?? reserva.status}
        </span>
      </div>

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="sr-only">Dia</dt>
          <dd className="text-text-primary">{dataPorExtenso(reserva.data)}</dd>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <dt className="sr-only">Horário</dt>
          <dd className="font-semibold text-text-primary">
            {reserva.inicio} às {reserva.fim}
          </dd>
          <dd className="text-text-secondary">{duracaoPorExtenso(minutos)}</dd>
          <dd className="text-text-secondary">
            {emReais(Math.round(Number(reserva.valor) * 100))}
          </dd>
        </div>
      </dl>

      {encerrada ? null : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Botao
              aparencia="primario"
              largura="conteudo"
              disabled={!reserva.podeAlterar}
              onClick={aoReagendar}
              className="flex-1"
            >
              Reagendar
            </Botao>
            <Botao
              aparencia="secundario"
              largura="conteudo"
              disabled={!reserva.podeAlterar}
              onClick={aoCancelar}
              className="flex-1"
            >
              Cancelar
            </Botao>
          </div>

          {reserva.podeAlterar ? null : (
            <p className="rounded-lg border border-border bg-bg-secondary p-3 text-sm leading-relaxed text-text-secondary">
              Faltam menos de {janelaHoras} horas para o início, então não dá mais
              para remarcar ou cancelar por aqui. Fale com a recepção pelo
              WhatsApp que a equipe resolve com você.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
