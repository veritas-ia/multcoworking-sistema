"use client";

import { Calendario } from "./calendario";
import { TituloDaEtapa } from "./pecas";
import type { Agenda } from "./tipos";

/** Etapa 2 — calendario com dias fechados e fora da janela desabilitados. */
export function EtapaData({
  agenda,
  nomeDaSala,
  dataEscolhida,
  aoEscolher,
}: {
  agenda: Agenda;
  nomeDaSala: string;
  dataEscolhida: string | null;
  aoEscolher: (data: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <TituloDaEtapa apoio={`Reserva na ${nomeDaSala}.`}>Qual dia?</TituloDaEtapa>

      <Calendario
        agenda={agenda}
        dataEscolhida={dataEscolhida}
        aoEscolher={aoEscolher}
      />
    </div>
  );
}
