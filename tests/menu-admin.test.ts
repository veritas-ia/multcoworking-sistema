/**
 * O MENU DO PAINEL (Fase 17).
 *
 * POR QUE ISTO TEM TESTE
 *
 * "Qual item está aceso" não é decoração: é o que diz à pessoa onde ela está.
 * Errado, não dá erro nenhum — a tela abre, tudo funciona, e a recepcionista
 * só fica com a sensação de estar perdida. É o tipo de defeito que ninguém
 * reporta e ninguém conserta.
 *
 * A ARMADILHA ESPECÍFICA: onze dos quinze itens apontam para o MESMO caminho
 * ("/admin/configuracoes") e só o parâmetro muda. Uma comparação ingênua por
 * caminho acenderia os onze ao mesmo tempo.
 */
import { describe, expect, it } from "vitest";

import {
  ABA_PADRAO,
  ABA_PADRAO_EMPORIO,
  ABA_PADRAO_FINANCEIRO,
  estaAceso,
  itensDeConfiguracao,
  itensDoEmporio,
  itensDoFinanceiro,
  MENU,
  TELA_CONFIGURACOES,
  TELA_EMPORIO,
  TELA_FINANCEIRO,
  telaAberta,
  telasComAbas,
  todosOsItens,
} from "@/lib/menu-admin";

/** Acha um item pelo rótulo, para o teste ler como a tela. */
function item(rotulo: string) {
  const achado = todosOsItens().find((i) => i.rotulo === rotulo);
  if (!achado) throw new Error(`não existe item "${rotulo}" no menu`);
  return achado;
}

describe("o menu tem tudo que existe no painel", () => {
  /**
   * NAO HA TESTE comparando o menu com as abas da tela, e isso e de
   * proposito: a garantia subiu para o COMPILADOR.
   *
   * A tela de configuracoes declara o conteudo num
   * "Record<AbaDeConfiguracao, ...>" e monta as abas a partir deste mesmo
   * menu. Esquecer uma aba, ou acrescentar um item de menu que nao leva a
   * lugar nenhum, vira erro de compilacao — que aparece antes do commit, e
   * nao num teste que alguem pode marcar como pendente.
   */
  /**
   * Cada item com aba aponta para a tela DELE.
   *
   * Antes isto comparava com "/admin/configuracoes" escrito por extenso, e
   * quando o emporio entrou — a segunda tela com abas — o teste acusou os
   * itens dele como se fossem de configuracoes. O endereco tem de sair do
   * proprio item: senao, um item do emporio apontando para configuracoes
   * passaria batido e levaria a recepcao para uma aba que nao existe la.
   */
  it("todo item com aba aponta para a tela dele", () => {
    for (const item of todosOsItens()) {
      if (item.tela !== null) {
        expect(item.href).toBe(`${item.tela}?aba=${item.aba}`);
      }
    }
  });

  /**
   * TODA tela com abas tem item, e todo item com aba aponta para uma delas.
   *
   * ESTE TESTE JA FALHOU POR DESATUALIZACAO, e por isso mudou de forma: ele
   * listava "/admin/configuracoes" e "/admin/emporio" a mao, e a TERCEIRA
   * tela com abas (o Financeiro) o derrubou sem haver defeito nenhum. Agora a
   * lista sai de "telasComAbas()", e a regra vale tambem para a tela com abas
   * que ainda nao existe.
   */
  it("toda tela com abas tem item, e nenhum item solto", () => {
    const telas = telasComAbas().map((uma) => uma.tela);

    expect(telas.length).toBeGreaterThanOrEqual(3);
    expect(itensDeConfiguracao().length).toBeGreaterThan(0);
    expect(itensDoEmporio().length).toBeGreaterThan(0);
    expect(itensDoFinanceiro().length).toBeGreaterThan(0);

    // Cada tela com abas precisa de ao menos um item apontando para ela:
    // tela sem item e um destino que ninguem alcanca pelo menu.
    for (const tela of telas) {
      const quantos = todosOsItens().filter((i) => i.tela === tela).length;
      expect(quantos).toBeGreaterThan(0);
    }

    // E todo item ou e de uma tela com abas, ou e um link direto.
    for (const item of todosOsItens()) {
      if (item.tela !== null) {
        expect(telas).toContain(item.tela);
      } else {
        expect(item.href.startsWith("/admin/")).toBe(true);
      }
    }
  });

  it("nenhum endereço repetido", () => {
    const enderecos = todosOsItens().map((i) => i.href);
    expect(new Set(enderecos).size).toBe(enderecos.length);
  });

  it("todo grupo tem título e pelo menos um item", () => {
    for (const grupo of MENU) {
      expect(grupo.titulo.trim().length).toBeGreaterThan(0);
      expect(grupo.itens.length).toBeGreaterThan(0);
    }
  });
});

