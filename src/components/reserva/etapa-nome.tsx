"use client";

import { useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

import { TituloDaEtapa } from "./pecas";

/**
 * Etapa 6 — nome.
 * Sem e-mail: decisao do CLAUDE.md, a reserva guarda so nome e telefone.
 */
export function EtapaNome({
  nome,
  aoMudar,
  aoContinuar,
}: {
  nome: string;
  aoMudar: (nome: string) => void;
  aoContinuar: () => void;
}) {
  const [erro, setErro] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (nome.trim().length < 2) {
          setErro("Escreva seu nome para a equipe saber quem esperar.");
          return;
        }
        aoContinuar();
      }}
    >
      <TituloDaEtapa apoio="É como a equipe vai te chamar quando você chegar.">
        Como você se chama?
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

      <Botao type="submit">Continuar</Botao>
    </form>
  );
}
