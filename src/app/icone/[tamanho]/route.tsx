import { ImageResponse } from "next/og";

import { ladoDoIcone } from "@/lib/manifesto";
import { AMARELO, PRETO } from "@/lib/marca";

/**
 * O ICONE GRANDE, do tamanho que o celular pedir.
 *
 * POR QUE NAO DEU PARA USAR OS QUE JA EXISTIAM: "icon.tsx" desenha 64 pixels
 * (a abinha do navegador) e "apple-icon.tsx" desenha 180 (o iPhone). O
 * Android so OFERECE a instalacao se houver um icone de 192 ou mais, e quando
 * nao ha ele nao reclama: o convite simplesmente nunca aparece.
 *
 * Desenhado aqui, e nao guardado como arquivo de imagem, pela mesma razao dos
 * outros dois: a cor sai de "marca.ts", entao nao existe arquivo para alguem
 * esquecer de trocar no dia em que o amarelo mudar.
 *
 * A LETRA OCUPA METADE DO QUADRADO de proposito. O Android recorta o icone em
 * circulo ou em quadrado arredondado, conforme o aparelho; com a letra
 * ocupando quase tudo — como no icone da abinha, que ninguem recorta — as
 * pontas do M seriam comidas pelo recorte.
 */
export const runtime = "nodejs";

export async function GET(
  _pedido: Request,
  { params }: { params: Promise<{ tamanho: string }> },
): Promise<Response> {
  const { tamanho } = await params;

  // Lista fechada, conferida em "@/lib/manifesto" — o mesmo lugar de onde a
  // ficha do aplicativo tira os tamanhos que pede.
  const lado = ladoDoIcone(tamanho);

  if (lado === null) {
    return new Response("Tamanho de ícone não disponível.", { status: 404 });
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: AMARELO,
          color: PRETO,
          fontSize: Math.round(lado / 2),
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    {
      width: lado,
      height: lado,
      // O desenho nunca muda. Sem isto, o celular pediria as duas imagens a
      // cada abertura do aplicativo.
      headers: { "cache-control": "public, max-age=86400, immutable" },
    },
  );
}
