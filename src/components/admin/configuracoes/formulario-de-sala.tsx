"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

import type { DadosDeSala, SalaDoPainel } from "./api";

export type Rascunho = {
  nome: string;
  capacidade: string;
  precoPorHora: string;
  duracaoMaximaMinutos: string;
  ordem: string;
};

/** "80.00" (como vem do servidor) vira "80,00" (como o brasileiro escreve). */
export function precoParaTexto(valor: string): string {
  return valor.replace(".", ",");
}

/** "80,00" vira 80. Nulo quando nao da para entender o que foi digitado. */
export function precoParaNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) {
    return null;
  }

  return Number(limpo);
}

export function rascunhoDaSala(sala: SalaDoPainel): Rascunho {
  return {
    nome: sala.nome,
    capacidade: sala.capacidade === null ? "" : String(sala.capacidade),
    precoPorHora: precoParaTexto(sala.precoPorHora),
    duracaoMaximaMinutos:
      sala.duracaoMaximaMinutos === null ? "" : String(sala.duracaoMaximaMinutos),
    ordem: String(sala.ordem),
  };
}

export const RASCUNHO_VAZIO: Rascunho = {
  nome: "",
  capacidade: "",
  precoPorHora: "",
  duracaoMaximaMinutos: "",
  ordem: "",
};

/** Transforma o que foi digitado no que a API espera. Texto = o que esta errado. */
export function lerRascunho(rascunho: Rascunho): DadosDeSala | string {
  const nome = rascunho.nome.trim();

  if (nome === "") {
    return "Escreva o nome da sala.";
  }

  const preco = precoParaNumero(rascunho.precoPorHora);

  if (preco === null) {
    return "Escreva o preço por hora como 80 ou 80,50.";
  }

  const capacidade = rascunho.capacidade.trim();

  if (capacidade !== "" && !/^\d+$/.test(capacidade)) {
    return "A capacidade precisa ser um número inteiro, ou pode ficar em branco.";
  }

  const duracao = rascunho.duracaoMaximaMinutos.trim();

  if (duracao !== "" && !/^\d+$/.test(duracao)) {
    return "A duração máxima precisa ser um número de minutos, ou pode ficar em branco.";
  }

  const ordem = rascunho.ordem.trim();

  if (!/^\d+$/.test(ordem)) {
    return "A ordem precisa ser um número inteiro.";
  }

  return {
    nome,
    capacidade: capacidade === "" ? null : Number(capacidade),
    precoPorHora: preco,
    duracaoMaximaMinutos: duracao === "" ? null : Number(duracao),
    ordem: Number(ordem),
  };
}

/**
 * Os campos de uma sala. Serve tanto para editar quanto para cadastrar —
 * sao os mesmos campos, e duas telas quase iguais so criariam duas versoes
 * da mesma regra para manter em dia.
 */
export function CamposDaSala({
  rascunho,
  aoMudar,
}: {
  rascunho: Rascunho;
  aoMudar: (novo: Rascunho) => void;
}) {
  function trocar(campo: keyof Rascunho, valor: string) {
    aoMudar({ ...rascunho, [campo]: valor });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo
        etiqueta="Nome"
        value={rascunho.nome}
        onChange={(evento) => trocar("nome", evento.target.value)}
        maxLength={60}
        className="sm:col-span-2"
      />

      <Campo
        etiqueta="Preço por hora (R$)"
        inputMode="decimal"
        value={rascunho.precoPorHora}
        onChange={(evento) => trocar("precoPorHora", evento.target.value)}
        dica="Só para o valor estimado. Não há cobrança pelo site."
      />

      <Campo
        etiqueta="Capacidade (pessoas)"
        inputMode="numeric"
        value={rascunho.capacidade}
        onChange={(evento) => trocar("capacidade", evento.target.value.replace(/\D/g, ""))}
        dica="Pode ficar em branco."
      />

      <Campo
        etiqueta="Duração máxima (minutos)"
        inputMode="numeric"
        value={rascunho.duracaoMaximaMinutos}
        onChange={(evento) =>
          trocar("duracaoMaximaMinutos", evento.target.value.replace(/\D/g, ""))
        }
        dica="Em branco = pode ir até o fechamento do dia. Múltiplo de 30."
      />

      <Campo
        etiqueta="Ordem no site"
        inputMode="numeric"
        value={rascunho.ordem}
        onChange={(evento) => trocar("ordem", evento.target.value.replace(/\D/g, ""))}
        dica="1 aparece primeiro."
      />
    </div>
  );
}

/** Formulario de cadastro de sala nova, escondido até a equipe pedir. */
export function NovaSala({
  aoCriar,
  salvando,
  erro,
  aoCancelar,
}: {
  aoCriar: (dados: DadosDeSala) => void;
  salvando: boolean;
  erro: string | null;
  aoCancelar: () => void;
}) {
  const [rascunho, setRascunho] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <CamposDaSala rascunho={rascunho} aoMudar={setRascunho} />

      {erroLocal || erro ? (
        <p className="text-sm font-medium text-destructive">{erroLocal ?? erro}</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Botao aparencia="secundario" largura="conteudo" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao
          largura="conteudo"
          disabled={salvando}
          onClick={() => {
            const lido = lerRascunho(rascunho);

            if (typeof lido === "string") {
              setErroLocal(lido);
              return;
            }

            setErroLocal(null);
            aoCriar(lido);
          }}
        >
          {salvando ? "Cadastrando…" : "Cadastrar sala"}
        </Botao>
      </div>
    </div>
  );
}
