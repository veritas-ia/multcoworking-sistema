"use client";

import { useEffect, useState } from "react";

import { Secao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import { buscarExtrato, buscarProdutos, lancarMovimento } from "./api";
import { Escolha, Estoque, FotoDoProduto } from "./pecas";
import type {
  MovimentoNaLista,
  ProdutoDoEmporio,
  TipoMovimentoEstoque,
} from "./tipos";

/** O que cada movimento quer dizer, na língua da equipe. */
const NOME_DO_TIPO: Record<TipoMovimentoEstoque, string> = {
  REPOSICAO: "Chegou mercadoria",
  VENDA: "Consumo lançado",
  PERDA: "Perda",
  AJUSTE: "Ajuste da contagem",
};

/** Só estes três entram à mão: VENDA nasce do lançamento do consumo. */
const LANCAVEIS = [
  { valor: "REPOSICAO", rotulo: "Chegou mercadoria" },
  { valor: "PERDA", rotulo: "Perda (venceu, quebrou)" },
] as const;

type TipoLancavel = (typeof LANCAVEIS)[number]["valor"];

/**
 * O EXTRATO DO ESTOQUE.
 *
 * POR QUE ESTA TELA EXISTE: o estoque é a SOMA DOS MOVIMENTOS, nunca um número
 * solto que alguém edita. É isto que responde *"por que o estoque está em 3?"*
 * — um número editável não responde nada, e quando ele está errado ninguém
 * consegue descobrir onde foi.
 *
 * VENDA NÃO ENTRA POR AQUI, de propósito: ela nasce do lançamento do consumo,
 * que grava de quem foi, quando e por quanto. Deixar vender por esta tela
 * criaria saída de estoque sem dono, e o empório pararia de bater com o que foi
 * cobrado.
 */
export function AbaDeMovimentos() {
  const [produtos, setProdutos] = useState<ProdutoDoEmporio[]>([]);
  const [produtoId, setProdutoId] = useState("");
  const [movimentos, setMovimentos] = useState<MovimentoNaLista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoExtrato, setCarregandoExtrato] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // --- o lançamento ---
  const [tipo, setTipo] = useState<TipoLancavel>("REPOSICAO");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    buscarProdutos()
      .then((resposta) => {
        setProdutos(resposta.produtos);
        setProdutoId(resposta.produtos[0]?.id ?? "");
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        setErro(
          falha instanceof ErroDaApi
            ? falha.message
            : "Não conseguimos abrir os movimentos.",
        );
        setCarregando(false);
      });
  }, []);

  useEffect(() => {
    if (!produtoId) {
      setMovimentos([]);
      return;
    }

    let vivo = true;
    setCarregandoExtrato(true);

    buscarExtrato(produtoId)
      .then((resposta) => {
        if (!vivo) return;
        setMovimentos(resposta.movimentos);
        setCarregandoExtrato(false);
      })
      .catch(() => {
        if (!vivo) return;
        setMovimentos([]);
        setCarregandoExtrato(false);
      });

    return () => {
      vivo = false;
    };
  }, [produtoId]);

  const escolhido = produtos.find((produto) => produto.id === produtoId) ?? null;

  const numero = Number(quantidade);
  const quantidadeInvalida =
    quantidade.trim() === "" || !Number.isInteger(numero) || numero <= 0;

  async function lancar(): Promise<void> {
    if (!produtoId) return;

    setOcupado(true);
    setErro(null);
    setRecado(null);

    try {
      await lancarMovimento(produtoId, {
        tipo,
        // A QUANTIDADE VAI SEMPRE POSITIVA: quem decide o sinal é o servidor,
        // a partir do tipo. Mandar o sinal daqui convidaria ao erro de uma
        // reposição negativa, que somaria para o lado errado — e o número
        // continuaria parecendo certo.
        quantidade: numero,
        motivo: motivo.trim() || null,
      });

      // O estoque e o extrato mudaram: os dois vêm do servidor de novo, em vez
      // de serem recalculados aqui. Dois lugares fazendo a mesma conta é como
      // começam dois números que discordam na mesma tela.
      const [doCatalogo, doExtrato] = await Promise.all([
        buscarProdutos(),
        buscarExtrato(produtoId),
      ]);

      setProdutos(doCatalogo.produtos);
      setMovimentos(doExtrato.movimentos);
      setQuantidade("");
      setMotivo("");
      setRecado(
        tipo === "REPOSICAO"
          ? `Entraram ${numero} de ${escolhido?.nome}.`
          : `Baixa de ${numero} de ${escolhido?.nome} por perda.`,
      );
    } catch (falha: unknown) {
      setErro(
        falha instanceof ErroDaApi
          ? falha.message
          : "Não conseguimos lançar o movimento.",
      );
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo os movimentos…" />;
  }

  if (produtos.length === 0) {
    return <AvisoVazio>Nenhum produto cadastrado ainda.</AvisoVazio>;
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      {recado ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm text-text-primary"
        >
          {recado}
        </p>
      ) : null}

      <Secao
        titulo="Registrar entrada ou perda"
        descricao="A reposição precisa ser registrada: sem ela, a contagem do dia seguinte acusaria uma falta que não existe."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Escolha
              etiqueta="Produto"
              valor={produtoId}
              aoMudar={setProdutoId}
              opcoes={produtos.map((produto) => ({
                valor: produto.id,
                rotulo: produto.ativo
                  ? produto.nome
                  : `${produto.nome} (desligado)`,
              }))}
            />

            <Escolha
              etiqueta="O que aconteceu"
              valor={tipo}
              aoMudar={setTipo}
              opcoes={LANCAVEIS}
              dica="Consumo de cliente não entra aqui — use “Lançar consumo”, que grava de quem foi."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Quantidade"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={quantidade}
              onChange={(evento) => setQuantidade(evento.target.value)}
              dica="Sempre positiva: o sistema sabe de que lado somar."
            />

            <Campo
              etiqueta={tipo === "PERDA" ? "Motivo" : "Motivo (opcional)"}
              value={motivo}
              maxLength={160}
              onChange={(evento) => setMotivo(evento.target.value)}
              placeholder={
                tipo === "PERDA" ? "Venceu, caiu, quebrou…" : "Nota, fornecedor…"
              }
            />
          </div>

          {escolhido ? (
            <p className="text-sm text-text-secondary">
              Estoque de {escolhido.nome} agora:{" "}
              <Estoque quantidade={escolhido.estoque} />
            </p>
          ) : null}

          <div className="flex justify-end">
            <Botao
              largura="conteudo"
              onClick={lancar}
              disabled={ocupado || quantidadeInvalida}
            >
              {ocupado ? "Lançando…" : "Lançar movimento"}
            </Botao>
          </div>
        </div>
      </Secao>

      <Secao
        titulo="Extrato do produto"
        descricao="Toda entrada e toda saída, da mais recente para a mais antiga. É daqui que sai a resposta de por que o estoque está no número que está."
      >
        {escolhido ? (
          <div className="mb-4 flex items-center gap-3">
            <FotoDoProduto
              nome={escolhido.nome}
              foto={escolhido.foto}
              tamanho="pequena"
            />

            <div>
              <p className="text-base font-semibold text-text-primary">
                {escolhido.nome}
              </p>
              <p className="text-sm text-text-secondary">
                estoque <Estoque quantidade={escolhido.estoque} />
              </p>
            </div>
          </div>
        ) : null}

        {carregandoExtrato ? (
          <Carregando texto="Carregando o extrato…" />
        ) : movimentos.length === 0 ? (
          <AvisoVazio>
            Nenhum movimento neste produto ainda. O estoque começa em zero e sobe
            com a primeira reposição.
          </AvisoVazio>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {movimentos.map((movimento) => (
              <li
                key={movimento.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="text-base text-text-primary">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      movimento.quantidade < 0
                        ? "text-destructive"
                        : "text-text-primary",
                    )}
                  >
                    {movimento.quantidade > 0 ? `+${movimento.quantidade}` : movimento.quantidade}
                  </span>{" "}
                  · {NOME_DO_TIPO[movimento.tipo]}
                  {movimento.motivo ? ` · ${movimento.motivo}` : ""}
                </span>

                <span className="text-sm text-text-secondary">
                  {new Date(movimento.criadoEm).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {movimento.lancadoPor ? ` · ${movimento.lancadoPor}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
