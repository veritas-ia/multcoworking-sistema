"use client";

import { useRef, useState } from "react";

/**
 * CARROSSEL DE FOTOS DA SALA.
 *
 * Sem biblioteca: e uma lista que rola na horizontal com encaixe
 * ("scroll-snap"). Deslizar com o dedo ja funciona de graca no celular e no
 * tablet, porque quem faz a rolagem e o proprio navegador — e ele faz melhor
 * do que qualquer imitacao em JavaScript. As setas existem para quem usa
 * mouse ou teclado.
 *
 * Sala SEM foto nao chega aqui: quem chama nao desenha o carrossel. Assim
 * nao sobra moldura vazia nem espaco reservado para nada.
 */
export function CarrosselDeFotos({
  fotos,
  nomeDaSala,
}: {
  fotos: { id: string; url: string }[];
  nomeDaSala: string;
}) {
  const trilho = useRef<HTMLUListElement>(null);
  const [atual, setAtual] = useState(0);

  if (fotos.length === 0) {
    return null;
  }

  const uma = fotos.length === 1;

  function irPara(indice: number): void {
    const destino = Math.max(0, Math.min(indice, fotos.length - 1));
    const lista = trilho.current;

    if (!lista) {
      return;
    }

    lista.scrollTo({ left: destino * lista.clientWidth, behavior: "smooth" });
    setAtual(destino);
  }

  return (
    <div className="relative">
      <ul
        ref={trilho}
        // "snap" faz a foto parar encaixada, e nao no meio do caminho.
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-t-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(evento) => {
          const lista = evento.currentTarget;
          const largura = lista.clientWidth || 1;
          setAtual(Math.round(lista.scrollLeft / largura));
        }}
      >
        {fotos.map((foto, indice) => (
          <li key={foto.id} className="w-full shrink-0 snap-start">
            {/* eslint-disable-next-line @next/next/no-img-element --
                a imagem vem do Cloudinary ja no tamanho pedido pelo endereco;
                o otimizador do Next so acrescentaria uma volta. */}
            <img
              src={foto.url}
              alt={`${nomeDaSala} — foto ${indice + 1} de ${fotos.length}`}
              className="h-44 w-full bg-bg-secondary object-cover sm:h-56"
              loading="lazy"
            />
          </li>
        ))}
      </ul>

      {uma ? null : (
        <>
          <Seta
            lado="esquerda"
            rotulo="Foto anterior"
            desabilitada={atual === 0}
            aoTocar={() => irPara(atual - 1)}
          />
          <Seta
            lado="direita"
            rotulo="Próxima foto"
            desabilitada={atual === fotos.length - 1}
            aoTocar={() => irPara(atual + 1)}
          />

          {/* Bolinhas: dizem quantas fotos existem e em qual voce esta. */}
          <ul
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5"
          >
            {fotos.map((foto, indice) => (
              <li
                key={foto.id}
                className={`size-1.5 rounded-full ${
                  indice === atual ? "bg-brand" : "bg-bg-primary/70"
                }`}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Seta({
  lado,
  rotulo,
  desabilitada,
  aoTocar,
}: {
  lado: "esquerda" | "direita";
  rotulo: string;
  desabilitada: boolean;
  aoTocar: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={desabilitada}
      onClick={aoTocar}
      className={`absolute top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-black bg-brand text-lg font-bold text-brand-foreground transition-opacity disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${
        lado === "esquerda" ? "left-2" : "right-2"
      }`}
    >
      <span aria-hidden>{lado === "esquerda" ? "‹" : "›"}</span>
    </button>
  );
}
