"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  buscarSessao,
  encerrarSessao,
  ErroDaApi,
  mensagemDoErro,
} from "@/components/reserva/api";
import { EtapaTelefone } from "@/components/reserva/etapa-telefone";
import { dataPorExtenso } from "@/components/reserva/datas";
import { PoliticaDeCancelamento } from "@/components/reserva/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

import { buscarMinhasReservas, cancelar, reagendar, type ListaDeReservas, type ReservaDoCliente } from "./api";
import { CartaoDeReserva } from "./cartao-de-reserva";
import { PedirCodigo } from "./pedir-codigo";
import { Reagendamento } from "./reagendamento";

type Modo =
  | { tela: "lista" }
  | { tela: "cancelar"; reserva: ReservaDoCliente }
  | { tela: "reagendar"; reserva: ReservaDoCliente };

/**
 * Area "Minhas reservas".
 *
 * Sem sessao, mostra a mesma verificacao por WhatsApp da Fase 5. Com sessao,
 * lista as reservas do telefone confirmado — e so dele: quem filtra e o
 * servidor, a partir do cookie.
 */
export function AreaDoCliente() {
  const [telefoneMascarado, setTelefoneMascarado] = useState<string | null>(null);
  const [sessaoConferida, setSessaoConferida] = useState(false);
  const [lista, setLista] = useState<ListaDeReservas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const [modo, setModo] = useState<Modo>({ tela: "lista" });
  const [enviando, setEnviando] = useState(false);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const recarregar = useCallback(() => setTentativa((numero) => numero + 1), []);

  useEffect(() => {
    const controle = new AbortController();
    setErro(null);

    buscarSessao(controle.signal)
      .then(async (sessao) => {
        if (controle.signal.aborted) {
          return;
        }

        setTelefoneMascarado(sessao.telefoneMascarado);
        setSessaoConferida(true);

        if (!sessao.identificado) {
          setLista(null);
          return;
        }

        setLista(await buscarMinhasReservas(controle.signal));
      })
      .catch((problema: unknown) => {
        if (controle.signal.aborted) {
          return;
        }
        // Sessao vencida entre uma chamada e outra: volta para a verificacao.
        if (problema instanceof ErroDaApi && problema.status === 401) {
          setTelefoneMascarado(null);
          setSessaoConferida(true);
          setLista(null);
          return;
        }
        setErro(mensagemDoErro(problema));
      });

    return () => controle.abort();
  }, [tentativa]);

  async function sair(): Promise<void> {
    try {
      await encerrarSessao();
    } catch {
      // Mesmo se o servidor falhar, a tela precisa sair.
    }
    setTelefoneMascarado(null);
    setLista(null);
    setModo({ tela: "lista" });
    setRecado(null);
  }

  function tratarFalha(problema: unknown): void {
    if (problema instanceof ErroDaApi && problema.status === 401 && problema.codigo === "SEM_SESSAO") {
      setTelefoneMascarado(null);
      setLista(null);
      setModo({ tela: "lista" });
      return;
    }
    setErroDaAcao(mensagemDoErro(problema));
  }

  async function confirmarCancelamento(reservaId: string, codigo: string): Promise<void> {
    setEnviando(true);
    setErroDaAcao(null);
    try {
      await cancelar(reservaId, codigo);
      setModo({ tela: "lista" });
      setRecado("Reserva cancelada. O horário já voltou para a agenda.");
      recarregar();
    } catch (problema: unknown) {
      tratarFalha(problema);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarReagendamento(
    reservaId: string,
    escolha: { codigo: string; salaId: string; data: string; inicio: string; fim: string },
  ): Promise<void> {
    setEnviando(true);
    setErroDaAcao(null);
    try {
      const nova = await reagendar(reservaId, escolha);
      setModo({ tela: "lista" });
      setRecado(
        `Reserva remarcada para ${dataPorExtenso(nova.data)}, ${nova.inicio} às ${nova.fim}, na ${nova.sala}. Valor estimado: R$ ${nova.valorEstimado.replace(".", ",")}.`,
      );
      recarregar();
    } catch (problema: unknown) {
      tratarFalha(problema);
    } finally {
      setEnviando(false);
    }
  }

  // ---------------------------------------------------------------------------

  if (erro) {
    return (
      <Moldura>
        <AvisoDeErro mensagem={erro} aoTentarDeNovo={recarregar} />
      </Moldura>
    );
  }

  if (!sessaoConferida) {
    return (
      <Moldura>
        <Carregando texto="Abrindo suas reservas…" />
      </Moldura>
    );
  }

  // Sem sessao: mesma verificacao por WhatsApp da Fase 5.
  if (!telefoneMascarado) {
    return (
      <Moldura>
        <EtapaTelefone
          aoConfirmar={(mascarado) => {
            setTelefoneMascarado(mascarado);
            recarregar();
          }}
        />
        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link href="/" className="underline underline-offset-4 hover:text-black">
            Voltar e fazer uma reserva
          </Link>
        </p>
      </Moldura>
    );
  }

  if (!lista) {
    return (
      <Moldura>
        <Carregando texto="Buscando suas reservas…" />
      </Moldura>
    );
  }

  if (modo.tela === "cancelar") {
    return (
      <Moldura>
        <PedirCodigo
          titulo="Cancelar esta reserva"
          descricao={`${modo.reserva.sala}, ${dataPorExtenso(modo.reserva.data)}, ${modo.reserva.inicio} às ${modo.reserva.fim}.`}
          rotuloDoBotao="Confirmar cancelamento"
          telefoneMascarado={telefoneMascarado}
          enviando={enviando}
          erro={erroDaAcao}
          aoConfirmar={(codigo) => void confirmarCancelamento(modo.reserva.id, codigo)}
          aoDesistir={() => {
            setModo({ tela: "lista" });
            setErroDaAcao(null);
          }}
        />
      </Moldura>
    );
  }

  if (modo.tela === "reagendar") {
    return (
      <Moldura>
        <Reagendamento
          reserva={modo.reserva}
          telefoneMascarado={telefoneMascarado}
          janelaHoras={lista.janelaCancelamentoHoras}
          horaInicioNoturno={lista.horaInicioNoturno}
          enviando={enviando}
          erro={erroDaAcao}
          aoConfirmar={(escolha) => void confirmarReagendamento(modo.reserva.id, escolha)}
          aoDesistir={() => {
            setModo({ tela: "lista" });
            setErroDaAcao(null);
          }}
        />
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            Você está identificado como{" "}
            <strong className="font-semibold text-text-primary">
              {telefoneMascarado}
            </strong>
          </p>
          <Botao aparencia="secundario" largura="conteudo" onClick={() => void sair()}>
            Sair
          </Botao>
        </div>

        <div role="status" aria-live="polite">
          {recado ? (
            <p className="rounded-lg border border-border bg-brand/20 p-4 text-sm font-medium text-text-primary">
              {recado}
            </p>
          ) : null}
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold tracking-tight text-text-primary">
            Próximas reservas
          </h2>

          {lista.futuras.length === 0 ? (
            <AvisoVazio>
              Você não tem nenhuma reserva marcada.{" "}
              <Link href="/" className="underline underline-offset-4">
                Fazer uma reserva
              </Link>
              .
            </AvisoVazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {lista.futuras.map((reserva) => (
                <CartaoDeReserva
                  key={reserva.id}
                  reserva={reserva}
                  janelaHoras={lista.janelaCancelamentoHoras}
                  encerrada={false}
                  aoCancelar={() => {
                    setErroDaAcao(null);
                    setRecado(null);
                    setModo({ tela: "cancelar", reserva });
                  }}
                  aoReagendar={() => {
                    setErroDaAcao(null);
                    setRecado(null);
                    setModo({ tela: "reagendar", reserva });
                  }}
                />
              ))}
            </ul>
          )}
        </section>

        <PoliticaDeCancelamento texto={lista.textos.politicaCancelamento} />

        {lista.historico.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold tracking-tight text-text-primary">
              Histórico
            </h2>
            <ul className="flex flex-col gap-3">
              {lista.historico.map((reserva) => (
                <CartaoDeReserva
                  key={reserva.id}
                  reserva={reserva}
                  janelaHoras={lista.janelaCancelamentoHoras}
                  encerrada
                  aoCancelar={() => undefined}
                  aoReagendar={() => undefined}
                />
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-center text-sm text-text-secondary">
          <Link href="/" className="underline underline-offset-4 hover:text-black">
            Fazer uma nova reserva
          </Link>
        </p>
      </div>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-secondary">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-primary">
        <div className="mx-auto w-full max-w-lg px-4 py-4">
          <h1 className="text-base font-bold text-text-primary">Minhas reservas</h1>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
