"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";

import {
  buscarSalas,
  criarSala,
  ligarOuDesligarSala,
  salvarSala,
  type DadosDeSala,
  type SalaDoPainel,
} from "./api";
import {
  CamposDaSala,
  NovaSala,
  lerRascunho,
  rascunhoDaSala,
  type Rascunho,
} from "./formulario-de-sala";
import { FotosDaSala } from "./fotos-da-sala";
import { BarraDeSalvar, Secao, type Situacao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

export function AbaDeSalas() {
  const [salas, setSalas] = useState<SalaDoPainel[] | null>(null);
  const [envioDisponivel, setEnvioDisponivel] = useState(false);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [cadastrando, setCadastrando] = useState(false);
  const [salvandoNova, setSalvandoNova] = useState(false);
  const [erroDaNova, setErroDaNova] = useState<string | null>(null);

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarSalas(sinal);
      setSalas(resposta.salas);
      setEnvioDisponivel(resposta.envioDeFotosDisponivel);
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar as salas."));
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  function trocarNaLista(atualizada: SalaDoPainel) {
    setSalas((atual) =>
      (atual ?? [])
        .map((sala) => (sala.id === atualizada.id ? atualizada : sala))
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR")),
    );
  }

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!salas) {
    return <Carregando texto="Carregando as salas…" />;
  }

  async function cadastrar(dados: DadosDeSala) {
    setSalvandoNova(true);
    setErroDaNova(null);

    try {
      const { sala } = await criarSala(dados);
      setSalas((atual) => [...(atual ?? []), sala].sort((a, b) => a.ordem - b.ordem));
      setCadastrando(false);
    } catch (erro) {
      setErroDaNova(mensagemDe(erro, "Não foi possível cadastrar a sala."));
    } finally {
      setSalvandoNova(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {salas.map((sala) => (
        <CartaoDaSala
          key={sala.id}
          sala={sala}
          envioDisponivel={envioDisponivel}
          aoAtualizar={trocarNaLista}
        />
      ))}

      {cadastrando ? (
        <Secao
          titulo="Nova sala"
          descricao="O endereço da sala no site é gerado a partir do nome e não muda depois — é ele que vai nos links e QR codes."
        >
          <NovaSala
            aoCriar={(dados) => void cadastrar(dados)}
            salvando={salvandoNova}
            erro={erroDaNova}
            aoCancelar={() => {
              setCadastrando(false);
              setErroDaNova(null);
            }}
          />
        </Secao>
      ) : (
        <Botao
          aparencia="secundario"
          largura="conteudo"
          onClick={() => setCadastrando(true)}
          className="self-start"
        >
          + Cadastrar sala
        </Botao>
      )}
    </div>
  );
}

/** Uma sala: os campos, o aviso de reservas futuras e o botao de ligar/desligar. */
function CartaoDaSala({
  sala,
  envioDisponivel,
  aoAtualizar,
}: {
  sala: SalaDoPainel;
  envioDisponivel: boolean;
  aoAtualizar: (sala: SalaDoPainel) => void;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoDaSala(sala));
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });
  const [trocandoEstado, setTrocandoEstado] = useState(false);

  const original = rascunhoDaSala(sala);
  const alterado = (Object.keys(original) as (keyof Rascunho)[]).some(
    (campo) => rascunho[campo] !== original[campo],
  );

  async function salvar() {
    const lido = lerRascunho(rascunho);

    if (typeof lido === "string") {
      setSituacao({ tipo: "erro", mensagem: lido });
      return;
    }

    setSituacao({ tipo: "salvando" });

    try {
      const { sala: atualizada } = await salvarSala(sala.id, lido);
      aoAtualizar(atualizada);
      setRascunho(rascunhoDaSala(atualizada));
      setSituacao({ tipo: "salvo", mensagem: "Sala salva." });
    } catch (erro) {
      setSituacao({ tipo: "erro", mensagem: mensagemDe(erro, "Não foi possível salvar.") });
    }
  }

  async function trocarEstado() {
    setTrocandoEstado(true);
    setSituacao({ tipo: "parado" });

    try {
      const { sala: atualizada } = await ligarOuDesligarSala(sala.id, !sala.ativa);
      aoAtualizar(atualizada);
    } catch (erro) {
      setSituacao({
        tipo: "erro",
        mensagem: mensagemDe(erro, "Não foi possível mudar o estado da sala."),
      });
    } finally {
      setTrocandoEstado(false);
    }
  }

  return (
    <Secao
      titulo={sala.nome}
      descricao={
        <>
          Endereço no site: <code className="font-mono text-text-primary">?sala={sala.slug}</code>
          {sala.ativa ? null : " — desligada, não aparece para o cliente."}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <CamposDaSala rascunho={rascunho} aoMudar={setRascunho} />

        <BarraDeSalvar
          situacao={situacao}
          alterado={alterado}
          aoSalvar={() => void salvar()}
          aoDescartar={() => {
            setRascunho(rascunhoDaSala(sala));
            setSituacao({ tipo: "parado" });
          }}
          rotulo="Salvar sala"
        />

        <FotosDaSala
          salaId={sala.id}
          nomeDaSala={sala.nome}
          fotos={sala.fotos}
          envioDisponivel={envioDisponivel}
          aoMudar={(fotos) => aoAtualizar({ ...sala, fotos })}
        />

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-text-secondary">
            {sala.ativa
              ? "Desligar tira a sala do site. As reservas já marcadas continuam de pé."
              : "Ligar faz a sala voltar a aparecer para o cliente."}
            {sala.reservasFuturas > 0 ? (
              <>
                {" "}
                <strong className="font-semibold text-text-primary">
                  {sala.reservasFuturas === 1
                    ? "1 reserva futura"
                    : `${sala.reservasFuturas} reservas futuras`}
                </strong>{" "}
                nesta sala.
              </>
            ) : null}
          </p>

          <Botao
            aparencia="secundario"
            largura="conteudo"
            onClick={() => void trocarEstado()}
            disabled={trocandoEstado}
          >
            {sala.ativa ? "Desligar sala" : "Ligar sala"}
          </Botao>
        </div>
      </div>
    </Secao>
  );
}
