"use client";

import { useCallback, useEffect, useState } from "react";

import { Secao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import { buscarPainel } from "./api";
import { emReais } from "./pecas";
import type { FatiaDoPainel, PainelFinanceiro } from "./tipos";

/** "2026-12" -> "dezembro de 2026". */
function mesPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);

  return new Date(Date.UTC(ano!, mes! - 1, 1)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** "2026-12" -> "dez". Para os rótulos do gráfico, onde não cabe o nome todo. */
function mesCurto(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);

  return new Date(Date.UTC(ano!, mes! - 1, 1)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "short",
  });
}

function somarMeses(competencia: string, quantos: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1 + quantos, 1));

  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A VARIAÇÃO contra o mês anterior.
 *
 * NULA quando o mês anterior foi zero, e não "+100%": sem base de comparação,
 * uma porcentagem não significa nada — e a conta daria Infinity. A tela
 * escreve "sem comparação" em vez de inventar um número.
 */
function variacao(agora: number, antes: number): number | null {
  if (antes === 0) {
    return null;
  }

  return Math.round(((agora - antes) / Math.abs(antes)) * 1000) / 10;
}

/**
 * O PAINEL DO FINANCEIRO — Fase 16, Parte E.
 *
 * SÓ LEITURA, mesma regra do dashboard de relatórios: nada aqui altera
 * lançamento, contrato ou configuração.
 *
 * O QUE ELE NÃO MOSTRA, e a tela diz isso por escrito:
 *
 *  - **o saldo do banco.** O sistema não conhece o dinheiro que já estava na
 *    conta antes dele existir. Um "saldo acumulado" somaria só o que foi
 *    lançado aqui e apareceria como se fosse o saldo de verdade — errado, e do
 *    jeito que ninguém desconfia;
 *  - **DRE.** Decisão do dono. O que está aqui é CAIXA — entrou menos saiu —, e
 *    é por isso que o número se chama "resultado" e não "lucro": lucro contábil
 *    tem depreciação, provisão e competência, que o sistema não tem.
 *
 * OS GRÁFICOS SÃO SVG E CSS, sem biblioteca — a stack do projeto não tem
 * nenhuma e as formas são simples. E **todo gráfico escreve o número ao lado**:
 * nenhuma informação depende só do desenho. Mesma regra dos relatórios.
 */
