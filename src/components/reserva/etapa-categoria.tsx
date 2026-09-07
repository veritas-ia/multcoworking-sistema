"use client";

import type { CategoriaReserva } from "@/lib/precos";

import { emReais } from "./datas";
import { TituloDaEtapa } from "./pecas";
import type { Sala } from "./tipos";

/**
 * Etapa — por hora ou dia inteiro.
 *
 * So aparece nas salas que trabalham com diaria. Quem escolhe o dia inteiro
 * nao passa pelas telas de inicio e termino: o horario da diaria e fixo.
 */
export function EtapaCategoria({
  sala,
  diaria,
  escolhida,
  aoEscolher,
}: {
  sala: Sala;
  /** O horario fixo da diaria, vindo da configuracao. */
  diaria: { inicio: string; fim: string };
  escolhida: CategoriaReserva;
  aoEscolher: (categoria: CategoriaReserva) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <TituloDaEtapa apoio={`Na ${sala.nome}, você escolhe como quer reservar.`}>
        Por hora ou o dia inteiro?
      </TituloDaEtapa>

      <ul className="flex flex-col gap-3">
        <li>
          <Opcao
            titulo="Por hora"
            detalhe={`A partir de ${emReais(Math.round(Number(sala.precoPorHora) * 100))} a hora. Você escolhe o horário.`}
            selecionada={escolhida === "HORA"}
            aoEscolher={() => aoEscolher("HORA")}
          />
        </li>

        <li>
          <Opcao
            titulo="Dia inteiro (diária)"
            detalhe={
              sala.precoDiaria === null
                ? `Das ${diaria.inicio} às ${diaria.fim}.`
                : `${emReais(Math.round(Number(sala.precoDiaria) * 100))} fechado, das ${diaria.inicio} às ${diaria.fim}.`
            }
            selecionada={escolhida === "DIARIA"}
            aoEscolher={() => aoEscolher("DIARIA")}
          />
        </li>
      </ul>
    </div>
  );
}

function Opcao({
  titulo,
  detalhe,
  selecionada,
  aoEscolher,
}: {
  titulo: string;
  detalhe: string;
  selecionada: boolean;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionada}
      onClick={aoEscolher}
      className={`flex w-full flex-col gap-1 rounded-xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
        selecionada
          ? "border-black bg-brand"
          : "border-border bg-bg-primary hover:border-black"
      }`}
    >
      <span className="text-lg font-bold text-text-primary">{titulo}</span>
      <span
        className={`text-sm ${selecionada ? "text-black" : "text-text-secondary"}`}
      >
        {detalhe}
      </span>
    </button>
  );
}
