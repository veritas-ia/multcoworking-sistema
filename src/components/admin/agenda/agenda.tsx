"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buscarAgenda, buscarSalas, mensagemDoErro } from "@/components/reserva/api";
import {
  dataPorExtenso,
  mesDe,
  nomeDoMes,
  partesDe,
  semanaDe,
  somarDias,
  somarMeses,
} from "@/components/reserva/datas";
import type { Agenda as RegrasDaAgenda, Sala } from "@/components/reserva/tipos";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { cn } from "@/lib/utils";

import { buscarAgendaAdmin, type RelatorioDaSerie } from "./api";
import { NovaReserva } from "./nova-reserva";
import { NovoBloqueio } from "./novo-bloqueio";
import { RelatorioDaSerieCriada } from "./relatorio-da-serie";
import { PainelDaReserva } from "./painel-da-reserva";
import { VISOES, type ItemDaAgenda, type Visao } from "./tipos";
import { VisaoDiaria } from "./visao-diaria";
import { VisaoMensal } from "./visao-mensal";
import { VisaoSemanal } from "./visao-semanal";

/**
 * Agenda do painel.
 *
 * O estado (visao, data, sala) vive na URL. Assim o botao "voltar" do
 * navegador funciona, a recepcao pode deixar um dia nos favoritos e o caminho
 * mes -> dia -> reserva nao perde o lugar quando a pessoa volta atras.
 */
