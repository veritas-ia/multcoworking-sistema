"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

import {
  buscarCadastroDeClientes,
  juntarClientes,
  ligarOuDesligarCliente,
  renomearCliente,
  separarTelefone,
  type ClienteDoPainel,
  type SugestaoDeJuncao,
} from "./api";
import { CaixaInformativa, Secao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

/**
 * CADASTRO DE CLIENTES (Fase 14, parte B).
 *
 * A migracao acerta sozinha os nomes escritos de varios jeitos no MESMO
 * telefone. O que ela nao tem como saber e que o "Rafael dos Passos" de um
 * numero e o "Rafael Passos" de OUTRO numero sao a mesma pessoa. Ninguem tem
 * — so a equipe. E para isso que esta tela existe.
 *
 * O sistema SUGERE e nunca junta sozinho.
 */
export function AbaDeClientes() {
  const [clientes, setClientes] = useState<ClienteDoPainel[] | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestaoDeJuncao[]>([]);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [procurado, setProcurado] = useState("");

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarCadastroDeClientes(sinal);
      setClientes(resposta.clientes);
      setSugestoes(resposta.sugestoes);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar os clientes."));
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  async function comAviso(
    acao: () => Promise<string | void>,
    padrao: string,
  ): Promise<void> {
    setSalvando(true);
    setErroDaAcao(null);
    setRecado(null);

    try {
      const dito = await acao();
      await carregar();
      if (dito) {
        setRecado(dito);
      }
    } catch (erro) {
      setErroDaAcao(mensagemDe(erro, padrao));
    } finally {
      setSalvando(false);
    }
  }

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!clientes) {
    return <Carregando texto="Carregando os clientes…" />;
  }

  const alvo = procurado
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  const visiveis = alvo
    ? clientes.filter((cliente) =>
        [cliente.nome, ...cliente.nomesNasReservas, ...cliente.telefones].some(
          (texto) =>
            texto
              .normalize("NFD")
              .replace(/[̀-ͯ]/g, "")
              .toLowerCase()
              .includes(alvo),
        ),
      )
    : clientes;

  return (
    <div className="flex flex-col gap-4">
      {erroDaAcao ? <AvisoDeErro mensagem={erroDaAcao} /> : null}

      {recado ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-bg-primary p-3 text-sm leading-relaxed text-text-primary"
        >
          {recado}
        </p>
      ) : null}

      {sugestoes.length > 0 ? (
        <Secao
          titulo="Parecem a mesma pessoa"
          descricao="Cadastros com nome parecido em telefones diferentes. Confira antes: juntar errado soma o faturamento de um na conta do outro."
        >
          <ul className="flex flex-col gap-3">
            {sugestoes.slice(0, 12).map((sugestao) => (
              <Sugestao
                key={sugestao.palavra}
                sugestao={sugestao}
                salvando={salvando}
                comAviso={comAviso}
              />
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao
        titulo={`Clientes (${clientes.length})`}
        descricao="O nome daqui é o que aparece no relatório. O nome escrito em cada reserva continua intocado."
      >
        <div className="flex flex-col gap-3">
          <Campo
            etiqueta="Procurar"
            type="search"
            value={procurado}
            placeholder="Nome ou telefone"
            autoComplete="off"
            onChange={(evento) => setProcurado(evento.target.value)}
          />

          {visiveis.length === 0 ? (
            <p className="text-sm text-text-secondary">Nenhum cliente encontrado.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visiveis.map((cliente) => (
                <LinhaDoCliente
                  key={cliente.id}
                  cliente={cliente}
                  salvando={salvando}
                  comAviso={comAviso}
                />
              ))}
            </ul>
          )}
        </div>
      </Secao>

      <CaixaInformativa titulo="O que cada ação faz">
        <p>
          <strong>Renomear</strong> troca o nome no relatório. As reservas
          antigas <strong>não são tocadas</strong>: elas apontam para o cadastro
          e não guardam o texto, então cliente que mudou de nome não vira dois.
        </p>
        <p>
          <strong>Juntar</strong> é para a mesma pessoa com dois telefones. As
          reservas e os números passam para o cadastro que você escolher
          manter, e o outro deixa de existir — ele não guarda mais nada.
        </p>
        <p>
          <strong>Separar</strong> desfaz: tira um telefone do cadastro e devolve
          a ele um cadastro próprio, com as reservas daquele número. É o
          conserto de quem foi juntado por engano.
        </p>
        <p>
          <strong>Desligar</strong> é decisão sobre o futuro. O histórico fica
          inteiro e o cliente continua no relatório. Excluir não existe — apagar
          tiraria as horas dele do relatório em silêncio.
        </p>
      </CaixaInformativa>
    </div>
  );
}

function Sugestao({
  sugestao,
  salvando,
  comAviso,
}: {
  sugestao: SugestaoDeJuncao;
  salvando: boolean;
  comAviso: (acao: () => Promise<string | void>, padrao: string) => Promise<void>;
}) {
  // Quem FICA. Começa no que tem mais reservas, que costuma ser o cadastro
  // principal — mas a escolha é sempre da equipe.
  const maisUsado = [...sugestao.clientes].sort((a, b) => b.reservas - a.reservas)[0];
  const [principalId, setPrincipalId] = useState(maisUsado?.id ?? "");

  const outros = sugestao.clientes.filter((cliente) => cliente.id !== principalId);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-bg-primary p-3">
      <p className="text-sm text-text-secondary">
        Todos têm <strong className="text-text-primary">{sugestao.palavra}</strong> no
        nome:
      </p>

      <ul className="flex flex-col gap-1">
        {sugestao.clientes.map((cliente) => (
          <li key={cliente.id}>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                name={`principal-${sugestao.palavra}`}
                checked={cliente.id === principalId}
                onChange={() => setPrincipalId(cliente.id)}
                className="size-4"
              />
              <span className="font-semibold">{cliente.nome}</span>
              <span className="text-text-secondary">
                {cliente.reservas} {cliente.reservas === 1 ? "reserva" : "reservas"}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <p className="text-sm text-text-secondary">
        O escolhido fica com tudo. {outros.length}{" "}
        {outros.length === 1 ? "cadastro some" : "cadastros somem"}.
      </p>

      <Botao
        largura="conteudo"
        disabled={salvando || !principalId || outros.length === 0}
        onClick={() =>
          void comAviso(async () => {
            let reservas = 0;
            // Um pedido por cadastro absorvido: a rota junta dois por vez, e
            // assim uma falha no meio não deixa metade do grupo pendurada
            // sem ninguém saber quais entraram.
            for (const outro of outros) {
              const feito = await juntarClientes(principalId, outro.id);
              reservas += feito.juncao.reservas;
            }
            return `Juntado. ${reservas} ${reservas === 1 ? "reserva mudou" : "reservas mudaram"} de cadastro.`;
          }, "Não foi possível juntar os cadastros.")
        }
      >
        Juntar no escolhido
      </Botao>
    </li>
  );
}

function LinhaDoCliente({
  cliente,
  salvando,
  comAviso,
}: {
  cliente: ClienteDoPainel;
  salvando: boolean;
  comAviso: (acao: () => Promise<string | void>, padrao: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(cliente.nome);
  const [separando, setSeparando] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");

  const mudou = nome.trim() !== cliente.nome;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-bg-primary p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <Campo
            etiqueta="Nome"
            value={nome}
            maxLength={120}
            onChange={(evento) => setNome(evento.target.value)}
          />
        </div>

        <Botao
          largura="conteudo"
          disabled={salvando || !mudou || nome.trim().length < 2}
          onClick={() =>
            void comAviso(
              () => renomearCliente(cliente.id, nome).then(() => "Nome atualizado."),
              "Não foi possível renomear.",
            )
          }
        >
          Renomear
        </Botao>

        <Botao
          largura="conteudo"
          aparencia="secundario"
          disabled={salvando}
          onClick={() =>
            void comAviso(
              () =>
                ligarOuDesligarCliente(cliente.id, !cliente.ativo).then(
                  (resposta) => resposta.mensagem,
                ),
              "Não foi possível mudar o cliente.",
            )
          }
        >
          {cliente.ativo ? "Desligar" : "Religar"}
        </Botao>
      </div>

      <p className="text-sm text-text-secondary">
        {cliente.telefones.length > 0
          ? cliente.telefones.join(" · ")
          : "sem telefone ligado"}
        {cliente.ativo ? "" : " · (desligado)"}
      </p>

      {/* Os nomes usados nas reservas: é a variação que faz a equipe
          reconhecer de quem é o cadastro. */}
      {cliente.nomesNasReservas.length > 1 ? (
        <p className="text-sm text-text-secondary">
          nas reservas: {cliente.nomesNasReservas.join(" · ")}
        </p>
      ) : null}

      <p className="text-sm text-text-secondary">
        {cliente.horas} h · {cliente.reservas}{" "}
        {cliente.reservas === 1 ? "reserva" : "reservas"}
        {cliente.ultimaReserva ? ` · última em ${emDiaEMes(cliente.ultimaReserva)}` : ""}
      </p>

      {/* SEPARAR só aparece com dois ou mais números: tirar o único telefone
          de um cadastro criaria uma cópia dele, sem resolver nada. */}
      {cliente.telefones.length > 1 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-2">
          {separando === null ? (
            <div className="flex flex-wrap gap-2">
              {cliente.telefones.map((telefone) => (
                <Botao
                  key={telefone}
                  largura="conteudo"
                  aparencia="texto"
                  disabled={salvando}
                  onClick={() => {
                    setSeparando(telefone);
                    setNomeNovo(cliente.nome);
                  }}
                >
                  Separar {telefone}
                </Botao>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <Campo
                  etiqueta={`Nome do cadastro novo para ${separando}`}
                  value={nomeNovo}
                  maxLength={120}
                  onChange={(evento) => setNomeNovo(evento.target.value)}
                  dica="As reservas desse número vão junto."
                />
              </div>
              <Botao
                largura="conteudo"
                disabled={salvando || nomeNovo.trim().length < 2}
                onClick={() =>
                  void comAviso(async () => {
                    const feito = await separarTelefone(separando, nomeNovo);
                    setSeparando(null);
                    return `Separado. ${feito.separacao.reservas} ${
                      feito.separacao.reservas === 1 ? "reserva foi" : "reservas foram"
                    } para o cadastro novo.`;
                  }, "Não foi possível separar o telefone.")
                }
              >
                Separar
              </Botao>
              <Botao
                largura="conteudo"
                aparencia="texto"
                onClick={() => setSeparando(null)}
              >
                Cancelar
              </Botao>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}

/** "2026-11-09" -> "09/11". */
function emDiaEMes(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}
