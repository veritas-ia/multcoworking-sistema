"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Secao, type Situacao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import {
  buscarConsumos,
  buscarProdutos,
  buscarSalas,
  lancarConsumo,
} from "./api";
import {
  centavosDe,
  emReaisDeCentavos,
  Escolha,
  FotoDoProduto,
  precoVisivel,
  totalVisivel,
} from "./pecas";
import { EscolherCliente } from "./escolher-cliente";
import type {
  CategoriaDoProduto,
  ClienteParaEscolher,
  ConsumoLancado,
  FormaDePagamento,
  MomentoDoPagamento,
  ProdutoDoEmporio,
  SalaParaEscolher,
} from "./tipos";

const CATEGORIAS: readonly { valor: "" | CategoriaDoProduto; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "BEBIDA", rotulo: "Geladeira" },
  { valor: "COMIDA", rotulo: "Chocolate" },
];

/**
 * LANÇAR O CONSUMO DA FICHA FÍSICA.
 *
 * A FICHA DE PAPEL CONTINUA, e esta tela existe para ler dela — não para
 * substituí-la. O cliente escreve nome, sala, produto e horário na parede; a
 * recepcionista lê no dia seguinte e lança aqui.
 *
 * O QUE MUDA, e é só isto: hoje alguém soma a ficha de cabeça e digita um
 * valor no fechamento do mês. Quem passa a somar é o sistema. A digitação
 * continua sendo da equipe — foi uma correção que o dono fez em cima da minha
 * própria explicação, e ele estava certo.
 *
 * O DIA E A HORA SÃO OS DO PAPEL, nunca os do lançamento: carimbar "agora"
 * faria o relatório dizer que todo mundo consome no fim do dia.
 */
