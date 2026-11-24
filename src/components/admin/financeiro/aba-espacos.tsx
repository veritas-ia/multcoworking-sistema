"use client";

import { useEffect, useState } from "react";

import { Secao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import {
  buscarEspacos,
  criarEspaco,
  editarEspaco,
  reordenarEspacos,
} from "./api";
import type { EspacoNaTela } from "./tipos";

/**
 * OS ESPAÇOS ALUGADOS POR MÊS — as salas privativas do coworking.
 *
 * POR QUE ELES NÃO SÃO "SALAS", e isto é o ponto desta tela: a tabela de
 * salas é a da AGENDA. Uma linha ali aparece no site público para qualquer um
 * reservar por hora, entra na grade de disponibilidade e nas travas de
 * sobreposição. Se as privativas entrassem lá, um cliente poderia reservar por
 * hora a sala que outro aluga por mês.
 *
 * Daqui vem a maior parte do dinheiro do coworking — e o sistema nunca a viu:
 * ele cuidava só das 3 salas alugadas por hora.
 *
 * EXCLUIR NÃO EXISTE: desliga-se. E espaço com contrato VIGENTE não se
 * desliga, porque o contrato continuaria cobrando — a equipe veria um espaço
 * "fora do ar" gerando dinheiro todo mês.
 */
export function AbaDeEspacos() {
  const [espacos, setEspacos] = useState<EspacoNaTela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [novoNome, setNovoNome] = useState("");
  const [novaObservacao, setNovaObservacao] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    buscarEspacos()
      .then((resposta) => {
        setEspacos(resposta.espacos);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        setErro(
          falha instanceof ErroDaApi
            ? falha.message
            : "Não conseguimos abrir os espaços.",
        );
        setCarregando(false);
      });
  }, []);

  function avisar(falha: unknown, padrao: string): void {
    setErro(falha instanceof ErroDaApi ? falha.message : padrao);
  }

  async function cadastrar(): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { espaco } = await criarEspaco({
        nome: novoNome.trim(),
        observacao: novaObservacao.trim() || null,
      });

      setEspacos((atuais) => [...atuais, espaco]);
      setNovoNome("");
      setNovaObservacao("");
      setRecado(`${espaco.nome} cadastrado.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos cadastrar o espaço.");
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(id: string): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { espaco } = await editarEspaco(id, {
        nome: nome.trim(),
        observacao: observacao.trim() || null,
      });

      setEspacos((atuais) => atuais.map((um) => (um.id === id ? espaco : um)));
      setEditandoId(null);
      setRecado(`${espaco.nome} salvo.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos salvar o espaço.");
    } finally {
      setOcupado(false);
    }
  }

  async function ligarOuDesligar(espaco: EspacoNaTela): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const salvo = await editarEspaco(espaco.id, { ativo: !espaco.ativo });

      setEspacos((atuais) =>
        atuais.map((um) => (um.id === espaco.id ? salvo.espaco : um)),
      );
      setRecado(
        salvo.espaco.ativo
          ? `${salvo.espaco.nome} voltou para a lista.`
          : `${salvo.espaco.nome} saiu da lista de escolha. Os contratos antigos dele continuam no histórico.`,
      );
    } catch (falha: unknown) {
      // A recusa mais comum é a do espaço OCUPADO: desligar deixaria o
      // contrato vigente cobrando um espaço "fora do ar".
      avisar(falha, "Não conseguimos mudar o espaço.");
    } finally {
      setOcupado(false);
    }
  }

  /** Move uma posição. Por BOTÃO, não arrastando — a recepção mexe no tablet. */
  async function mover(indice: number, direcao: -1 | 1): Promise<void> {
    const destino = indice + direcao;

    if (destino < 0 || destino >= espacos.length) {
      return;
    }

    const nova = [...espacos];
    const [movido] = nova.splice(indice, 1);
    nova.splice(destino, 0, movido!);

    setEspacos(nova);
    setOcupado(true);

    try {
      const resposta = await reordenarEspacos(nova.map((um) => um.id));
      setEspacos(resposta.espacos);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos gravar a ordem.");
      // Volta ao que o servidor tem: deixar a tela numa ordem que não foi
      // gravada faria a equipe acreditar num arranjo que não existe.
      buscarEspacos()
        .then((resposta) => setEspacos(resposta.espacos))
        .catch(() => undefined);
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo os espaços…" />;
  }

  const ocupados = espacos.filter((um) => um.ocupado).length;
  const livres = espacos.filter((um) => um.ativo && !um.ocupado).length;

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
        titulo="Espaços mensais"
        descricao="As salas alugadas por mês. São separadas das 3 salas da agenda de propósito: uma sala da agenda aparece no site para qualquer um reservar por hora, e a privativa de um mensalista não pode aparecer lá."
      >
        <div className="flex flex-col gap-4">
          {espacos.length > 0 ? (
            <p className="text-sm text-text-secondary">
              {ocupados} {ocupados === 1 ? "ocupado" : "ocupados"} ·{" "}
              <span className="font-semibold text-text-primary">
                {livres} {livres === 1 ? "livre" : "livres"}
              </span>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nome"
              value={novoNome}
              onChange={(evento) => setNovoNome(evento.target.value)}
              placeholder="Privativa 7"
            />

            <Campo
              etiqueta="Anotação (opcional)"
              value={novaObservacao}
              maxLength={300}
              onChange={(evento) => setNovaObservacao(evento.target.value)}
              placeholder="Metragem, andar, quantas pessoas…"
            />
          </div>

          <div className="flex justify-end">
            <Botao
              largura="conteudo"
              onClick={cadastrar}
              disabled={ocupado || novoNome.trim().length < 1}
            >
              Cadastrar espaço
            </Botao>
          </div>

          {espacos.length === 0 ? (
            <AvisoVazio>
              Nenhum espaço cadastrado. Cadastre as salas privativas aqui para
              poder fazer os contratos de mensalidade.
            </AvisoVazio>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {espacos.map((espaco, indice) => (
                <li
                  key={espaco.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  {editandoId === espaco.id ? (
                    <>
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                        <Campo
                          etiqueta="Nome"
                          value={nome}
                          onChange={(evento) => setNome(evento.target.value)}
                        />
                        <Campo
                          etiqueta="Anotação"
                          value={observacao}
                          maxLength={300}
                          onChange={(evento) => setObservacao(evento.target.value)}
                        />
                      </div>

                      <Botao
                        largura="conteudo"
                        onClick={() => void salvar(espaco.id)}
                        disabled={ocupado || nome.trim().length < 1}
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
                        <p className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-base font-semibold",
                              espaco.ativo
                                ? "text-text-primary"
                                : "text-text-secondary",
                            )}
                          >
                            {espaco.nome}
                          </span>

                          {/*
                            OCUPADO É SOBRE HOJE, decidido pelo servidor: um
                            espaço cujo contrato terminou em março está LIVRE, e
                            mostrá-lo como ocupado faria a equipe deixar de
                            alugá-lo.
                          */}
                          {espaco.ocupado ? (
                            <span className="inline-flex items-center rounded-full border border-black px-2 py-0.5 text-xs font-semibold text-text-primary">
                              ocupado
                            </span>
                          ) : espaco.ativo ? (
                            <span className="inline-flex items-center rounded-full border border-border bg-bg-secondary px-2 py-0.5 text-xs font-semibold text-text-secondary">
                              livre
                            </span>
                          ) : null}

                          {!espaco.ativo ? (
                            <span className="text-sm text-text-secondary">
                              (desligado — fora da lista de escolha, histórico
                              mantido)
                            </span>
                          ) : null}
                        </p>

                        <p className="mt-0.5 text-sm text-text-secondary">
                          {espaco.observacao ? `${espaco.observacao} · ` : ""}
                          {espaco.contratos === 0
                            ? "nenhum contrato"
                            : espaco.contratos === 1
                              ? "1 contrato"
                              : `${espaco.contratos} contratos`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Mover ${espaco.nome} para cima`}
                          onClick={() => void mover(indice, -1)}
                          disabled={ocupado || indice === 0}
                          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-primary hover:bg-bg-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        >
                          <span aria-hidden>↑</span>
                        </button>

                        <button
                          type="button"
                          aria-label={`Mover ${espaco.nome} para baixo`}
                          onClick={() => void mover(indice, 1)}
                          disabled={ocupado || indice === espacos.length - 1}
                          className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-primary hover:bg-bg-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                        >
                          <span aria-hidden>↓</span>
                        </button>

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          disabled={ocupado}
                          onClick={() => {
                            setEditandoId(espaco.id);
                            setNome(espaco.nome);
                            setObservacao(espaco.observacao ?? "");
                          }}
                        >
                          Editar
                        </Botao>

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          disabled={ocupado}
                          onClick={() => void ligarOuDesligar(espaco)}
                        >
                          {espaco.ativo ? "Desligar" : "Religar"}
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
