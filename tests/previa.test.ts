/**
 * A PREVIA: a copia do sistema que serve para mostrar o que esta sendo
 * construido, antes de ir para o original.
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 * A previa e uma copia IDENTICA: mesmo visual, mesmas telas, mesmos dados.
 * Em duas abas abertas, nada distingue uma da outra — e o acidente e sempre
 * o mesmo: alguem lanca a reserva de um cliente na previa, ela nunca chega na
 * agenda de verdade, e o cliente aparece no dia sem sala.
 *
 * Os avisos (faixa, titulo da aba, sumir do Google) sao o que impede isso. E
 * uma falha neles NAO DA ERRO EM LUGAR NENHUM: a previa continua funcionando
 * perfeitamente, so que indistinguivel do sistema de verdade. Por isso tem
 * teste.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import robots from "@/app/robots";
import { ehPrevia } from "@/lib/ambiente";
import { metadadosDoPainel, metadadosPublicos } from "@/lib/metadados";

const AMBIENTE_ORIGINAL = process.env.AMBIENTE;

/** Liga a previa, como o EasyPanel faria pela variavel de ambiente. */
function ligarPrevia(valor = "previa"): void {
  process.env.AMBIENTE = valor;
}

beforeEach(() => {
  delete process.env.AMBIENTE;
});

afterEach(() => {
  if (AMBIENTE_ORIGINAL === undefined) {
    delete process.env.AMBIENTE;
  } else {
    process.env.AMBIENTE = AMBIENTE_ORIGINAL;
  }
});

const PUBLICA = {
  titulo: "Reservar sala",
  descricao: "qualquer coisa",
  caminho: "/",
  indexar: true,
};

describe("quando a previa esta ligada", () => {
  it("reconhece o ambiente", () => {
    ligarPrevia();
    expect(ehPrevia()).toBe(true);
  });

  it("aceita espaco e maiuscula, porque o valor e digitado a mao", () => {
    // Quem preenche isso e uma pessoa, num campo de texto do EasyPanel.
    ligarPrevia("  PREVIA ");
    expect(ehPrevia()).toBe(true);
  });

  it("avisa no TITULO DA ABA, que e onde a faixa nao aparece", () => {
    // O acidente e a pessoa com as duas abas abertas. Na barra de abas nao
    // ha faixa nenhuma: so o titulo distingue uma da outra.
    ligarPrevia();
    expect(String(metadadosPublicos(PUBLICA).title)).toMatch(/^PRÉVIA · /);
    expect(String(metadadosDoPainel("Agenda").title)).toMatch(/^PRÉVIA · /);
  });

  it("some do Google mesmo nas paginas publicas", () => {
    // Sao duas copias do mesmo site. Indexadas as duas, o cliente abriria
    // pela busca a que nao vale e reservaria nela.
    ligarPrevia();
    expect(metadadosPublicos(PUBLICA).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("o robots.txt recusa o site INTEIRO, e nao so o painel", () => {
    ligarPrevia();
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });
});

describe("em producao, nada disso existe", () => {
  it("nao e previa quando a variavel esta vazia", () => {
    expect(ehPrevia()).toBe(false);
    process.env.AMBIENTE = "";
    expect(ehPrevia()).toBe(false);
  });

  it("nao e previa com qualquer outro valor", () => {
    // Um valor errado tem de cair no lado SEGURO: producao e o sistema de
    // verdade, e marca-lo como previa por engano assustaria o cliente.
    ligarPrevia("producao");
    expect(ehPrevia()).toBe(false);
  });

  it("o titulo da aba continua o de sempre", () => {
    expect(String(metadadosPublicos(PUBLICA).title)).not.toContain("PRÉVIA");
    expect(String(metadadosDoPainel("Agenda").title)).not.toContain("PRÉVIA");
  });

  it("a pagina publica continua indexada, e o painel continua fora", () => {
    expect(metadadosPublicos(PUBLICA).robots).toBeUndefined();
    expect(metadadosDoPainel("Agenda").robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("o robots.txt continua liberando o site e barrando o painel", () => {
    expect(robots().rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/minhas-reservas"],
    });
  });
});