export function AgendaDoPainel({ hoje }: { hoje: string }) {
  const router = useRouter();
  const parametros = useSearchParams();

  const visao = (parametros.get("visao") as Visao | null) ?? "dia";
  const data = parametros.get("data") ?? hoje;
  const salaId = parametros.get("sala") ?? "";

  const [salas, setSalas] = useState<Sala[] | null>(null);
  const [regras, setRegras] = useState<RegrasDaAgenda | null>(null);
  const [itens, setItens] = useState<ItemDaAgenda[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  const [itemAberto, setItemAberto] = useState<ItemDaAgenda | null>(null);
  const [criandoReserva, setCriandoReserva] = useState(false);
  const [criandoBloqueio, setCriandoBloqueio] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioDaSerie | null>(null);

  const periodo = useMemo(() => faixaDaVisao(visao, data), [visao, data]);

  const irPara = useCallback(
    (mudancas: { visao?: Visao; data?: string; sala?: string | null }) => {
      const busca = new URLSearchParams(parametros.toString());
      if (mudancas.visao) {
        busca.set("visao", mudancas.visao);
      }
      if (mudancas.data) {
        busca.set("data", mudancas.data);
      }
      if (mudancas.sala !== undefined) {
        if (mudancas.sala) {
          busca.set("sala", mudancas.sala);
        } else {
          busca.delete("sala");
        }
      }
      router.push(`/admin/agenda?${busca}`);
    },
    [parametros, router],
  );

  // --- carga das salas e das regras (uma vez) --------------------------------
  useEffect(() => {
    const controle = new AbortController();

    Promise.all([buscarSalas(controle.signal), buscarAgenda(controle.signal)])
      .then(([resultado, dadosDasRegras]) => {
        if (!controle.signal.aborted) {
          setSalas(resultado.salas);
          setRegras(dadosDasRegras);
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErro(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, []);

  // --- carga dos itens do periodo -------------------------------------------
  useEffect(() => {
    const controle = new AbortController();
    setItens(null);
    setErro(null);

    buscarAgendaAdmin(
      { de: periodo.de, ate: periodo.ate, salaId: salaId || undefined },
      controle.signal,
    )
      .then((resposta) => {
        if (!controle.signal.aborted) {
          setItens(resposta.itens);
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErro(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, [periodo.de, periodo.ate, salaId, versao]);

  const recarregar = useCallback(() => setVersao((numero) => numero + 1), []);

  if (erro && !salas) {
    return <AvisoDeErro mensagem={erro} aoTentarDeNovo={recarregar} />;
  }

  if (!salas || !regras) {
    return <Carregando texto="Abrindo a agenda…" />;
  }

  const salasVisiveis = salaId ? salas.filter((sala) => sala.id === salaId) : salas;

  return (
    <div className="flex flex-col gap-5">
      {/* --- barra de controles --- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Como ver a agenda"
            className="inline-flex rounded-lg border border-border bg-bg-primary p-1"
          >
            {VISOES.map((opcao) => (
              <button
                key={opcao.chave}
                type="button"
                role="tab"
                aria-selected={visao === opcao.chave}
                onClick={() => irPara({ visao: opcao.chave })}
                className={cn(
                  "min-h-11 rounded-md px-4 text-sm font-semibold",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                  visao === opcao.chave
                    ? "bg-brand text-black"
                    : "text-text-secondary hover:text-text-primary",
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Botao
              aparencia="primario"
              largura="conteudo"
              onClick={() => setCriandoReserva(true)}
            >
              + Nova reserva
            </Botao>
            <Botao
              aparencia="secundario"
              largura="conteudo"
              onClick={() => setCriandoBloqueio(true)}
            >
              + Bloqueio
            </Botao>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Botao
            aparencia="secundario"
            largura="conteudo"
            aria-label="Período anterior"
            onClick={() => irPara({ data: andar(visao, data, -1) })}
            className="min-h-11 px-4 text-xl leading-none"
          >
            <span aria-hidden>‹</span>
          </Botao>

          <p
            aria-live="polite"
            className="min-w-48 flex-1 text-center text-sm font-bold text-text-primary sm:text-base"
          >
            {rotuloDoPeriodo(visao, data)}
          </p>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            aria-label="Próximo período"
            onClick={() => irPara({ data: andar(visao, data, 1) })}
            className="min-h-11 px-4 text-xl leading-none"
          >
            <span aria-hidden>›</span>
          </Botao>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            onClick={() => irPara({ data: hoje })}
            className="min-h-11"
          >
            Hoje
          </Botao>

          <label className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Sala</span>
            <select
              value={salaId}
              onChange={(evento) => irPara({ sala: evento.target.value || null })}
              className="min-h-11 rounded-lg border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
            >
              <option value="">Todas</option>
              {salas.map((sala) => (
                <option key={sala.id} value={sala.id}>
                  {sala.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* --- conteudo --- */}
      <div role="status" aria-live="polite">
        {recado ? (
          <p className="rounded-lg border border-border bg-brand/20 p-3 text-sm font-medium text-text-primary">
            {recado}
          </p>
        ) : null}
      </div>

      {erro ? <AvisoDeErro mensagem={erro} aoTentarDeNovo={recarregar} /> : null}

      {itens === null ? (
        <Carregando texto="Buscando as reservas…" />
      ) : (
        <>
          {visao === "dia" ? (
            <VisaoDiaria
              data={data}
              salas={salasVisiveis}
              agenda={regras}
              itens={itens}
              aoAbrirItem={setItemAberto}
            />
          ) : null}

          {visao === "semana" ? (
            <VisaoSemanal
              data={data}
              salas={salasVisiveis}
              agenda={regras}
              itens={itens}
              aoAbrirDia={(dia, sala) => irPara({ visao: "dia", data: dia, sala })}
            />
          ) : null}

          {visao === "mes" ? (
            <VisaoMensal
              mes={mesDe(data)}
              hoje={hoje}
              agenda={regras}
              itens={itens}
              aoAbrirDia={(dia) => irPara({ visao: "dia", data: dia })}
            />
          ) : null}
        </>
      )}

      {/* --- gaveta e formulario --- */}
      {itemAberto ? (
        <PainelDaReserva
          item={itemAberto}
          salas={salas}
          aoFechar={() => setItemAberto(null)}
          aoMudarAgenda={recarregar}
        />
      ) : null}

      {criandoReserva ? (
        <NovaReserva
          salas={salas}
          dataInicial={visao === "mes" ? `${mesDe(data)}-01` : data}
          salaInicial={salaId || undefined}
          aoCriar={() => {
            setCriandoReserva(false);
            setRecado("Reserva lançada. O cliente recebeu a confirmação no WhatsApp.");
            recarregar();
          }}
          aoCriarSerie={(dados) => {
            setCriandoReserva(false);
            setRelatorio(dados);
            recarregar();
          }}
          aoFechar={() => setCriandoReserva(false)}
        />
      ) : null}

      {criandoBloqueio ? (
        <NovoBloqueio
          salas={salas}
          dataInicial={visao === "mes" ? `${mesDe(data)}-01` : data}
          salaInicial={salaId || undefined}
          aoCriar={(quantas) => {
            setCriandoBloqueio(false);
            setRecado(
              quantas === 1
                ? "Bloqueio criado."
                : `Bloqueio criado em ${quantas} salas.`,
            );
            recarregar();
          }}
          aoFechar={() => setCriandoBloqueio(false)}
        />
      ) : null}

      {relatorio ? (
        <RelatorioDaSerieCriada
          relatorio={relatorio}
          aoFechar={() => setRelatorio(null)}
        />
      ) : null}
    </div>
  );
}

// -----------------------------------------------------------------------------

function faixaDaVisao(visao: Visao, data: string): { de: string; ate: string } {
  if (visao === "dia") {
    return { de: data, ate: data };
  }
  if (visao === "semana") {
    const semana = semanaDe(data);
    return { de: semana[0] ?? data, ate: semana[6] ?? data };
  }
  const mes = mesDe(data);
  const { ano, mes: numero } = partesDe(`${mes}-01`);
  const ultimo = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

function andar(visao: Visao, data: string, passos: number): string {
  if (visao === "dia") {
    return somarDias(data, passos);
  }
  if (visao === "semana") {
    return somarDias(data, passos * 7);
  }
  return `${somarMeses(mesDe(data), passos)}-01`;
}

function rotuloDoPeriodo(visao: Visao, data: string): string {
  if (visao === "dia") {
    return dataPorExtenso(data);
  }
  if (visao === "semana") {
    const semana = semanaDe(data);
    const primeiro = partesDe(semana[0] ?? data);
    const ultimo = partesDe(semana[6] ?? data);
    return `${primeiro.dia}/${String(primeiro.mes).padStart(2, "0")} a ${ultimo.dia}/${String(ultimo.mes).padStart(2, "0")}`;
  }
  return nomeDoMes(mesDe(data));
}
