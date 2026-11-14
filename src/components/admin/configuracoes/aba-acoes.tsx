"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { telefoneVisivel } from "@/lib/telefone";

import { buscarAcoes, type AcaoNaTela } from "./api";
import { CaixaInformativa, Secao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

/**
 * HISTORICO DE ACOES.
 *
 * POR QUE ESTA TELA EXISTE: desde 13/11/2026 a equipe pode EXCLUIR uma reserva
 * lancada por engano. Excluir apaga a prova — e a prova e o que permite
 * responder, tres meses depois, "por que o relatorio de outubro mudou?" ou
 * "cade a reserva da Toca do dia 14?".
 *
 * Pedido do dono: *"mesmo que exclua, a gente pelo menos tem esse dado... pelo
 * menos a gente sabe que aconteceu essa ação. Aí sim, é uma evidência."*
 *
 * SO LEITURA, e de proposito: nao ha como criar, editar nem apagar um registro
 * daqui. Um registro de evidencia que pode ser mexido nao e evidencia.
 */
export function AbaDeAcoes() {
  const [acoes, setAcoes] = useState<AcaoNaTela[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErro(null);

    try {
      const resposta = await buscarAcoes(sinal);
      setAcoes(resposta.acoes);
    } catch (problema) {
      if (sinal?.aborted) {
        return;
      }
      setErro(mensagemDe(problema, "Não foi possível carregar o histórico."));
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  if (erro) {
    return <AvisoDeErro mensagem={erro} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!acoes) {
    return <Carregando texto="Carregando o histórico…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="O que a equipe fez"
        descricao="Exclusões de reserva e mudanças de status feitas à mão, da mais recente para a mais antiga."
      >
        {acoes.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Nada registrado ainda. Esta lista enche quando alguém exclui uma
            reserva ou muda o status de uma à mão.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {acoes.map((acao) => (
              <li
                key={acao.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-bg-primary p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold text-text-primary">
                    {acao.resumo}
                  </span>
                  <span className="text-sm tabular-nums text-text-secondary">
                    {emDataEHora(acao.criadoEm)}
                  </span>
                </div>

                <span className="text-sm text-text-secondary">
                  por {acao.usuarioNome}
                  {acao.motivo ? ` · motivo: ${acao.motivo}` : ""}
                </span>

                {/* O telefone aparece inteiro, como no relatório de clientes:
                    é a equipe olhando os próprios clientes, atrás de login — e
                    numa reserva excluída é o que permite achar a pessoa. */}
                {typeof acao.dados.telefone === "string" ? (
                  <span className="text-sm tabular-nums text-text-secondary">
                    {telefoneVisivel(acao.dados.telefone)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <CaixaInformativa titulo="Para que serve este histórico">
        <p>
          <strong>Excluir uma reserva apaga a prova.</strong> O registro aqui
          passa a ser a única evidência de que ela existiu — com o cliente, a
          sala, o dia, o horário, o valor e quem excluiu.
        </p>
        <p>
          É isto que permite responder, meses depois, por que um relatório
          mudou. Sem o registro, a reserva simplesmente some e ninguém tem como
          reconstruir o que aconteceu.
        </p>
        <p>
          <strong>Nada aqui pode ser editado nem apagado</strong>, nem por quem
          tem acesso ao painel. Um registro de evidência que pode ser mexido
          deixa de ser evidência.
        </p>
      </CaixaInformativa>
    </div>
  );
}

/** "2026-11-13T19:30:00.000Z" -> "13/11/2026 às 16:30". */
function emDataEHora(iso: string): string {
  const data = new Date(iso);

  return `${data.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })} às ${data.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
