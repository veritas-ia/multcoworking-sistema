"use client";

import { useEffect, useState } from "react";

import { buscarAgenda, buscarSalas, mensagemDoErro } from "@/components/reserva/api";
import { dataPorExtenso, duracaoPorExtenso, minutosEntreHoras } from "@/components/reserva/datas";
import { EtapaData } from "@/components/reserva/etapa-data";
import { EtapaFim, EtapaInicio } from "@/components/reserva/etapa-horarios";
import { EtapaSala } from "@/components/reserva/etapa-sala";
import { BarraDeProgresso } from "@/components/reserva/pecas";
import type { Agenda, Sala } from "@/components/reserva/tipos";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";

import type { ReservaDoCliente } from "./api";
import { PedirCodigo } from "./pedir-codigo";

type Passo = "sala" | "data" | "inicio" | "fim" | "codigo";

const TITULOS: Record<Passo, string> = {
  sala: "Sala",
  data: "Dia",
  inicio: "Início",
  fim: "Término",
  codigo: "Confirmar",
};

const ORDEM: Passo[] = ["sala", "data", "inicio", "fim", "codigo"];

/**
 * Remarcar uma reserva: mesma escolha de sala/data/horario da Fase 5.
 *
 * A sala atual ja vem escolhida, mas da para trocar. A grade recebe o
 * identificador da reserva, para que o horario ATUAL dela apareca livre —
 * senao a pessoa nao conseguiria, por exemplo, so esticar de 1h para 2h.
 */
export function Reagendamento({
  reserva,
  telefoneMascarado,
  janelaHoras,
  enviando,
  erro,
  aoConfirmar,
  aoDesistir,
}: {
  reserva: ReservaDoCliente;
  telefoneMascarado: string | null;
  janelaHoras: number;
  enviando: boolean;
  erro: string | null;
  aoConfirmar: (escolha: {
    codigo: string;
    salaId: string;
    data: string;
    inicio: string;
    fim: string;
  }) => void;
  aoDesistir: () => void;
}) {
  const [salas, setSalas] = useState<Sala[] | null>(null);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [passo, setPasso] = useState<Passo>("sala");
  const [salaId, setSalaId] = useState(reserva.salaId);
  const [data, setData] = useState<string | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    setSalas(null);
    setAgenda(null);
    setErroInicial(null);

    Promise.all([buscarSalas(controle.signal), buscarAgenda(controle.signal)])
      .then(([resultado, dadosDaAgenda]) => {
        if (!controle.signal.aborted) {
          setSalas(resultado.salas);
          setAgenda(dadosDaAgenda);
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErroInicial(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, [tentativa]);

  if (erroInicial) {
    return (
      <AvisoDeErro
        mensagem={erroInicial}
        aoTentarDeNovo={() => setTentativa((numero) => numero + 1)}
      />
    );
  }

  if (!salas || !agenda) {
    return <Carregando texto="Abrindo a agenda…" />;
  }

  const sala = salas.find((item) => item.id === salaId) ?? null;
  const numero = ORDEM.indexOf(passo) + 1;

  function voltar(): void {
    const anterior = ORDEM[ORDEM.indexOf(passo) - 1];
    if (anterior) {
      setPasso(anterior);
    } else {
      aoDesistir();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-4">
        <p className="text-sm text-text-secondary">
          Remarcando a reserva de{" "}
          <strong className="font-semibold text-text-primary">
            {reserva.sala}, {dataPorExtenso(reserva.data)}, {reserva.inicio} às{" "}
            {reserva.fim}
          </strong>
          . O novo horário também precisa estar a mais de {janelaHoras} horas de
          agora.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={voltar}
          aria-label="Voltar"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl text-text-primary hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        >
          <span aria-hidden>‹</span>
        </button>
        <div className="flex-1">
          <BarraDeProgresso numero={numero} titulo={TITULOS[passo]} total={ORDEM.length} />
        </div>
      </div>

      {passo === "sala" ? (
        <EtapaSala
          salas={salas}
          salaEscolhida={salaId}
          aoEscolher={(nova) => {
            setSalaId(nova);
            setData(null);
            setInicio(null);
            setFim(null);
            setPasso("data");
          }}
        />
      ) : null}

      {passo === "data" && sala ? (
        <EtapaData
          agenda={agenda}
          nomeDaSala={sala.nome}
          dataEscolhida={data}
          aoEscolher={(nova) => {
            setData(nova);
            setInicio(null);
            setFim(null);
            setPasso("inicio");
          }}
        />
      ) : null}

      {passo === "inicio" && data ? (
        <EtapaInicio
          salaId={salaId}
          data={data}
          versao={0}
          reservaId={reserva.id}
          inicioEscolhido={inicio}
          aoEscolher={(nova) => {
            setInicio(nova);
            setFim(null);
            setPasso("fim");
          }}
          aoTrocarDeData={() => setPasso("data")}
        />
      ) : null}

      {passo === "fim" && data && inicio ? (
        <EtapaFim
          salaId={salaId}
          data={data}
          versao={0}
          reservaId={reserva.id}
          inicio={inicio}
          fimEscolhido={fim}
          aoEscolher={(nova) => {
            setFim(nova);
            setPasso("codigo");
          }}
          aoTrocarDeInicio={() => setPasso("inicio")}
        />
      ) : null}

      {passo === "codigo" && sala && data && inicio && fim ? (
        <PedirCodigo
          titulo="Confirmar a remarcação"
          descricao={`O novo horário é ${sala.nome}, ${dataPorExtenso(data)}, ${inicio} às ${fim} (${duracaoPorExtenso(minutosEntreHoras(inicio, fim))}).`}
          rotuloDoBotao="Confirmar remarcação"
          telefoneMascarado={telefoneMascarado}
          enviando={enviando}
          erro={erro}
          aoConfirmar={(codigo) =>
            aoConfirmar({ codigo, salaId, data, inicio, fim })
          }
          aoDesistir={aoDesistir}
        />
      ) : null}
    </div>
  );
}
