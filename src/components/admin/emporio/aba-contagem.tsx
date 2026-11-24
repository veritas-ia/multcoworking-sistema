"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AreaDeTexto,
  Secao,
  type Situacao,
} from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import { buscarFichaParaContar, gravarContagem } from "./api";
import type {
  CategoriaDoProduto,
  ContagemGravada,
  LinhaParaContar,
  TipoDeControle,
} from "./tipos";

/**
 * As TRES FICHAS FISICAS, como elas existem na parede.
 *
 * Nao e enfeite: elas sao contadas em horarios diferentes, e quem conta a
 * geladeira as 9h40 nao quer a lista do chocolate na frente. O filtro da tela
 * copia a realidade do papel.
 */
const FICHAS: readonly {
  id: string;
  rotulo: string;
  categoria?: CategoriaDoProduto;
  controle?: TipoDeControle;
}[] = [
  { id: "geladeira", rotulo: "Geladeira", categoria: "BEBIDA", controle: "ESTOQUE" },
  { id: "chocolate", rotulo: "Chocolate", categoria: "COMIDA", controle: "ESTOQUE" },
  { id: "cafe", rotulo: "Máquina de café", controle: "CONTADOR" },
];

/**
 * A CONTAGEM DO DIA.
 *
 * POR QUE ELA EXISTE, e por que ela ganha da reposicao item a item: a rotina
 * real da equipe e CONTAR a prateleira, nao lancar cada venda. A contagem e
 * AUTOCORRETIVA — o que foi esquecido aparece sozinho na conta do dia
 * seguinte, porque a prateleira nao mente. A reposicao item a item e exata so
 * se ninguem esquecer, e quando alguem esquece o sistema nunca descobre.
 *
 * A CONTAGEM NAO SUBSTITUI OS MOVIMENTOS, ela os RECONCILIA: gravar gera um
 * movimento de AJUSTE com a diferenca, e o estoque continua sendo a soma dos
 * movimentos. Duas fontes de verdade para o mesmo numero sao o comeco de dois
 * numeros que discordam na mesma tela.
 *
 * A DIFERENCA E A COLUNA "FALTOU" DA FICHA — o que sumiu sem ninguem pagar.
 * Hoje ninguem calcula isso.
 */
