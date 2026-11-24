"use client";

import { useCallback, useEffect, useState } from "react";

import {
  AreaDeTexto,
  Secao,
  type Situacao as SituacaoDoSalvar,
} from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import {
  buscarLancamentos,
  desvincular,
  editarLancamento,
  excluirLancamento,
  lancar,
  marcarPagamento,
  type RespostaDeLancamentos,
} from "./api";
import {
  centavosDe,
  diaCompleto,
  diaVisivel,
  Escolha,
  NOME_DO_TIPO,
  Numero,
  Situacao,
  valorVisivel,
} from "./pecas";
import type {
  CategoriaNaTela,
  LancamentoNaTela,
  SituacaoDoLancamento,
  TipoDeLancamento,
} from "./tipos";

/** "2026-11-17" -> o primeiro e o último dia daquele mês. */
function mesDe(dia: string): { de: string; ate: string } {
  const [ano, mes] = dia.split("-").map(Number);
  // O dia 0 do mês seguinte é o último do mês atual — assim a conta funciona
  // em fevereiro e em ano bissexto sem nenhuma tabela de dias.
  const ultimo = new Date(Date.UTC(ano!, mes!, 0)).getUTCDate();

  return {
    de: `${ano}-${String(mes).padStart(2, "0")}-01`,
    ate: `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`,
  };
}

