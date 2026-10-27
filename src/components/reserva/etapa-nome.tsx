"use client";

import { useId, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { TituloDaEtapa } from "./pecas";
import type { EmpresaDoCliente, ProfissaoDoCliente } from "./tipos";

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
  nomeJaConhecido,
  aoLiberarNome,
  pessoas,
  perguntarPessoas,
  capacidade,
  profissao,
  profissoes,
  empresas,
  empresaId,
  aoMudar,
  aoMudarPessoas,
  aoMudarProfissao,
  aoMudarEmpresa,
  aoContinuar,
}: {
  nome: string;
  /** Veio da reserva anterior deste telefone: o campo nasce travado. */
  nomeJaConhecido: boolean;
  aoLiberarNome: () => void;
  /** Texto, para o campo poder ficar vazio enquanto a pessoa digita. */
  pessoas: string;
  perguntarPessoas: boolean;
  /** Teto de pessoas da sala. Nulo = a sala nao tem teto cadastrado. */
  capacidade: number | null;
  /** O identificador da area escolhida. Vazio ate escolher; obrigatorio. */
  profissao: string;
  /** As areas de atuacao cadastradas pela equipe, na ordem do painel. */
  profissoes: ProfissaoDoCliente[];
  /** As empresas mensalistas cadastradas. Vazia = a pergunta nao aparece. */
  empresas: EmpresaDoCliente[];
  /** A empresa escolhida, ou nulo para "nao sou de empresa mensalista". */
  empresaId: string | null;
  aoMudar: (nome: string) => void;
  aoMudarPessoas: (pessoas: string) => void;
  aoMudarProfissao: (profissao: string) => void;
  aoMudarEmpresa: (empresaId: string | null) => void;
  aoContinuar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [erroDePessoas, setErroDePessoas] = useState<string | null>(null);
  const [erroDeProfissao, setErroDeProfissao] = useState<string | null>(null);
  const [erroDeEmpresa, setErroDeEmpresa] = useState<string | null>(null);
  const idProfissao = useId();
  const idEmpresa = useId();

  /**
   * Nulo = a pessoa ainda nao respondeu. Com a empresa ja vinda do telefone,
   * nasce em "sim" — e so confirmar.
   */
  const [deEmpresa, setDeEmpresa] = useState<boolean | null>(
    empresaId === null ? null : true,
  );

  /**
   * A area escolhida, se houver. A trava do bloqueio sai dela: a lista veio
   * do servidor e ja diz quais nao podem reservar.
   */
  const escolhida = profissoes.find((opcao) => opcao.id === profissao) ?? null;
  const bloqueada = escolhida?.bloqueada === true;

  /** Sem empresa cadastrada no painel, a pergunta nao faz sentido nenhum. */
  const perguntarEmpresa = empresas.length > 0;

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

        // O servidor recusa de qualquer jeito; aqui e so para a pessoa nao
        // preencher o resto a toa e levar a recusa no fim.
        if (
          perguntarPessoas &&
          capacidade !== null &&
          Number(pessoas.trim()) > capacidade
        ) {
          setErroDePessoas(
            `Esta sala comporta no máximo ${capacidade} pessoas. Para um grupo maior, fale com a recepção.`,
          );
          return;
        }

        if (profissao === "") {
          setErroDeProfissao("Escolha a sua área de atuação.");
          return;
        }

        // A trava da area bloqueada. O servidor recusa de qualquer jeito;
        // aqui e so para o cliente nao preencher o resto a toa e levar a
        // recusa so no fim.
        if (bloqueada) {
          return;
        }

        // Quem disse que e de empresa precisa dizer QUAL. Deixar passar em
        // branco criaria a reserva sem empresa, e a pessoa sairia achando
        // que marcou no nome da dela.
        if (perguntarEmpresa && deEmpresa === null) {
          setErroDeEmpresa("Diga se esta reserva é de uma empresa mensalista.");
          return;
        }

        if (perguntarEmpresa && deEmpresa && empresaId === null) {
          setErroDeEmpresa("Escolha a empresa.");
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

      {/* NOME JA CONHECIDO: vem travado, com "Trocar o nome" do lado.
          Nao e para impedir a pessoa de se corrigir — e para ela nao
          reescrever o nome por reflexo a cada reserva e virar varias versoes
          de si mesma no painel. Quem quiser trocar, troca num toque. */}
      {nomeJaConhecido ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text-primary">Seu nome</span>
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-bg-secondary px-4 py-2.5">
            <span className="text-base text-text-primary">{nome}</span>
            <button
              type="button"
              onClick={aoLiberarNome}
              className="min-h-11 text-sm font-semibold text-text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Trocar o nome
            </button>
          </div>
          <span className="text-sm text-text-secondary">
            É o nome da sua última reserva. Pode trocar se quiser.
          </span>
        </div>
      ) : (
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
      )}

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
          {profissoes.map((opcao) => (
            <option key={opcao.id} value={opcao.id}>
              {opcao.nome}
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

      {/* A EMPRESA MENSALISTA.
          Lista fechada, cadastrada pela equipe: digitar livre devolveria a
          bagunca de nomes ("Prestare", "Prestarre") por outra porta. Nao muda
          preco nem disponibilidade — serve ao relatorio da equipe. */}
      {perguntarEmpresa ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="pb-1 text-sm font-semibold text-text-primary">
            Esta reserva é de uma empresa mensalista?
          </legend>

          <div className="flex flex-col gap-2 sm:flex-row">
            {[
              { valor: false, rotulo: "Não, é minha" },
              { valor: true, rotulo: "Sim, de uma empresa" },
            ].map((opcao) => (
              <button
                key={String(opcao.valor)}
                type="button"
                aria-pressed={deEmpresa === opcao.valor}
                onClick={() => {
                  setDeEmpresa(opcao.valor);
                  setErroDeEmpresa(null);
                  if (!opcao.valor) {
                    aoMudarEmpresa(null);
                  }
                }}
                className={`min-h-12 flex-1 rounded-lg border px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black ${
                  deEmpresa === opcao.valor
                    ? "border-black bg-brand-yellow font-semibold text-black"
                    : "border-border bg-bg-primary text-text-primary"
                }`}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>

          {deEmpresa ? (
            <div className="flex flex-col gap-2">
              <label
                htmlFor={idEmpresa}
                className="text-sm font-semibold text-text-primary"
              >
                Qual empresa?
              </label>
              <select
                id={idEmpresa}
                value={empresaId ?? ""}
                aria-invalid={erroDeEmpresa ? true : undefined}
                onChange={(evento) => {
                  aoMudarEmpresa(evento.target.value === "" ? null : evento.target.value);
                  setErroDeEmpresa(null);
                }}
                className={`min-h-12 w-full rounded-lg border bg-bg-primary px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black ${
                  erroDeEmpresa ? "border-destructive" : "border-border"
                }`}
              >
                <option value="">Escolha…</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {erroDeEmpresa ? (
            <p className="text-sm font-medium text-destructive">{erroDeEmpresa}</p>
          ) : (
            <p className="text-sm text-text-secondary">
              Se a sua empresa aluga uma sala por mês aqui, as reservas da
              equipe ficam juntas. Não muda o valor.
            </p>
          )}
        </fieldset>
      ) : null}

      {bloqueada ? (
        <p
          role="status"
          className="rounded-lg border border-destructive bg-bg-primary p-4 text-sm leading-relaxed text-text-primary"
        >
          {escolhida?.avisoBloqueio}
        </p>
      ) : null}

      <Botao type="submit" disabled={bloqueada}>
        Continuar
      </Botao>
    </form>
  );
}