export function AbaDoPainel({ hoje }: { hoje: string }) {
  const [competencia, setCompetencia] = useState(hoje.slice(0, 7));
  const [painel, setPainel] = useState<PainelFinanceiro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async (mes: string) => {
    try {
      const resposta = await buscarPainel(mes);
      setPainel(resposta.painel);
      setErro(null);
    } catch (falha: unknown) {
      setErro(
        falha instanceof ErroDaApi
          ? falha.message
          : "Não conseguimos abrir o painel.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    setCarregando(true);
    void recarregar(competencia);
  }, [competencia, recarregar]);

  if (carregando && !painel) {
    return <Carregando texto="Montando o painel…" />;
  }

  if (erro && !painel) {
    return <AvisoDeErro mensagem={erro} />;
  }

  if (!painel) {
    return null;
  }

  const variacaoDoResultado = variacao(
    painel.resultadoCentavos,
    painel.anterior.resultadoCentavos,
  );

  const atrasadoTotal =
    painel.atrasadoAReceberCentavos + painel.atrasadoAPagarCentavos;

  return (
    <div className="flex flex-col gap-4">
      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      {/* --- O MÊS --- */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-primary p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Botao
            aparencia="secundario"
            largura="conteudo"
            aria-label="Mês anterior"
            onClick={() => setCompetencia((atual) => somarMeses(atual, -1))}
          >
            ←
          </Botao>

          <span className="min-w-40 text-center text-base font-bold text-text-primary">
            {mesPorExtenso(competencia)}
          </span>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            aria-label="Mês seguinte"
            onClick={() => setCompetencia((atual) => somarMeses(atual, 1))}
          >
            →
          </Botao>
        </div>

        <p className="text-sm text-text-secondary">
          Comparando com {mesPorExtenso(painel.competenciaAnterior)}
        </p>
      </div>

      {/* --- OS QUATRO NÚMEROS --- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao
          rotulo="Entrou"
          centavos={painel.entradasCentavos}
          variacao={variacao(painel.entradasCentavos, painel.anterior.entradasCentavos)}
        />

        <Cartao
          rotulo="Saiu"
          centavos={painel.saidasCentavos}
          variacao={variacao(painel.saidasCentavos, painel.anterior.saidasCentavos)}
          /* Em despesa, subir é ruim: a seta não deve parecer uma boa notícia. */
          subirEhBom={false}
        />

        <Cartao
          rotulo="Resultado do mês"
          centavos={painel.resultadoCentavos}
          variacao={variacaoDoResultado}
          ajuda="Entrou menos saiu, só do que já foi pago. Não é o saldo do banco."
        />

        <div className="rounded-lg border border-border bg-bg-primary p-4">
          <p className="text-sm text-text-secondary">Margem</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">
            {/*
              SEM BASE, SEM PORCENTAGEM. "0%" diria que a margem é zero, que é
              outra informação — e dividir por zero daria Infinity.
            */}
            {painel.margem === null
              ? "—"
              : `${painel.margem.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            {painel.margem === null
              ? "Nada entrou neste mês, então não há o que dividir."
              : "Quanto do que entrou sobrou depois das saídas."}
          </p>
        </div>
      </div>

      {/*
        A NOTA SOBRE O QUE ESTE NÚMERO NÃO É.
        Sem ela, alguém leria "resultado do mês" como saldo da conta — e o
        sistema não conhece o dinheiro que já estava no banco.
      */}
      <p className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm leading-relaxed text-text-secondary">
        Estes números são do <strong>caixa</strong>: o que entrou e saiu de
        verdade neste mês, pelas datas de pagamento.{" "}
        <strong>Não é o saldo da sua conta</strong> — o sistema não conhece o
        dinheiro que já estava lá antes dele existir. E não é DRE: lucro contábil
        tem depreciação e provisão, que não entram aqui.
      </p>

      {/* --- A INADIMPLÊNCIA --- */}
      <Secao
        titulo="Em atraso"
        descricao="Tudo que venceu e não foi pago, de qualquer mês — uma conta de agosto continua em atraso em dezembro."
      >
        {atrasadoTotal === 0 ? (
          <AvisoVazio>Nada em atraso. Todas as contas vencidas estão pagas.</AvisoVazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-text-secondary">A receber</p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  painel.atrasadoAReceberCentavos > 0
                    ? "text-destructive"
                    : "text-text-primary",
                )}
              >
                {emReais(painel.atrasadoAReceberCentavos)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {painel.quantasAtrasadasAReceber === 1
                  ? "1 conta"
                  : `${painel.quantasAtrasadasAReceber} contas`}
              </p>
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-sm text-text-secondary">A pagar</p>
              <p
                className={cn(
                  "mt-1 text-xl font-bold tabular-nums",
                  painel.atrasadoAPagarCentavos > 0
                    ? "text-destructive"
                    : "text-text-primary",
                )}
              >
                {emReais(painel.atrasadoAPagarCentavos)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                {painel.quantasAtrasadasAPagar === 1
                  ? "1 conta"
                  : `${painel.quantasAtrasadasAPagar} contas`}
              </p>
            </div>
          </div>
        )}
      </Secao>

      {/* --- A EVOLUÇÃO --- */}
      <Secao
        titulo="Os últimos meses"
        descricao="Entrou, saiu e o resultado de cada mês. O mês escolhido é o último."
      >
        <Evolucao meses={painel.evolucao} />
      </Secao>

      {/* --- POR CATEGORIA --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="De onde entrou" descricao="Só o que já foi recebido no mês.">
          <PorCategoria fatias={painel.entradasPorCategoria} />
        </Secao>

        <Secao titulo="Para onde saiu" descricao="Só o que já foi pago no mês.">
          <PorCategoria fatias={painel.saidasPorCategoria} />
        </Secao>
      </div>

      {/* --- A PROJEÇÃO --- */}
      <Secao
        titulo="O que vem pela frente"
        descricao="O que VENCE nos próximos meses e ainda não foi pago. É previsão, não caixa."
      >
        {painel.projecao.every(
          (mes) => mes.aReceberCentavos === 0 && mes.aPagarCentavos === 0,
        ) ? (
          <AvisoVazio>
            Nada marcado para os próximos meses. Gere as mensalidades em
            Financeiro → Mensalidades para a previsão aparecer.
          </AvisoVazio>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {painel.projecao.map((mes) => (
              <li
                key={mes.competencia}
                className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-3"
              >
                <span className="text-base font-semibold text-text-primary">
                  {mesPorExtenso(mes.competencia)}
                </span>

                <span className="text-sm tabular-nums text-text-secondary">
                  a receber{" "}
                  <span className="font-semibold text-text-primary">
                    {emReais(mes.aReceberCentavos)}
                  </span>{" "}
                  · a pagar{" "}
                  <span className="font-semibold text-text-primary">
                    {emReais(mes.aPagarCentavos)}
                  </span>{" "}
                  · sobra{" "}
                  <span
                    className={cn(
                      "font-semibold",
                      mes.aReceberCentavos - mes.aPagarCentavos < 0
                        ? "text-destructive"
                        : "text-text-primary",
                    )}
                  >
                    {emReais(mes.aReceberCentavos - mes.aPagarCentavos)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

// -----------------------------------------------------------------------------

/** Um número grande com a variação contra o mês anterior. */
function Cartao({
  rotulo,
  centavos,
  variacao: variacaoDoMes,
  subirEhBom = true,
  ajuda,
}: {
  rotulo: string;
  centavos: number;
  variacao: number | null;
  subirEhBom?: boolean;
  ajuda?: string;
}) {
  const subiu = variacaoDoMes !== null && variacaoDoMes > 0;
  const desceu = variacaoDoMes !== null && variacaoDoMes < 0;
  const bom = subiu ? subirEhBom : desceu ? !subirEhBom : null;

  return (
    <div className="rounded-lg border border-border bg-bg-primary p-4">
      <p className="text-sm text-text-secondary">{rotulo}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          centavos < 0 ? "text-destructive" : "text-text-primary",
        )}
      >
        {emReais(centavos)}
      </p>

      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
        {/*
          SEM BASE, SEM SETA. Quando o mês anterior foi zero não existe
          porcentagem — escrever "+100%" inventaria uma comparação.
        */}
        {variacaoDoMes === null ? (
          "sem comparação com o mês anterior"
        ) : (
          <>
            <span
              className={cn(
                "font-semibold",
                bom === true
                  ? "text-text-primary"
                  : bom === false
                    ? "text-destructive"
                    : "text-text-secondary",
              )}
            >
              {variacaoDoMes > 0 ? "↑" : variacaoDoMes < 0 ? "↓" : "="}{" "}
              {Math.abs(variacaoDoMes).toLocaleString("pt-BR", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              %
            </span>{" "}
            vs. o mês anterior
          </>
        )}
      </p>

      {ajuda ? (
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{ajuda}</p>
      ) : null}
    </div>
  );
}

/**
 * O GRÁFICO DE BARRAS dos últimos meses.
 *
 * Duas barras por mês — entrou e saiu — e o resultado escrito ao lado. Feito
 * com CSS puro: a largura de cada barra é uma porcentagem do maior valor da
 * série, que é a única conta necessária.
 *
 * **O NÚMERO VAI SEMPRE ESCRITO**, nunca só desenhado: num mês de R$ 20 e
 * outro de R$ 20.000 as barras pequenas ficam invisíveis, e a informação não
 * pode depender de o olho conseguir medir.
 */
function Evolucao({
  meses,
}: {
  meses: { competencia: string; entradasCentavos: number; saidasCentavos: number; resultadoCentavos: number }[];
}) {
  const maior = Math.max(
    1,
    ...meses.map((mes) => Math.max(mes.entradasCentavos, mes.saidasCentavos)),
  );

  if (meses.every((mes) => mes.entradasCentavos === 0 && mes.saidasCentavos === 0)) {
    return <AvisoVazio>Nenhum pagamento registrado nestes meses.</AvisoVazio>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {meses.map((mes) => (
        <li key={mes.competencia} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-text-primary">
              {mesCurto(mes.competencia)}
            </span>

            <span className="text-sm tabular-nums text-text-secondary">
              {emReais(mes.entradasCentavos)} entrou ·{" "}
              {emReais(mes.saidasCentavos)} saiu ·{" "}
              <span
                className={cn(
                  "font-semibold",
                  mes.resultadoCentavos < 0
                    ? "text-destructive"
                    : "text-text-primary",
                )}
              >
                {emReais(mes.resultadoCentavos)}
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-1" aria-hidden>
            <div className="h-2.5 w-full rounded-full bg-bg-secondary">
              <div
                className="h-2.5 rounded-full bg-brand"
                style={{ width: `${(mes.entradasCentavos / maior) * 100}%` }}
              />
            </div>

            <div className="h-2.5 w-full rounded-full bg-bg-secondary">
              <div
                className="h-2.5 rounded-full bg-black"
                style={{ width: `${(mes.saidasCentavos / maior) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** As categorias, em barras horizontais, com o valor e a contagem escritos. */
function PorCategoria({ fatias }: { fatias: FatiaDoPainel[] }) {
  if (fatias.length === 0) {
    return <AvisoVazio>Nada neste mês.</AvisoVazio>;
  }

  const maior = Math.max(1, ...fatias.map((fatia) => fatia.centavos));

  return (
    <ul className="flex flex-col gap-3">
      {fatias.map((fatia) => (
        <li key={fatia.categoria} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-text-primary">
              {fatia.categoria}
            </span>
            <span className="text-sm tabular-nums text-text-secondary">
              {emReais(fatia.centavos)} ·{" "}
              {fatia.quantas === 1 ? "1 conta" : `${fatia.quantas} contas`}
            </span>
          </div>

          <div className="h-2.5 w-full rounded-full bg-bg-secondary" aria-hidden>
            <div
              className="h-2.5 rounded-full bg-brand"
              style={{ width: `${(fatia.centavos / maior) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
