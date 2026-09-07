"use client";

import { useId, useState } from "react";

import { AvisoDeErro } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

import {
  dataPorExtenso,
  duracaoPorExtenso,
  emReais,
  minutosEntreHoras,
  valorEstimadoEmCentavos,
} from "./datas";
import { LinhaDeResumo, PoliticaDeCancelamento, TituloDaEtapa } from "./pecas";
import type { Sala, TextosDePolitica } from "./tipos";

type Props = {
  sala: Sala;
  data: string;
  inicio: string;
  fim: string;
  nome: string;
  telefoneMascarado: string | null;
  janelaCancelamentoHoras: number;
  /** A partir de que hora vale o preco noturno. */
  horaInicioNoturno: string;
  textos: TextosDePolitica;
  enviando: boolean;
  erro: string | null;
  aoConfirmar: () => void;
};

/** Etapa 7 — confere tudo, mostra a politica e pede o aceite. */
export function EtapaResumo({
  sala,
  data,
  inicio,
  fim,
  nome,
  telefoneMascarado,
  janelaCancelamentoHoras,
  horaInicioNoturno,
  textos,
  enviando,
  erro,
  aoConfirmar,
}: Props) {
  const [aceito, setAceito] = useState(false);
  const [erroDoAceite, setErroDoAceite] = useState<string | null>(null);
  const idAceite = useId();

  const minutos = minutosEntreHoras(inicio, fim);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!aceito) {
          setErroDoAceite("Marque o aceite da política para confirmar.");
          return;
        }
        aoConfirmar();
      }}
    >
      <TituloDaEtapa apoio="Confira antes de confirmar.">
        Tudo certo?
      </TituloDaEtapa>

      <dl className="divide-y divide-border rounded-xl border border-border bg-bg-primary px-4 py-1">
        <LinhaDeResumo rotulo="Sala" valor={sala.nome} />
        <LinhaDeResumo rotulo="Dia" valor={dataPorExtenso(data)} />
        <LinhaDeResumo rotulo="Horário" valor={`${inicio} às ${fim}`} />
        <LinhaDeResumo rotulo="Duração" valor={duracaoPorExtenso(minutos)} />
        <LinhaDeResumo rotulo="Nome" valor={nome} />
        {telefoneMascarado ? (
          <LinhaDeResumo rotulo="WhatsApp" valor={telefoneMascarado} />
        ) : null}
        <LinhaDeResumo
          rotulo="Valor estimado"
          destaque
          valor={emReais(
            valorEstimadoEmCentavos({
              sala,
              inicio,
              fim,
              horaInicioNoturno,
            }),
          )}
        />
      </dl>

      <p className="text-sm whitespace-pre-line text-text-secondary">
        {textos.avisoDoValor}
      </p>

      <PoliticaDeCancelamento texto={textos.politicaCancelamento} />

      <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-primary p-4">
        <input
          id={idAceite}
          type="checkbox"
          checked={aceito}
          aria-describedby={erroDoAceite ? `${idAceite}-erro` : undefined}
          onChange={(evento) => {
            setAceito(evento.target.checked);
            setErroDoAceite(null);
          }}
          className="mt-0.5 size-6 shrink-0 accent-[var(--brand-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        />
        <label htmlFor={idAceite} className="text-sm leading-relaxed text-text-primary">
          Li e aceito a política de cancelamento: posso cancelar ou remarcar
          sozinho até {janelaCancelamentoHoras} horas antes do início.
        </label>
      </div>

      {erroDoAceite ? (
        <p
          id={`${idAceite}-erro`}
          className="text-sm font-medium text-destructive"
        >
          {erroDoAceite}
        </p>
      ) : null}

      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      <Botao type="submit" disabled={enviando}>
        {enviando ? "Confirmando…" : "Confirmar reserva"}
      </Botao>
    </form>
  );
}
