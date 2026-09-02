"use client";

import { useEffect, useState } from "react";

import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

import { buscarBlocos, buscarTerminos, mensagemDoErro } from "./api";
import { dataCurta, duracaoPorExtenso, minutosEntreHoras } from "./datas";
import { BotaoDaGrade, TituloDaEtapa } from "./pecas";
import type { Bloco } from "./tipos";

type BaseProps = {
  salaId: string;
  data: string;
  /** Muda de valor para forcar uma releitura da grade (ex.: depois de um 409). */
  versao: number;
  /** Reagendamento: a reserva sendo remarcada nao ocupa o proprio horario. */
  reservaId?: string;
};

// -----------------------------------------------------------------------------
// Etapa 3 — horario de inicio
// -----------------------------------------------------------------------------

export function EtapaInicio({
  salaId,
  data,
  versao,
  reservaId,
  inicioEscolhido,
  aoEscolher,
  aoTrocarDeData,
}: BaseProps & {
  inicioEscolhido: string | null;
  aoEscolher: (inicio: string) => void;
  aoTrocarDeData: () => void;
}) {
  const [blocos, setBlocos] = useState<Bloco[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controle = new AbortController();
    setBlocos(null);
    setErro(null);

    buscarBlocos(salaId, data, controle.signal, reservaId)
      .then((resposta) => {
        if (!controle.signal.aborted) {
          setBlocos(resposta.blocos);
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErro(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, [salaId, data, versao, reservaId, tentativa]);

  const temAlgumLivre = blocos?.some((bloco) => bloco.disponivelParaInicio) ?? false;

  return (
    <div className="flex flex-col gap-5">
      <TituloDaEtapa apoio={`${dataCurta(data)}. Os horários riscados já estão ocupados.`}>
        A partir de que horas?
      </TituloDaEtapa>

      {erro ? (
        <AvisoDeErro
          mensagem={erro}
          aoTentarDeNovo={() => setTentativa((numero) => numero + 1)}
        />
      ) : blocos === null ? (
        <Carregando texto="Buscando os horários livres…" />
      ) : blocos.length === 0 || !temAlgumLivre ? (
        <div className="flex flex-col gap-4">
          <AvisoVazio>
            Não há horários livres nesta sala neste dia. Pode ser um feriado, um
            dia reservado pela equipe ou a agenda já cheia.
          </AvisoVazio>
          <Botao aparencia="secundario" onClick={aoTrocarDeData}>
            Escolher outro dia
          </Botao>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {blocos.map((bloco) => (
            <li key={bloco.horario}>
              <BotaoDaGrade
                rotulo={
                  bloco.disponivelParaInicio
                    ? `Começar às ${bloco.horario}`
                    : `${bloco.horario} — indisponível`
                }
                bloqueado={!bloco.disponivelParaInicio}
                selecionado={bloco.horario === inicioEscolhido}
                aoEscolher={() => aoEscolher(bloco.horario)}
                className="w-full"
              >
                {bloco.horario}
              </BotaoDaGrade>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Etapa 4 — horario de termino
// -----------------------------------------------------------------------------

export function EtapaFim({
  salaId,
  data,
  versao,
  reservaId,
  inicio,
  fimEscolhido,
  aoEscolher,
  aoTrocarDeInicio,
}: BaseProps & {
  inicio: string;
  fimEscolhido: string | null;
  aoEscolher: (fim: string) => void;
  aoTrocarDeInicio: () => void;
}) {
  const [terminos, setTerminos] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controle = new AbortController();
    setTerminos(null);
    setErro(null);

    buscarTerminos(salaId, data, inicio, controle.signal, reservaId)
      .then((resposta) => {
        if (!controle.signal.aborted) {
          setTerminos(resposta.terminos);
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErro(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, [salaId, data, inicio, versao, reservaId, tentativa]);

  return (
    <div className="flex flex-col gap-5">
      <TituloDaEtapa
        apoio={`Começando às ${inicio}. Só aparecem os términos permitidos para esta sala.`}
      >
        Até que horas?
      </TituloDaEtapa>

      {erro ? (
        <AvisoDeErro
          mensagem={erro}
          aoTentarDeNovo={() => setTentativa((numero) => numero + 1)}
        />
      ) : terminos === null ? (
        <Carregando texto="Calculando as durações possíveis…" />
      ) : terminos.length === 0 ? (
        <div className="flex flex-col gap-4">
          <AvisoVazio>
            Não há duração possível começando às {inicio}. Escolha outro horário
            de início.
          </AvisoVazio>
          <Botao aparencia="secundario" onClick={aoTrocarDeInicio}>
            Voltar aos horários
          </Botao>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {terminos.map((fim) => {
            const duracao = duracaoPorExtenso(minutosEntreHoras(inicio, fim));

            return (
              <li key={fim}>
                <BotaoDaGrade
                  rotulo={`Terminar às ${fim}, ${duracao} de reserva`}
                  selecionado={fim === fimEscolhido}
                  aoEscolher={() => aoEscolher(fim)}
                  className="w-full flex-col gap-0.5 py-2.5"
                >
                  <span className="text-base font-semibold">{fim}</span>
                  <span className="text-xs font-normal text-text-secondary">
                    {duracao}
                  </span>
                </BotaoDaGrade>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
