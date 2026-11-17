/**
 * O ICONE NA TELA DE INICIO DO CELULAR.
 *
 * O QUE ESTES TESTES PROTEGEM, e por que ele precisa de teste:
 *
 * TODA falha aqui e silenciosa. Se faltar o icone de 192 pixels, o Android
 * simplesmente nunca OFERECE a instalacao — nao da erro, nao escreve nada em
 * lugar nenhum, o convite so nao aparece. Se a ficha pedir um tamanho que a
 * rota do icone nao desenha, o icone some e fica um quadrado em branco. Se o
 * modo de exibicao vier errado, o aplicativo abre COM a barra de endereco,
 * que e exatamente a coisa que ele veio tirar. E se as duas fichas abrirem o
 * mesmo endereco, o icone da equipe abre a tela de reservar do cliente.
 *
 * Nada disso aparece numa tela de teste manual rapido: o site continua
 * funcionando perfeitamente em todos os casos.
 */
import { describe, expect, it } from "vitest";

import manifestoDaRota from "@/app/manifest";
import { GET as fichaDoPainel } from "@/app/manifest-painel.webmanifest/route";
import {
  CAMINHO_DO_MANIFESTO_DO_PAINEL,
  TAMANHOS_DE_ICONE,
  ladoDoIcone,
  manifestoDoPainel,
  manifestoPublico,
} from "@/lib/manifesto";
import { metadadosDoPainel, metadadosPublicos } from "@/lib/metadados";

const publico = manifestoPublico();
const painel = manifestoDoPainel();

describe("as duas fichas abrem telas DIFERENTES", () => {
  it("a do site abre a tela de reservar", () => {
    expect(publico.start_url).toBe("/");
  });

  it("a do painel abre o painel", () => {
    expect(painel.start_url).toBe("/admin");
  });

  /**
   * E a razao de existirem duas. Com uma ficha so, o icone da recepcionista
   * abriria o site do cliente e ela teria de navegar ate o painel toda vez.
   */
  it("nunca abrem o mesmo lugar", () => {
    expect(publico.start_url).not.toBe(painel.start_url);
    expect(publico.id).not.toBe(painel.id);
  });

  it("cada uma fica presa na area dela", () => {
    expect(publico.scope).toBe("/");
    expect(painel.scope).toBe("/admin");
  });
});

describe("abrir em tela cheia", () => {
  /**
   * "standalone" e o que tira a barra de endereco. Com "browser" o aplicativo
   * abre igual a uma aba comum — e o ganho inteiro desaparece sem dar erro.
   */
  it("as duas fichas pedem tela cheia", () => {
    expect(publico.display).toBe("standalone");
    expect(painel.display).toBe("standalone");
  });
});

describe("os icones", () => {
  /**
   * O requisito do Android que falha calado: sem um icone de 192 ou mais, o
   * Chrome nao oferece a instalacao e nao diz por que.
   */
  it("as duas fichas tem um icone de 192 pixels ou mais", () => {
    for (const ficha of [publico, painel]) {
      const lados = (ficha.icons ?? []).map((icone) =>
        Number(String(icone.sizes).split("x")[0]),
      );
      expect(Math.max(...lados)).toBeGreaterThanOrEqual(192);
    }
  });

  /**
   * A ficha e a rota que desenha o icone leem a MESMA lista. Este teste
   * existe para o dia em que alguem escrever um tamanho a mao numa das duas:
   * o endereco responderia 404 e o icone sumiria, sem erro em lugar nenhum.
   */
  it("so pedem tamanhos que a rota do icone desenha", () => {
    for (const ficha of [publico, painel]) {
      for (const icone of ficha.icons ?? []) {
        const lado = Number(String(icone.sizes).split("x")[0]);
        expect(TAMANHOS_DE_ICONE).toContain(lado);
        expect(icone.src).toBe(`/icone/${lado}`);
      }
    }
  });

  /**
   * O Android recorta o icone em circulo ou em quadrado arredondado. Sem uma
   * entrada "maskable" ele desenha o nosso quadrado amarelo DENTRO de outro
   * quadrado branco, com uma moldura feia em volta.
   */
  it("cada tamanho aparece como comum E como recortavel", () => {
    for (const ficha of [publico, painel]) {
      for (const lado of TAMANHOS_DE_ICONE) {
        const deste = (ficha.icons ?? []).filter(
          (icone) => icone.sizes === `${lado}x${lado}`,
        );
        expect(deste.map((icone) => icone.purpose).sort()).toEqual([
          "any",
          "maskable",
        ]);
      }
    }
  });

  it("desenha os tamanhos da lista", () => {
    for (const lado of TAMANHOS_DE_ICONE) {
      expect(ladoDoIcone(String(lado))).toBe(lado);
    }
  });

  /**
   * Sem a lista fechada, um estranho pediria "/icone/20000" e ocuparia o
   * servidor desenhando uma imagem gigante.
   */
  it("recusa um tamanho que nao esta na lista", () => {
    expect(ladoDoIcone("9999")).toBeNull();
    expect(ladoDoIcone("0")).toBeNull();
    expect(ladoDoIcone("-192")).toBeNull();
  });

  it("recusa texto no lugar do tamanho", () => {
    expect(ladoDoIcone("grande")).toBeNull();
    expect(ladoDoIcone("")).toBeNull();
  });
});

