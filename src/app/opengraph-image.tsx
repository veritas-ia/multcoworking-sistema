import { ImageResponse } from "next/og";

import { AMARELO, NOME_DA_MARCA, PRETO } from "@/lib/marca";

/**
 * A IMAGEM QUE O WHATSAPP E O INSTAGRAM MOSTRAM (Fase 12).
 *
 * O CLAUDE.md diz que a maior parte do trafego chega por link colado no
 * WhatsApp e no Instagram. Sem esta imagem, o link aparece como um retangulo
 * cinza vazio — parece link suspeito, e menos gente toca.
 *
 * E gerada pelo proprio Next durante o build, e nao um arquivo de imagem
 * guardado no projeto: mudar o nome ou a cor da marca nao exige abrir editor
 * de imagem nenhum.
 *
 * Cuidado ao mexer: quem desenha esta imagem nao e um navegador. Cada caixa
 * precisa de "display: flex" declarado, e so entende um subconjunto do CSS.
 */
export const runtime = "nodejs";
export const alt = `${NOME_DA_MARCA} — reserve sua sala`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ImagemDeCompartilhamento() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: AMARELO,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              width: 120,
              height: 12,
              backgroundColor: PRETO,
              borderRadius: 999,
            }}
          />
          <div
            style={{
              display: "flex",
              marginTop: 40,
              fontSize: 108,
              fontWeight: 700,
              color: PRETO,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {NOME_DA_MARCA}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 44,
              color: PRETO,
              opacity: 0.75,
            }}
          >
            Reserve sua sala em poucos toques
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {["Sala CI", "Sala de Reunião", "Sala Container"].map((sala) => (
            <div
              key={sala}
              style={{
                display: "flex",
                padding: "14px 28px",
                borderRadius: 999,
                border: `3px solid ${PRETO}`,
                fontSize: 30,
                color: PRETO,
              }}
            >
              {sala}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
