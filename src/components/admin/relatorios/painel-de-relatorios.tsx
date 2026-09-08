"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

import { buscarRelatorio, type Comparacao, type Periodo } from "./api";
import {
  BarrasHorizontais,
  BarrasVerticais,
  Cartao,
  GraficoDoTempo,
  diaEMes,
} from "./graficos";
import { ATALHOS, porExtensoCurto } from "./periodos";

/**
 * O DASHBOARD DE RELATORIOS.
 *
 * So consulta: nao existe nenhum botao aqui que altere reserva, sala ou
 * configuracao. Se um dia aparecer, esta no lugar errado.
 *
 * Sem faturamento, por decisao do dono — e o servidor tambem nao manda valor
 * nenhum, entao nao ha o que esconder aqui.
 */
export function PainelDeRelatorios({ hoje }: { hoje: string }) {
  const [periodo, setPeriodo] = useState<Periodo>(() => ATALHOS[0]!.calcular(hoje));
  const [atalhoAtivo, setAtalhoAtivo] = useState<string | null>(ATALHOS[0]!.id);
  const [dados, setDados] = useState<Comparacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async (alvo: Periodo, sinal?: AbortSignal) => {
    setCarregando(true);
    setErro(null);

    try {
      setDados(await buscarRelatorio(alvo, null, sinal));
    } catch (falha) {
      if (sinal?.aborted) {
        return;
      }
      setErro(
        falha instanceof ErroDaApi ? falha.message : "Não foi possível carregar o relatório.",
      );
    } finally {
      if (!sinal?.aborted) {
        setCarregando(false);
      }
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(periodo, controle.signal);
    return () => controle.abort();
  }, [carregar, periodo]);

  return (
    <div className="flex flex-col gap-4">
      <Filtros
        periodo={periodo}
        atalhoAtivo={atalhoAtivo}
        hoje={hoje}
        aoEscolherAtalho={(atalho) => {
          setAtalhoAtivo(atalho.id);
          setPeriodo(atalho.calcular(hoje));
        }}
        aoEscolherPeriodo={(novo) => {
          setAtalhoAtivo(null);
          setPeriodo(novo);
        }}
      />

      {erro ? (
        <AvisoDeErro mensagem={erro} aoTentarDeNovo={() => void carregar(periodo)} />
      ) : null}

      {carregando && !dados ? <Carregando texto="Somando as reservas…" /> : null}

      {dados ? <Numeros dados={dados} carregando={carregando} /> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------

function Filtros({
  periodo,
  atalhoAtivo,
  hoje,
  aoEscolherAtalho,
  aoEscolherPeriodo,
}: {
  periodo: Periodo;
  atalhoAtivo: string | null;
  hoje: string;
  aoEscolherAtalho: (atalho: (typeof ATALHOS)[number]) => void;
  aoEscolherPeriodo: (periodo: Periodo) => void;
}) {
  const [de, setDe] = useState(periodo.de);
  const [ate, setAte] = useState(periodo.ate);
  const [erro, setErro] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-border bg-bg-primary p-4">
      <h2 className="text-sm font-bold text-text-primary">Período</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {ATALHOS.map((atalho) => (
          <button
            key={atalho.id}
            type="button"
            aria-pressed={atalhoAtivo === atalho.id}
            onClick={() => {
              const novo = atalho.calcular(hoje);
              setDe(novo.de);
              setAte(novo.ate);
              setErro(null);
              aoEscolherAtalho(atalho);
            }}
            className={`min-h-11 rounded-lg border px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
              atalhoAtivo === atalho.id
                ? "border-black bg-brand text-brand-foreground"
                : "border-border bg-bg-primary text-text-secondary hover:border-black hover:text-text-primary"
            }`}
          >
            {atalho.rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold text-text-primary">De</span>
          <input
            type="date"
            value={de}
            onChange={(evento) => setDe(evento.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
          />
        </label>

        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-semibold text-text-primary">Até</span>
          <input
            type="date"
            value={ate}
            onChange={(evento) => setAte(evento.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
          />
        </label>

        <Botao
          largura="conteudo"
          onClick={() => {
            if (de === "" || ate === "") {
              setErro("Preencha as duas datas.");
              return;
            }
            if (ate < de) {
              setErro("A data final precisa ser igual ou depois da inicial.");
              return;
            }
            setErro(null);
            aoEscolherPeriodo({ de, ate });
          }}
        >
          Ver período
        </Botao>
      </div>

      {erro ? (
        <p className="mt-2 text-sm font-medium text-destructive">{erro}</p>
      ) : null}
    </section>
  );
}

// -----------------------------------------------------------------------------

function Numeros({ dados, carregando }: { dados: Comparacao; carregando: boolean }) {
  const { atual, anterior, variacaoPercentual, variacaoAbsoluta } = dados;

  return (
    <div className={carregando ? "opacity-60 transition-opacity" : ""}>
      <div className="grid gap-4 lg:grid-cols-2">
        <Cartao
          titulo="Total de reservas"
          apoio={`${porExtensoCurto(atual.periodo.de)} a ${porExtensoCurto(atual.periodo.ate)}`}
          largo
        >
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <span className="text-4xl font-bold tabular-nums text-text-primary">
              {atual.total}
            </span>

            <div className="flex flex-col text-sm">
              <span className="font-semibold text-text-primary">
                {textoDaVariacao(variacaoAbsoluta, variacaoPercentual)}
              </span>
              <span className="text-text-secondary">
                Período anterior ({porExtensoCurto(anterior.periodo.de)} a{" "}
                {porExtensoCurto(anterior.periodo.ate)}): {anterior.total}
              </span>
            </div>
          </div>
        </Cartao>

        <Cartao
          titulo="Evolução no período"
          apoio="Uma marca por dia. Dias sem reserva aparecem como zero."
          largo
        >
          <GraficoDoTempo pontos={atual.porDia} />
        </Cartao>

        <Cartao titulo="Dias da semana mais reservados">
          <BarrasHorizontais barras={atual.porDiaDaSemana} />
        </Cartao>

        <Cartao titulo="Reservas por sala" apoio="Da mais usada para a menos.">
          <BarrasHorizontais barras={atual.porSala} />
        </Cartao>

        <Cartao titulo="Horários mais procurados" apoio="Pela hora de início.">
          <BarrasVerticais barras={atual.porHora} />
        </Cartao>

        <Cartao titulo="Situação das reservas">
          <BarrasHorizontais barras={atual.porStatus} />
        </Cartao>

        <Cartao
          titulo="Área de atuação"
          apoio="Reservas anteriores a este campo aparecem como “Não informado”."
          largo
        >
          <BarrasHorizontais barras={atual.porProfissao} />
        </Cartao>
      </div>

      <p className="mt-4 text-center text-sm text-text-secondary">
        Uma reserva entra no período quando o horário dela cai ali, em qualquer
        situação. Primeiro dia: {diaEMes(atual.periodo.de)}.
      </p>
    </div>
  );
}

/** "12 a mais que o período anterior (+40%)" — ou o recado de sem base. */
function textoDaVariacao(absoluta: number, percentual: number | null): string {
  if (percentual === null) {
    return absoluta === 0
      ? "Sem reservas nos dois períodos"
      : `${absoluta} reserva${absoluta === 1 ? "" : "s"} — o período anterior não teve nenhuma`;
  }

  if (absoluta === 0) {
    return "Igual ao período anterior";
  }

  const sinal = absoluta > 0 ? "+" : "−";
  const quantas = Math.abs(absoluta);

  return `${sinal}${quantas} reserva${quantas === 1 ? "" : "s"} (${sinal}${Math.abs(percentual)}%) sobre o período anterior`;
}
