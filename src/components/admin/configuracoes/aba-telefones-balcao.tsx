"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { formatarEnquantoDigita, telefoneVisivel } from "@/lib/telefone";

import {
  buscarTelefonesDeBalcao,
  desmarcarTelefoneDeBalcao,
  marcarTelefoneDeBalcao,
  type PessoaNoBalcao,
  type TelefoneDeBalcao,
} from "./api";
import { CaixaInformativa, Secao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

/**
 * TELEFONES DO BALCAO.
 *
 * O relatorio agrupa cliente pelo telefone, e para quase todos os numeros
 * isso esta certo. O do atendimento comercial, nao: a recepcao lanca nele a
 * reserva de quem nao deixou o proprio numero, e ele acumula reservas de
 * varias pessoas. Marcado aqui, cada nome daquele numero vira um cliente no
 * relatorio.
 *
 * Quem marca e a equipe, porque so ela sabe qual numero e da casa. O sistema
 * nao adivinha: o sinal mais forte que existe no banco — duas reservas ao
 * mesmo tempo em salas diferentes — nao basta, porque uma pessoa pode
 * reservar duas salas de uma vez.
 */
export function AbaDeTelefonesDeBalcao() {
  const [telefones, setTelefones] = useState<TelefoneDeBalcao[] | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);
  const [novoTelefone, setNovoTelefone] = useState("");
  const [novoMotivo, setNovoMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarTelefonesDeBalcao(sinal);
      setTelefones(resposta.telefones);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar os telefones."));
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

  if (!telefones) {
    return <Carregando texto="Carregando os telefones do balcão…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {erroDaAcao ? <AvisoDeErro mensagem={erroDaAcao} /> : null}

      <Secao
        titulo="Telefones marcados"
        descricao="No relatório, cada nome destes números vira um cliente separado."
      >
        {telefones.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nenhum número marcado. Enquanto for assim, nada muda no relatório.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {telefones.map((item) => (
              <li
                key={item.telefone}
                className="flex flex-col gap-3 rounded-lg border border-border bg-bg-primary p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-56 flex-1 flex-col gap-0.5">
                    <span className="font-bold tabular-nums text-text-primary">
                      {telefoneVisivel(item.telefone)}
                    </span>
                    <span className="text-sm text-text-secondary">{item.motivo}</span>
                    <span className="text-sm text-text-secondary">
                      {item.reservas} {item.reservas === 1 ? "reserva" : "reservas"}
                      {item.marcadoPor ? ` · marcado por ${item.marcadoPor}` : ""}
                    </span>
                  </div>

                  <Botao
                    largura="conteudo"
                    aparencia="secundario"
                    disabled={salvando}
                    onClick={() =>
                      void comAviso(
                        () => desmarcarTelefoneDeBalcao(item.telefone),
                        "Não foi possível desmarcar.",
                      )
                    }
                  >
                    Desmarcar
                  </Botao>
                </div>

                {/* QUEM ESTÁ PRESO NESTE NÚMERO.
                    É a lista de trabalho da recepção: cada linha é alguém
                    cuja reserva saiu do número da casa e que ainda não tem
                    telefone próprio no sistema. */}
                {item.pessoas.length > 0 ? (
                  <PessoasDoNumero pessoas={item.pessoas} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao
        titulo="Marcar um número"
        descricao="Use quando um mesmo telefone aparecer com nomes de clientes diferentes."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-48 flex-1">
              <Campo
                etiqueta="Telefone"
                type="tel"
                inputMode="tel"
                placeholder="(14) 99604-0233"
                value={novoTelefone}
                onChange={(evento) =>
                  setNovoTelefone(formatarEnquantoDigita(evento.target.value))
                }
              />
            </div>
            <div className="min-w-56 flex-[2]">
              <Campo
                etiqueta="Por que não é de um cliente"
                value={novoMotivo}
                maxLength={120}
                placeholder="Atendimento comercial do coworking"
                onChange={(evento) => setNovoMotivo(evento.target.value)}
                dica="Daqui a seis meses ninguém lembra. Escreva para a próxima pessoa."
              />
            </div>
          </div>

          <Botao
            largura="conteudo"
            disabled={
              salvando || novoTelefone.length < 14 || novoMotivo.trim().length < 3
            }
            onClick={() =>
              void comAviso(async () => {
                await marcarTelefoneDeBalcao(novoTelefone, novoMotivo);
                setNovoTelefone("");
                setNovoMotivo("");
              }, "Não foi possível marcar o número.")
            }
          >
            Marcar número
          </Botao>
        </div>
      </Secao>

      <CaixaInformativa titulo="O que marcar faz, e o que não faz">
        <p>
          <strong>Faz:</strong> no relatório, as reservas daquele número deixam
          de ser somadas num cliente só e passam a ser agrupadas{" "}
          <strong>pelo nome de cada reserva</strong>. Um número com reservas da
          Toca, da Prestare e do Rafael vira três clientes, cada um com as horas
          dele.
        </p>
        <p>
          <strong>Não faz:</strong> não encosta em reserva nenhuma. Nem ao
          marcar, nem ao desmarcar — e desmarcar devolve tudo exatamente como
          era. A agenda, as mensagens e os valores ficam iguais.
        </p>
        <p>
          <strong>Por que você marca, e não o sistema:</strong> duas reservas ao
          mesmo tempo em salas diferentes parece prova de que o número é de
          várias pessoas, mas não é — alguém pode reservar duas salas de uma
          vez. Se o sistema chutasse, quebraria um cliente de verdade em várias
          linhas e ninguém desconfiaria, porque cada linha continuaria parecendo
          certa.
        </p>
        <p>
          <strong>O certo é não precisar disto.</strong> Na tela de nova reserva
          a recepção agora procura o cliente pelo nome e usa o telefone dele.
          Esta tela serve para arrumar o que já está gravado.
        </p>
      </CaixaInformativa>
    </div>
  );
}

/**
 * Quem está preso dentro de um telefone do balcão.
 *
 * Não é estatística: é lista de trabalho. Cada linha é alguém cuja reserva
 * saiu do número da casa e que ainda não tem telefone próprio no sistema. A
 * equipe olha, pede o número na próxima vez, e a lista para de crescer.
 */
function PessoasDoNumero({ pessoas }: { pessoas: PessoaNoBalcao[] }) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-3">
      <h3 className="text-sm font-bold text-text-primary">
        Clientes com reserva neste número
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-text-secondary">
        Falta o telefone de cada um. Peça na próxima vez que atender.
      </p>

      <ul className="mt-3 flex flex-col gap-1.5">
        {pessoas.map((pessoa) => (
          <li
            key={pessoa.nome}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-border pb-1.5 last:border-b-0 last:pb-0"
          >
            <span className="font-semibold text-text-primary">{pessoa.nome}</span>
            <span className="text-sm tabular-nums text-text-secondary">
              {horasPorExtenso(pessoa.horas)} · {pessoa.reservas}{" "}
              {pessoa.reservas === 1 ? "reserva" : "reservas"} · última em{" "}
              {emDiaEMes(pessoa.ultima)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        As horas não contam reservas canceladas, igual ao relatório. A contagem
        de reservas conta todas.
      </p>
    </div>
  );
}

/** "3,5 h" — com vírgula, e sem o ",0" quando é hora cheia. */
function horasPorExtenso(horas: number): string {
  const texto = Number.isInteger(horas)
    ? String(horas)
    : horas.toFixed(1).replace(".", ",");
  return `${texto} h`;
}

/** "2026-10-26" -> "26/10". */
function emDiaEMes(data: string): string {
  const [, mes, dia] = data.split("-");
  return `${dia}/${mes}`;
}
