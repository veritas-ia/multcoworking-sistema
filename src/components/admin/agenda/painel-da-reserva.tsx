"use client";

import { useEffect, useState } from "react";

import { mensagemDoErro } from "@/components/reserva/api";
import {
  blocosEntre,
  dataPorExtenso,
  duracaoPorExtenso,
  emReais,
} from "@/components/reserva/datas";
import type { Sala } from "@/components/reserva/tipos";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { formatarEnquantoDigita } from "@/lib/telefone";
import { cn } from "@/lib/utils";

import {
  buscarReserva,
  cancelarComoAdmin,
  editarCadastroDaReserva,
  reagendarComoAdmin,
} from "./api";
import { rotuloDoStatus } from "./cores";
import { Historico } from "./historico";
import type { ItemDaAgenda, ReservaDetalhada } from "./tipos";

/** Blocos oferecidos no reagendamento pela recepcao. Faixa larga de proposito:
 *  a recepcao pode lancar fora do horario comum. O servidor da a palavra final. */
const BLOCOS = blocosEntre("06:00", "23:00");

type Modo = "detalhe" | "editar" | "reagendar";

export function PainelDaReserva({
  item,
  salas,
  aoFechar,
  aoMudarAgenda,
}: {
  item: ItemDaAgenda;
  salas: Sala[];
  aoFechar: () => void;
  aoMudarAgenda: () => void;
}) {
  if (item.tipo === "BLOQUEIO") {
    return (
      <Gaveta titulo="Bloqueio" aoFechar={aoFechar}>
        <dl className="flex flex-col gap-3">
          <Linha rotulo="Sala" valor={item.sala} />
          <Linha rotulo="Dia" valor={dataPorExtenso(item.data)} />
          <Linha rotulo="Horário" valor={`${item.inicio} às ${item.fim}`} />
          <Linha rotulo="Motivo" valor={item.motivo ?? "sem motivo registrado"} />
        </dl>
        <p className="mt-4 rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
          Criar e apagar bloqueios chega na próxima fase. Por enquanto a agenda
          apenas mostra os que existirem.
        </p>
      </Gaveta>
    );
  }

  return (
    <DetalheDaReserva
      reservaId={item.id}
      salas={salas}
      aoFechar={aoFechar}
      aoMudarAgenda={aoMudarAgenda}
    />
  );
}

