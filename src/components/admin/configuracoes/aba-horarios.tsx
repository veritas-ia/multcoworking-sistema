"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

import {
  buscarHorarios,
  conferirHorarios,
  salvarHorarios,
  type DiaDeFuncionamento,
  type ReservaForaDoHorario,
} from "./api";
import { BarraDeSalvar, Secao, type Situacao } from "./pecas";

const NOMES = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

/** Todas as meias horas do dia: 00:00, 00:30, 01:00... 23:30. */
const HORAS: string[] = Array.from({ length: 48 }, (_, indice) => {
  const hora = String(Math.floor(indice / 2)).padStart(2, "0");
  const minuto = indice % 2 === 0 ? "00" : "30";
  return `${hora}:${minuto}`;
});

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

function iguais(a: DiaDeFuncionamento[], b: DiaDeFuncionamento[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type Confirmacao = { reservas: ReservaForaDoHorario[] };

export function AbaDeHorarios() {
  const [salvos, setSalvos] = useState<DiaDeFuncionamento[] | null>(null);
  const [rascunho, setRascunho] = useState<DiaDeFuncionamento[]>([]);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [afetadas, setAfetadas] = useState<ReservaForaDoHorario[] | null>(null);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarHorarios(sinal);
      setSalvos(resposta.horarios);
      setRascunho(resposta.horarios);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar o horário."));
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!salvos) {
    return <Carregando texto="Carregando o horário…" />;
  }

  const alterado = !iguais(salvos, rascunho);

  function trocarDia(diaDaSemana: number, mudanca: Partial<DiaDeFuncionamento>) {
    setSituacao({ tipo: "parado" });
    setConfirmacao(null);
    setRascunho((atual) =>
      atual.map((dia) => (dia.diaDaSemana === diaDaSemana ? { ...dia, ...mudanca } : dia)),
    );
  }

  /** Primeiro passo: perguntar ao servidor o que essa mudanca quebraria. */
  async function conferir() {
    setSituacao({ tipo: "salvando" });

    try {
      const { reservas } = await conferirHorarios(rascunho);

      if (reservas.length === 0) {
        await gravar();
        return;
      }

      setConfirmacao({ reservas });
      setSituacao({ tipo: "parado" });
    } catch (erro) {
      setSituacao({ tipo: "erro", mensagem: mensagemDe(erro, "Não foi possível conferir.") });
    }
  }

  async function gravar() {
    setSituacao({ tipo: "salvando" });

    try {
      const resposta = await salvarHorarios(rascunho);
      setSalvos(resposta.horarios);
      setRascunho(resposta.horarios);
      setConfirmacao(null);
      setAfetadas(
        resposta.reservasForaDoHorario.length > 0 ? resposta.reservasForaDoHorario : null,
      );
      setSituacao({ tipo: "salvo", mensagem: "Horário salvo." });
    } catch (erro) {
      setSituacao({ tipo: "erro", mensagem: mensagemDe(erro, "Não foi possível salvar.") });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Horário de funcionamento"
        descricao="Vale para o site. A recepção continua podendo lançar reserva fora do expediente quando a equipe sabe que vai abrir."
      >
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border">
            {[...rascunho]
              .sort((a, b) => a.diaDaSemana - b.diaDaSemana)
              .map((dia) => (
                <LinhaDoDia key={dia.diaDaSemana} dia={dia} aoMudar={trocarDia} />
              ))}
          </ul>

          <BarraDeSalvar
            situacao={situacao}
            alterado={alterado}
            aoSalvar={() => void conferir()}
            aoDescartar={() => {
              setRascunho(salvos);
              setConfirmacao(null);
              setSituacao({ tipo: "parado" });
            }}
            rotulo="Salvar horário"
          />
        </div>
      </Secao>

      {confirmacao ? (
        <ListaDeReservas
          titulo="Estas reservas ficam fora do novo horário"
          descricao="O sistema não vai cancelar nem mexer em nenhuma delas. Se você salvar, elas continuam marcadas como estão — e você decide o que fazer com cada uma na agenda."
          reservas={confirmacao.reservas}
          rodape={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Botao
                aparencia="secundario"
                largura="conteudo"
                onClick={() => setConfirmacao(null)}
              >
                Voltar e ajustar
              </Botao>
              <Botao
                largura="conteudo"
                disabled={situacao.tipo === "salvando"}
                onClick={() => void gravar()}
              >
                {situacao.tipo === "salvando" ? "Salvando…" : "Salvar mesmo assim"}
              </Botao>
            </div>
          }
        />
      ) : null}

      {afetadas && !confirmacao ? (
        <ListaDeReservas
          titulo="Horário salvo. Estas reservas ficaram fora dele"
          descricao="Elas continuam de pé, exatamente como estavam. Resolva uma a uma na agenda: cancelar, remarcar ou simplesmente manter."
          reservas={afetadas}
          rodape={
            <div className="flex justify-end">
              <Botao aparencia="secundario" largura="conteudo" onClick={() => setAfetadas(null)}>
                Entendi
              </Botao>
            </div>
          }
        />
      ) : null}
    </div>
  );
}

/** Um dia da semana: aberto/fechado e as duas horas. */
function LinhaDoDia({
  dia,
  aoMudar,
}: {
  dia: DiaDeFuncionamento;
  aoMudar: (diaDaSemana: number, mudanca: Partial<DiaDeFuncionamento>) => void;
}) {
  const nome = NOMES[dia.diaDaSemana] ?? "";

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <label className="flex min-w-44 items-center gap-2.5 text-sm font-semibold text-text-primary">
        <input
          type="checkbox"
          checked={dia.aberto}
          onChange={(evento) =>
            aoMudar(dia.diaDaSemana, {
              aberto: evento.target.checked,
              horaAbertura: evento.target.checked ? (dia.horaAbertura ?? "08:00") : null,
              horaFechamento: evento.target.checked ? (dia.horaFechamento ?? "18:00") : null,
            })
          }
          className="size-5 accent-[var(--brand-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
        />
        {nome}
      </label>

      {dia.aberto ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <SeletorDeHora
            etiqueta={`Abertura de ${nome}`}
            valor={dia.horaAbertura ?? "08:00"}
            aoMudar={(hora) => aoMudar(dia.diaDaSemana, { horaAbertura: hora })}
          />
          <span aria-hidden>às</span>
          <SeletorDeHora
            etiqueta={`Fechamento de ${nome}`}
            valor={dia.horaFechamento ?? "18:00"}
            aoMudar={(hora) => aoMudar(dia.diaDaSemana, { horaFechamento: hora })}
          />
        </div>
      ) : (
        <span className="text-sm text-text-secondary">Fechado</span>
      )}
    </li>
  );
}

