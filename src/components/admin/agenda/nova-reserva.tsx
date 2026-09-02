"use client";

import { useState } from "react";

import { mensagemDoErro } from "@/components/reserva/api";
import { blocosEntre } from "@/components/reserva/datas";
import type { Sala } from "@/components/reserva/tipos";
import { AvisoDeErro } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { formatarEnquantoDigita } from "@/lib/telefone";

import { criarNaRecepcao } from "./api";

const BLOCOS = blocosEntre("06:00", "23:00");

/**
 * Lancar uma reserva pelo balcao.
 *
 * A recepcao nao tem as travas comerciais do site: pode marcar para daqui a
 * pouco, para tras, com qualquer duracao e sem limite por telefone. O que ela
 * NAO pode e sobrepor horario nem comer o intervalo de 30 min — e o servidor
 * que decide isso, nao esta tela.
 */
export function NovaReserva({
  salas,
  dataInicial,
  salaInicial,
  aoCriar,
  aoFechar,
}: {
  salas: Sala[];
  dataInicial: string;
  salaInicial?: string;
  aoCriar: () => void;
  aoFechar: () => void;
}) {
  const [salaId, setSalaId] = useState(salaInicial ?? salas[0]?.id ?? "");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [data, setData] = useState(dataInicial);
  const [inicio, setInicio] = useState("09:00");
  const [fim, setFim] = useState("10:00");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const invalido = fim <= inicio || nome.trim().length < 2 || telefone.length < 14;

  async function salvar(): Promise<void> {
    setEnviando(true);
    setErro(null);
    try {
      await criarNaRecepcao({ salaId, telefone, nome: nome.trim(), data, inicio, fim });
      aoCriar();
    } catch (problema: unknown) {
      setErro(mensagemDoErro(problema));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <form
        className="mt-6 flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-bg-primary p-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          void salvar();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Nova reserva pela recepção
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Sem limite de reservas por telefone e sem antecedência mínima. O
              cliente recebe a confirmação no WhatsApp.
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

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text-primary">Sala</span>
          <select
            value={salaId}
            onChange={(evento) => setSalaId(evento.target.value)}
            className="min-h-12 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
          >
            {salas.map((sala) => (
              <option key={sala.id} value={sala.id}>
                {sala.nome}
              </option>
            ))}
          </select>
        </label>

        <Campo
          etiqueta="Nome do cliente"
          value={nome}
          maxLength={120}
          placeholder="Maria Silva"
          onChange={(evento) => setNome(evento.target.value)}
        />

        <Campo
          etiqueta="Telefone (WhatsApp)"
          type="tel"
          inputMode="tel"
          placeholder="(11) 91234-5678"
          value={telefone}
          onChange={(evento) => setTelefone(formatarEnquantoDigita(evento.target.value))}
        />

        <Campo
          etiqueta="Dia"
          type="date"
          value={data}
          onChange={(evento) => setData(evento.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-text-primary">Início</span>
            <select
              value={inicio}
              onChange={(evento) => setInicio(evento.target.value)}
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
              onChange={(evento) => setFim(evento.target.value)}
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

        {fim <= inicio ? (
          <p className="text-sm font-medium text-destructive">
            O término precisa ser depois do início.
          </p>
        ) : null}

        {erro ? <AvisoDeErro mensagem={erro} /> : null}

        <div className="flex flex-wrap gap-2">
          <Botao type="submit" largura="conteudo" disabled={enviando || invalido}>
            {enviando ? "Lançando…" : "Lançar reserva"}
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
