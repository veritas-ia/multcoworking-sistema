"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { telefoneVisivel } from "@/lib/telefone";

import {
  buscarEmpresas,
  criarEmpresa,
  editarEmpresa,
  vincularTelefone,
  type ClienteConhecido,
  type EmpresaDoPainel,
  type SugestaoDeEmpresa,
} from "./api";
import { CaixaInformativa, Secao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

/**
 * EMPRESAS: juntar varios telefones da mesma empresa num total so.
 *
 * A tela e uma lista de TELEFONES, e nao de pessoas, porque o telefone e o
 * unico identificador confiavel. Cada linha mostra TODOS os nomes que aquele
 * numero ja usou — e justamente a variacao ("Prestare", "Prestare Karen")
 * que faz a equipe reconhecer de quem e o numero.
 */
export function AbaDeEmpresas() {
  const [empresas, setEmpresas] = useState<EmpresaDoPainel[] | null>(null);
  const [clientes, setClientes] = useState<ClienteConhecido[]>([]);
  const [sugestoes, setSugestoes] = useState<SugestaoDeEmpresa[]>([]);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  /** A empresa que esta sendo renomeada agora, e o texto em edicao. */
  const [renomeando, setRenomeando] = useState<string | null>(null);
  const [nomeEmEdicao, setNomeEmEdicao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarEmpresas(sinal);
      setEmpresas(resposta.empresas);
      setClientes(resposta.clientes);
      setSugestoes(resposta.sugestoes);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar as empresas."));
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

  if (empresas === null) {
    return <Carregando texto="Carregando as empresas…" />;
  }

  const semEmpresa = clientes.filter((cliente) => cliente.empresaId === null);

  return (
    <div className="flex flex-col gap-6">
      <CaixaInformativa titulo="Para que serve">
        <p>
          Tem empresa aqui com vários funcionários reservando, cada um do seu
          telefone. Sem juntar, o relatório mostra cada pessoa separada — e às
          vezes quem paga a conta do mês é a empresa.
        </p>
        <p>
          As empresas <strong>ligadas</strong> aparecem no site, para o cliente
          escolher a dele na hora de reservar. É esse o caminho normal: a
          resposta fica guardada na reserva e não depende de ninguém marcar
          nada depois.
        </p>
        <p>
          <strong>Desligar</strong> tira a empresa da lista do site — ela deixa
          de ser oferecida a quem vai reservar. O histórico{" "}
          <strong>fica inteiro</strong>: as reservas antigas continuam de pé, a
          empresa continua no relatório com as horas e o faturamento dela, e
          nada é apagado. Empresa que saiu do coworking é desligada, nunca
          excluída — por isso não existe botão de excluir aqui.
        </p>
        <p>
          Marcar um telefone, lá embaixo, junta{" "}
          <strong>as reservas antigas dele</strong> na hora. Serve para arrumar
          o passado e para o caso raro de quem veio uma vez só com a equipe.
        </p>
      </CaixaInformativa>

      {/* ----------------------------- cadastro ----------------------------- */}
      <Secao titulo="Empresas cadastradas">
        <div className="flex flex-col gap-4">
          {empresas.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Nenhuma empresa ainda. Cadastre a primeira abaixo.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {empresas.map((empresa) => (
                <li
                  key={empresa.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-bg-primary px-4 py-2.5"
                >
                  <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <span className="flex flex-col">
                      <span className="font-semibold text-text-primary">
                        {empresa.nome}
                        {empresa.ativa ? "" : " (desligada)"}
                      </span>
                      <span className="text-sm text-text-secondary">
                        {empresa.telefones === 1
                          ? "1 telefone marcado"
                          : `${empresa.telefones} telefones marcados`}
                        {empresa.ativa
                          ? ""
                          : " · fora da lista do site, histórico mantido"}
                      </span>
                    </span>

                    <div className="flex flex-wrap gap-2">
                      <Botao
                        aparencia="secundario"
                        largura="conteudo"
                        disabled={salvando}
                        onClick={() => {
                          setErroDaAcao(null);
                          setRenomeando((atual) =>
                            atual === empresa.id ? null : empresa.id,
                          );
                          setNomeEmEdicao(empresa.nome);
                        }}
                      >
                        {renomeando === empresa.id ? "Cancelar" : "Renomear"}
                      </Botao>

                      <Botao
                        aparencia="secundario"
                        largura="conteudo"
                        disabled={salvando}
                        onClick={() =>
                          void comAviso(
                            () => editarEmpresa(empresa.id, { ativa: !empresa.ativa }),
                            "Não foi possível mudar a empresa.",
                          )
                        }
                      >
                        {empresa.ativa ? "Desligar" : "Religar"}
                      </Botao>
                    </div>
                  </div>

                  {/* RENOMEAR muda o rotulo em TODO lugar, inclusive nas
                      reservas antigas — elas apontam para a empresa, e nao
                      guardam o nome. E o que se quer: empresa que mudou de
                      razao social nao vira duas no relatorio. */}
                  {renomeando === empresa.id ? (
                    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                      <div className="min-w-56 flex-1">
                        <Campo
                          etiqueta="Nome da empresa"
                          value={nomeEmEdicao}
                          maxLength={80}
                          onChange={(evento) => setNomeEmEdicao(evento.target.value)}
                          dica="Troca o nome também nas reservas antigas: elas apontam para a empresa, não guardam o texto."
                        />
                      </div>
                      <Botao
                        largura="conteudo"
                        disabled={salvando || nomeEmEdicao.trim().length < 2}
                        onClick={() =>
                          void comAviso(async () => {
                            await editarEmpresa(empresa.id, {
                              nome: nomeEmEdicao.trim(),
                            });
                            setRenomeando(null);
                          }, "Não foi possível renomear a empresa.")
                        }
                      >
                        Salvar nome
                      </Botao>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Campo
                etiqueta="Nome da empresa nova"
                value={nomeNovo}
                maxLength={80}
                placeholder="Prestare"
                onChange={(evento) => setNomeNovo(evento.target.value)}
              />
            </div>
            <Botao
              largura="conteudo"
              disabled={salvando || nomeNovo.trim().length < 2}
              onClick={() =>
                void comAviso(async () => {
                  await criarEmpresa(nomeNovo);
                  setNomeNovo("");
                }, "Não foi possível cadastrar a empresa.")
              }
            >
              Cadastrar
            </Botao>
          </div>

          {erroDaAcao ? <AvisoDeErro mensagem={erroDaAcao} /> : null}
        </div>
      </Secao>

      {/* ---------------------------- sugestoes ---------------------------- */}
      {sugestoes.length > 0 && empresas.length > 0 ? (
        <Secao titulo="O sistema notou">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              Estes números usaram nomes parecidos e podem ser da mesma empresa.
              É só um palpite para você não ter que ler a lista inteira — o
              sistema nunca junta nada sozinho.
            </p>

            <ul className="flex flex-col gap-2">
              {sugestoes.slice(0, 6).map((sugestao) => (
                <li
                  key={sugestao.palavra}
                  className="rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-primary"
                >
                  <strong>{sugestao.telefones.length} números</strong> com “
                  {sugestao.palavra}” no nome: {sugestao.exemplos.join(", ")}
                </li>
              ))}
            </ul>
          </div>
        </Secao>
      ) : null}

      {/* ------------------------- vinculo por telefone ------------------------ */}
      <Secao titulo="De qual empresa é cada telefone">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            {semEmpresa.length === 0
              ? "Todos os telefones já estão marcados."
              : `${semEmpresa.length} de ${clientes.length} ainda sem empresa.`}
          </p>

          {empresas.length === 0 ? (
            <p className="rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
              Cadastre uma empresa acima para poder marcar os telefones.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {clientes.map((cliente) => (
                <li
                  key={cliente.telefone}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-bg-primary px-4 py-3"
                >
                  <span className="flex min-w-48 flex-1 flex-col">
                    <span className="font-semibold text-text-primary">
                      {telefoneVisivel(cliente.telefone)}
                    </span>
                    {/* TODOS os nomes, e nao so o mais recente: e a variacao
                        que faz a equipe reconhecer de quem e o numero. */}
                    <span className="text-sm text-text-secondary">
                      {cliente.nomes.join(" · ")}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {cliente.reservas === 1 ? "1 reserva" : `${cliente.reservas} reservas`}
                    </span>
                  </span>

                  <label className="flex flex-col gap-1">
                    <span className="sr-only">
                      Empresa de {telefoneVisivel(cliente.telefone)}
                    </span>
                    <select
                      value={cliente.empresaId ?? ""}
                      disabled={salvando}
                      onChange={(evento) =>
                        void comAviso(
                          () =>
                            vincularTelefone(
                              cliente.telefone,
                              evento.target.value === "" ? null : evento.target.value,
                            ),
                          "Não foi possível marcar o telefone.",
                        )
                      }
                      className="min-h-12 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                    >
                      <option value="">Sem empresa</option>
                      {empresas.map((empresa) => (
                        <option key={empresa.id} value={empresa.id}>
                          {empresa.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Secao>
    </div>
  );
}
