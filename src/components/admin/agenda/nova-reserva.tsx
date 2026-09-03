"use client";

import { useState } from "react";

import { mensagemDoErro } from "@/components/reserva/api";
import { blocosEntre } from "@/components/reserva/datas";
import type { Sala } from "@/components/reserva/tipos";
import { AvisoDeErro } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { serieporExtenso, type SemanaDoMes } from "@/lib/datas-recorrencia";
import { formatarEnquantoDigita } from "@/lib/telefone";
import { cn } from "@/lib/utils";

import { criarNaRecepcao, criarSerie, type RelatorioDaSerie } from "./api";

const BLOCOS = blocosEntre("06:00", "23:00");

const DIAS = [
  { numero: 1, curto: "seg" },
  { numero: 2, curto: "ter" },
  { numero: 3, curto: "qua" },
  { numero: 4, curto: "qui" },
  { numero: 5, curto: "sex" },
  { numero: 6, curto: "sáb" },
  { numero: 0, curto: "dom" },
] as const;

const FREQUENCIAS = [
  { chave: "SEMANAL", rotulo: "Toda semana" },
  { chave: "QUINZENAL", rotulo: "A cada 2 semanas" },
  { chave: "MENSAL", rotulo: "Uma vez por mês" },
] as const;

const ORDINAIS = [
  { valor: 1, rotulo: "primeira" },
  { valor: 2, rotulo: "segunda" },
  { valor: 3, rotulo: "terceira" },
  { valor: -1, rotulo: "última" },
] as const;

type Frequencia = (typeof FREQUENCIAS)[number]["chave"];

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
  aoCriarSerie,
  aoFechar,
}: {
  salas: Sala[];
  dataInicial: string;
  salaInicial?: string;
  aoCriar: () => void;
  aoCriarSerie: (relatorio: RelatorioDaSerie) => void;
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

  // --- repeticao ---
  const [repetir, setRepetir] = useState(false);
  const [diasDaSemana, setDiasDaSemana] = useState<number[]>([]);
  const [frequencia, setFrequencia] = useState<Frequencia>("SEMANAL");
  const [semanaDoMes, setSemanaDoMes] = useState<SemanaDoMes>(1);
  const [dataFim, setDataFim] = useState("");

  const faltaAlgoDaSerie =
    repetir && (diasDaSemana.length === 0 || !dataFim || dataFim < data);

  const invalido =
    fim <= inicio || nome.trim().length < 2 || telefone.length < 14 || faltaAlgoDaSerie;

  async function salvar(): Promise<void> {
    setEnviando(true);
    setErro(null);
    try {
      if (repetir) {
        const relatorio = await criarSerie({
          salaId,
          telefone,
          nome: nome.trim(),
          inicio,
          fim,
          diasDaSemana,
          frequencia,
          semanaDoMes: frequencia === "MENSAL" ? semanaDoMes : null,
          dataInicio: data,
          dataFim,
        });
        aoCriarSerie(relatorio);
        return;
      }

      await criarNaRecepcao({ salaId, telefone, nome: nome.trim(), data, inicio, fim });
      aoCriar();
    } catch (problema: unknown) {
      setErro(mensagemDoErro(problema));
    } finally {
      setEnviando(false);
    }
  }

  function alternarDia(numero: number): void {
    setDiasDaSemana((atuais) =>
      atuais.includes(numero)
        ? atuais.filter((outro) => outro !== numero)
        : [...atuais, numero],
    );
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
          etiqueta={repetir ? "Começa em" : "Dia"}
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


        {/* ----------------------------- Repetir? ----------------------------- */}
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={repetir}
              onChange={(evento) => setRepetir(evento.target.checked)}
              className="size-6 shrink-0 accent-[var(--brand-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            />
            <span className="text-sm font-semibold text-text-primary">
              Repetir esta reserva
            </span>
          </label>

          {repetir ? (
            <>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-semibold text-text-primary">
                  Em quais dias
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {DIAS.map((dia) => (
                    <button
                      key={dia.numero}
                      type="button"
                      aria-pressed={diasDaSemana.includes(dia.numero)}
                      onClick={() => alternarDia(dia.numero)}
                      className={cn(
                        "min-h-11 min-w-12 rounded-lg border px-2 text-sm font-semibold",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                        diasDaSemana.includes(dia.numero)
                          ? "border-black bg-brand text-black"
                          : "border-border bg-bg-primary text-text-secondary hover:border-black",
                      )}
                    >
                      {dia.curto}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  Com que frequência
                </span>
                <select
                  value={frequencia}
                  onChange={(evento) => setFrequencia(evento.target.value as Frequencia)}
                  className="min-h-12 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                >
                  {FREQUENCIAS.map((opcao) => (
                    <option key={opcao.chave} value={opcao.chave}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
              </label>

              {frequencia === "MENSAL" ? (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-text-primary">
                    Qual semana do mês
                  </span>
                  <select
                    value={semanaDoMes}
                    onChange={(evento) =>
                      setSemanaDoMes(Number(evento.target.value) as SemanaDoMes)
                    }
                    className="min-h-12 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                  >
                    {ORDINAIS.map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor}>
                        {opcao.rotulo}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-text-secondary">
                    A conta é sempre por dia da semana — nunca por dia do número
                    do mês.
                  </span>
                </label>
              ) : null}

              <Campo
                etiqueta="Repetir até"
                type="date"
                value={dataFim}
                min={data}
                onChange={(evento) => setDataFim(evento.target.value)}
              />

              {diasDaSemana.length > 0 ? (
                <p
                  aria-live="polite"
                  className="rounded-lg border border-border bg-bg-primary p-3 text-sm text-text-primary"
                >
                  {serieporExtenso({
                    diasDaSemana,
                    frequencia,
                    semanaDoMes: frequencia === "MENSAL" ? semanaDoMes : null,
                    dataInicio: data,
                    dataFim,
                  })}
                  , das {inicio} às {fim}.
                </p>
              ) : (
                <p className="text-sm text-text-secondary">
                  Escolha pelo menos um dia da semana.
                </p>
              )}

              {dataFim && dataFim < data ? (
                <p className="text-sm font-medium text-destructive">
                  A data final precisa ser depois da inicial.
                </p>
              ) : null}

              <p className="text-sm text-text-secondary">
                Datas que caírem em dia fechado ou em horário já ocupado são
                puladas — no fim você vê a lista do que entrou e do que ficou de
                fora.
              </p>
            </>
          ) : null}
        </div>

        {fim <= inicio ? (
          <p className="text-sm font-medium text-destructive">
            O término precisa ser depois do início.
          </p>
        ) : null}

        {erro ? <AvisoDeErro mensagem={erro} /> : null}

        <div className="flex flex-wrap gap-2">
          <Botao type="submit" largura="conteudo" disabled={enviando || invalido}>
            {enviando
              ? "Lançando…"
              : repetir
                ? "Lançar série"
                : "Lançar reserva"}
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