export function AbaDeContagem({ hoje }: { hoje: string }) {
  const [ficha, setFicha] = useState(FICHAS[0]!.id);
  const [linhas, setLinhas] = useState<LinhaParaContar[]>([]);
  const [contado, setContado] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erroAoAbrir, setErroAoAbrir] = useState<string | null>(null);

  const [dia, setDia] = useState(hoje);
  const [horario, setHorario] = useState("");
  const [observacao, setObservacao] = useState("");
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });
  const [gravada, setGravada] = useState<ContagemGravada | null>(null);

  const escolhida = FICHAS.find((opcao) => opcao.id === ficha) ?? FICHAS[0]!;

  const carregar = useCallback(async (qual: typeof escolhida) => {
    setCarregando(true);
    setErroAoAbrir(null);

    try {
      const resposta = await buscarFichaParaContar({
        categoria: qual.categoria,
        controle: qual.controle,
      });
      setLinhas(resposta.linhas);
      // O que foi digitado volta ao branco ao trocar de ficha: aproveitar os
      // numeros de uma lista noutra faria a equipe gravar a contagem errada.
      setContado({});
    } catch (erro: unknown) {
      setErroAoAbrir(
        erro instanceof ErroDaApi ? erro.message : "Não conseguimos abrir a ficha.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(escolhida);
    // Só a ficha escolhida importa aqui; "carregar" é estável.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ficha]);

  const ehContador = escolhida.controle === "CONTADOR";

  /** As linhas que a equipe preencheu. Em branco não é zero: é "não contei". */
  const preenchidas = linhas.filter((linha) => {
    const texto = contado[linha.produtoId];
    return texto !== undefined && texto.trim() !== "";
  });

  /**
   * LEITURA MENOR QUE A ANTERIOR, na maquina de cafe.
   *
   * O contador so cresce: uma leitura menor e quase sempre erro de digitacao.
   * O servidor recusa, mas a tela avisa ANTES — assim a pessoa acha o erro com
   * a ficha ainda na mao, em vez de levar a recusa depois de preencher trinta
   * linhas.
   */
  const retrocedidas = ehContador
    ? preenchidas.filter(
        (linha) => Number(contado[linha.produtoId]) < linha.esperado,
      )
    : [];

  const invalido =
    !dia ||
    preenchidas.length === 0 ||
    retrocedidas.length > 0 ||
    preenchidas.some((linha) => {
      const numero = Number(contado[linha.produtoId]);
      return !Number.isInteger(numero) || numero < 0;
    });

  async function salvar(): Promise<void> {
    setSituacao({ tipo: "salvando" });
    setGravada(null);

    try {
      const resposta = await gravarContagem({
        dia,
        horario: horario || null,
        observacao: observacao.trim() || null,
        itens: preenchidas.map((linha) => ({
          produtoId: linha.produtoId,
          quantidade: Number(contado[linha.produtoId]),
        })),
      });

      setGravada(resposta.contagem);
      setSituacao({ tipo: "salvo", mensagem: "Contagem gravada." });
      setObservacao("");

      // O estoque mudou com o ajuste: a ficha é recarregada para a próxima
      // contagem partir do número novo, e não do que estava na tela.
      void carregar(escolhida);
    } catch (erro: unknown) {
      setSituacao({
        tipo: "erro",
        mensagem:
          erro instanceof ErroDaApi
            ? erro.message
            : "Não conseguimos gravar a contagem.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Contagem do dia"
        descricao={
          ehContador
            ? "Anote o número que está no visor da máquina. O sistema calcula quantos cafés saíram desde a última leitura."
            : "Conte a prateleira e escreva o que achou. O sistema compara com o que esperava e mostra o que faltou."
        }
      >
        <div className="flex flex-col gap-5">
          <div
            role="group"
            aria-label="Qual ficha"
            className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-bg-primary p-1.5"
          >
            {FICHAS.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={ficha === opcao.id}
                onClick={() => setFicha(opcao.id)}
                className={cn(
                  "min-h-11 rounded-md px-3.5 text-sm font-semibold",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                  ficha === opcao.id
                    ? "bg-brand text-brand-foreground"
                    : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Dia da ficha"
              type="date"
              value={dia}
              max={hoje}
              onChange={(evento) => setDia(evento.target.value)}
              dica="O dia do papel, não o de hoje: a ficha é lida no dia seguinte."
            />

            <Campo
              etiqueta="Horário da contagem (opcional)"
              type="time"
              value={horario}
              onChange={(evento) => setHorario(evento.target.value)}
              dica="Como está escrito no papel: 09:40."
            />
          </div>

          {carregando ? (
            <Carregando texto="Abrindo a ficha…" />
          ) : erroAoAbrir ? (
            <AvisoDeErro mensagem={erroAoAbrir} />
          ) : linhas.length === 0 ? (
            <AvisoVazio>
              Nenhum produto ativo nesta ficha. Produto desligado não entra na
              contagem — ele não está mais na prateleira.
            </AvisoVazio>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {linhas.map((linha) => {
                const texto = contado[linha.produtoId] ?? "";
                const numero = Number(texto);
                const temNumero = texto.trim() !== "" && Number.isInteger(numero);
                const retrocedeu = ehContador && temNumero && numero < linha.esperado;
                // A conta e a MESMA nos dois casos (contado menos esperado); o
                // que muda e a leitura dela: na prateleira, o negativo e o
                // "FALTOU"; na maquina, o positivo e quantos cafes sairam.
                const diferenca = temNumero ? numero - linha.esperado : null;

                return (
                  <li
                    key={linha.produtoId}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-text-primary">
                        {linha.nome}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {ehContador
                          ? `última leitura: ${linha.esperado}`
                          : `o sistema espera: ${linha.esperado}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/*
                        O numero aparece AO LADO do campo, e nao depois de
                        gravar: a pessoa ve a diferenca com a ficha ainda na
                        mao. Depois de fechar a tela ela nao tem mais como
                        conferir de onde veio.
                      */}
                      {diferenca !== null && !retrocedeu ? (
                        <span
                          className={cn(
                            "text-sm tabular-nums",
                            !ehContador && diferenca < 0
                              ? "font-semibold text-destructive"
                              : "text-text-secondary",
                          )}
                        >
                          {ehContador
                            ? `${diferenca} cafés`
                            : diferenca === 0
                              ? "bate"
                              : diferenca < 0
                                ? `faltaram ${Math.abs(diferenca)}`
                                : `sobraram ${diferenca}`}
                        </span>
                      ) : null}

                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={texto}
                        aria-label={`Quantidade contada de ${linha.nome}`}
                        aria-invalid={retrocedeu ? true : undefined}
                        onChange={(evento) =>
                          setContado((atuais) => ({
                            ...atuais,
                            [linha.produtoId]: evento.target.value,
                          }))
                        }
                        className={cn(
                          "min-h-12 w-24 rounded-lg border bg-bg-primary px-3 py-2 text-right text-base tabular-nums text-text-primary",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black",
                          retrocedeu ? "border-destructive" : "border-border",
                        )}
                      />
                    </div>

                    {retrocedeu ? (
                      <p className="w-full text-sm font-medium text-destructive">
                        O contador da máquina só cresce. A última leitura foi{" "}
                        {linha.esperado} — confira o número no visor.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {/*
            A OBSERVACAO e o campo escrito a mao na ficha ("1 cookies"). Ela e
            guardada como esta no papel, sem o sistema tentar interpretar.
          */}
          <AreaDeTexto
            etiqueta="Observação (opcional)"
            valor={observacao}
            aoMudar={setObservacao}
            maximo={300}
            linhas={2}
            ajuda="O que estiver anotado à mão no papel."
          />

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary">
              {preenchidas.length} de {linhas.length}{" "}
              {linhas.length === 1 ? "produto" : "produtos"} preenchidos. Deixar
              em branco não é zero — é “não contei”.
            </p>

            <Botao
              largura="conteudo"
              onClick={salvar}
              disabled={invalido || situacao.tipo === "salvando"}
            >
              {situacao.tipo === "salvando" ? "Gravando…" : "Gravar contagem"}
            </Botao>
          </div>

          <p
            aria-live="polite"
            className={cn(
              "text-sm",
              situacao.tipo === "erro"
                ? "font-medium text-destructive"
                : "text-text-secondary",
            )}
          >
            {situacao.tipo === "erro" || situacao.tipo === "salvo"
              ? situacao.mensagem
              : ""}
          </p>
        </div>
      </Secao>

      {gravada ? (
        <Secao
          titulo="O que esta contagem descobriu"
          descricao="Este é o resultado guardado. Os números ficam congelados nesta ficha — recalculados depois dariam sempre zero, porque o ajuste já aconteceu."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <p className="text-text-secondary">
                Faltaram no total:{" "}
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    gravada.faltaram > 0 ? "text-destructive" : "text-text-primary",
                  )}
                >
                  {gravada.faltaram}
                </span>
              </p>

              {gravada.cafesFeitos > 0 ? (
                <p className="text-text-secondary">
                  Cafés feitos desde a última leitura:{" "}
                  <span className="font-bold tabular-nums text-text-primary">
                    {gravada.cafesFeitos}
                  </span>
                </p>
              ) : null}
            </div>

            {/*
              SOBRA NAO COMPENSA FALTA: o "faltaram" soma so o que sumiu. O que
              apareceu a mais e outro problema — chegou mercadoria sem registro
              — e somar os dois esconderia os dois.
            */}
            <ul className="divide-y divide-border rounded-lg border border-border">
              {gravada.linhas.map((linha) => (
                <li
                  key={linha.produtoId}
                  className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2.5"
                >
                  <span className="text-base text-text-primary">{linha.nome}</span>

                  <span className="text-sm tabular-nums text-text-secondary">
                    contado {linha.contado} · esperado {linha.esperado} ·{" "}
                    <span
                      className={cn(
                        linha.controle === "ESTOQUE" && linha.diferenca < 0
                          ? "font-semibold text-destructive"
                          : "",
                      )}
                    >
                      {linha.controle === "CONTADOR"
                        ? `${linha.diferenca} cafés`
                        : linha.diferenca === 0
                          ? "bate"
                          : linha.diferenca < 0
                            ? `faltaram ${Math.abs(linha.diferenca)}`
                            : `sobraram ${linha.diferenca}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Secao>
      ) : null}
    </div>
  );
}
