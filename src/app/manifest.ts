import type { MetadataRoute } from "next";

import { manifestoPublico } from "@/lib/manifesto";

/**
 * A FICHA DO APLICATIVO DO SITE (o que o celular le ao salvar na tela de
 * inicio). O conteudo mora em "src/lib/manifesto.ts", que e TypeScript puro e
 * por isso da para testar; aqui fica so a entrega.
 *
 * Gerada a cada pedido, e nao uma vez na construcao da imagem, pelo MESMO
 * motivo do robots.txt: a variavel AMBIENTE so existe quando o container
 * SOBE. Sem isto, a ficha da previa sairia congelada com o nome e a cor do
 * sistema de verdade — e os dois icones ficariam identicos na tela do
 * celular, que e o acidente que a previa inteira tenta evitar.
 */
export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return manifestoPublico();
}