describe("qual item fica aceso", () => {
  it("o item comum acende no caminho dele, e só nele", () => {
    expect(estaAceso(item("Agenda"), "/admin/agenda", null)).toBe(true);
    expect(estaAceso(item("Agenda"), "/admin/relatorios", null)).toBe(false);
    // Na tela inicial, nenhum item de seção acende.
    expect(estaAceso(item("Agenda"), "/admin", null)).toBe(false);
  });

  it("UM item de Configurações acende por vez — não os onze", () => {
    // É a armadilha: todos apontam para "/admin/configuracoes".
    const acesos = todosOsItens().filter((i) =>
      estaAceso(i, "/admin/configuracoes", "empresas"),
    );

    expect(acesos.map((i) => i.rotulo)).toEqual(["Empresas"]);
  });

  it("sem aba no endereço, acende a mesma que a tela abre", () => {
    // A tela de configurações cai na primeira da lista quando não há aba. Se
    // a barra discordasse, o item aceso e a aba aberta seriam diferentes.
    const acesos = todosOsItens().filter((i) =>
      estaAceso(i, "/admin/configuracoes", null),
    );

    expect(acesos).toHaveLength(1);
    expect(acesos[0]?.aba).toBe(ABA_PADRAO);
  });

  it("item de Configurações não acende em outra tela", () => {
    expect(estaAceso(item("Clientes"), "/admin/agenda", "clientes")).toBe(false);
  });

  /**
   * A ARMADILHA NOVA, trazida pelo emporio: duas telas com abas.
   *
   * Nada impede duas abas de telas diferentes de se chamarem igual. Se a regra
   * comparasse so o nome da aba, abrir "/admin/emporio?aba=produtos" acenderia
   * tambem um item de configuracoes com a mesma aba — e a pessoa veria dois
   * lugares acesos, sem saber em qual esta.
   */
  it("aba do Empório não acende item de Configurações, e vice-versa", () => {
    const acesosNoEmporio = todosOsItens().filter((i) =>
      estaAceso(i, TELA_EMPORIO, "produtos"),
    );

    expect(acesosNoEmporio.map((i) => i.rotulo)).toEqual(["Produtos"]);

    // E o caminho inverso: na tela de configuracoes, item de emporio apagado.
    for (const doEmporio of itensDoEmporio()) {
      expect(estaAceso(doEmporio, TELA_CONFIGURACOES, doEmporio.aba)).toBe(false);
    }
  });

  /**
   * NENHUM ITEM ACENDE NA TELA DE OUTRA, qualquer que seja o par.
   *
   * Nada impede duas abas de telas diferentes de se chamarem igual — e o
   * Financeiro tem "categorias", nome que uma aba de Configuracoes poderia ter
   * amanha. Se a regra comparasse so o nome da aba, a pessoa veria dois itens
   * acesos em telas diferentes e nao saberia onde esta.
   */
  it("item de uma tela nunca acende na tela de outra", () => {
    for (const { tela } of telasComAbas()) {
      for (const item of todosOsItens()) {
        if (item.tela === null || item.tela === tela) continue;

        expect(estaAceso(item, tela, item.aba)).toBe(false);
      }
    }
  });

  /**
   * Sem aba no endereco, CADA tela acende a propria padrao — e exatamente uma.
   *
   * Vale para todas, derivado de "telasComAbas()": a tela cai na primeira aba
   * da lista dela, e a barra precisa concordar, senao o item aceso e a aba
   * aberta ficam diferentes.
   */
  it("sem aba, cada tela acende a padrão dela, e só uma", () => {
    for (const { tela, padrao } of telasComAbas()) {
      const acesos = todosOsItens().filter((i) => estaAceso(i, tela, null));

      expect(acesos, `na tela ${tela}`).toHaveLength(1);
      expect(acesos[0]?.aba, `na tela ${tela}`).toBe(padrao);
    }

    // As tres padroes sao nomes diferentes: igual, um teste de vazamento
    // entre telas passaria por coincidencia.
    expect(new Set([ABA_PADRAO, ABA_PADRAO_EMPORIO, ABA_PADRAO_FINANCEIRO]).size).toBe(3);
  });

  it("uma aba do Financeiro acende só o item dela", () => {
    const acesos = todosOsItens().filter((i) =>
      estaAceso(i, TELA_FINANCEIRO, "fornecedores"),
    );

    expect(acesos.map((i) => i.rotulo)).toEqual(["Fornecedores"]);
  });

  it("em qualquer tela do painel, no máximo UM item acende", () => {
    const telas: [string, string | null][] = [
      ["/admin", null],
      ["/admin/agenda", null],
      ["/admin/relatorios", null],
      ["/admin/demonstrativos", null],
      ["/admin/configuracoes", null],
      ["/admin/emporio", null],
      ["/admin/financeiro", null],
      // Cada aba na tela DELA: é assim que a pessoa realmente navega.
      ...todosOsItens()
        .filter((i) => i.tela !== null)
        .map((i): [string, string | null] => [i.tela!, i.aba]),
    ];

    for (const [caminho, aba] of telas) {
      const quantos = todosOsItens().filter((i) =>
        estaAceso(i, caminho, aba),
      ).length;

      expect(quantos).toBeLessThanOrEqual(1);
    }
  });
});

describe("o nome da tela aberta", () => {
  it("sai do próprio menu, sem lista paralela", () => {
    // Uma segunda lista de títulos divergiria do menu com o tempo.
    expect(telaAberta("/admin/agenda", null)).toBe("Agenda");
    expect(telaAberta("/admin/configuracoes", "usuarios")).toBe("Usuários");
  });

  it("é nulo na tela inicial, que não é um item do menu", () => {
    expect(telaAberta("/admin", null)).toBeNull();
  });
});
