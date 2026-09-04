import { ImageResponse } from "next/og";

import { AMARELO, PRETO } from "@/lib/marca";

/**
 * Icone de quando alguem salva o site na tela inicial do celular.
 *
 * O iPhone pede um tamanho proprio (180x180) e NAO arredonda sozinho: sem
 * este arquivo ele recorta um pedaco da pagina, o que costuma sair feio.
 */
export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IconeDoCelular() {
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
          fontSize: 120,
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    size,
  );
}
