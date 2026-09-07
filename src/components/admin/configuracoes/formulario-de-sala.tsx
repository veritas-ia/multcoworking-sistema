"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

import { COR_PADRAO, PALETA } from "@/lib/cores-de-sala";

import type { DadosDeSala, SalaDoPainel } from "./api";

export type Rascunho = {
  nome: string;
  capacidade: string;
  precoPorHora: string;
  precoPorHoraNoturno: string;
  precoPorHoraNoturnoGrupo: string;
  pessoasParaGrupo: string;
  aceitaDiaria: boolean;
  precoDiaria: string;
  cor: string;
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
    precoPorHoraNoturno: precoParaTexto(sala.precoPorHoraNoturno),
    precoPorHoraNoturnoGrupo:
      sala.precoPorHoraNoturnoGrupo === null
        ? ""
        : precoParaTexto(sala.precoPorHoraNoturnoGrupo),
    pessoasParaGrupo:
      sala.pessoasParaGrupo === null ? "" : String(sala.pessoasParaGrupo),
    aceitaDiaria: sala.aceitaDiaria,
    precoDiaria: sala.precoDiaria === null ? "" : precoParaTexto(sala.precoDiaria),
    cor: sala.cor,
    duracaoMaximaMinutos:
      sala.duracaoMaximaMinutos === null ? "" : String(sala.duracaoMaximaMinutos),
    ordem: String(sala.ordem),
  };
}

export const RASCUNHO_VAZIO: Rascunho = {
  nome: "",
  capacidade: "",
  precoPorHora: "",
  precoPorHoraNoturno: "",
  precoPorHoraNoturnoGrupo: "",
  pessoasParaGrupo: "",
  aceitaDiaria: false,
  precoDiaria: "",
  cor: COR_PADRAO,
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
    return "Escreva o preço por hora (dia) como 40 ou 40,50.";
  }

  const precoNoturno = precoParaNumero(rascunho.precoPorHoraNoturno);

  if (precoNoturno === null) {
    return "Escreva o preço por hora da noite como 75 ou 75,50.";
  }

  const grupoEscrito = rascunho.precoPorHoraNoturnoGrupo.trim();
  const pessoasEscrito = rascunho.pessoasParaGrupo.trim();

  if ((grupoEscrito === "") !== (pessoasEscrito === "")) {
    return "Para cobrar diferente por grupo, preencha os dois campos: o preço da noite para grupo e a partir de quantas pessoas. Deixe os dois em branco para não cobrar diferente.";
  }

  const precoGrupo = grupoEscrito === "" ? null : precoParaNumero(grupoEscrito);

  if (grupoEscrito !== "" && precoGrupo === null) {
    return "Escreva o preço da noite para grupo como 95 ou 95,50.";
  }

  if (pessoasEscrito !== "" && !/^\d+$/.test(pessoasEscrito)) {
    return "O número de pessoas do grupo precisa ser um número inteiro.";
  }

  const precoDaDiaria =
    rascunho.precoDiaria.trim() === "" ? null : precoParaNumero(rascunho.precoDiaria);

  if (rascunho.precoDiaria.trim() !== "" && precoDaDiaria === null) {
    return "Escreva o preço da diária como 350 ou 350,50.";
  }

  if (rascunho.aceitaDiaria && precoDaDiaria === null) {
    return "Sala que aceita diária precisa ter o preço da diária preenchido.";
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
    precoPorHoraNoturno: precoNoturno,
    precoPorHoraNoturnoGrupo: precoGrupo,
    pessoasParaGrupo: pessoasEscrito === "" ? null : Number(pessoasEscrito),
    aceitaDiaria: rascunho.aceitaDiaria,
    precoDiaria: precoDaDiaria,
    cor: rascunho.cor,
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
        etiqueta="Preço por hora — de dia (R$)"
        inputMode="decimal"
        value={rascunho.precoPorHora}
        onChange={(evento) => trocar("precoPorHora", evento.target.value)}
        dica="Vale até o horário em que começa a faixa noturna."
      />

      <Campo
        etiqueta="Preço por hora — à noite (R$)"
        inputMode="decimal"
        value={rascunho.precoPorHoraNoturno}
        onChange={(evento) => trocar("precoPorHoraNoturno", evento.target.value)}
        dica="Uma reserva que atravessa o horário paga cada meia hora pela faixa dela."
      />

      <Campo
        etiqueta="Preço por hora — à noite, para grupo (R$)"
        inputMode="decimal"
        value={rascunho.precoPorHoraNoturnoGrupo}
        onChange={(evento) => trocar("precoPorHoraNoturnoGrupo", evento.target.value)}
        dica="Em branco = esta sala não cobra diferente por tamanho de grupo."
      />

      <Campo
        etiqueta="Grupo é acima de quantas pessoas"
        inputMode="numeric"
        value={rascunho.pessoasParaGrupo}
        onChange={(evento) =>
          trocar("pessoasParaGrupo", evento.target.value.replace(/\D/g, ""))
        }
        dica="Com 4 aqui, 5 pessoas já pagam o preço de grupo. Só à noite."
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

      <div className="flex flex-col gap-2 sm:col-span-2">
        <span className="text-sm font-semibold text-text-primary">
          Cor na agenda
        </span>
        <p className="text-sm text-text-secondary">
          Serve para bater o olho na agenda e ver de quem é cada bloco. A
          situação da reserva continua marcada por borda e texto, e não por cor.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          {PALETA.map((opcao) => {
            const escolhida = opcao.valor.toLowerCase() === rascunho.cor.toLowerCase();

            return (
              <button
                key={opcao.valor}
                type="button"
                aria-pressed={escolhida}
                aria-label={opcao.nome}
                title={opcao.nome}
                onClick={() => trocar("cor", opcao.valor)}
                style={{ backgroundColor: opcao.valor }}
                className={`size-11 rounded-lg border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
                  escolhida ? "border-black" : "border-border"
                }`}
              >
                <span aria-hidden className="text-lg font-bold text-black">
                  {escolhida ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-secondary p-4 sm:col-span-2">
        <label className="flex items-start gap-3 text-sm text-text-primary">
          <input
            type="checkbox"
            checked={rascunho.aceitaDiaria}
            onChange={(evento) =>
              aoMudar({ ...rascunho, aceitaDiaria: evento.target.checked })
            }
            className="mt-0.5 size-5 shrink-0 accent-[var(--brand-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          />
          <span>
            <strong className="font-semibold">Esta sala aceita diária</strong>
            <br />
            Dia inteiro, das 8h às 18h, por um preço fechado. Quem reserva a
            diária ocupa a sala o dia todo.
          </span>
        </label>

        {rascunho.aceitaDiaria ? (
          <Campo
            etiqueta="Preço da diária (R$)"
            inputMode="decimal"
            value={rascunho.precoDiaria}
            onChange={(evento) => trocar("precoDiaria", evento.target.value)}
            dica="Preço fechado do dia inteiro, independente do horário."
          />
        ) : null}
      </div>
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
