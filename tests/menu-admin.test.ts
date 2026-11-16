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
  estaAceso,
  MENU,
  telaAberta,
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
  it("todos os itens de Configurações apontam para a tela dela", () => {
    for (const item of todosOsItens()) {
      if (item.aba !== null) {
        expect(item.href).toBe(`/admin/configuracoes?aba=${item.aba}`);
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

  it("em qualquer tela do painel, no máximo UM item acende", () => {
    const telas: [string, string | null][] = [
      ["/admin", null],
      ["/admin/agenda", null],
      ["/admin/relatorios", null],
      ["/admin/demonstrativos", null],
      ["/admin/configuracoes", null],
      ...todosOsItens()
        .filter((i) => i.aba)
        .map((i): [string, string | null] => ["/admin/configuracoes", i.aba]),
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
