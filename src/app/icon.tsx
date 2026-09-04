import { ImageResponse } from "next/og";

import { AMARELO, PRETO } from "@/lib/marca";

/**
 * Icone da aba do navegador.
 *
 * Gerado como a imagem de compartilhamento, e pelo mesmo motivo: a cor e a
 * letra saem de "marca.ts", entao nao existe arquivo de imagem para alguem
 * esquecer de atualizar. Fundo amarelo com letra preta e a combinacao de
 * maior contraste do sistema (CLAUDE.md) e continua legivel num quadradinho
 * de 16 pixels.
 */
export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icone() {
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
          fontSize: 46,
          fontWeight: 700,
        }}
      >
        M
      </div>
    ),
    size,
  );
}
