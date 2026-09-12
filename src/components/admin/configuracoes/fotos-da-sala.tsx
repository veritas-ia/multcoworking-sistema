"use client";

import { useRef, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { MAXIMO_DE_FOTOS, TIPOS_ACEITOS, enderecoDaFoto } from "@/lib/cloudinary";

import { enviarFoto, removerFoto, reordenarFotos, type FotoDaSala } from "./api";

/**
 * A AREA DE FOTOS DE UMA SALA, no painel.
 *
 * A reordenacao e por BOTOES de mover, e nao arrastando. Arrastar e bonito no
 * computador e ruim no tablet — que e onde a recepcao mexe —, alem de nao
 * funcionar para quem navega pelo teclado. Com botoes, todo mundo consegue.
 *
 * Quando o Cloudinary nao esta configurado, a area aparece mesmo assim, com
 * as fotos que ja existirem e um aviso no lugar do botao de enviar: o resto
 * do painel nao pode parar por causa disso.
 */
export function FotosDaSala({
  salaId,
  nomeDaSala,
  fotos,
  envioDisponivel,
  aoMudar,
}: {
  salaId: string;
  nomeDaSala: string;
  fotos: FotoDaSala[];
  envioDisponivel: boolean;
  aoMudar: (fotos: FotoDaSala[]) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const campoDeArquivo = useRef<HTMLInputElement>(null);

  const cheia = fotos.length >= MAXIMO_DE_FOTOS;

  function tratar(falha: unknown, padrao: string): void {
    setErro(falha instanceof ErroDaApi ? falha.message : padrao);
  }

  async function enviar(arquivo: File): Promise<void> {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const { fotos: atualizadas } = await enviarFoto(salaId, arquivo);
      aoMudar(atualizadas);
    } catch (falha) {
      tratar(falha, "Não foi possível enviar a foto.");
    } finally {
      setOcupado(false);
      // Limpa o campo para dar para reenviar o MESMO arquivo depois de um erro.
      if (campoDeArquivo.current) {
        campoDeArquivo.current.value = "";
      }
    }
  }

  async function remover(foto: FotoDaSala): Promise<void> {
    setOcupado(true);
    setErro(null);
    setAviso(null);

    try {
      const resposta = await removerFoto(salaId, foto.id);
      aoMudar(resposta.fotos);
      setAviso(resposta.aviso);
    } catch (falha) {
      tratar(falha, "Não foi possível remover a foto.");
    } finally {
      setOcupado(false);
    }
  }

  async function mover(indice: number, direcao: -1 | 1): Promise<void> {
    const destino = indice + direcao;

    if (destino < 0 || destino >= fotos.length) {
      return;
    }

    const nova = [...fotos];
    [nova[indice], nova[destino]] = [nova[destino]!, nova[indice]!];

    setOcupado(true);
    setErro(null);

    // Mostra a ordem nova na hora; se o servidor recusar, volta atras.
    aoMudar(nova);

    try {
      const { fotos: confirmadas } = await reordenarFotos(
        salaId,
        nova.map((foto) => foto.id),
      );
      aoMudar(confirmadas);
    } catch (falha) {
      aoMudar(fotos);
      tratar(falha, "Não foi possível mudar a ordem.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-text-primary">
          Fotos ({fotos.length} de {MAXIMO_DE_FOTOS})
        </h3>
        <p className="text-sm text-text-secondary">
          A primeira é a que o cliente vê primeiro no site.
        </p>
      </div>

      {fotos.length === 0 ? (
        <p className="rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
          Sem fotos ainda. Enquanto estiver assim, o site não mostra carrossel
          nesta sala — nem espaço vazio.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {fotos.map((foto, indice) => (
            <li
              key={foto.id}
              className="flex w-32 flex-col gap-1.5 rounded-lg border border-border bg-bg-secondary p-1.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element --
                  a imagem vem do Cloudinary ja no tamanho pedido pelo
                  endereco; o otimizador do Next so acrescentaria uma volta. */}
              <img
                src={enderecoDaFoto(foto.url, 240)}
                alt={`Foto ${indice + 1} da ${nomeDaSala}`}
                className="h-20 w-full rounded object-cover"
                loading="lazy"
              />

              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label={`Mover foto ${indice + 1} para trás`}
                  disabled={ocupado || indice === 0}
                  onClick={() => void mover(indice, -1)}
                  className="flex size-8 items-center justify-center rounded text-text-primary hover:bg-bg-primary disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                >
                  <span aria-hidden>‹</span>
                </button>

                <span className="text-xs tabular-nums text-text-secondary">
                  {indice + 1}
                </span>

                <button
                  type="button"
                  aria-label={`Mover foto ${indice + 1} para frente`}
                  disabled={ocupado || indice === fotos.length - 1}
                  onClick={() => void mover(indice, 1)}
                  className="flex size-8 items-center justify-center rounded text-text-primary hover:bg-bg-primary disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                >
                  <span aria-hidden>›</span>
                </button>
              </div>

              <button
                type="button"
                disabled={ocupado}
                onClick={() => void remover(foto)}
                className="rounded py-1 text-xs font-semibold text-destructive hover:bg-bg-primary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {envioDisponivel ? (
        <div className="flex flex-col gap-2">
          <input
            ref={campoDeArquivo}
            type="file"
            accept={TIPOS_ACEITOS.join(",")}
            disabled={ocupado || cheia}
            aria-label={`Enviar foto da ${nomeDaSala}`}
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              if (arquivo) {
                void enviar(arquivo);
              }
            }}
            className="text-sm text-text-secondary file:mr-3 file:min-h-10 file:rounded-lg file:border file:border-border file:bg-bg-primary file:px-4 file:text-sm file:font-semibold file:text-text-primary disabled:opacity-50"
          />

          <p className="text-sm text-text-secondary">
            {cheia
              ? `Esta sala já tem ${MAXIMO_DE_FOTOS} fotos. Remova uma para enviar outra.`
              : "JPG, PNG ou WEBP, até 5 MB cada."}
          </p>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-bg-secondary p-3 text-sm text-text-secondary">
          <strong className="font-semibold text-text-primary">
            Envio de fotos indisponível.
          </strong>{" "}
          Falta configurar o Cloudinary no servidor (as três variáveis
          CLOUDINARY_… no EasyPanel). As fotos que já existem continuam
          aparecendo normalmente.
        </p>
      )}

      {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
      {aviso ? <p className="text-sm text-text-secondary">{aviso}</p> : null}

      {ocupado ? (
        <p aria-live="polite" className="text-sm text-text-secondary">
          Trabalhando…
        </p>
      ) : null}
    </div>
  );
}
