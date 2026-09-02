"use client";

import { useEffect, useRef, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { mensagemDoErro } from "@/components/reserva/api";

import { pedirCodigoDaSessao } from "./api";

const ESPERA_PARA_REENVIAR = 60;

/**
 * Pede o codigo de 6 digitos antes de uma acao destrutiva.
 *
 * Decisao do CLAUDE.md: cancelar e reagendar exigem um codigo NOVO do WhatsApp
 * na hora, mesmo com a sessao de 30 dias valida. Quem confere o codigo e o
 * servidor, dentro da propria acao — este componente so coleta.
 */
export function PedirCodigo({
  titulo,
  descricao,
  rotuloDoBotao,
  telefoneMascarado,
  enviando,
  erro,
  aoConfirmar,
  aoDesistir,
}: {
  titulo: string;
  descricao: string;
  rotuloDoBotao: string;
  telefoneMascarado: string | null;
  enviando: boolean;
  erro: string | null;
  aoConfirmar: (codigo: string) => void;
  aoDesistir: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(ESPERA_PARA_REENVIAR);
  const [pedindo, setPedindo] = useState(false);
  const jaPediu = useRef(false);

  // O primeiro codigo sai sozinho: a pessoa ja clicou em "cancelar" ou
  // "reagendar", nao faz sentido pedir mais um clique so para receber o codigo.
  useEffect(() => {
    if (jaPediu.current) {
      return;
    }
    jaPediu.current = true;

    pedirCodigoDaSessao().catch((problema: unknown) => {
      setErroLocal(mensagemDoErro(problema));
    });
  }, []);

  useEffect(() => {
    if (segundos <= 0) {
      return;
    }
    const relogio = setTimeout(() => setSegundos((resta) => resta - 1), 1_000);
    return () => clearTimeout(relogio);
  }, [segundos]);

  async function reenviar(): Promise<void> {
    setPedindo(true);
    setErroLocal(null);
    try {
      await pedirCodigoDaSessao();
      setSegundos(ESPERA_PARA_REENVIAR);
      setCodigo("");
    } catch (problema: unknown) {
      setErroLocal(mensagemDoErro(problema));
    } finally {
      setPedindo(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (codigo.length !== 6) {
          setErroLocal("O código tem 6 dígitos.");
          return;
        }
        aoConfirmar(codigo);
      }}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold tracking-tight text-text-primary">{titulo}</h2>
        <p className="text-sm text-text-secondary">
          {descricao} Para sua segurança, enviamos um código novo
          {telefoneMascarado ? ` para ${telefoneMascarado}` : ""}.
        </p>
      </div>

      <Campo
        etiqueta="Código de 6 dígitos"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        placeholder="000000"
        value={codigo}
        erro={erroLocal ?? erro}
        className="text-center text-2xl font-bold tracking-[0.4em]"
        onChange={(evento) => {
          setCodigo(evento.target.value.replace(/\D/g, "").slice(0, 6));
          setErroLocal(null);
        }}
      />

      <Botao type="submit" disabled={enviando || codigo.length !== 6}>
        {enviando ? "Confirmando…" : rotuloDoBotao}
      </Botao>

      <div className="flex flex-col items-center gap-2 text-sm">
        {segundos > 0 ? (
          <p aria-live="polite" className="min-h-11 py-3 text-text-secondary">
            Não chegou? Pode reenviar em {segundos}s.
          </p>
        ) : (
          <Botao
            aparencia="texto"
            largura="conteudo"
            disabled={pedindo || enviando}
            onClick={() => void reenviar()}
            className="min-h-11"
          >
            Reenviar código
          </Botao>
        )}

        <Botao
          aparencia="texto"
          largura="conteudo"
          onClick={aoDesistir}
          disabled={enviando}
          className="min-h-11 text-text-secondary"
        >
          Voltar sem alterar
        </Botao>
      </div>
    </form>
  );
}
