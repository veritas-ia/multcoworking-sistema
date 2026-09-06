"use client";

import Link from "next/link";

import { Botao } from "@/components/ui/botao";

import { dataPorExtenso, duracaoPorExtenso, emReais, minutosEntreHoras } from "./datas";
import { LinhaDeResumo } from "./pecas";
import type { ReservaCriada } from "./tipos";

/** Etapa 8 — deu certo. */
export function EtapaConfirmacao({
  reserva,
  telefoneMascarado,
  janelaCancelamentoHoras,
  aoRecomecar,
}: {
  reserva: ReservaCriada;
  telefoneMascarado: string | null;
  janelaCancelamentoHoras: number;
  aoRecomecar: () => void;
}) {
  const minutos = minutosEntreHoras(reserva.inicio, reserva.fim);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-full bg-brand text-3xl font-bold text-black"
        >
          ✓
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Reserva confirmada!
        </h1>
        <p className="text-sm text-text-secondary">
          Já guardamos esse horário para você.
        </p>
      </div>

      <dl className="divide-y divide-border rounded-xl border border-border bg-bg-primary px-4 py-1">
        <LinhaDeResumo rotulo="Sala" valor={reserva.sala} />
        <LinhaDeResumo rotulo="Dia" valor={dataPorExtenso(reserva.data)} />
        <LinhaDeResumo
          rotulo="Horário"
          valor={`${reserva.inicio} às ${reserva.fim}`}
        />
        <LinhaDeResumo rotulo="Duração" valor={duracaoPorExtenso(minutos)} />
        <LinhaDeResumo
          rotulo="Valor estimado"
          destaque
          valor={emReais(Math.round(Number(reserva.valorEstimado) * 100))}
        />
      </dl>

      <div className="rounded-lg border border-border bg-bg-secondary p-4">
        <h2 className="text-sm font-bold text-text-primary">
          O WhatsApp está a caminho
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          Enviamos a confirmação com todos os detalhes
          {telefoneMascarado ? ` para ${telefoneMascarado}` : ""}. Você também
          recebe lembretes 13 horas e 3 horas antes do horário.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-bg-primary p-4">
        <h2 className="text-sm font-bold text-text-primary">
          Precisa remarcar ou cancelar?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
          É só entrar em{" "}
          <Link
            href="/minhas-reservas"
            className="font-semibold text-text-primary underline underline-offset-4 hover:text-black"
          >
            Minhas reservas
          </Link>
          . Você pode fazer isso sozinho até {janelaCancelamentoHoras} horas
          antes do início.
        </p>
      </div>

      <Botao aparencia="secundario" onClick={aoRecomecar}>
        Fazer outra reserva
      </Botao>
    </div>
  );
}
