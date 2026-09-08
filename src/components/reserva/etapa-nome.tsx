"use client";

import { useId, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { PROFISSOES } from "@/lib/profissoes";

import { TituloDaEtapa } from "./pecas";

/**
 * Etapa 6 — nome (e, em algumas salas, quantas pessoas).
 *
 * Sem e-mail: decisao do CLAUDE.md, a reserva guarda so nome e telefone.
 *
 * O numero de pessoas so aparece nas salas que COBRAM diferente por tamanho
 * de grupo — hoje, a de Reuniao. A pergunta nasce do cadastro da sala, e nao
 * de uma lista de nomes no codigo: ligar a mesma regra numa sala nova e so
 * preencher os campos no painel.
 */
export function EtapaNome({
  nome,
  pessoas,
  perguntarPessoas,
  profissao,
  aoMudar,
  aoMudarPessoas,
  aoMudarProfissao,
  aoContinuar,
}: {
  nome: string;
  /** Texto, para o campo poder ficar vazio enquanto a pessoa digita. */
  pessoas: string;
  perguntarPessoas: boolean;
  /** Vazio ate a pessoa escolher. Obrigatorio para continuar. */
  profissao: string;
  aoMudar: (nome: string) => void;
  aoMudarPessoas: (pessoas: string) => void;
  aoMudarProfissao: (profissao: string) => void;
  aoContinuar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [erroDePessoas, setErroDePessoas] = useState<string | null>(null);
  const [erroDeProfissao, setErroDeProfissao] = useState<string | null>(null);
  const idProfissao = useId();

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (nome.trim().length < 2) {
          setErro("Escreva seu nome para a equipe saber quem esperar.");
          return;
        }

        if (perguntarPessoas && !/^[1-9]\d*$/.test(pessoas.trim())) {
          setErroDePessoas("Diga quantas pessoas vão usar a sala.");
          return;
        }

        if (profissao === "") {
          setErroDeProfissao("Escolha a sua área de atuação.");
          return;
        }

        aoContinuar();
      }}
    >
      <TituloDaEtapa
        apoio={
          perguntarPessoas
            ? "O nome é como a equipe vai te chamar. O número de pessoas ajuda a preparar a sala."
            : "É como a equipe vai te chamar quando você chegar."
        }
      >
        {perguntarPessoas ? "Quase lá" : "Como você se chama?"}
      </TituloDaEtapa>

      <Campo
        etiqueta="Seu nome"
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={120}
        placeholder="Maria Silva"
        value={nome}
        erro={erro}
        onChange={(evento) => {
          aoMudar(evento.target.value);
          setErro(null);
        }}
      />

      {perguntarPessoas ? (
        <Campo
          etiqueta="Quantas pessoas vão usar a sala?"
          inputMode="numeric"
          placeholder="4"
          value={pessoas}
          erro={erroDePessoas}
          dica="Depois das 18h, grupos maiores têm preço diferente. O valor aparece na próxima tela."
          onChange={(evento) => {
            aoMudarPessoas(evento.target.value.replace(/\D/g, ""));
            setErroDePessoas(null);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <label
          htmlFor={idProfissao}
          className="text-sm font-semibold text-text-primary"
        >
          Sua área de atuação
        </label>

        <select
          id={idProfissao}
          value={profissao}
          aria-invalid={erroDeProfissao ? true : undefined}
          onChange={(evento) => {
            aoMudarProfissao(evento.target.value);
            setErroDeProfissao(null);
          }}
          className={`min-h-12 w-full rounded-lg border bg-bg-primary px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black ${
            erroDeProfissao ? "border-destructive" : "border-border"
          }`}
        >
          <option value="">Escolha…</option>
          {PROFISSOES.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>

        {erroDeProfissao ? (
          <p className="text-sm font-medium text-destructive">{erroDeProfissao}</p>
        ) : (
          <p className="text-sm text-text-secondary">
            Ajuda a equipe a entender quem usa o espaço. Não muda o valor.
          </p>
        )}
      </div>

      <Botao type="submit">Continuar</Botao>
    </form>
  );
}
