"use client";

import type { ReactNode } from "react";

import { AMARELO } from "@/lib/marca";

/**
 * OS GRAFICOS DO RELATORIO, feitos em SVG e CSS.
 *
 * Sem biblioteca de graficos de proposito: sao formas simples, ficam
 * exatamente nas cores da marca e nao acrescentam peso nem dependencia nova
 * ao painel (a stack do CLAUDE.md nao tem nenhuma).
 *
 * TODO grafico aqui tambem diz o numero POR ESCRITO, ao lado da barra ou da
 * linha. Quem nao enxerga bem, quem esta no sol batendo na tela do tablet e
 * quem usa leitor de tela continuam conseguindo ler o relatorio — nenhuma
 * informacao depende so do desenho.
 */

export function Cartao({
  titulo,
  apoio,
  children,
  largo = false,
}: {
  titulo: string;
  apoio?: string;
  children: ReactNode;
  /** Ocupa a linha inteira no tablet. Para o grafico do tempo. */
  largo?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border border-border bg-bg-primary p-4 sm:p-5 ${
        largo ? "lg:col-span-2" : ""
      }`}
    >
      <h2 className="text-base font-bold text-text-primary">{titulo}</h2>
      {apoio ? <p className="mt-0.5 text-sm text-text-secondary">{apoio}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function SemDados() {
  return (
    <p className="rounded-lg border border-border bg-bg-secondary p-4 text-center text-sm text-text-secondary">
      Nenhuma reserva neste período.
    </p>
  );
}

// -----------------------------------------------------------------------------

export type Barra = { rotulo: string; total: number; cor?: string };

/**
 * Barras HORIZONTAIS.
 *
 * Horizontal, e nao vertical, porque os rotulos sao palavras ("Segunda",
 * "Sala de Reunião", "Área da Saúde"): em pé elas ficariam deitadas ou
 * cortadas, principalmente no tablet.
 */
export function BarrasHorizontais({
  barras,
  vazioQuandoZero = false,
}: {
  barras: Barra[];
  /** Esconde as linhas com zero. Util em listas longas. */
  vazioQuandoZero?: boolean;
}) {
  const visiveis = vazioQuandoZero ? barras.filter((barra) => barra.total > 0) : barras;
  const maior = Math.max(...visiveis.map((barra) => barra.total), 1);

  if (visiveis.length === 0) {
    return <SemDados />;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {visiveis.map((barra) => (
        <li key={barra.rotulo} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-text-secondary sm:w-36">
            {barra.rotulo}
          </span>

          <span className="flex h-6 flex-1 items-center rounded bg-bg-secondary">
            <span
              className="h-full rounded"
              style={{
                width: `${Math.max((barra.total / maior) * 100, barra.total > 0 ? 4 : 0)}%`,
                backgroundColor: barra.cor ?? AMARELO,
              }}
            />
          </span>

          <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-text-primary">
            {barra.total}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Barras em pe, para os horarios — o rotulo e curto ("09h"). */
export function BarrasVerticais({ barras }: { barras: Barra[] }) {
  const maior = Math.max(...barras.map((barra) => barra.total), 1);

  if (barras.length === 0) {
    return <SemDados />;
  }

  return (
    <ul className="flex items-end gap-1.5 overflow-x-auto pb-1">
      {barras.map((barra) => (
        <li
          key={barra.rotulo}
          className="flex min-w-9 flex-1 flex-col items-center gap-1"
          title={`${barra.rotulo}: ${barra.total}`}
        >
          <span className="text-xs font-semibold tabular-nums text-text-primary">
            {barra.total}
          </span>
          <span
            className="w-full rounded-t"
            style={{
              height: `${Math.max((barra.total / maior) * 96, 4)}px`,
              backgroundColor: AMARELO,
            }}
          />
          <span className="text-xs whitespace-nowrap text-text-secondary">
            {barra.rotulo}
          </span>
        </li>
      ))}
    </ul>
  );
}

// -----------------------------------------------------------------------------

export type Ponto = { data: string; total: number };

/**
 * A evolucao ao longo do tempo, em area preenchida.
 *
 * Desenhada com um "viewBox" e sem largura fixa: o SVG estica junto com o
 * cartao, entao serve do celular ao tablet sem calculo de tamanho em
 * JavaScript.
 */
export function GraficoDoTempo({ pontos }: { pontos: Ponto[] }) {
  if (pontos.length === 0) {
    return <SemDados />;
  }

  const largura = 100;
  const altura = 34;
  const maior = Math.max(...pontos.map((ponto) => ponto.total), 1);
  const passo = pontos.length > 1 ? largura / (pontos.length - 1) : 0;

  const coordenadas = pontos.map((ponto, indice) => ({
    x: pontos.length > 1 ? indice * passo : largura / 2,
    y: altura - (ponto.total / maior) * altura,
  }));

  const linha = coordenadas
    .map((posicao, indice) => `${indice === 0 ? "M" : "L"} ${posicao.x} ${posicao.y}`)
    .join(" ");

  const area = `${linha} L ${coordenadas.at(-1)!.x} ${altura} L ${coordenadas[0]!.x} ${altura} Z`;

  const total = pontos.reduce((soma, ponto) => soma + ponto.total, 0);
  const pico = pontos.reduce((maiorAte, ponto) =>
    ponto.total > maiorAte.total ? ponto : maiorAte,
  );

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${largura} ${altura}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label={`Evolução das reservas: ${total} no período, com pico de ${pico.total} em ${diaEMes(pico.data)}.`}
      >
        <path d={area} fill={AMARELO} fillOpacity="0.35" />
        <path
          d={linha}
          fill="none"
          stroke="#000000"
          strokeWidth="0.6"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex justify-between text-xs text-text-secondary">
        <span>{diaEMes(pontos[0]!.data)}</span>
        {/* O pico escrito por extenso: o desenho sozinho nao diz o numero. */}
        <span className="font-medium text-text-primary">
          Pico: {pico.total} em {diaEMes(pico.data)}
        </span>
        <span>{diaEMes(pontos.at(-1)!.data)}</span>
      </div>
    </div>
  );
}

/** "2026-11-02" -> "02/11". */
export function diaEMes(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}
