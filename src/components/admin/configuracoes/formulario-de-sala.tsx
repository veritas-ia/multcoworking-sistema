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
  precoPorHoraGrupo: string;
  precoPorHoraNoturno: string;
  precoPorHoraNoturnoGrupo: string;
  pessoasParaGrupo: string;
  aceitaDiaria: boolean;
  precoDiaria: string;
  precoDiariaGrupo: string;
  pessoasParaGrupoDiaria: string;
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
    precoPorHoraGrupo:
      sala.precoPorHoraGrupo === null ? "" : precoParaTexto(sala.precoPorHoraGrupo),
    precoPorHoraNoturno: precoParaTexto(sala.precoPorHoraNoturno),
    precoPorHoraNoturnoGrupo:
      sala.precoPorHoraNoturnoGrupo === null
        ? ""
        : precoParaTexto(sala.precoPorHoraNoturnoGrupo),
    pessoasParaGrupo:
      sala.pessoasParaGrupo === null ? "" : String(sala.pessoasParaGrupo),
    aceitaDiaria: sala.aceitaDiaria,
    precoDiaria: sala.precoDiaria === null ? "" : precoParaTexto(sala.precoDiaria),
    precoDiariaGrupo:
      sala.precoDiariaGrupo === null ? "" : precoParaTexto(sala.precoDiariaGrupo),
    pessoasParaGrupoDiaria:
      sala.pessoasParaGrupoDiaria === null ? "" : String(sala.pessoasParaGrupoDiaria),
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
  precoPorHoraGrupo: "",
  precoPorHoraNoturno: "",
  precoPorHoraNoturnoGrupo: "",
  pessoasParaGrupo: "",
  aceitaDiaria: false,
  precoDiaria: "",
  precoDiariaGrupo: "",
  pessoasParaGrupoDiaria: "",
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

  // --- preco de grupo POR HORA (dia e noite, um corte so) --------------------
  const diaGrupoEscrito = rascunho.precoPorHoraGrupo.trim();
  const grupoEscrito = rascunho.precoPorHoraNoturnoGrupo.trim();
  const pessoasEscrito = rascunho.pessoasParaGrupo.trim();
  const temAlgumPrecoDeGrupo = diaGrupoEscrito !== "" || grupoEscrito !== "";

  if (temAlgumPrecoDeGrupo !== (pessoasEscrito !== "")) {
    return "Para cobrar diferente por grupo, preencha o preço de grupo (de dia, de noite ou os dois) e a partir de quantas pessoas. Deixe tudo em branco para não cobrar diferente.";
  }

  const precoDiaGrupo = diaGrupoEscrito === "" ? null : precoParaNumero(diaGrupoEscrito);

  if (diaGrupoEscrito !== "" && precoDiaGrupo === null) {
    return "Escreva o preço de dia para grupo como 75 ou 75,50.";
  }

  const precoGrupo = grupoEscrito === "" ? null : precoParaNumero(grupoEscrito);

  if (grupoEscrito !== "" && precoGrupo === null) {
    return "Escreva o preço da noite para grupo como 95 ou 95,50.";
  }

  if (pessoasEscrito !== "" && !/^\d+$/.test(pessoasEscrito)) {
    return "O número de pessoas do grupo precisa ser um número inteiro.";
  }

  const corteDaHora = pessoasEscrito === "" ? null : Number(pessoasEscrito);

  if (corteDaHora !== null && (corteDaHora < 1 || corteDaHora > 10)) {
    return "O número de pessoas do grupo precisa ser de 1 a 10.";
  }

  // Preco de grupo MENOR que o base quase sempre e um numero digitado no
  // campo errado. O servidor recusa de qualquer jeito; aqui e so para a
  // equipe descobrir antes de clicar em salvar.
  if (precoDiaGrupo !== null && precoDiaGrupo < preco) {
    return "O preço de dia para grupo não pode ser menor que o preço de dia normal. Confira se os dois não trocaram de lugar.";
  }

  if (precoGrupo !== null && precoGrupo < precoNoturno) {
    return "O preço da noite para grupo não pode ser menor que o preço da noite normal. Confira se os dois não trocaram de lugar.";
  }

  const precoDaDiaria =
    rascunho.precoDiaria.trim() === "" ? null : precoParaNumero(rascunho.precoDiaria);

  if (rascunho.precoDiaria.trim() !== "" && precoDaDiaria === null) {
    return "Escreva o preço da diária como 350 ou 350,50.";
  }

  if (rascunho.aceitaDiaria && precoDaDiaria === null) {
    return "Sala que aceita diária precisa ter o preço da diária preenchido.";
  }

  // --- a diaria de grupo, com o CORTE DELA -----------------------------------
  //
  // O corte da diaria NAO e o mesmo do calculo por hora: na Sala de Reuniao a
  // hora pula entre 4 e 5 pessoas, e a diaria entre 5 e 6.
  const diariaGrupoEscrito = rascunho.precoDiariaGrupo.trim();
  const corteDiariaEscrito = rascunho.pessoasParaGrupoDiaria.trim();

  if ((diariaGrupoEscrito === "") !== (corteDiariaEscrito === "")) {
    return "Para cobrar a diária diferente por grupo, preencha os dois campos: o preço da diária para grupo e a partir de quantas pessoas. Deixe os dois em branco para cobrar um preço só.";
  }

  const precoDiariaGrupo =
    diariaGrupoEscrito === "" ? null : precoParaNumero(diariaGrupoEscrito);

  if (diariaGrupoEscrito !== "" && precoDiariaGrupo === null) {
    return "Escreva o preço da diária para grupo como 450 ou 450,50.";
  }

  if (corteDiariaEscrito !== "" && !/^\d+$/.test(corteDiariaEscrito)) {
    return "O número de pessoas do grupo na diária precisa ser um número inteiro.";
  }

  const corteDaDiaria = corteDiariaEscrito === "" ? null : Number(corteDiariaEscrito);

  if (corteDaDiaria !== null && (corteDaDiaria < 1 || corteDaDiaria > 10)) {
    return "O número de pessoas do grupo na diária precisa ser de 1 a 10.";
  }

  if (precoDiariaGrupo !== null && precoDaDiaria === null) {
    return "A diária para grupo precisa do preço da diária normal preenchido.";
  }

  if (
    precoDiariaGrupo !== null &&
    precoDaDiaria !== null &&
    precoDiariaGrupo < precoDaDiaria
  ) {
    return "A diária para grupo não pode custar menos que a diária normal. Confira se os dois não trocaram de lugar.";
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
    precoPorHoraGrupo: precoDiaGrupo,
    precoPorHoraNoturno: precoNoturno,
    precoPorHoraNoturnoGrupo: precoGrupo,
    pessoasParaGrupo: corteDaHora,
    aceitaDiaria: rascunho.aceitaDiaria,
    precoDiaria: precoDaDiaria,
    precoDiariaGrupo: precoDiariaGrupo,
    pessoasParaGrupoDiaria: corteDaDiaria,
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
        etiqueta="Preço por hora — de dia, para grupo (R$)"
        inputMode="decimal"
        value={rascunho.precoPorHoraGrupo}
        onChange={(evento) => trocar("precoPorHoraGrupo", evento.target.value)}
        dica="Em branco = o tamanho do grupo não muda o preço de dia."
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
        dica="Com 4 aqui, 5 pessoas já pagam o preço de grupo — de dia e à noite."
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

        {/* Os campos da diaria so aparecem com a diaria ligada: numa sala que
            nao trabalha com dia inteiro eles seriam tres campos sem uso. */}
        {rascunho.aceitaDiaria ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Preço da diária (R$)"
              inputMode="decimal"
              value={rascunho.precoDiaria}
              onChange={(evento) => trocar("precoDiaria", evento.target.value)}
              dica="Preço fechado do dia inteiro, independente do horário."
            />

            <Campo
              etiqueta="Preço da diária — para grupo (R$)"
              inputMode="decimal"
              value={rascunho.precoDiariaGrupo}
              onChange={(evento) => trocar("precoDiariaGrupo", evento.target.value)}
              dica="Em branco = a diária tem um preço só, qualquer que seja o grupo."
            />

            <Campo
              etiqueta="Grupo na diária é acima de quantas pessoas"
              inputMode="numeric"
              value={rascunho.pessoasParaGrupoDiaria}
              onChange={(evento) =>
                trocar("pessoasParaGrupoDiaria", evento.target.value.replace(/\D/g, ""))
              }
              dica="Este número é SÓ da diária e pode ser diferente do de cima. Hoje: 5 aqui e 4 por hora."
            />

            <p className="self-end text-sm text-text-secondary sm:col-span-1">
              O corte da diária é separado de propósito: na Sala de Reunião a
              hora pula de preço entre 4 e 5 pessoas, e a diária entre 5 e 6.
            </p>
          </div>
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
