"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import {
  formatarEnquantoDigita,
  mascararTelefone,
  normalizarTelefone,
} from "@/lib/telefone";

import { confirmarCodigo, enviarCodigo, mensagemDoErro } from "./api";
import { TituloDaEtapa } from "./pecas";

/** Segundos de espera antes de liberar o "reenviar" (limite do CLAUDE.md: 1/min). */
const ESPERA_PARA_REENVIAR = 60;

type Props = {
  /** Chamado quando o telefone foi confirmado, com o numero ja mascarado. */
  aoConfirmar: (telefoneMascarado: string) => void;
};

/**
 * Etapa 5 — identificacao por WhatsApp.
 *
 * So aparece para quem ainda nao tem sessao valida no cookie. Duas telinhas:
 * primeiro o numero, depois o codigo de 6 digitos.
 */
export function EtapaTelefone({ aoConfirmar }: Props) {
  const [fase, setFase] = useState<"numero" | "codigo">("numero");
  const [telefoneDigitado, setTelefoneDigitado] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [segundosParaReenviar, setSegundosParaReenviar] = useState(0);

  const telefoneNormalizado = normalizarTelefone(telefoneDigitado);

  useEffect(() => {
    if (segundosParaReenviar <= 0) {
      return;
    }
    const relogio = setTimeout(
      () => setSegundosParaReenviar((restante) => restante - 1),
      1_000,
    );
    return () => clearTimeout(relogio);
  }, [segundosParaReenviar]);

  async function pedirCodigo(): Promise<void> {
    if (!telefoneNormalizado) {
      setErro("Confira o número: precisa ser DDD + celular, como (11) 91234-5678.");
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      await enviarCodigo(telefoneNormalizado);
      setFase("codigo");
      setCodigo("");
      setSegundosParaReenviar(ESPERA_PARA_REENVIAR);
    } catch (problema: unknown) {
      setErro(mensagemDoErro(problema));
    } finally {
      setEnviando(false);
    }
  }

  async function conferirCodigo(): Promise<void> {
    if (!telefoneNormalizado) {
      return;
    }
    if (codigo.length !== 6) {
      setErro("O código tem 6 dígitos.");
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      await confirmarCodigo(telefoneNormalizado, codigo);
      aoConfirmar(mascararTelefone(telefoneNormalizado));
    } catch (problema: unknown) {
      setErro(mensagemDoErro(problema));
      setCodigo("");
    } finally {
      setEnviando(false);
    }
  }

  if (fase === "numero") {
    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(evento) => {
          evento.preventDefault();
          void pedirCodigo();
        }}
      >
        <TituloDaEtapa apoio="Precisamos confirmar que o WhatsApp é seu. É rápido: um código de 6 dígitos.">
          Qual seu WhatsApp?
        </TituloDaEtapa>

        <Campo
          etiqueta="Celular com DDD"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          value={telefoneDigitado}
          erro={erro}
          onChange={(evento) => {
            setTelefoneDigitado(formatarEnquantoDigita(evento.target.value));
            setErro(null);
          }}
        />

        <Botao type="submit" disabled={enviando || !telefoneNormalizado}>
          {enviando ? "Enviando…" : "Enviar código no WhatsApp"}
        </Botao>
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        void conferirCodigo();
      }}
    >
      <TituloDaEtapa
        apoio={
          <>
            Mandamos um código de 6 dígitos para{" "}
            <strong className="font-semibold text-text-primary">
              {telefoneDigitado}
            </strong>
            . Ele vale por 10 minutos.
          </>
        }
      >
        Enviamos um código no seu WhatsApp
      </TituloDaEtapa>

      <Campo
        etiqueta="Código de 6 dígitos"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        placeholder="000000"
        value={codigo}
        erro={erro}
        className="text-center text-2xl font-bold tracking-[0.4em]"
        onChange={(evento) => {
          setCodigo(evento.target.value.replace(/\D/g, "").slice(0, 6));
          setErro(null);
        }}
      />

      <Botao type="submit" disabled={enviando || codigo.length !== 6}>
        {enviando ? "Conferindo…" : "Confirmar código"}
      </Botao>

      <div className="flex flex-col items-center gap-3 text-sm">
        {segundosParaReenviar > 0 ? (
          <p aria-live="polite" className="min-h-11 py-3 text-text-secondary">
            Não chegou? Pode reenviar em {segundosParaReenviar}s.
          </p>
        ) : (
          <Botao
            aparencia="texto"
            largura="conteudo"
            disabled={enviando}
            onClick={() => void pedirCodigo()}
            className="min-h-11"
          >
            Reenviar código
          </Botao>
        )}

        <Botao
          aparencia="texto"
          largura="conteudo"
          onClick={() => {
            setFase("numero");
            setErro(null);
            setCodigo("");
          }}
          className="min-h-11 text-text-secondary"
        >
          Digitei o número errado
        </Botao>
      </div>
    </form>
  );
}
