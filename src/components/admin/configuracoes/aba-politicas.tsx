"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

import { buscarPoliticas, salvarPoliticas, type RespostaDePoliticas } from "./api";
import { AreaDeTexto, BarraDeSalvar, Secao, type Situacao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

export function AbaDePoliticas() {
  const [dados, setDados] = useState<RespostaDePoliticas | null>(null);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarPoliticas(sinal);
      setDados(resposta);
      setRascunho(resposta.textos);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar os textos."));
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!dados) {
    return <Carregando texto="Carregando os textos…" />;
  }

  const alterado = dados.definicoes.some(
    (definicao) => rascunho[definicao.chave] !== dados.textos[definicao.chave],
  );

  async function salvar() {
    if (!dados) {
      return;
    }

    setSituacao({ tipo: "salvando" });

    try {
      const resposta = await salvarPoliticas(rascunho);
      setDados(resposta);
      setRascunho(resposta.textos);
      setSituacao({ tipo: "salvo", mensagem: "Textos salvos." });
    } catch (erro) {
      setSituacao({ tipo: "erro", mensagem: mensagemDe(erro, "Não foi possível salvar.") });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Textos que o cliente lê"
        descricao="Aparecem no site na hora de fechar a reserva. Escreva como você falaria no WhatsApp — quem lê está no celular, com pressa."
      >
        <div className="flex flex-col gap-6">
          {dados.definicoes.map((definicao) => (
            <div key={definicao.chave} className="flex flex-col gap-3">
              <AreaDeTexto
                etiqueta={definicao.rotulo}
                valor={rascunho[definicao.chave] ?? ""}
                maximo={definicao.maximo}
                ajuda={definicao.ajuda}
                aoMudar={(texto) => {
                  setSituacao({ tipo: "parado" });
                  setRascunho((atual) => ({ ...atual, [definicao.chave]: texto }));
                }}
              />

              {definicao.variaveis.length > 0 ? (
                <p className="text-sm text-text-secondary">
                  Variáveis desta mensagem:{" "}
                  {definicao.variaveis.map((variavel) => (
                    <code
                      key={variavel}
                      className="mr-1.5 rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-text-primary"
                    >
                      {variavel}
                    </code>
                  ))}
                </p>
              ) : null}

              {rascunho[definicao.chave] !== definicao.padrao ? (
                <Botao
                  aparencia="texto"
                  largura="conteudo"
                  className="self-start px-0"
                  onClick={() => {
                    setSituacao({ tipo: "parado" });
                    setRascunho((atual) => ({ ...atual, [definicao.chave]: definicao.padrao }));
                  }}
                >
                  Voltar ao texto original
                </Botao>
              ) : null}
            </div>
          ))}

          <BarraDeSalvar
            situacao={situacao}
            alterado={alterado}
            aoSalvar={() => void salvar()}
            aoDescartar={() => {
              setRascunho(dados.textos);
              setSituacao({ tipo: "parado" });
            }}
            rotulo="Salvar textos"
          />
        </div>
      </Secao>
    </div>
  );
}
