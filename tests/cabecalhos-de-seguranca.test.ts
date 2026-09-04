/**
 * CABECALHOS DE SEGURANCA (Fase 12).
 *
 * O que estes testes protegem:
 *  1. o painel nao pode ser aberto dentro de outro site disfarcado — o golpe
 *     e cobrir a tela e fazer a pessoa clicar em "cancelar" achando que clica
 *     noutra coisa;
 *  2. a area PUBLICA continua podendo ser embutida no site do coworking. Se um
 *     dia alguem bloquear tudo "por seguranca", este teste explica por que
 *     nao;
 *  3. o site nao anuncia qual tecnologia usa.
 *
 * Conferido tambem no servidor de verdade, com os cabecalhos na resposta.
 */
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

async function cabecalhosDe(caminho: string): Promise<Map<string, string>> {
  const regras = (await nextConfig.headers?.()) ?? [];
  const encontrados = new Map<string, string>();

  for (const regra of regras) {
    // As regras do Next sao caminhos com curinga: "/admin/:caminho*".
    const raiz = regra.source.split("/:")[0] || "/";

    if (raiz === "/" || caminho === raiz || caminho.startsWith(`${raiz}/`)) {
      for (const cabecalho of regra.headers) {
        encontrados.set(cabecalho.key.toLowerCase(), cabecalho.value);
      }
    }
  }

  return encontrados;
}

// -----------------------------------------------------------------------------

describe("o painel", () => {
  it("nao pode ser aberto dentro de outro site", async () => {
    const cabecalhos = await cabecalhosDe("/admin/agenda");

    expect(cabecalhos.get("x-frame-options")).toBe("DENY");
  });
});

describe("a area publica", () => {
  it("CONTINUA podendo ser embutida no site do coworking", async () => {
    const cabecalhos = await cabecalhosDe("/");

    // Proposital: a pagina de reserva pode um dia morar dentro do site do
    // coworking. Bloquear aqui quebraria isso sem ninguem entender por que.
    expect(cabecalhos.has("x-frame-options")).toBe(false);
  });
});

describe("as duas areas", () => {
  it("mandam os cabecalhos basicos", async () => {
    for (const caminho of ["/", "/minhas-reservas", "/admin/agenda"]) {
      const cabecalhos = await cabecalhosDe(caminho);

      expect(cabecalhos.get("x-content-type-options"), caminho).toBe("nosniff");
      expect(cabecalhos.get("referrer-policy"), caminho).toBe(
        "strict-origin-when-cross-origin",
      );
    }
  });
});

describe("o site", () => {
  it("nao anuncia qual tecnologia usa", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
