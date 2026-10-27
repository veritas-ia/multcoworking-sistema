"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

import {
  buscarProfissoesDoPainel,
  criarProfissao,
  editarProfissao,
  moverProfissao,
  type ProfissaoDoPainel,
} from "./api";
import { CaixaInformativa, Secao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

/**
 * AS AREAS DE ATUACAO.
 *
 * Virou tela em 27/10/2026: antes a lista estava escrita no codigo e so um
 * programador mexia nela.
 *
 * Tres acoes por area, e cada uma significa uma coisa diferente:
 *  - RENOMEAR muda o rotulo em todo lugar, inclusive nas reservas antigas;
 *  - DESLIGAR tira das telas de reserva e mantem o historico;
 *  - BLOQUEAR deixa a area na lista mas recusa a reserva, com o aviso dela.
 *
 * EXCLUIR nao existe, de proposito.
 */
export function AbaDeProfissoes() {
  const [profissoes, setProfissoes] = useState<ProfissaoDoPainel[] | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarProfissoesDoPainel(sinal);
      setProfissoes(resposta.profissoes);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar as áreas."));
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  async function comAviso(acao: () => Promise<unknown>, padrao: string): Promise<void> {
    setSalvando(true);
    setErroDaAcao(null);

    try {
      await acao();
      await carregar();
    } catch (erro) {
      setErroDaAcao(mensagemDe(erro, padrao));
    } finally {
      setSalvando(false);
    }
  }

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!profissoes) {
    return <Carregando texto="Carregando as áreas de atuação…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {erroDaAcao ? <AvisoDeErro mensagem={erroDaAcao} /> : null}

      <Secao
        titulo="Áreas de atuação"
        descricao="É o que o cliente escolhe ao reservar. A ordem daqui é a ordem que ele vê, e também a do gráfico no relatório."
      >
        <ul className="flex flex-col gap-2">
          {profissoes.map((profissao, indice) => (
            <LinhaDaProfissao
              key={profissao.id}
              profissao={profissao}
              primeira={indice === 0}
              ultima={indice === profissoes.length - 1}
              salvando={salvando}
              comAviso={comAviso}
            />
          ))}
        </ul>
      </Secao>

      <Secao
        titulo="Nova área"
        descricao="Entra no fim da lista. Depois dá para mover de lugar."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Campo
              etiqueta="Nome da área"
              value={nomeNovo}
              maxLength={60}
              placeholder="Tecnologia"
              onChange={(evento) => setNomeNovo(evento.target.value)}
              dica="É como aparece para o cliente."
            />
          </div>
          <Botao
            largura="conteudo"
            disabled={salvando || nomeNovo.trim().length < 2}
            onClick={() =>
              void comAviso(async () => {
                await criarProfissao(nomeNovo);
                setNomeNovo("");
              }, "Não foi possível criar a área.")
            }
          >
            Criar área
          </Botao>
        </div>
      </Secao>

      <CaixaInformativa titulo="Desligar e bloquear são coisas diferentes">
        <p>
          <strong>Desligar</strong> tira a área da lista: ninguém mais consegue
          escolhê-la ao reservar, nem no site nem no balcão.
        </p>
        <p>
          <strong>Bloquear</strong> deixa a área na lista, visível, e recusa a
          reserva com o aviso que você escrever. É o caso do Jurídico hoje, por
          causa do contrato de exclusividade com a advocacia — e é de propósito
          que ela continue aparecendo: escondida, o advogado não acharia a opção
          dele, escolheria “Outros” e a reserva passaria.
        </p>
        <p>
          Nos dois casos o <strong>histórico fica inteiro</strong>: as reservas
          antigas continuam de pé e a área continua no relatório. Por isso não
          existe excluir — apagar deixaria as reservas antigas sem explicação.
        </p>
        <p>
          Renomear troca o nome <strong>também nas reservas antigas</strong>:
          elas apontam para a área e não guardam o texto. Área que mudou de nome
          não vira duas no relatório.
        </p>
      </CaixaInformativa>
    </div>
  );
}