function DetalheDaReserva({
  reservaId,
  salas,
  aoFechar,
  aoMudarAgenda,
}: {
  reservaId: string;
  salas: Sala[];
  aoFechar: () => void;
  aoMudarAgenda: () => void;
}) {
  const [reserva, setReserva] = useState<ReservaDetalhada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [modo, setModo] = useState<Modo>("detalhe");
  const [enviando, setEnviando] = useState(false);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  useEffect(() => {
    const controle = new AbortController();
    setReserva(null);
    setErro(null);

    buscarReserva(reservaId, controle.signal)
      .then((dados) => {
        if (!controle.signal.aborted) {
          setReserva(dados);
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErro(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, [reservaId, tentativa]);

  function recarregar(): void {
    setTentativa((numero) => numero + 1);
    aoMudarAgenda();
  }

  if (erro) {
    return (
      <Gaveta titulo="Reserva" aoFechar={aoFechar}>
        <AvisoDeErro mensagem={erro} aoTentarDeNovo={() => setTentativa((n) => n + 1)} />
      </Gaveta>
    );
  }

  if (!reserva) {
    return (
      <Gaveta titulo="Reserva" aoFechar={aoFechar}>
        <Carregando texto="Abrindo a reserva…" />
      </Gaveta>
    );
  }

  const ativa = reserva.status === "CONFIRMADA" || reserva.status === "REAGENDADA";

  async function cancelar(): Promise<void> {
    setEnviando(true);
    setErroDaAcao(null);
    try {
      await cancelarComoAdmin(reservaId);
      setConfirmandoCancelamento(false);
      recarregar();
    } catch (problema: unknown) {
      setErroDaAcao(mensagemDoErro(problema));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Gaveta titulo="Reserva" aoFechar={aoFechar}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2 py-1 text-xs font-semibold",
              ativa ? "bg-brand text-black" : "bg-bg-secondary text-text-secondary",
            )}
          >
            {rotuloDoStatus(reserva.status)}
          </span>
          <span className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary">
            {reserva.origem === "ADMIN" ? "Lançada na recepção" : "Feita pelo site"}
          </span>
        </div>

        {modo === "detalhe" ? (
          <>
            <dl className="flex flex-col gap-3">
              <Linha rotulo="Cliente" valor={reserva.nomeCliente} />
              <Linha rotulo="Telefone" valor={reserva.telefone} destaque />
              <Linha rotulo="Sala" valor={reserva.sala} />
              <Linha rotulo="Dia" valor={dataPorExtenso(reserva.data)} />
              <Linha rotulo="Horário" valor={`${reserva.inicio} às ${reserva.fim}`} />
              <Linha
                rotulo="Duração"
                valor={duracaoPorExtenso(reserva.duracaoMinutos)}
              />
              <Linha
                rotulo="Valor"
                valor={emReais(Math.round(Number(reserva.valor) * 100))}
              />
            </dl>

            {erroDaAcao ? <AvisoDeErro mensagem={erroDaAcao} /> : null}

            {ativa ? (
              confirmandoCancelamento ? (
                <div className="flex flex-col gap-3 rounded-lg border border-destructive bg-bg-primary p-4">
                  <p className="text-sm font-medium text-text-primary">
                    Cancelar esta reserva? O horário volta para a agenda e o
                    cliente recebe um WhatsApp avisando.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Botao
                      aparencia="primario"
                      largura="conteudo"
                      disabled={enviando}
                      onClick={() => void cancelar()}
                    >
                      {enviando ? "Cancelando…" : "Sim, cancelar"}
                    </Botao>
                    <Botao
                      aparencia="secundario"
                      largura="conteudo"
                      disabled={enviando}
                      onClick={() => setConfirmandoCancelamento(false)}
                    >
                      Voltar
                    </Botao>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Botao
                    aparencia="primario"
                    largura="conteudo"
                    onClick={() => {
                      setErroDaAcao(null);
                      setModo("reagendar");
                    }}
                  >
                    Reagendar
                  </Botao>
                  <Botao
                    aparencia="secundario"
                    largura="conteudo"
                    onClick={() => {
                      setErroDaAcao(null);
                      setModo("editar");
                    }}
                  >
                    Editar cadastro
                  </Botao>
                  <Botao
                    aparencia="secundario"
                    largura="conteudo"
                    onClick={() => setConfirmandoCancelamento(true)}
                  >
                    Cancelar reserva
                  </Botao>
                </div>
              )
            ) : (
              <p className="rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
                Reserva encerrada. Não há ações disponíveis.
              </p>
            )}

            <section className="flex flex-col gap-2 border-t border-border pt-4">
              <h3 className="text-sm font-bold text-text-primary">
                Histórico de alterações
              </h3>
              <Historico linhas={reserva.historico} />
            </section>
          </>
        ) : null}

        {modo === "editar" ? (
          <FormularioDeCadastro
            reserva={reserva}
            enviando={enviando}
            erro={erroDaAcao}
            aoSalvar={async (dados) => {
              setEnviando(true);
              setErroDaAcao(null);
              try {
                await editarCadastroDaReserva(reservaId, dados);
                setModo("detalhe");
                recarregar();
              } catch (problema: unknown) {
                setErroDaAcao(mensagemDoErro(problema));
              } finally {
                setEnviando(false);
              }
            }}
            aoDesistir={() => {
              setModo("detalhe");
              setErroDaAcao(null);
            }}
          />
        ) : null}

        {modo === "reagendar" ? (
          <FormularioDeReagendamento
            reserva={reserva}
            salas={salas}
            enviando={enviando}
            erro={erroDaAcao}
            aoSalvar={async (dados) => {
              setEnviando(true);
              setErroDaAcao(null);
              try {
                await reagendarComoAdmin(reservaId, dados);
                setModo("detalhe");
                recarregar();
              } catch (problema: unknown) {
                setErroDaAcao(mensagemDoErro(problema));
              } finally {
                setEnviando(false);
              }
            }}
            aoDesistir={() => {
              setModo("detalhe");
              setErroDaAcao(null);
            }}
          />
        ) : null}
      </div>
    </Gaveta>
  );
}

// -----------------------------------------------------------------------------

function FormularioDeCadastro({
  reserva,
  enviando,
  erro,
  aoSalvar,
  aoDesistir,
}: {
  reserva: ReservaDetalhada;
  enviando: boolean;
  erro: string | null;
  aoSalvar: (dados: { nome: string; telefone: string }) => void;
  aoDesistir: () => void;
}) {
  const [nome, setNome] = useState(reserva.nomeCliente);
  const [telefone, setTelefone] = useState(
    formatarEnquantoDigita(reserva.telefone.replace("+55", "")),
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        aoSalvar({ nome, telefone });
      }}
    >
      <h3 className="text-sm font-bold text-text-primary">Corrigir cadastro</h3>
      <p className="text-sm text-text-secondary">
        Muda só o nome e o telefone. Não altera o horário e o cliente não recebe
        mensagem nenhuma.
      </p>

      <Campo
        etiqueta="Nome do cliente"
        value={nome}
        maxLength={120}
        onChange={(evento) => setNome(evento.target.value)}
      />
      <Campo
        etiqueta="Telefone (WhatsApp)"
        type="tel"
        inputMode="tel"
        value={telefone}
        onChange={(evento) => setTelefone(formatarEnquantoDigita(evento.target.value))}
      />

      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      <div className="flex flex-wrap gap-2">
        <Botao type="submit" largura="conteudo" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
        <Botao
          aparencia="secundario"
          largura="conteudo"
          disabled={enviando}
          onClick={aoDesistir}
        >
          Voltar
        </Botao>
      </div>
    </form>
  );
}

function FormularioDeReagendamento({
  reserva,
  salas,
  enviando,
  erro,
  aoSalvar,
  aoDesistir,
}: {
  reserva: ReservaDetalhada;
  salas: Sala[];
  enviando: boolean;
  erro: string | null;
  aoSalvar: (dados: {
    salaId: string;
    data: string;
    inicio: string;
    fim: string;
  }) => void;
  aoDesistir: () => void;
}) {
  const [salaId, setSalaId] = useState(reserva.salaId);
  const [data, setData] = useState(reserva.data);
  const [inicio, setInicio] = useState(reserva.inicio);
  const [fim, setFim] = useState(reserva.fim);

  const invalido = fim <= inicio;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        aoSalvar({ salaId, data, inicio, fim });
      }}
    >
      <h3 className="text-sm font-bold text-text-primary">Reagendar</h3>
      <p className="text-sm text-text-secondary">
        A recepção pode remarcar a qualquer momento, inclusive dentro das 12
        horas. O cliente recebe um WhatsApp com o horário novo.
      </p>

      <Escolha etiqueta="Sala" valor={salaId} aoMudar={setSalaId}>
        {salas.map((sala) => (
          <option key={sala.id} value={sala.id}>
            {sala.nome}
          </option>
        ))}
      </Escolha>

      <Campo
        etiqueta="Dia"
        type="date"
        value={data}
        onChange={(evento) => setData(evento.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Escolha etiqueta="Início" valor={inicio} aoMudar={setInicio}>
          {BLOCOS.map((bloco) => (
            <option key={bloco} value={bloco}>
              {bloco}
            </option>
          ))}
        </Escolha>
        <Escolha etiqueta="Término" valor={fim} aoMudar={setFim}>
          {BLOCOS.map((bloco) => (
            <option key={bloco} value={bloco}>
              {bloco}
            </option>
          ))}
        </Escolha>
      </div>

      {invalido ? (
        <p className="text-sm font-medium text-destructive">
          O término precisa ser depois do início.
        </p>
      ) : null}

      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      <div className="flex flex-wrap gap-2">
        <Botao type="submit" largura="conteudo" disabled={enviando || invalido}>
          {enviando ? "Remarcando…" : "Confirmar novo horário"}
        </Botao>
        <Botao
          aparencia="secundario"
          largura="conteudo"
          disabled={enviando}
          onClick={aoDesistir}
        >
          Voltar
        </Botao>
      </div>
    </form>
  );
}

// -----------------------------------------------------------------------------

function Escolha({
  etiqueta,
  valor,
  aoMudar,
  children,
}: {
  etiqueta: string;
  valor: string;
  aoMudar: (valor: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-primary">{etiqueta}</span>
      <select
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
      >
        {children}
      </select>
    </label>
  );
}

function Linha({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
      <dt className="text-sm text-text-secondary">{rotulo}</dt>
      <dd
        className={cn(
          "text-right text-text-primary",
          destaque ? "font-bold tabular-nums" : "font-semibold",
        )}
      >
        {valor}
      </dd>
    </div>
  );
}

/** A gaveta lateral. No tablet em pe ela ocupa a tela inteira. */
function Gaveta({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent): void => {
      if (evento.key === "Escape") {
        aoFechar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={aoFechar}
        className="flex-1 bg-black/30"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-bg-primary"
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-bg-primary px-4 py-3">
          <h2 className="text-base font-bold text-text-primary">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="flex size-11 items-center justify-center rounded-lg text-2xl text-text-primary hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <span aria-hidden>×</span>
          </button>
        </header>

        <div className="px-4 py-5">{children}</div>
      </aside>
    </div>
  );
}
