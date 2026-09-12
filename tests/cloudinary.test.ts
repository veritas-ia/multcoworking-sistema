/**
 * A CONVERSA COM O CLOUDINARY.
 *
 * O que estes testes protegem (sem tocar na rede):
 *  1. a ASSINATURA. E a parte que erra em silencio: ordem alfabetica errada
 *     ou um parametro a mais faz o Cloudinary recusar com uma mensagem
 *     generica, e ninguem descobre o motivo olhando o codigo;
 *  2. "nao configurado" e um estado NORMAL, e nao um erro — o sistema inteiro
 *     precisa funcionar sem Cloudinary;
 *  3. o endereco da foto sai com o redimensionamento pedido, e um endereco
 *     fora do formato esperado volta inteiro em vez de virar link quebrado.
 *
 * Os limites e o endereco moram em "fotos.ts", separado de proposito: o
 * navegador tambem carrega aquele arquivo, e "cloudinary.ts" usa a
 * criptografia do Node — junto, quebra a construcao do site inteira.
 */
import { createHash } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  assinar,
  cloudinaryConfigurado,
  credenciais,
} from "@/lib/cloudinary";
import {
  MAXIMO_DE_FOTOS,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_ACEITOS,
  enderecoDaFoto,
} from "@/lib/fotos";

const ORIGINAIS = {
  nome: process.env.CLOUDINARY_CLOUD_NAME,
  chave: process.env.CLOUDINARY_API_KEY,
  segredo: process.env.CLOUDINARY_API_SECRET,
};

function configurar(nome?: string, chave?: string, segredo?: string): void {
  process.env.CLOUDINARY_CLOUD_NAME = nome ?? "";
  process.env.CLOUDINARY_API_KEY = chave ?? "";
  process.env.CLOUDINARY_API_SECRET = segredo ?? "";
}

afterEach(() => {
  configurar(ORIGINAIS.nome, ORIGINAIS.chave, ORIGINAIS.segredo);
});

// -----------------------------------------------------------------------------

describe("assinatura", () => {
  it("junta em ordem alfabetica, cola o segredo e tira o SHA-1", () => {
    // A regra e do Cloudinary. Repetida aqui a mao de proposito: se alguem
    // mudar a implementacao, este teste compara com a regra, e nao com a
    // implementacao nova.
    const esperado = createHash("sha1")
      .update("folder=pasta&timestamp=1700000000SEGREDO")
      .digest("hex");

    expect(assinar({ timestamp: "1700000000", folder: "pasta" }, "SEGREDO")).toBe(
      esperado,
    );
  });

  it("a ordem em que os parametros chegam nao muda a assinatura", () => {
    const umaOrdem = assinar({ a: "1", b: "2", c: "3" }, "S");
    const outraOrdem = assinar({ c: "3", a: "1", b: "2" }, "S");

    expect(umaOrdem).toBe(outraOrdem);
  });

  it("segredo diferente da assinatura diferente", () => {
    expect(assinar({ t: "1" }, "UM")).not.toBe(assinar({ t: "1" }, "OUTRO"));
  });

  it("um parametro a mais muda a assinatura", () => {
    expect(assinar({ t: "1" }, "S")).not.toBe(assinar({ t: "1", extra: "x" }, "S"));
  });
});

describe("configuracao ausente", () => {
  it("sem nenhuma variavel, diz que nao esta configurado", () => {
    configurar();

    expect(credenciais()).toBeNull();
    expect(cloudinaryConfigurado()).toBe(false);
  });

  it("com so uma ou duas variaveis, TAMBEM nao esta configurado", () => {
    configurar("nome", "", "");
    expect(cloudinaryConfigurado()).toBe(false);

    configurar("nome", "chave", "");
    expect(cloudinaryConfigurado()).toBe(false);

    configurar("", "chave", "segredo");
    expect(cloudinaryConfigurado()).toBe(false);
  });

  it("com as tres, esta configurado", () => {
    configurar("nome", "chave", "segredo");

    expect(cloudinaryConfigurado()).toBe(true);
    expect(credenciais()).toEqual({
      cloudName: "nome",
      apiKey: "chave",
      apiSecret: "segredo",
    });
  });

  it("espaco em branco nao conta como preenchido", () => {
    configurar("   ", "chave", "segredo");

    expect(cloudinaryConfigurado()).toBe(false);
  });
});

describe("endereco da foto", () => {
  const URL =
    "https://res.cloudinary.com/demo/image/upload/v1700000000/mult-coworking/salas/abc.jpg";

  it("pede o tamanho e o formato ao proprio Cloudinary", () => {
    expect(enderecoDaFoto(URL, 800)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/v1700000000/mult-coworking/salas/abc.jpg",
    );
  });

  it("tamanhos diferentes geram enderecos diferentes", () => {
    expect(enderecoDaFoto(URL, 400)).toContain("w_400");
    expect(enderecoDaFoto(URL, 1200)).toContain("w_1200");
  });

  it("endereco fora do formato esperado volta inteiro", () => {
    // Melhor a foto grande do que a foto quebrada.
    const estranho = "https://exemplo.com/foto.jpg";
    expect(enderecoDaFoto(estranho, 800)).toBe(estranho);
  });
});

describe("os limites", () => {
  it("sao os combinados com o dono", () => {
    expect(MAXIMO_DE_FOTOS).toBe(5);
    expect(TAMANHO_MAXIMO_BYTES).toBe(5 * 1024 * 1024);
    expect([...TIPOS_ACEITOS]).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});
