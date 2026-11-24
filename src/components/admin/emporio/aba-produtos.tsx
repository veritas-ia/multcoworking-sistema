"use client";

import { useEffect, useState } from "react";

import { Secao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import {
  buscarProdutos,
  criarProduto,
  enviarFotoDoProduto,
  mudarProduto,
  removerFotoDoProduto,
  reordenarProdutos,
} from "./api";
import {
  Escolha,
  Estoque,
  Etiqueta,
  FotoDoProduto,
  NOME_DA_CATEGORIA,
  precoVisivel,
} from "./pecas";
import type { CategoriaDoProduto, ProdutoDoEmporio, TagDoPainel } from "./tipos";

/** O que a tela confere antes de mandar: "6", "6.5", "6,50". */
const PRECO = /^\d{1,6}([.,]\d{1,2})?$/;

/**
 * O CATÁLOGO DO EMPÓRIO.
 *
 * O catálogo veio das FICHAS FÍSICAS e das plaquinhas, conferido um a um — a
 * lista da geladeira bateu com a tabela de preços colada na porta (10 de 10) e
 * a do chocolate com as etiquetas do expositor (8 de 8).
 *
 * EXCLUIR NÃO EXISTE, mesma regra de salas, empresas e áreas de atuação:
 * apagar um produto tiraria o histórico de vendas em silêncio, e a chave
 * estrangeira do banco recusaria de todo jeito. Desligar tira o produto das
 * telas de lançamento e da contagem, e o histórico fica inteiro.
 */
export function AbaDeProdutos() {
  const [produtos, setProdutos] = useState<ProdutoDoEmporio[]>([]);
  const [tags, setTags] = useState<TagDoPainel[]>([]);
  const [envioDisponivel, setEnvioDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // --- cadastro de produto novo ---
  const [novoNome, setNovoNome] = useState("");
  const [novaCategoria, setNovaCategoria] = useState<CategoriaDoProduto>("BEBIDA");
  const [novoPreco, setNovoPreco] = useState("");
  const [novasTags, setNovasTags] = useState<string[]>([]);
  const [abrindoCadastro, setAbrindoCadastro] = useState(false);

  // --- edição ---
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDoProduto>("BEBIDA");
  const [tagsEscolhidas, setTagsEscolhidas] = useState<string[]>([]);

  useEffect(() => {
    buscarProdutos()
      .then((resposta) => {
        setProdutos(resposta.produtos);
        setTags(resposta.tags);
        setEnvioDisponivel(resposta.envioDeImagemDisponivel);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        setErro(
          falha instanceof ErroDaApi
            ? falha.message
            : "Não conseguimos abrir o catálogo.",
        );
        setCarregando(false);
      });
  }, []);

  function trocarNaLista(produto: ProdutoDoEmporio): void {
    setProdutos((atuais) =>
      atuais.map((item) => (item.id === produto.id ? produto : item)),
    );
  }

  function avisar(falha: unknown, padrao: string): void {
    setErro(falha instanceof ErroDaApi ? falha.message : padrao);
  }

  function abrirEdicao(produto: ProdutoDoEmporio): void {
    setEditandoId(produto.id);
    setNome(produto.nome);
    setPreco(produto.preco);
    setCategoria(produto.categoria);
    setTagsEscolhidas(produto.tags.map((tag) => tag.id));
    setErro(null);
    setRecado(null);
  }

  async function salvarEdicao(): Promise<void> {
    if (!editandoId) return;

    setOcupado(true);
    setErro(null);

    try {
      const { produto } = await mudarProduto(editandoId, {
        nome: nome.trim(),
        preco: preco.replace(",", "."),
        categoria,
        tagIds: tagsEscolhidas,
      });

      trocarNaLista(produto);
      setEditandoId(null);
      setRecado(`${produto.nome} salvo.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos salvar o produto.");
    } finally {
      setOcupado(false);
    }
  }

  async function ligarOuDesligar(produto: ProdutoDoEmporio): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const resposta = await mudarProduto(produto.id, { ativo: !produto.ativo });
      trocarNaLista(resposta.produto);
      setRecado(
        resposta.produto.ativo
          ? `${resposta.produto.nome} voltou para a lista.`
          : `${resposta.produto.nome} saiu da lista. O histórico de vendas fica.`,
      );
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos mudar o produto.");
    } finally {
      setOcupado(false);
    }
  }

  async function cadastrar(): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { produto } = await criarProduto({
        nome: novoNome.trim(),
        categoria: novaCategoria,
        preco: novoPreco.replace(",", "."),
        tagIds: novasTags,
      });

      setProdutos((atuais) => [...atuais, produto]);
      setNovoNome("");
      setNovoPreco("");
      setNovasTags([]);
      setAbrindoCadastro(false);
      setRecado(`${produto.nome} cadastrado.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos cadastrar o produto.");
    } finally {
      setOcupado(false);
    }
  }

  /**
   * Move o produto uma posição.
   *
   * POR BOTÃO, E NÃO ARRASTANDO: a recepção mexe no tablet, onde arrastar é
   * ruim, e arrastar não funciona pelo teclado. Mesma decisão das fotos das
   * salas e das áreas de atuação. A lista inteira é regravada em bloco, para
   * nunca haver dois produtos na mesma posição.
   */
  async function mover(indice: number, direcao: -1 | 1): Promise<void> {
    const destino = indice + direcao;

    if (destino < 0 || destino >= produtos.length) {
      return;
    }

    const nova = [...produtos];
    const [movido] = nova.splice(indice, 1);
    nova.splice(destino, 0, movido!);

    // A tela muda primeiro: esperar o servidor para redesenhar faria a lista
    // "pular" a cada clique, e a equipe reordena vários de uma vez.
    setProdutos(nova);
    setOcupado(true);

    try {
      const resposta = await reordenarProdutos(nova.map((item) => item.id));
      setProdutos(resposta.produtos);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos gravar a ordem.");
      // Volta ao que o servidor tem: deixar a tela numa ordem que não foi
      // gravada faria a equipe acreditar num arranjo que não existe.
      buscarProdutos()
        .then((resposta) => setProdutos(resposta.produtos))
        .catch(() => undefined);
    } finally {
      setOcupado(false);
    }
  }

  async function enviarFoto(produtoId: string, arquivo: File): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { produto } = await enviarFotoDoProduto(produtoId, arquivo);
      trocarNaLista(produto);
      setRecado(`Imagem de ${produto.nome} atualizada.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos enviar a imagem.");
    } finally {
      setOcupado(false);
    }
  }

  async function tirarFoto(produto: ProdutoDoEmporio): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { arquivoApagado } = await removerFotoDoProduto(produto.id);
      trocarNaLista({ ...produto, foto: null });
      setRecado(
        arquivoApagado
          ? "Imagem removida."
          : "Imagem removida da tela. O arquivo pode ter ficado no Cloudinary.",
      );
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos remover a imagem.");
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo o catálogo…" />;
  }

  const precoNovoInvalido = novoPreco.trim() !== "" && !PRECO.test(novoPreco.trim());
  const precoInvalido = preco.trim() !== "" && !PRECO.test(preco.trim());

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
        titulo="Produtos"
        descricao="O que está na geladeira e no expositor. Produto nunca se exclui — desligue para tirar das telas de lançamento, e o histórico de vendas fica."
      >
        <div className="flex flex-col gap-4">
          {!abrindoCadastro ? (
            <Botao
              aparencia="secundario"
              largura="conteudo"
              onClick={() => setAbrindoCadastro(true)}
            >
              Cadastrar produto
            </Botao>
          ) : (
            <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-secondary p-4">
              <h3 className="text-sm font-bold text-text-primary">
                Produto novo
              </h3>

              <div className="grid gap-4 sm:grid-cols-3">
                <Campo
                  etiqueta="Nome"
                  value={novoNome}
                  onChange={(evento) => setNovoNome(evento.target.value)}
                  placeholder="Água com gás"
                />

                <Escolha
                  etiqueta="Ficha"
                  valor={novaCategoria}
                  aoMudar={setNovaCategoria}
                  opcoes={[
                    { valor: "BEBIDA", rotulo: "Bebida (geladeira)" },
                    { valor: "COMIDA", rotulo: "Comida (chocolate)" },
                  ]}
                />

                <Campo
                  etiqueta="Preço"
                  value={novoPreco}
                  inputMode="decimal"
                  onChange={(evento) => setNovoPreco(evento.target.value)}
                  placeholder="6,00"
                  erro={precoNovoInvalido ? "Escreva como 6,00." : null}
                  dica="Zero quando é cortesia, como os cafés."
                />
              </div>

              <EscolhaDeTags
                tags={tags}
                escolhidas={novasTags}
                aoMudar={setNovasTags}
              />

              <div className="flex flex-wrap gap-2">
                <Botao
                  largura="conteudo"
                  onClick={cadastrar}
                  disabled={
                    ocupado ||
                    novoNome.trim().length < 2 ||
                    novoPreco.trim() === "" ||
                    precoNovoInvalido
                  }
                >
                  Cadastrar
                </Botao>

                <Botao
                  aparencia="secundario"
                  largura="conteudo"
                  onClick={() => setAbrindoCadastro(false)}
                  disabled={ocupado}
                >
                  Cancelar
                </Botao>
              </div>
            </div>
          )}

          {!envioDisponivel ? (
            /*
              CREDENCIAIS VAZIAS SÃO ESTADO NORMAL, não erro — na prévia elas
              ficam vazias de propósito, para apagar uma foto aqui não apagar o
              arquivo que o site de verdade usa. As fotos que já existem
              continuam aparecendo.
            */
            <p className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm text-text-secondary">
              O envio de imagens está indisponível neste ambiente. As fotos que
              já existem continuam aparecendo.
            </p>
          ) : null}

          {produtos.length === 0 ? (
            <AvisoVazio>Nenhum produto cadastrado ainda.</AvisoVazio>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {produtos.map((produto, indice) => (
                <li key={produto.id} className="p-4">
                  {editandoId === produto.id ? (
                    <div className="flex flex-col gap-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Campo
                          etiqueta="Nome"
                          value={nome}
                          onChange={(evento) => setNome(evento.target.value)}
                        />

                        <Escolha
                          etiqueta="Ficha"
                          valor={categoria}
                          aoMudar={setCategoria}
                          opcoes={[
                            { valor: "BEBIDA", rotulo: "Bebida (geladeira)" },
                            { valor: "COMIDA", rotulo: "Comida (chocolate)" },
                          ]}
                        />

                        <Campo
                          etiqueta="Preço"
                          value={preco}
                          inputMode="decimal"
                          onChange={(evento) => setPreco(evento.target.value)}
                          erro={precoInvalido ? "Escreva como 6,00." : null}
                          dica="Mudar o preço não altera o que já foi consumido."
                        />
                      </div>

                      <EscolhaDeTags
                        tags={tags}
                        escolhidas={tagsEscolhidas}
                        aoMudar={setTagsEscolhidas}
                      />

                      <div className="flex flex-wrap gap-2">
                        <Botao
                          largura="conteudo"
                          onClick={salvarEdicao}
                          disabled={
                            ocupado || nome.trim().length < 2 || precoInvalido
                          }
                        >
                          Salvar
                        </Botao>

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          onClick={() => setEditandoId(null)}
                          disabled={ocupado}
                        >
                          Cancelar
                        </Botao>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <FotoDoProduto nome={produto.nome} foto={produto.foto} />

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-base font-semibold",
                              produto.ativo
                                ? "text-text-primary"
                                : "text-text-secondary",
                            )}
                          >
                            {produto.nome}
                          </span>

                          {!produto.ativo ? (
                            <span className="text-sm text-text-secondary">
                              (desligado)
                            </span>
                          ) : null}

                          {produto.tags.map((tag) => (
                            <Etiqueta key={tag.id} tag={tag} />
                          ))}
                        </p>

                        <p className="mt-0.5 text-sm text-text-secondary">
                          {NOME_DA_CATEGORIA[produto.categoria]} ·{" "}
                          {Number(produto.preco) === 0
                            ? "cortesia"
                            : precoVisivel(produto.preco)}{" "}
                          · estoque <Estoque quantidade={produto.estoque} />
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <BotaoDeMover
                          rotulo={`Mover ${produto.nome} para cima`}
                          sinal="↑"
                          desabilitado={ocupado || indice === 0}
                          aoClicar={() => void mover(indice, -1)}
                        />

                        <BotaoDeMover
                          rotulo={`Mover ${produto.nome} para baixo`}
                          sinal="↓"
                          desabilitado={ocupado || indice === produtos.length - 1}
                          aoClicar={() => void mover(indice, 1)}
                        />

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          onClick={() => abrirEdicao(produto)}
                          disabled={ocupado}
                        >
                          Editar
                        </Botao>

                        {envioDisponivel ? (
                          <label
                            className={cn(
                              "inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-border bg-bg-primary px-4 text-base font-semibold text-text-primary hover:bg-bg-secondary",
                              ocupado && "pointer-events-none opacity-60",
                            )}
                          >
                            {produto.foto ? "Trocar foto" : "Pôr foto"}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(evento) => {
                                const arquivo = evento.target.files?.[0];
                                // O campo é limpo para a mesma imagem poder
                                // ser escolhida de novo depois de uma falha.
                                evento.target.value = "";
                                if (arquivo) {
                                  void enviarFoto(produto.id, arquivo);
                                }
                              }}
                            />
                          </label>
                        ) : null}

                        {produto.foto ? (
                          <Botao
                            aparencia="secundario"
                            largura="conteudo"
                            onClick={() => void tirarFoto(produto)}
                            disabled={ocupado}
                          >
                            Tirar foto
                          </Botao>
                        ) : null}

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          onClick={() => void ligarOuDesligar(produto)}
                          disabled={ocupado}
                        >
                          {produto.ativo ? "Desligar" : "Religar"}
                        </Botao>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Secao>
    </div>
  );
}

/** Botão quadrado de mover, com o nome do produto no rótulo invisível. */
function BotaoDeMover({
  rotulo,
  sinal,
  desabilitado,
  aoClicar,
}: {
  rotulo: string;
  sinal: string;
  desabilitado: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={aoClicar}
      disabled={desabilitado}
      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-primary hover:bg-bg-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
    >
      <span aria-hidden>{sinal}</span>
    </button>
  );
}

/**
 * As etiquetas do produto.
 *
 * VÁRIAS por produto, de propósito: o Chocobiscuit é chocolate *e* biscoito, e
 * obrigar a escolher uma faria a equipe perder um dos dois jeitos de achar.
 */
function EscolhaDeTags({
  tags,
  escolhidas,
  aoMudar,
}: {
  tags: TagDoPainel[];
  escolhidas: string[];
  aoMudar: (ids: string[]) => void;
}) {
  const disponiveis = tags.filter(
    (tag) => tag.ativa || escolhidas.includes(tag.id),
  );

  if (disponiveis.length === 0) {
    return null;
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-text-primary">
        Etiquetas
      </legend>

      <div className="flex flex-wrap gap-1.5">
        {disponiveis.map((tag) => {
          const marcada = escolhidas.includes(tag.id);

          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={marcada}
              onClick={() =>
                aoMudar(
                  marcada
                    ? escolhidas.filter((id) => id !== tag.id)
                    : [...escolhidas, tag.id],
                )
              }
              style={marcada ? { backgroundColor: tag.cor, borderColor: tag.cor } : { borderColor: tag.cor, color: tag.cor }}
              className={cn(
                "min-h-10 rounded-full border px-3 text-sm font-semibold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                // Texto PRETO na etiqueta marcada: as nove cores do empório
                // são claras, e branco em cima delas fica ilegível.
                marcada ? "text-black" : "bg-bg-primary",
              )}
            >
              {tag.nome}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