describe("a ficha do painel chega nas paginas do painel", () => {
  /**
   * Amarrada em "metadadosDoPainel", e nao pagina por pagina: assim a proxima
   * tela nova do painel ja nasce com ela. Escrito a mao, bastaria esquecer
   * numa pagina para o icone dela abrir o site publico.
   */
  it("toda pagina do painel aponta para ela", () => {
    expect(metadadosDoPainel("Agenda").manifest).toBe(
      CAMINHO_DO_MANIFESTO_DO_PAINEL,
    );
  });

  /**
   * FORA de "/admin" de proposito: o middleware exige login em tudo que
   * comeca com /admin, e o navegador le a ficha ANTES de alguem entrar. La
   * dentro ela viraria um redirecionamento para o login.
   */
  it("mora fora de /admin, senao o login a bloquearia", () => {
    expect(CAMINHO_DO_MANIFESTO_DO_PAINEL.startsWith("/admin")).toBe(false);
  });

  it("e servida com o tipo de arquivo que o celular espera", async () => {
    const resposta = fichaDoPainel();

    expect(resposta.headers.get("content-type")).toContain(
      "application/manifest+json",
    );
    expect(await resposta.json()).toEqual(painel);
  });
});

describe("a ficha do site e a mesma que a rota entrega", () => {
  it("a rota so repassa o modulo", () => {
    expect(manifestoDaRota()).toEqual(publico);
  });
});

describe("a parte que so o iPhone le", () => {
  const doSite = metadadosPublicos({
    titulo: "Reservar sala",
    descricao: "qualquer coisa",
    caminho: "/",
    indexar: true,
  });
  const doPainel = metadadosDoPainel("Agenda");

  /**
   * O iPhone nao decide isso pela ficha do aplicativo: sem "capable" ele abre
   * o site dentro do Safari de sempre, COM a barra de endereco — e o ganho
   * inteiro desaparece sem dar erro nenhum.
   */
  it("as duas abrem sem a barra de endereco no iPhone", () => {
    for (const metadados of [doSite, doPainel]) {
      expect(metadados.appleWebApp).toMatchObject({ capable: true });
    }
  });

  /**
   * Sem o nome, o iPhone escreve embaixo do icone o titulo da pagina em que a
   * pessoa estava quando salvou — "Agenda | Mult Cowo...", cortado.
   */
  it("o nome embaixo do icone diz de qual dos dois se trata", () => {
    expect(doSite.appleWebApp).toMatchObject({ title: "Mult" });
    expect(doPainel.appleWebApp).toMatchObject({ title: "Painel" });
  });

  /** O iPhone e o Android precisam concordar: e o mesmo icone. */
  it("e o mesmo nome que a ficha do aplicativo usa", () => {
    expect(doSite.appleWebApp).toMatchObject({ title: publico.short_name });
    expect(doPainel.appleWebApp).toMatchObject({ title: painel.short_name });
  });
});