function LinhaDaProfissao({
  profissao,
  primeira,
  ultima,
  salvando,
  comAviso,
}: {
  profissao: ProfissaoDoPainel;
  primeira: boolean;
  ultima: boolean;
  salvando: boolean;
  comAviso: (acao: () => Promise<unknown>, padrao: string) => Promise<void>;
}) {
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(profissao.nome);
  const [editandoAviso, setEditandoAviso] = useState(false);
  const [aviso, setAviso] = useState(profissao.avisoBloqueio);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-bg-primary px-4 py-2.5">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex flex-col">
          <span className="font-semibold text-text-primary">
            {profissao.nome}
            {profissao.ativa ? "" : " (desligada)"}
            {profissao.bloqueada ? (
              <span className="ml-2 rounded bg-bg-secondary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
                não pode reservar
              </span>
            ) : null}
          </span>
          <span className="text-sm text-text-secondary">
            {profissao.reservas === 1
              ? "1 reserva no histórico"
              : `${profissao.reservas} reservas no histórico`}
          </span>
        </span>

        <div className="flex flex-wrap gap-2">
          {/* Mover por BOTAO, e nao arrastando: a recepcao mexe no tablet,
              onde arrastar e ruim, e arrastar nao funciona pelo teclado. */}
          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={salvando || primeira}
            onClick={() =>
              void comAviso(
                () => moverProfissao(profissao.id, "SUBIR"),
                "Não foi possível mover a área.",
              )
            }
          >
            ↑
          </Botao>
          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={salvando || ultima}
            onClick={() =>
              void comAviso(
                () => moverProfissao(profissao.id, "DESCER"),
                "Não foi possível mover a área.",
              )
            }
          >
            ↓
          </Botao>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={salvando}
            onClick={() => {
              setRenomeando((atual) => !atual);
              setNome(profissao.nome);
            }}
          >
            {renomeando ? "Cancelar" : "Renomear"}
          </Botao>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={salvando}
            onClick={() =>
              void comAviso(
                () =>
                  editarProfissao(profissao.id, { bloqueada: !profissao.bloqueada }),
                "Não foi possível mudar o bloqueio.",
              )
            }
          >
            {profissao.bloqueada ? "Liberar reserva" : "Bloquear reserva"}
          </Botao>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            disabled={salvando}
            onClick={() =>
              void comAviso(
                () => editarProfissao(profissao.id, { ativa: !profissao.ativa }),
                "Não foi possível mudar a área.",
              )
            }
          >
            {profissao.ativa ? "Desligar" : "Religar"}
          </Botao>
        </div>
      </div>

      {renomeando ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="min-w-56 flex-1">
            <Campo
              etiqueta="Nome da área"
              value={nome}
              maxLength={60}
              onChange={(evento) => setNome(evento.target.value)}
              dica="Troca o nome também nas reservas antigas: elas apontam para a área, não guardam o texto."
            />
          </div>
          <Botao
            largura="conteudo"
            disabled={salvando || nome.trim().length < 2}
            onClick={() =>
              void comAviso(async () => {
                await editarProfissao(profissao.id, { nome: nome.trim() });
                setRenomeando(false);
              }, "Não foi possível renomear a área.")
            }
          >
            Salvar nome
          </Botao>
        </div>
      ) : null}

      {/* O AVISO da area bloqueada. Aparece so quando ela esta bloqueada:
          editar o texto de uma area que reserva normalmente nao faz nada e
          so confundiria. */}
      {profissao.bloqueada ? (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {editandoAviso ? (
            <>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  Aviso mostrado ao cliente
                </span>
                <textarea
                  value={aviso}
                  maxLength={400}
                  rows={3}
                  onChange={(evento) => setAviso(evento.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-primary p-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Botao
                  largura="conteudo"
                  disabled={salvando}
                  onClick={() =>
                    void comAviso(async () => {
                      await editarProfissao(profissao.id, { avisoBloqueio: aviso });
                      setEditandoAviso(false);
                    }, "Não foi possível salvar o aviso.")
                  }
                >
                  Salvar aviso
                </Botao>
                <Botao
                  aparencia="secundario"
                  largura="conteudo"
                  onClick={() => {
                    setEditandoAviso(false);
                    setAviso(profissao.avisoBloqueio);
                  }}
                >
                  Cancelar
                </Botao>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm italic text-text-secondary">
                “{profissao.avisoBloqueio}”
              </p>
              <Botao
                aparencia="secundario"
                largura="conteudo"
                className="self-start"
                disabled={salvando}
                onClick={() => {
                  setEditandoAviso(true);
                  setAviso(profissao.avisoBloqueio);
                }}
              >
                Mudar o aviso
              </Botao>
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}
