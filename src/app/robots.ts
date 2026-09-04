import type { MetadataRoute } from "next";

import { enderecoDoSite } from "@/lib/marca";

/**
 * O robots.txt do site.
 *
 * Duas camadas guardam o painel dos buscadores: cada pagina do /admin ja diz
 * "nao me indexe" no proprio HTML, e este arquivo diz o mesmo antes de o robo
 * chegar la. Uma camada so seria suficiente no dia bom; duas continuam
 * funcionando quando alguem esquecer a primeira numa pagina nova.
 *
 * As rotas de API tambem ficam de fora: nao ha nada ali para uma pessoa ler.
 */
/**
 * Gerado a cada pedido, e nao uma vez na construcao da imagem.
 *
 * O endereco do site vem do APP_URL, que no EasyPanel so existe quando o
 * container SOBE — na hora de construir a imagem ele ainda nao foi definido.
 * Sem isto, o robots.txt sairia congelado com "localhost" dentro.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/minhas-reservas"],
    },
    host: enderecoDoSite(),
  };
}
