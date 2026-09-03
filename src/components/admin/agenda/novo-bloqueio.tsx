"use client";

import { useState } from "react";

import { ErroDaApi, mensagemDoErro } from "@/components/reserva/api";
import { blocosEntre, dataPorExtenso } from "@/components/reserva/datas";
import type { Sala } from "@/components/reserva/tipos";
import { AvisoDeErro } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

import { conferirBloqueio, criarBloqueio, type ReservaNoCaminho } from "./api";

const BLOCOS = blocosEntre("00:00", "23:30");

/** "Dia inteiro" na pratica: da meia-noite ate o ultimo bloco do dia. */
const DIA_INTEIRO = { inicio: "00:00", fim: "23:30" };

/**
 * Criar bloqueio pela agenda.
 *
 * Bloqueio e espaco ocupado puro: NAO exige os 30 min de folga, entao uma
 * reserva pode comecar no minuto em que ele termina.
 *
 * Se houver reserva ativa no periodo, a tela mostra a lista e NAO deixa
 * confirmar — a equipe precisa cancelar ou remarcar cada uma antes. E tudo ou
 * nada: bloquear metade de um feriado seria pior do que nao bloquear.
 */
export function NovoBloqueio({
  salas,
  dataInicial,
  salaInicial,
  aoCriar,
  aoFechar,
}: {
  salas: Sala[];
  dataInicial: string;
  salaInicial?: string;
  aoCriar: (quantas: number) => void;
  aoFechar: () => void;
}) {
  const [salaIds, setSalaIds] = useState<string[]>(
    salaInicial ? [salaInicial] : salas[0] ? [salas[0].id] : [],
  );
  const [data, setData] = useState(dataInicial);
  const [diaInteiro, setDiaInteiro] = useState(false);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("18:00");
  const [motivo, setMotivo] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [noCaminho, setNoCaminho] = useState<ReservaNoCaminho[] | null>(null);

  const horaInicio = diaInteiro ? DIA_INTEIRO.inicio : inicio;
  const horaFim = diaInteiro ? DIA_INTEIRO.fim : fim;
  const invalido = salaIds.length === 0 || horaFim <= horaInicio;

  function alternarSala(id: string): void {
    setNoCaminho(null);
    setErro(null);
    setSalaIds((atuais) =>
      atuais.includes(id) ? atuais.filter((outro) => outro !== id) : [...atuais, id],
    );
  }

  async function conferir(): Promise<void> {
    setConferindo(true);
    setErro(null);
    try {
      const { reservas } = await conferirBloqueio({
        salaIds,
        data,
        inicio: horaInicio,
        fim: horaFim,
      });
      setNoCaminho(reservas);
    } catch (problema: unknown) {
      setErro(mensagemDoErro(problema));
    } finally {
      setConferindo(false);
    }
  }

  async function salvar(): Promise<void> {
    setEnviando(true);
    setErro(null);
    try {
      const criado = await criarBloqueio({
        salaIds,
        data,
        inicio: horaInicio,
        fim: horaFim,
        motivo: motivo.trim() || undefined,
      });
      aoCriar(criado.ids.length);
    } catch (problema: unknown) {
      // O servidor devolve as reservas afetadas junto com o 409.
      if (problema instanceof ErroDaApi && problema.codigo === "RESERVAS_NO_CAMINHO") {
        setErro(problema.message);
        void conferir();
      } else {
        setErro(mensagemDoErro(problema));
      }
    } finally {
      setEnviando(false);
    }
  }

  const temImpedimento = (noCaminho?.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <form
        className="mt-6 flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-bg-primary p-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (temImpedimento) {
            return;
          }
          void salvar();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Bloquear horário</h2>
            <p className="mt-1 text-sm text-text-secondary">
              O cliente vê apenas &quot;indisponível&quot;. O motivo é só para a
              equipe.
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl text-text-primary hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <span aria-hidden>×</span>
          </button>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-text-primary">
            Salas
          </legend>

          <div className="flex flex-wrap gap-2">
            {salas.map((sala) => (
              <button
                key={sala.id}
                type="button"
                aria-pressed={salaIds.includes(sala.id)}
                onClick={() => alternarSala(sala.id)}
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-sm font-semibold",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                  salaIds.includes(sala.id)
                    ? "border-black bg-brand text-black"
                    : "border-border bg-bg-primary text-text-secondary hover:border-black",
                )}
              >
                {sala.nome}
              </button>
            ))}
          </div>

          <Botao
            aparencia="texto"
            largura="conteudo"
            className="min-h-11 self-start"
            onClick={() => {
              setNoCaminho(null);
              setSalaIds(
                salaIds.length === salas.length ? [] : salas.map((sala) => sala.id),
              );
            }}
          >
            {salaIds.length === salas.length
              ? "Limpar seleção"
              : "Todas as salas (feriado)"}
          </Botao>
        </fieldset>

        <Campo
          etiqueta="Dia"
          type="date"
          value={data}
          onChange={(evento) => {
            setData(evento.target.value);
            setNoCaminho(null);
          }}
          dica={data ? dataPorExtenso(data) : undefined}
        />

        <label className="flex items-center gap-3 rounded-lg border border-border bg-bg-primary p-3">
          <input
            type="checkbox"
            checked={diaInteiro}
            onChange={(evento) => {
              setDiaInteiro(evento.target.checked);
              setNoCaminho(null);
            }}
            className="size-6 shrink-0 accent-[var(--brand-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          />
          <span className="text-sm font-semibold text-text-primary">
            Bloquear o dia inteiro
          </span>
        </label>

        {diaInteiro ? null : (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Início</span>
              <select
                value={inicio}
                onChange={(evento) => {
                  setInicio(evento.target.value);
                  setNoCaminho(null);
                }}
                className="min-h-12 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
              >
                {BLOCOS.map((bloco) => (
                  <option key={bloco} value={bloco}>
                    {bloco}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">Término</span>
              <select
                value={fim}
                onChange={(evento) => {
                  setFim(evento.target.value);
                  setNoCaminho(null);
                }}
                className="min-h-12 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
              >
                {BLOCOS.map((bloco) => (
                  <option key={bloco} value={bloco}>
                    {bloco}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <Campo
          etiqueta="Motivo (só a equipe vê)"
          value={motivo}
          maxLength={200}
          placeholder="Manutenção do ar-condicionado"
          onChange={(evento) => setMotivo(evento.target.value)}
        />

        {horaFim <= horaInicio ? (
          <p className="text-sm font-medium text-destructive">
            O término precisa ser depois do início.
          </p>
        ) : null}

        {erro ? <AvisoDeErro mensagem={erro} /> : null}

        <ReservasNoCaminho reservas={noCaminho} />

        <div className="flex flex-wrap gap-2">
          {temImpedimento ? (
            <Botao
              aparencia="secundario"
              largura="conteudo"
              disabled={conferindo}
              onClick={() => void conferir()}
            >
              {conferindo ? "Conferindo…" : "Conferir de novo"}
            </Botao>
          ) : (
            <Botao type="submit" largura="conteudo" disabled={enviando || invalido}>
              {enviando ? "Bloqueando…" : "Bloquear"}
            </Botao>
          )}

          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={enviando || conferindo}
            onClick={() => void conferir()}
            className={temImpedimento ? "hidden" : ""}
          >
            {conferindo ? "Conferindo…" : "Conferir antes"}
          </Botao>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={enviando}
            onClick={aoFechar}
          >
            Cancelar
          </Botao>
        </div>
      </form>
    </div>
  );
}

/** A lista de reservas que impedem o bloqueio. */
function ReservasNoCaminho({ reservas }: { reservas: ReservaNoCaminho[] | null }) {
  if (reservas === null) {
    return null;
  }

  if (reservas.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
        Nenhuma reserva neste período. Pode bloquear.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-destructive bg-bg-primary p-4">
      <h3 className="text-sm font-bold text-destructive">
        {reservas.length === 1
          ? "1 reserva impede este bloqueio"
          : `${reservas.length} reservas impedem este bloqueio`}
      </h3>
      <p className="text-sm text-text-secondary">
        Cancele ou remarque cada uma na agenda e volte aqui.
      </p>
      <ul className="flex flex-col gap-1.5 text-sm">
        {reservas.map((reserva) => (
          <li
            key={reserva.id}
            className="flex flex-wrap gap-x-2 border-t border-border pt-1.5 text-text-primary"
          >
            <span className="font-semibold">{reserva.nomeCliente}</span>
            <span className="text-text-secondary">
              {reserva.sala} · {reserva.data} · {reserva.inicio}–{reserva.fim}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
