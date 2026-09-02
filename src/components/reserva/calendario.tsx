"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/botao";

import {
  DIAS_CURTOS,
  dataPorExtenso,
  diaDaSemanaDe,
  diasNoMes,
  mesDe,
  montarData,
  motivoDoBloqueioDoDia,
  nomeDoMes,
  partesDe,
  resumoDoFuncionamento,
  somarMeses,
} from "./datas";
import { BotaoDaGrade } from "./pecas";
import type { Agenda } from "./tipos";

type Props = {
  agenda: Agenda;
  dataEscolhida: string | null;
  aoEscolher: (data: string) => void;
};

export function Calendario({ agenda, dataEscolhida, aoEscolher }: Props) {
  const [mes, setMes] = useState(() => mesDe(dataEscolhida ?? agenda.primeiraData));

  const primeiroMes = mesDe(agenda.primeiraData);
  const ultimoMes = mesDe(agenda.ultimaData);

  const { ano, mes: numeroDoMes } = partesDe(`${mes}-01`);
  const totalDeDias = diasNoMes(ano, numeroDoMes);
  const casasVazias = diaDaSemanaDe(`${mes}-01`);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Botao
          aparencia="secundario"
          largura="conteudo"
          aria-label="Mês anterior"
          disabled={mes <= primeiroMes}
          onClick={() => setMes(somarMeses(mes, -1))}
          className="min-h-11 px-4 text-xl leading-none"
        >
          <span aria-hidden>‹</span>
        </Botao>

        {/* O nome do mes muda sozinho ao navegar: "polite" avisa sem interromper. */}
        <p aria-live="polite" className="text-base font-bold text-text-primary">
          {nomeDoMes(mes)}
        </p>

        <Botao
          aparencia="secundario"
          largura="conteudo"
          aria-label="Próximo mês"
          disabled={mes >= ultimoMes}
          onClick={() => setMes(somarMeses(mes, 1))}
          className="min-h-11 px-4 text-xl leading-none"
        >
          <span aria-hidden>›</span>
        </Botao>
      </div>

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

        {Array.from({ length: totalDeDias }, (_, indice) => {
          const data = montarData(ano, numeroDoMes, indice + 1);
          const motivo = motivoDoBloqueioDoDia(data, agenda);

          return (
            <BotaoDaGrade
              key={data}
              rotulo={
                motivo ? `${dataPorExtenso(data)} — ${motivo}` : dataPorExtenso(data)
              }
              bloqueado={motivo !== null}
              selecionado={data === dataEscolhida}
              aoEscolher={() => aoEscolher(data)}
              className="px-0"
            >
              {indice + 1}
            </BotaoDaGrade>
          );
        })}
      </div>

      {agenda.diasAbertos.length > 0 ? (
        <p className="text-sm leading-relaxed text-text-secondary">
          {resumoDoFuncionamento(agenda)}
        </p>
      ) : null}
    </div>
  );
}