/**
 * Lista fechada de horas, em vez de campo livre.
 *
 * O CLAUDE.md so admite :00 e :30. Com uma lista, o horario errado nem chega a
 * ser digitado — melhor do que deixar escrever e reclamar depois.
 */
function SeletorDeHora({
  etiqueta,
  valor,
  aoMudar,
}: {
  etiqueta: string;
  valor: string;
  aoMudar: (hora: string) => void;
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(evento) => aoMudar(evento.target.value)}
      className="min-h-11 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
    >
      {HORAS.map((hora) => (
        <option key={hora} value={hora}>
          {hora}
        </option>
      ))}
    </select>
  );
}

/** Reservas afetadas, com atalho para a agenda do dia. */
function ListaDeReservas({
  titulo,
  descricao,
  reservas,
  rodape,
}: {
  titulo: string;
  descricao: string;
  reservas: ReservaForaDoHorario[];
  rodape: React.ReactNode;
}) {
  return (
    <Secao titulo={titulo} descricao={descricao}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col divide-y divide-border">
          {reservas.map((reserva) => (
            <li key={reserva.id} className="flex flex-col gap-1 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-text-primary">
                  {reserva.data} · {reserva.inicio} às {reserva.fim}
                </span>
                <span className="text-sm text-text-secondary">{reserva.sala}</span>
              </div>
              <span className="text-sm text-text-secondary">
                {reserva.nomeCliente} · {reserva.telefone}
              </span>
              <span className="text-sm text-text-secondary">Motivo: {reserva.motivo}</span>
              <Link
                href={`/admin/agenda?data=${reserva.data}`}
                className="text-sm font-semibold text-text-primary underline underline-offset-4"
              >
                Abrir esse dia na agenda
              </Link>
            </li>
          ))}
        </ul>

        {rodape}
      </div>
    </Secao>
  );
}