/** Soma meses a "AAAA-MM". */
function somarMeses(mes: string, quantos: number): string {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, numero! - 1 + quantos, 1));

  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nomeDoMes(mes: string): string {
  const [ano, numero] = mes.split("-").map(Number);

  return new Date(Date.UTC(ano!, numero! - 1, 1)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

const FILTROS: readonly { valor: "" | SituacaoDoLancamento; rotulo: string }[] = [
  { valor: "", rotulo: "Tudo" },
  { valor: "ATRASADO", rotulo: "Atrasadas" },
  { valor: "PENDENTE", rotulo: "A vencer" },
  { valor: "PAGO", rotulo: "Pagas" },
];

/**
 * AS CONTAS DO MÊS — a tela do dia a dia do financeiro.
 *
 * DUAS VISÕES, e a diferença entre elas é regra, não enfeite:
 *
 *  - **Contas** mostra o que VENCE no mês, pago ou não. É com ela que a equipe
 *    trabalha: o que falta pagar, o que está atrasado.
 *  - **Caixa** mostra o que ENTROU E SAIU de verdade no mês.
 *
 * Uma conta de outubro paga em novembro é despesa de outubro e caixa de
 * novembro. Misturar as duas num filtro só daria um número que não bate com
 * nenhuma das duas — e seria impossível explicar o saldo a alguém.
 */
export function AbaDeContas({ hoje }: { hoje: string }) {
  const [mes, setMes] = useState(hoje.slice(0, 7));
  const [base, setBase] = useState<"vencimento" | "pagamento">("vencimento");
  const [filtro, setFiltro] = useState<"" | SituacaoDoLancamento>("");
  const [dados, setDados] = useState<RespostaDeLancamentos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const periodo = mesDe(`${mes}-01`);

    try {
      setDados(
        await buscarLancamentos({
          ...periodo,
          base,
          situacao: filtro || undefined,
        }),
      );
      setErro(null);
    } catch (falha: unknown) {
      setErro(
        falha instanceof ErroDaApi
          ? falha.message
          : "Não conseguimos abrir o financeiro.",
      );
    } finally {
      setCarregando(false);
    }
  }, [mes, base, filtro]);

  useEffect(() => {
    setCarregando(true);
    void recarregar();
  }, [recarregar]);

  if (carregando && !dados) {
    return <Carregando texto="Abrindo o financeiro…" />;
  }

  if (erro && !dados) {
    return <AvisoDeErro mensagem={erro} />;
  }

  if (!dados) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      {/* --- O MÊS E A VISÃO --- */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-primary p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Botao
            aparencia="secundario"
            largura="conteudo"
            aria-label="Mês anterior"
            onClick={() => setMes((atual) => somarMeses(atual, -1))}
          >
            ←
          </Botao>

          <span className="min-w-40 text-center text-base font-bold text-text-primary">
            {nomeDoMes(mes)}
          </span>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            aria-label="Mês seguinte"
            onClick={() => setMes((atual) => somarMeses(atual, 1))}
          >
            →
          </Botao>
        </div>

        <div
          role="group"
          aria-label="O que a data significa"
          className="flex gap-1.5 rounded-lg border border-border p-1.5"
        >
          {(
            [
              { valor: "vencimento", rotulo: "Contas do mês" },
              { valor: "pagamento", rotulo: "Caixa do mês" },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={base === opcao.valor}
              onClick={() => setBase(opcao.valor)}
              className={cn(
                "min-h-10 rounded-md px-3 text-sm font-semibold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                base === opcao.valor
                  ? "bg-brand text-brand-foreground"
                  : "text-text-secondary hover:bg-bg-secondary",
              )}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-text-secondary">
        {base === "vencimento"
          ? "O que VENCE neste mês, pago ou não — é a lista de trabalho."
          : "O que ENTROU E SAIU de verdade neste mês. Conta de outubro paga em novembro aparece aqui em novembro."}
      </p>

      {/* --- O RESUMO, somado no servidor --- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo="Entrou"
          centavos={dados.resumo.entradasCentavos}
          tom="entrada"
        />
        <Numero rotulo="Saiu" centavos={dados.resumo.saidasCentavos} tom="saida" />
        <Numero
          rotulo="Saldo"
          centavos={dados.resumo.saldoCentavos}
          ajuda="Só o que já foi pago e recebido."
        />
        <Numero
          rotulo="Atrasado"
          centavos={
            dados.resumo.atrasadoAPagarCentavos +
            dados.resumo.atrasadoAReceberCentavos
          }
          tom="alerta"
          ajuda={`A pagar ${valorVisivel(String(dados.resumo.aPagarCentavos / 100))} · a receber ${valorVisivel(String(dados.resumo.aReceberCentavos / 100))}`}
        />
      </div>

      <FormularioDeLancamento
        dados={dados}
        hoje={hoje}
        ocupado={ocupado}
        aoOcupar={setOcupado}
        aoLancar={() => void recarregar()}
      />

      {/* --- A LISTA --- */}
      <Secao
        titulo="Lançamentos"
        descricao="Clique em um para corrigir. Tudo que a equipe digita, a equipe corrige."
      >
        <div className="flex flex-col gap-4">
          <div
            role="group"
            aria-label="Filtrar por situação"
            className="flex flex-wrap gap-1.5 rounded-lg border border-border p-1.5"
          >
            {FILTROS.map((opcao) => (
              <button
                key={opcao.valor || "tudo"}
                type="button"
                aria-pressed={filtro === opcao.valor}
                onClick={() => setFiltro(opcao.valor)}
                className={cn(
                  "min-h-10 rounded-md px-3 text-sm font-semibold",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                  filtro === opcao.valor
                    ? "bg-brand text-brand-foreground"
                    : "text-text-secondary hover:bg-bg-secondary",
                )}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>

          {dados.lancamentos.length === 0 ? (
            <AvisoVazio>Nenhum lançamento com esse filtro neste mês.</AvisoVazio>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {dados.lancamentos.map((lancamento) => (
                <Linha
                  key={lancamento.id}
                  lancamento={lancamento}
                  dados={dados}
                  hoje={hoje}
                  ocupado={ocupado}
                  aoOcupar={setOcupado}
                  aoMudar={() => void recarregar()}
                  aoFalhar={setErro}
                />
              ))}
            </ul>
          )}
        </div>
      </Secao>
    </div>
  );
}

// -----------------------------------------------------------------------------

/**
 * O FORMULÁRIO.
 *
 * A CATEGORIA VEM PRIMEIRO, antes do valor, e isso é de propósito: é ela que
 * decide se o dinheiro entra ou sai. Escolhendo-a primeiro, a tela já sabe se
 * deve pedir um cliente ou um fornecedor — e a pessoa não preenche metade do
 * formulário para descobrir que escolheu o lado errado.
 */
function FormularioDeLancamento({
  dados,
  hoje,
  ocupado,
  aoOcupar,
  aoLancar,
}: {
  dados: RespostaDeLancamentos;
  hoje: string;
  ocupado: boolean;
  aoOcupar: (ocupado: boolean) => void;
  aoLancar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [lado, setLado] = useState<TipoDeLancamento>("SAIDA");
  const [categoriaId, setCategoriaId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [vencimento, setVencimento] = useState(hoje);
  const [jaPago, setJaPago] = useState(false);
  const [pagoEm, setPagoEm] = useState(hoje);
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [situacao, setSituacao] = useState<SituacaoDoSalvar>({ tipo: "parado" });

  const doLado = dados.categorias.filter(
    (categoria) => categoria.tipo === lado,
  );

  // A primeira categoria do lado já vem escolhida: deixar vazio faria a pessoa
  // abrir o seletor em todo lançamento.
  useEffect(() => {
    setCategoriaId((atual) =>
      doLado.some((categoria) => categoria.id === atual)
        ? atual
        : (doLado[0]?.id ?? ""),
    );
    // Só a troca de lado importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lado, dados.categorias.length]);

  const valorInvalido =
    valor.trim() !== "" && centavosDe(valor) <= 0;

  const invalido =
    descricao.trim().length < 2 ||
    valor.trim() === "" ||
    valorInvalido ||
    !categoriaId ||
    !vencimento;

  async function salvar(): Promise<void> {
    aoOcupar(true);
    setSituacao({ tipo: "salvando" });

    try {
      const { lancamento } = await lancar({
        descricao: descricao.trim(),
        valor,
        categoriaId,
        // O fornecedor só faz sentido numa saída: cliente e fornecedor juntos
        // é recusado pelo servidor E pelo banco.
        fornecedorId: lado === "SAIDA" ? fornecedorId || null : null,
        vencimento,
        pagoEm: jaPago ? pagoEm : null,
        formaPagamentoId: jaPago ? formaPagamentoId || null : null,
        observacao: observacao.trim() || null,
      });

      setSituacao({
        tipo: "salvo",
        mensagem: `${NOME_DO_TIPO[lancamento.tipo]} de ${valorVisivel(lancamento.valor)} lançada.`,
      });

      // O lado, a categoria e o vencimento FICAM: a equipe lança várias contas
      // parecidas de uma vez (as despesas do mês). Descrição e valor limpam.
      setDescricao("");
      setValor("");
      setObservacao("");
      aoLancar();
    } catch (falha: unknown) {
      setSituacao({
        tipo: "erro",
        mensagem:
          falha instanceof ErroDaApi
            ? falha.message
            : "Não conseguimos lançar.",
      });
    } finally {
      aoOcupar(false);
    }
  }

  if (!aberto) {
    return (
      <div className="flex flex-wrap gap-2">
        <Botao
          largura="conteudo"
          onClick={() => {
            setLado("SAIDA");
            setAberto(true);
          }}
        >
          Lançar saída
        </Botao>

        <Botao
          aparencia="secundario"
          largura="conteudo"
          onClick={() => {
            setLado("ENTRADA");
            setAberto(true);
          }}
        >
          Lançar entrada
        </Botao>
      </div>
    );
  }

  return (
    <Secao
      titulo={lado === "SAIDA" ? "Lançar uma saída" : "Lançar uma entrada"}
      descricao="O valor é sempre positivo — quem diz se entra ou sai é a categoria."
    >
      <div className="flex flex-col gap-4">
        <div
          role="group"
          aria-label="Entrada ou saída"
          className="flex gap-1.5 rounded-lg border border-border p-1.5 sm:max-w-80"
        >
          {(
            [
              { valor: "SAIDA", rotulo: "Saída" },
              { valor: "ENTRADA", rotulo: "Entrada" },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={lado === opcao.valor}
              onClick={() => setLado(opcao.valor)}
              className={cn(
                "min-h-10 flex-1 rounded-md px-3 text-sm font-semibold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                lado === opcao.valor
                  ? "bg-brand text-brand-foreground"
                  : "text-text-secondary hover:bg-bg-secondary",
              )}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        {doLado.length === 0 ? (
          <AvisoVazio>
            Nenhuma categoria de {lado === "SAIDA" ? "saída" : "entrada"} ligada.
            Cadastre uma na aba Categorias.
          </AvisoVazio>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Escolha
                etiqueta="Categoria"
                valor={categoriaId}
                aoMudar={setCategoriaId}
                opcoes={doLado.map((categoria) => ({
                  valor: categoria.id,
                  rotulo: categoria.nome,
                }))}
                dica="É ela que diz de que lado o dinheiro vai."
              />

              <Campo
                etiqueta="Valor"
                value={valor}
                inputMode="decimal"
                onChange={(evento) => setValor(evento.target.value)}
                placeholder="1250,00"
                erro={valorInvalido ? "Escreva como 1250,00." : null}
              />
            </div>

            <Campo
              etiqueta="Do que se trata"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
              placeholder={
                lado === "SAIDA" ? "Energia de outubro" : "Mensalidade da sala 4"
              }
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Vencimento"
                type="date"
                value={vencimento}
                onChange={(evento) => setVencimento(evento.target.value)}
                dica="O dia combinado, mesmo que já tenha passado."
              />

              {lado === "SAIDA" && dados.fornecedores.length > 0 ? (
                <Escolha
                  etiqueta="Fornecedor (opcional)"
                  valor={fornecedorId}
                  aoMudar={setFornecedorId}
                  opcoes={[
                    { valor: "", rotulo: "Não informado" },
                    ...dados.fornecedores.map((fornecedor) => ({
                      valor: fornecedor.id,
                      rotulo: fornecedor.nome,
                    })),
                  ]}
                />
              ) : null}
            </div>

            {/*
              "JÁ FOI PAGO" é uma caixa, e não dois campos de data soltos.
              A maioria das contas é lançada ANTES de pagar (é a lista de
              trabalho), e deixar a data de pagamento sempre visível faria a
              equipe preenchê-la por reflexo — passando a dizer que pagou o que
              não pagou.
            */}
            <label className="flex items-center gap-3 rounded-lg border border-border bg-bg-secondary px-4 py-3">
              <input
                type="checkbox"
                checked={jaPago}
                onChange={(evento) => setJaPago(evento.target.checked)}
                className="size-5 accent-black"
              />
              <span className="text-sm font-semibold text-text-primary">
                Já foi {lado === "SAIDA" ? "paga" : "recebida"}
              </span>
            </label>

            {jaPago ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo
                  etiqueta={lado === "SAIDA" ? "Pago em" : "Recebido em"}
                  type="date"
                  value={pagoEm}
                  onChange={(evento) => setPagoEm(evento.target.value)}
                />

                {dados.formasDePagamento.length > 0 ? (
                  <Escolha
                    etiqueta="Forma de pagamento"
                    valor={formaPagamentoId}
                    aoMudar={setFormaPagamentoId}
                    opcoes={[
                      { valor: "", rotulo: "Não informada" },
                      ...dados.formasDePagamento.map((forma) => ({
                        valor: forma.id,
                        rotulo: forma.nome,
                      })),
                    ]}
                  />
                ) : null}
              </div>
            ) : null}

            <AreaDeTexto
              etiqueta="Observação (opcional)"
              valor={observacao}
              aoMudar={setObservacao}
              maximo={300}
              linhas={2}
            />

            <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
              <p
                aria-live="polite"
                className={cn(
                  "text-sm sm:mr-auto",
                  situacao.tipo === "erro"
                    ? "font-medium text-destructive"
                    : "text-text-secondary",
                )}
              >
                {situacao.tipo === "erro" || situacao.tipo === "salvo"
                  ? situacao.mensagem
                  : ""}
              </p>

              <Botao
                aparencia="secundario"
                largura="conteudo"
                onClick={() => setAberto(false)}
                disabled={ocupado}
              >
                Fechar
              </Botao>

              <Botao
                largura="conteudo"
                onClick={salvar}
                disabled={invalido || ocupado}
              >
                {situacao.tipo === "salvando" ? "Lançando…" : "Lançar"}
              </Botao>
            </div>
          </>
        )}
      </div>
    </Secao>
  );
}

// -----------------------------------------------------------------------------

/** Uma linha da lista, que abre para corrigir. */
function Linha({
  lancamento,
  dados,
  hoje,
  ocupado,
  aoOcupar,
  aoMudar,
  aoFalhar,
}: {
  lancamento: LancamentoNaTela;
  dados: RespostaDeLancamentos;
  hoje: string;
  ocupado: boolean;
  aoOcupar: (ocupado: boolean) => void;
  aoMudar: () => void;
  aoFalhar: (erro: string | null) => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [descricao, setDescricao] = useState(lancamento.descricao);
  const [valor, setValor] = useState(lancamento.valor);
  const [vencimento, setVencimento] = useState(lancamento.vencimento);
  const [categoriaId, setCategoriaId] = useState(lancamento.categoria.id);
  const [excluindo, setExcluindo] = useState(false);
  const [motivo, setMotivo] = useState("");

  const doLado = dados.categorias.filter(
    (categoria: CategoriaNaTela) => categoria.tipo === lancamento.tipo,
  );

  async function comErro(acao: () => Promise<unknown>): Promise<void> {
    aoOcupar(true);
    aoFalhar(null);

    try {
      await acao();
      aoMudar();
    } catch (falha: unknown) {
      aoFalhar(
        falha instanceof ErroDaApi ? falha.message : "Não conseguimos salvar.",
      );
    } finally {
      aoOcupar(false);
    }
  }

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-text-primary">
              {lancamento.descricao}
            </span>
            <Situacao
              situacao={lancamento.situacao}
              diasDeAtraso={lancamento.diasDeAtraso}
            />
            {/*
              A ETIQUETA DE ORIGEM existe para a equipe saber onde corrigir.
              Sem ela, a pessoa tentaria editar uma linha que e espelho da
              reserva — e a correcao sumiria na proxima vez, sem explicacao.
            */}
            {lancamento.origem !== "MANUAL" ? (
              <span className="inline-flex items-center rounded-full border border-border bg-bg-secondary px-2 py-0.5 text-xs font-semibold text-text-secondary">
                {lancamento.origem === "RESERVA" ? "da agenda" : "do empório"}
              </span>
            ) : null}
          </p>

          <p className="mt-0.5 text-sm text-text-secondary">
            {lancamento.categoria.nome} · vence {diaVisivel(lancamento.vencimento)}
            {lancamento.pagoEm ? ` · pago ${diaVisivel(lancamento.pagoEm)}` : ""}
            {lancamento.fornecedor ? ` · ${lancamento.fornecedor.nome}` : ""}
            {lancamento.cliente ? ` · ${lancamento.cliente.nome}` : ""}
            {lancamento.formaPagamento ? ` · ${lancamento.formaPagamento.nome}` : ""}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 text-base font-bold tabular-nums",
            lancamento.tipo === "SAIDA" ? "text-destructive" : "text-text-primary",
          )}
        >
          {/* O SINAL É ESCRITO NA LEITURA. No banco o valor é sempre positivo. */}
          {lancamento.tipo === "SAIDA" ? "− " : "+ "}
          {valorVisivel(lancamento.valor)}
        </span>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          {lancamento.situacao === "PAGO" ? (
            <Botao
              aparencia="secundario"
              largura="conteudo"
              disabled={ocupado}
              onClick={() =>
                void comErro(() => marcarPagamento(lancamento.id, { pagoEm: null }))
              }
            >
              Desmarcar
            </Botao>
          ) : (
            <Botao
              largura="conteudo"
              disabled={ocupado}
              onClick={() =>
                void comErro(() =>
                  marcarPagamento(lancamento.id, { pagoEm: hoje }),
                )
              }
            >
              {lancamento.tipo === "SAIDA" ? "Paguei" : "Recebi"}
            </Botao>
          )}

          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={ocupado}
            onClick={() => setAberta((atual) => !atual)}
          >
            {aberta ? "Fechar" : lancamento.origem === "MANUAL" ? "Corrigir" : "Ver"}
          </Botao>
        </div>
      </div>

      {aberta && lancamento.origem !== "MANUAL" ? (
        /*
         * A LINHA AUTOMATICA NAO SE EDITA AQUI, e a tela diz onde se corrige.
         *
         * Ela e ESPELHO da origem: editar o espelho faria o financeiro mostrar
         * um valor e o relatorio outro, que e a doenca da planilha da Toca —
         * o total digitado dizia R$ 3.033 e as linhas somavam R$ 3.023.
         */
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-4">
          {lancamento.origem === "RESERVA" ? (
            <>
              <p className="text-sm leading-relaxed text-text-primary">
                <strong>Esta linha é espelho de uma reserva.</strong> Para
                mudar o valor, corrija a reserva na agenda — a linha acompanha.
                Para desfazer o recebimento, use “Desfazer recebimento” no
                painel dela.
              </p>

              <p className="text-sm leading-relaxed text-text-secondary">
                Se precisar mesmo mexer só aqui, desvincule: a linha solta da
                reserva e vira manual, editável à vontade. Ela para de
                acompanhar a reserva a partir daí.
              </p>

              <div className="flex flex-wrap gap-2">
                <Botao
                  aparencia="secundario"
                  largura="conteudo"
                  disabled={ocupado}
                  onClick={() => void comErro(() => desvincular(lancamento.id))}
                >
                  Desvincular da reserva
                </Botao>
              </div>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-text-primary">
              <strong>Esta linha resume o empório de um dia</strong> — o
              consumo pago na hora, por forma de pagamento. Ela é{" "}
              <strong>recalculada</strong> a cada consumo lançado naquele dia,
              então corrigir aqui não pararia de pé. Para mudar o valor,
              corrija o consumo em Empório → Lançar consumo; para um acerto
              fora disso, lance uma linha à mão explicando.
            </p>
          )}

          <p className="text-sm text-text-secondary">
            Lançada em {diaCompleto(lancamento.criadoEm.slice(0, 10))}
          </p>
        </div>
      ) : null}

      {aberta && lancamento.origem === "MANUAL" ? (
        <div className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-bg-secondary p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Do que se trata"
              value={descricao}
              onChange={(evento) => setDescricao(evento.target.value)}
            />

            <Campo
              etiqueta="Valor"
              value={valor}
              inputMode="decimal"
              onChange={(evento) => setValor(evento.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Vencimento"
              type="date"
              value={vencimento}
              onChange={(evento) => setVencimento(evento.target.value)}
            />

            {/*
              A CATEGORIA SÓ TROCA DENTRO DO MESMO LADO. Passar uma saída para
              uma categoria de entrada inverteria o sinal da linha, e o caixa
              do mês mudaria sem ninguém pedir.
            */}
            <Escolha
              etiqueta="Categoria"
              valor={categoriaId}
              aoMudar={setCategoriaId}
              opcoes={
                doLado.length > 0
                  ? doLado.map((categoria) => ({
                      valor: categoria.id,
                      rotulo: categoria.nome,
                    }))
                  : [{ valor: lancamento.categoria.id, rotulo: lancamento.categoria.nome }]
              }
              dica={`Só categorias de ${lancamento.tipo === "SAIDA" ? "saída" : "entrada"}.`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Botao
              largura="conteudo"
              disabled={ocupado || centavosDe(valor) <= 0 || descricao.trim().length < 2}
              onClick={() =>
                void comErro(() =>
                  editarLancamento(lancamento.id, {
                    descricao: descricao.trim(),
                    valor,
                    vencimento,
                    categoriaId,
                  }),
                )
              }
            >
              Salvar
            </Botao>

            <Botao
              aparencia="secundario"
              largura="conteudo"
              disabled={ocupado}
              onClick={() => setExcluindo((atual) => !atual)}
            >
              Excluir
            </Botao>

            <p className="text-sm text-text-secondary">
              Lançado por {lancamento.lancadoPor ?? "alguém da equipe"} ·{" "}
              {diaCompleto(lancamento.criadoEm.slice(0, 10))}
            </p>
          </div>

          {excluindo ? (
            /*
              O MOTIVO É OBRIGATÓRIO, e a tela explica por quê antes de pedir.
              Sem isso a equipe escreve "a" para passar da tela — e seis meses
              depois ninguém explica por que o caixa daquele mês mudou.
            */
            <div className="flex flex-col gap-3 rounded-lg border border-destructive bg-bg-primary p-4">
              <p className="text-sm leading-relaxed text-text-primary">
                <strong>Excluir apaga a linha de verdade.</strong> Fica o registro
                em Configurações → Histórico de ações, com o retrato dela e o seu
                nome. Use quando foi lançada em dobro ou na conta errada — para
                conta que não vai mais ser paga, melhor corrigir o valor.
              </p>

              <Campo
                etiqueta="Por que está excluindo?"
                value={motivo}
                onChange={(evento) => setMotivo(evento.target.value)}
                placeholder="lancei duas vezes a mesma conta"
              />

              <div className="flex flex-wrap gap-2">
                <Botao
                  largura="conteudo"
                  disabled={ocupado || motivo.trim().length < 3}
                  onClick={() =>
                    void comErro(() =>
                      excluirLancamento(lancamento.id, motivo.trim()),
                    )
                  }
                >
                  Excluir e registrar
                </Botao>

                <Botao
                  aparencia="secundario"
                  largura="conteudo"
                  onClick={() => setExcluindo(false)}
                  disabled={ocupado}
                >
                  Cancelar
                </Botao>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