export function AbaDeLancamento({ hoje }: { hoje: string }) {
  const [produtos, setProdutos] = useState<ProdutoDoEmporio[]>([]);
  const [formas, setFormas] = useState<FormaDePagamento[]>([]);
  const [salas, setSalas] = useState<SalaParaEscolher[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroAoAbrir, setErroAoAbrir] = useState<string | null>(null);

  // --- o formulário ---
  const [cliente, setCliente] = useState<ClienteParaEscolher | null>(null);
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [dia, setDia] = useState(hoje);
  const [hora, setHora] = useState("");
  const [salaId, setSalaId] = useState("");
  const [momento, setMomento] = useState<MomentoDoPagamento>("NA_HORA");
  const [formaPagamentoId, setFormaPagamentoId] = useState("");
  const [filtro, setFiltro] = useState("");
  const [categoria, setCategoria] = useState<"" | CategoriaDoProduto>("");
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });

  // --- a lista do dia, para conferir contra o papel ---
  const [lancados, setLancados] = useState<ConsumoLancado[]>([]);
  const [diaDaLista, setDiaDaLista] = useState(hoje);

  const recarregarLista = useCallback(
    async (quando: string) => {
      try {
        const resposta = await buscarConsumos({ de: quando, ate: quando });
        setLancados(resposta.consumos);
        setFormas(resposta.formasDePagamento);
      } catch {
        // A lista é conferência, não o lançamento: se ela falhar, a equipe
        // ainda consegue lançar. Travar o formulário por isso seria pior.
        setLancados([]);
      }
    },
    [],
  );

  useEffect(() => {
    let vivo = true;

    Promise.all([
      buscarProdutos({ somenteAtivos: true }),
      buscarSalas(),
      buscarConsumos({ de: hoje, ate: hoje }),
    ])
      .then(([doEmporio, dasSalas, dosConsumos]) => {
        if (!vivo) return;
        setProdutos(doEmporio.produtos);
        setSalas(dasSalas.salas);
        setLancados(dosConsumos.consumos);
        setFormas(dosConsumos.formasDePagamento);
        // A primeira forma já vem escolhida: no balcão, quase tudo é Pix, e
        // deixar o campo vazio faria a equipe escolher a mesma coisa toda vez.
        setFormaPagamentoId(dosConsumos.formasDePagamento[0]?.id ?? "");
        setCarregando(false);
      })
      .catch((erro: unknown) => {
        if (!vivo) return;
        setErroAoAbrir(
          erro instanceof ErroDaApi
            ? erro.message
            : "Não conseguimos abrir o empório.",
        );
        setCarregando(false);
      });

    return () => {
      vivo = false;
    };
  }, [hoje]);

  const visiveis = useMemo(() => {
    const alvo = filtro.trim().toLowerCase();

    return produtos.filter((produto) => {
      if (categoria && produto.categoria !== categoria) {
        return false;
      }

      if (!alvo) {
        return true;
      }

      return (
        produto.nome.toLowerCase().includes(alvo) ||
        produto.tags.some((tag) => tag.nome.toLowerCase().includes(alvo))
      );
    });
  }, [produtos, filtro, categoria]);

  const escolhido = produtos.find((produto) => produto.id === produtoId) ?? null;

  /**
   * A PRÉVIA do total, e só prévia.
   *
   * Quem multiplica de verdade é o servidor — a rota não aceita total. Isto
   * aqui existe para a recepcionista comparar com o que está escrito no papel
   * ANTES de salvar, que é justamente a conferência que não existia quando
   * alguém somava a ficha de cabeça.
   */
  const previaDoTotal = escolhido
    ? emReaisDeCentavos(centavosDe(escolhido.preco) * quantidade)
    : null;

  const faltaForma = momento === "NA_HORA" && formas.length > 0 && !formaPagamentoId;

  const invalido =
    !cliente ||
    !produtoId ||
    quantidade < 1 ||
    !dia ||
    !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(hora) ||
    faltaForma;

  async function salvar(): Promise<void> {
    if (!cliente) return;

    setSituacao({ tipo: "salvando" });

    try {
      const { consumo } = await lancarConsumo({
        clienteId: cliente.id,
        produtoId,
        quantidade,
        dia,
        hora,
        salaId: salaId || null,
        momento,
        // No NA_MENSALIDADE ainda não foi pago: mandar a forma ali seria
        // dizer que aconteceu um pagamento que não aconteceu. O servidor
        // ignora, e aqui nem enviamos.
        formaPagamentoId: momento === "NA_HORA" ? formaPagamentoId || null : null,
      });

      setSituacao({
        tipo: "salvo",
        mensagem: `${consumo.quantidade}× ${consumo.produtoNome} · ${precoVisivel(consumo.valor)} para ${consumo.clienteNome}.`,
      });

      // O ESTOQUE MUDOU: o consumo deu baixa. Sem recarregar, a tela
      // continuaria mostrando o número velho e a equipe contaria errado na
      // ficha do dia seguinte.
      buscarProdutos({ somenteAtivos: true })
        .then((resposta) => setProdutos(resposta.produtos))
        .catch(() => undefined);

      // O que fica e o que limpa: o cliente e o dia PERMANECEM, porque a ficha
      // costuma ter várias linhas da mesma pessoa no mesmo dia. Produto, hora e
      // quantidade voltam ao início — são o que muda linha a linha.
      setProdutoId("");
      setQuantidade(1);
      setHora("");

      if (dia === diaDaLista) {
        setLancados((atuais) => [consumo, ...atuais]);
      }
    } catch (erro: unknown) {
      setSituacao({
        tipo: "erro",
        mensagem:
          erro instanceof ErroDaApi
            ? erro.message
            : "Não conseguimos lançar o consumo.",
      });
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo o empório…" />;
  }

  if (erroAoAbrir) {
    return <AvisoDeErro mensagem={erroAoAbrir} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Lançar o que foi consumido"
        descricao="Leia a ficha da parede e lance linha por linha. O dia e a hora são os que estão escritos no papel, não os de agora."
      >
        <div className="flex flex-col gap-5">
          <EscolherCliente
            escolhido={cliente}
            aoEscolher={setCliente}
            aoLimpar={() => setCliente(null)}
          />

          {/* --- O PRODUTO, com foto --- */}
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-text-primary">Produto</span>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="search"
                value={filtro}
                onChange={(evento) => setFiltro(evento.target.value)}
                placeholder="Filtrar por nome ou etiqueta"
                aria-label="Filtrar produtos"
                className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
              />

              <div
                role="group"
                aria-label="Ficha"
                className="flex shrink-0 gap-1.5 rounded-lg border border-border bg-bg-primary p-1.5"
              >
                {CATEGORIAS.map((opcao) => (
                  <button
                    key={opcao.valor || "todos"}
                    type="button"
                    aria-pressed={categoria === opcao.valor}
                    onClick={() => setCategoria(opcao.valor)}
                    className={cn(
                      "min-h-10 flex-1 rounded-md px-3 text-sm font-semibold",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                      categoria === opcao.valor
                        ? "bg-brand text-brand-foreground"
                        : "text-text-secondary hover:bg-bg-secondary",
                    )}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>
            </div>

            {visiveis.length === 0 ? (
              <AvisoVazio>Nenhum produto com esse filtro.</AvisoVazio>
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {visiveis.map((produto) => {
                  const selecionado = produto.id === produtoId;

                  return (
                    <li key={produto.id}>
                      <button
                        type="button"
                        aria-pressed={selecionado}
                        onClick={() => setProdutoId(produto.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                          selecionado
                            ? "border-black bg-bg-secondary"
                            : "border-border bg-bg-primary hover:bg-bg-secondary",
                        )}
                      >
                        <FotoDoProduto
                          nome={produto.nome}
                          foto={produto.foto}
                          tamanho="pequena"
                        />

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-text-primary">
                            {produto.nome}
                          </span>
                          <span className="block text-sm text-text-secondary">
                            {/*
                              Preço zero é informação, não falta de cadastro:
                              os doze botões da máquina de café são de graça e
                              existem porque a máquina conta o consumo.
                            */}
                            {Number(produto.preco) === 0
                              ? "cortesia"
                              : precoVisivel(produto.preco)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* --- QUANTIDADE, DIA, HORA --- */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">
                Quantidade
              </span>

              <div className="flex items-center gap-2">
                <Botao
                  aparencia="secundario"
                  largura="conteudo"
                  aria-label="Diminuir a quantidade"
                  onClick={() => setQuantidade((atual) => Math.max(1, atual - 1))}
                  disabled={quantidade <= 1}
                >
                  −
                </Botao>

                <span
                  aria-live="polite"
                  className="min-w-12 text-center text-lg font-bold tabular-nums text-text-primary"
                >
                  {quantidade}
                </span>

                <Botao
                  aparencia="secundario"
                  largura="conteudo"
                  aria-label="Aumentar a quantidade"
                  onClick={() => setQuantidade((atual) => atual + 1)}
                >
                  +
                </Botao>
              </div>
            </div>

            <Campo
              etiqueta="Dia da ficha"
              type="date"
              value={dia}
              max={hoje}
              onChange={(evento) => setDia(evento.target.value)}
              dica="O dia escrito no papel."
            />

            <Campo
              etiqueta="Hora da ficha"
              type="time"
              value={hora}
              onChange={(evento) => setHora(evento.target.value)}
              dica="Como está no papel: 09:40."
            />
          </div>

          {/* --- SALA E FORMA DE FECHAR --- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Escolha
              etiqueta="Sala (opcional)"
              valor={salaId}
              aoMudar={setSalaId}
              opcoes={[
                { valor: "", rotulo: "Não anotado" },
                ...salas.map((sala) => ({ valor: sala.id, rotulo: sala.nome })),
              ]}
              dica="A ficha pede a sala; quando não estiver escrita, deixe em branco."
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">
                Como fechou
              </span>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { valor: "NA_HORA", rotulo: "Pagou na hora" },
                    { valor: "NA_MENSALIDADE", rotulo: "Na mensalidade" },
                  ] as const
                ).map((opcao) => (
                  <button
                    key={opcao.valor}
                    type="button"
                    aria-pressed={momento === opcao.valor}
                    onClick={() => setMomento(opcao.valor)}
                    className={cn(
                      "min-h-12 rounded-lg border px-3 text-sm font-semibold",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                      momento === opcao.valor
                        ? "border-black bg-bg-secondary text-text-primary"
                        : "border-border bg-bg-primary text-text-secondary hover:bg-bg-secondary",
                    )}
                  >
                    {opcao.rotulo}
                  </button>
                ))}
              </div>

              <p className="text-sm text-text-secondary">
                Não existe comanda: ou a pessoa paga agora, ou entra no
                fechamento do mês dela.
              </p>
            </div>
          </div>

          {/*
            A FORMA DE PAGAMENTO SÓ APARECE NO "pagou na hora". No
            "na mensalidade" ainda não houve pagamento: gravar uma forma ali
            faria o relatório de formas contar dinheiro que ninguém recebeu.
            O banco também recusa — a regra é dele, não só da tela.
          */}
          {momento === "NA_HORA" ? (
            formas.length > 0 ? (
              <Escolha
                etiqueta="Forma de pagamento"
                valor={formaPagamentoId}
                aoMudar={setFormaPagamentoId}
                opcoes={formas.map((forma) => ({
                  valor: forma.id,
                  rotulo: forma.nome,
                }))}
              />
            ) : (
              <AvisoVazio>
                Nenhuma forma de pagamento cadastrada. O consumo entra sem ela.
              </AvisoVazio>
            )
          ) : null}

          {/* --- O TOTAL E O BOTÃO --- */}
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-text-secondary" aria-live="polite">
              {previaDoTotal ? (
                <>
                  <span className="font-semibold text-text-primary">
                    {quantidade}× {escolhido?.nome} = {previaDoTotal}
                  </span>{" "}
                  — confira com o papel antes de salvar.
                </>
              ) : (
                "Escolha o cliente e o produto."
              )}
            </p>

            <Botao largura="conteudo" onClick={salvar} disabled={invalido || situacao.tipo === "salvando"}>
              {situacao.tipo === "salvando" ? "Lançando…" : "Lançar consumo"}
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

      {/* --- A CONFERÊNCIA CONTRA O PAPEL --- */}
      <Secao
        titulo="O que já foi lançado"
        descricao="Compare com a ficha da parede: o que estiver no papel e não estiver aqui, falta lançar."
      >
        <div className="flex flex-col gap-4">
          <div className="sm:max-w-60">
            <Campo
              etiqueta="Dia"
              type="date"
              value={diaDaLista}
              max={hoje}
              onChange={(evento) => {
                setDiaDaLista(evento.target.value);
                void recarregarLista(evento.target.value);
              }}
            />
          </div>

          {lancados.length === 0 ? (
            <AvisoVazio>Nada lançado neste dia.</AvisoVazio>
          ) : (
            <>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {lancados.map((consumo) => (
                  <li
                    key={consumo.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3"
                  >
                    <span className="text-base text-text-primary">
                      <span className="font-semibold">
                        {consumo.quantidade}× {consumo.produtoNome}
                      </span>{" "}
                      · {consumo.clienteNome}
                    </span>

                    <span className="text-sm text-text-secondary">
                      {consumo.hora}
                      {consumo.sala ? ` · ${consumo.sala}` : ""} ·{" "}
                      {consumo.momento === "NA_HORA"
                        ? (consumo.formaPagamento ?? "pagou na hora")
                        : "na mensalidade"}{" "}
                      · {precoVisivel(consumo.valor)}
                    </span>
                  </li>
                ))}
              </ul>

              {/*
                O total do dia é SOMADO AQUI a partir das linhas que vieram do
                servidor, e cada linha carrega o valor congelado no lançamento.
                É a conta que ninguém fazia: a ficha da parede não tem total.
              */}
              <p className="text-sm text-text-secondary">
                {lancados.length} {lancados.length === 1 ? "linha" : "linhas"} ·
                total do dia{" "}
                <span className="font-semibold text-text-primary">
                  {totalVisivel(lancados.map((consumo) => consumo.valor))}
                </span>
              </p>
            </>
          )}
        </div>
      </Secao>
    </div>
  );
}
