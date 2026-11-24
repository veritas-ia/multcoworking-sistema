"use client";

import { useEffect, useState } from "react";

import { Secao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import {
  buscarCategorias,
  criarCategoria,
  editarCategoria,
  reordenarCategorias,
} from "./api";
import type { CategoriaNaTela, TipoDeLancamento } from "./tipos";

/**
 * AS CATEGORIAS DE RECEITA E DESPESA.
 *
 * As 18 iniciais entram pela MIGRAÇÃO, não pelo seed: o deploy roda
 * `migrate deploy` e não roda o seed, e categoria só no seed deixaria a tela
 * de lançamento sem opção nenhuma em produção.
 *
 * DUAS COISAS NÃO MUDAM NUNCA, e as duas por boas razões:
 *
 *  - **o lado** (entrada ou saída): virá-lo inverteria o sinal de todo
 *    lançamento que aponta para a categoria — meses de caixa mudariam de lado
 *    de uma vez, e cada linha continuaria parecendo certa. Para trocar o lado,
 *    cria-se outra categoria;
 *  - **o nome interno**: é ele que amarra a categoria ao que já está gravado.
 *
 * RENOMEAR, por outro lado, troca o rótulo em todo lugar — inclusive nos
 * lançamentos antigos. Isso é o desejado: eles apontam para a categoria e não
 * guardam o texto, então categoria que mudou de nome não vira duas no
 * relatório. Mesma regra das empresas e das áreas de atuação.
 *
 * EXCLUIR NÃO EXISTE: desliga-se.
 */
export function AbaDeCategorias() {
  const [categorias, setCategorias] = useState<CategoriaNaTela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [lado, setLado] = useState<TipoDeLancamento>("SAIDA");
  const [novoNome, setNovoNome] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  useEffect(() => {
    buscarCategorias()
      .then((resposta) => {
        setCategorias(resposta.categorias);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        setErro(
          falha instanceof ErroDaApi
            ? falha.message
            : "Não conseguimos abrir as categorias.",
        );
        setCarregando(false);
      });
  }, []);

  const doLado = categorias.filter((categoria) => categoria.tipo === lado);

  function avisar(falha: unknown, padrao: string): void {
    setErro(falha instanceof ErroDaApi ? falha.message : padrao);
  }

  async function cadastrar(): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { categoria } = await criarCategoria({ nome: novoNome.trim(), tipo: lado });
      setCategorias((atuais) => [...atuais, categoria]);
      setNovoNome("");
      setRecado(`${categoria.nome} cadastrada.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos cadastrar a categoria.");
    } finally {
      setOcupado(false);
    }
  }

  async function salvarNome(id: string): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { categoria } = await editarCategoria(id, { nome: nome.trim() });
      setCategorias((atuais) =>
        atuais.map((uma) => (uma.id === id ? categoria : uma)),
      );
      setEditandoId(null);
      setRecado(
        `${categoria.nome} salva. O nome novo vale também nos lançamentos antigos.`,
      );
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos salvar a categoria.");
    } finally {
      setOcupado(false);
    }
  }

  async function ligarOuDesligar(categoria: CategoriaNaTela): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const salva = await editarCategoria(categoria.id, { ativa: !categoria.ativa });
      setCategorias((atuais) =>
        atuais.map((uma) => (uma.id === categoria.id ? salva.categoria : uma)),
      );
      setRecado(
        salva.categoria.ativa
          ? `${salva.categoria.nome} voltou para a lista.`
          : `${salva.categoria.nome} saiu das telas de lançamento. Os lançamentos dela continuam de pé.`,
      );
    } catch (falha: unknown) {
      // A recusa mais comum aqui é a da ÚLTIMA categoria ativa do lado: sem
      // nenhuma, ninguém consegue lançar e o erro apareceria como "escolha a
      // categoria" numa lista vazia.
      avisar(falha, "Não conseguimos mudar a categoria.");
    } finally {
      setOcupado(false);
    }
  }

  /** Move dentro do lado. A ordem é por lado, e as duas listas são separadas. */
  async function mover(indice: number, direcao: -1 | 1): Promise<void> {
    const destino = indice + direcao;

    if (destino < 0 || destino >= doLado.length) {
      return;
    }

    const nova = [...doLado];
    const [movida] = nova.splice(indice, 1);
    nova.splice(destino, 0, movida!);

    setOcupado(true);

    try {
      const { categorias: todas } = await reordenarCategorias(
        nova.map((uma) => uma.id),
      );
      setCategorias(todas);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos gravar a ordem.");
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo as categorias…" />;
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
        titulo="Categorias"
        descricao="É a categoria que diz se o dinheiro entra ou sai. O lado dela nunca muda — para trocar, cadastre outra."
      >
        <div className="flex flex-col gap-4">
          <div
            role="group"
            aria-label="Entradas ou saídas"
            className="flex gap-1.5 rounded-lg border border-border p-1.5 sm:max-w-80"
          >
            {(
              [
                { valor: "SAIDA", rotulo: "Saídas" },
                { valor: "ENTRADA", rotulo: "Entradas" },
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

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Campo
                etiqueta={`Nova categoria de ${lado === "SAIDA" ? "saída" : "entrada"}`}
                value={novoNome}
                onChange={(evento) => setNovoNome(evento.target.value)}
                placeholder={lado === "SAIDA" ? "Jardinagem" : "Aluguel de armário"}
              />
            </div>

            <Botao
              largura="conteudo"
              onClick={cadastrar}
              disabled={ocupado || novoNome.trim().length < 2}
            >
              Cadastrar
            </Botao>
          </div>

          {doLado.length === 0 ? (
            <AvisoVazio>Nenhuma categoria deste lado ainda.</AvisoVazio>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {doLado.map((categoria, indice) => (
                <li
                  key={categoria.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  {editandoId === categoria.id ? (
                    <>
                      <div className="min-w-0 flex-1">
                        <Campo
                          etiqueta="Nome"
                          value={nome}
                          onChange={(evento) => setNome(evento.target.value)}
                          dica="O nome novo aparece também nos lançamentos antigos."
                        />
                      </div>

                      <Botao
                        largura="conteudo"
                        onClick={() => void salvarNome(categoria.id)}
                        disabled={ocupado || nome.trim().length < 2}
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
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-base font-semibold",
                            categoria.ativa
                              ? "text-text-primary"
                              : "text-text-secondary",
                          )}
                        >
                          {categoria.nome}
                          {!categoria.ativa ? (
                            <span className="ml-2 text-sm font-normal text-text-secondary">
                              (desligada — fora das telas de lançamento,
                              histórico mantido)
                            </span>
                          ) : null}
                        </p>

                        <p className="mt-0.5 text-sm text-text-secondary">
                          {categoria.lancamentos === 0
                            ? "nenhum lançamento"
                            : categoria.lancamentos === 1
                              ? "1 lançamento"
                              : `${categoria.lancamentos} lançamentos`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Mover ${categoria.nome} para cima`}
                          onClick={() => void mover(indice, -1)}
                          disabled={ocupado || indice === 0}
                          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-primary hover:bg-bg-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        >
                          <span aria-hidden>↑</span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Mover ${categoria.nome} para baixo`}
                          onClick={() => void mover(indice, 1)}
                          disabled={ocupado || indice === doLado.length - 1}
                          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-primary hover:bg-bg-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        >
                          <span aria-hidden>↓</span>
                        </button>

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          disabled={ocupado}
                          onClick={() => {
                            setEditandoId(categoria.id);
                            setNome(categoria.nome);
                          }}
                        >
                          Renomear
                        </Botao>

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          disabled={ocupado}
                          onClick={() => void ligarOuDesligar(categoria)}
                        >
                          {categoria.ativa ? "Desligar" : "Religar"}
                        </Botao>
                      </div>
                    </>
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
