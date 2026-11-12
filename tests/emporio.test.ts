/**
 * O EMPORIO: produtos e estoque (Fase 15, Parte A).
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 * O emporio ja e cobrado hoje, digitado a mao nas "Outras linhas" do controle
 * de horas. Todo defeito aqui aparece como dinheiro errado numa cobranca — e
 * dinheiro errado nao da erro em lugar nenhum, igual aos R$ 70 da planilha.
 *
 * A regra mais facil de quebrar sem ninguem perceber e o SINAL do movimento.
 * O estoque e a soma das quantidades: uma reposicao gravada negativa, ou uma
 * venda gravada positiva, somaria para o lado errado e o numero continuaria
 * parecendo certo.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  criarProduto,
  definirFotoDoProduto,
  editarProduto,
  extratoDoProduto,
  ligarOuDesligarProduto,
  listarProdutos,
  registrarMovimento,
  removerFotoDoProduto,
  reordenarProdutos,
  TipoMovimentoEstoque,
} from "@/lib/emporio";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

/** Prefixo proprio, para a limpeza nao encostar em dado de outro teste. */
const ZZ = "ZZ Emporio";

let operador: string;

beforeAll(async () => {
  await aquecerConexao();

  const usuario = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.emporio" },
    update: {},
    create: {
      nome: "Operador do Empório",
      usuario: "zz.emporio",
      senhaHash: "nao-usado-neste-teste",
    },
    select: { id: true },
  });

  operador = usuario.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.movimentoDeEstoque.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.produto.deleteMany({ where: { nome: { startsWith: ZZ } } });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.emporio" } });
  await bancoDeTeste.$disconnect();
});

/** Cria um produto de teste e devolve o identificador. */
async function produto(nome = `${ZZ} Barrinha`, preco = "6.00"): Promise<string> {
  const feito = await criarProduto({ nome, preco });
  if (!feito.ok) throw new Error(`não criou o produto: ${feito.falha.motivo}`);
  return feito.dados.id;
}

/** O estoque de um produto, lido da lista. */
async function estoque(id: string): Promise<number> {
  const lista = await listarProdutos();
  return lista.find((item) => item.id === id)!.estoque;
}

// -----------------------------------------------------------------------------

describe("cadastro de produto", () => {
  it("nasce ativo, com estoque zero e no fim da lista", async () => {
    const primeiro = await criarProduto({ nome: `${ZZ} Café`, preco: "5.00" });
    const segundo = await criarProduto({ nome: `${ZZ} Energético`, preco: "9.50" });

    if (!primeiro.ok || !segundo.ok) throw new Error("deveria criar");
    expect(primeiro.dados.ativo).toBe(true);
    expect(primeiro.dados.estoque).toBe(0);
    expect(segundo.dados.ordem).toBeGreaterThan(primeiro.dados.ordem);
  });

  it("aceita preço com vírgula, como a equipe digita", async () => {
    const feito = await criarProduto({ nome: `${ZZ} Suco`, preco: "7,50" });
    if (!feito.ok) throw new Error("deveria criar");
    expect(feito.dados.preco).toBe("7.50");
  });

  it("aceita preço zero: cortesia existe", async () => {
    const feito = await criarProduto({ nome: `${ZZ} Água`, preco: "0" });
    expect(feito.ok).toBe(true);
  });

  it("recusa preço negativo", async () => {
    const feito = await criarProduto({ nome: `${ZZ} Errado`, preco: "-1" });
    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria criar");
    expect(feito.falha.codigo).toBe("PRECO_INVALIDO");
  });

  it("recusa nome repetido, mesmo escrito diferente", async () => {
    // Dois "Barrinha" na lista fariam a recepcionista escolher no chute, e o
    // relatório mostraria o mesmo produto partido em dois.
    await produto(`${ZZ} Barrinha`);
    const igual = await criarProduto({ nome: `${ZZ} barrinha`, preco: "6.00" });

    expect(igual.ok).toBe(false);
    if (igual.ok) throw new Error("não deveria criar");
    expect(igual.falha.codigo).toBe("NOME_REPETIDO");
  });

  it("editar o preço NÃO mexe no estoque nem na ordem", async () => {
    const id = await produto();
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 12,
      usuarioId: operador,
    });

    const antes = (await listarProdutos()).find((p) => p.id === id)!;
    const salvo = await editarProduto(id, { nome: antes.nome, preco: "8.00" });

    if (!salvo.ok) throw new Error("deveria salvar");
    expect(salvo.dados.preco).toBe("8.00");
    expect(salvo.dados.estoque).toBe(12);
    expect(salvo.dados.ordem).toBe(antes.ordem);
  });

  it("salvar o MESMO nome é aceito", async () => {
    // A tela manda o nome junto mesmo quando a pessoa só mexeu no preço.
    const id = await produto();
    const salvo = await editarProduto(id, { nome: `${ZZ} Barrinha`, preco: "7.00" });
    expect(salvo.ok).toBe(true);
  });
});

describe("a foto do produto", () => {
  /**
   * NULA E ESTADO NORMAL, nao erro. Produto sem foto aparece com a inicial do
   * nome; nunca com um espaco vazio, nem com imagem quebrada.
   */
  it("nasce sem foto, e isso não é problema", async () => {
    const feito = await criarProduto({ nome: `${ZZ} Café`, preco: "5.00" });
    if (!feito.ok) throw new Error("deveria criar");
    expect(feito.dados.foto).toBeNull();
  });

  it("sem Cloudinary configurado, recusa com explicação e NÃO quebra o resto", async () => {
    // Credenciais vazias são estado normal: é assim que a prévia roda. O
    // envio fica indisponível e todo o resto do empório continua de pé.
    const id = await produto();
    const arquivo = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

    const feito = await definirFotoDoProduto(id, arquivo);

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria enviar");
    expect(feito.falha.codigo).toBe("CLOUDINARY_DESLIGADO");

    // O produto continua inteiro e listável.
    expect((await listarProdutos()).find((p) => p.id === id)?.nome).toBeTruthy();
  });

  it("recusa tipo de arquivo que não é imagem", async () => {
    // A validação é do SERVIDOR. A tela também confere, mas esconder o botão
    // não para quem manda o pedido direto.
    const id = await produto();
    const pdf = new Blob([new Uint8Array([1])], { type: "application/pdf" });

    const feito = await definirFotoDoProduto(id, pdf);
    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria aceitar");
    expect(feito.falha.codigo).toBe("TIPO_NAO_ACEITO");
  });

  it("remover a foto de um produto que não tem foto não dá erro", async () => {
    const id = await produto();
    const feito = await removerFotoDoProduto(id);
    expect(feito.ok).toBe(true);
  });

  it("as duas colunas da foto andam juntas — o BANCO exige", async () => {
    // Endereço sem identificador deixaria arquivo órfão no Cloudinary para
    // sempre; identificador sem endereço mostraria imagem quebrada na tela.
    const id = await produto();

    await expect(
      bancoDeTeste.produto.update({
        where: { id },
        data: { fotoUrl: "https://exemplo/x.png" },
      }),
    ).rejects.toThrow();

    await expect(
      bancoDeTeste.produto.update({ where: { id }, data: { fotoPublicId: "x" } }),
    ).rejects.toThrow();
  });

  it("a foto sobrevive a renomear e a desligar", async () => {
    // Gravada direto, porque enviar de verdade exigiria o Cloudinary.
    const id = await produto();
    await bancoDeTeste.produto.update({
      where: { id },
      data: { fotoPublicId: "mult-coworking/produtos/zz", fotoUrl: "https://x/zz.png" },
    });

    await editarProduto(id, { nome: `${ZZ} Barrinha nova`, preco: "7.00" });
    await ligarOuDesligarProduto(id, false);

    const depois = (await listarProdutos()).find((p) => p.id === id);
    expect(depois?.foto?.publicId).toBe("mult-coworking/produtos/zz");
  });
});

describe("desligar em vez de excluir", () => {
  it("produto desligado sai das telas de lançamento e fica no cadastro", async () => {
    const id = await produto();
    await ligarOuDesligarProduto(id, false);

    expect((await listarProdutos({ somenteAtivos: true })).map((p) => p.id)).not.toContain(
      id,
    );
    expect((await listarProdutos()).map((p) => p.id)).toContain(id);
  });

  it("religar devolve o produto à lista, com o estoque intacto", async () => {
    const id = await produto();
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 5,
      usuarioId: operador,
    });

    await ligarOuDesligarProduto(id, false);
    await ligarOuDesligarProduto(id, true);

    const vivo = (await listarProdutos({ somenteAtivos: true })).find((p) => p.id === id);
    expect(vivo?.estoque).toBe(5);
  });

  it("o BANCO recusa apagar produto com movimento", async () => {
    // Apagar tiraria o histórico de consumo em silêncio, e o relatório do mês
    // passado deixaria de bater. A trava é ON DELETE RESTRICT, do banco — não
    // existe tela para isso, mas se um dia existir, ela para aqui.
    const id = await produto();
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 1,
      usuarioId: operador,
    });

    await expect(bancoDeTeste.produto.delete({ where: { id } })).rejects.toThrow();
  });

  it("desligar o ÚLTIMO produto é permitido", async () => {
    // Diferente das áreas de atuação: um empório sem nada ativo é legítimo,
    // simplesmente não há o que vender. Na área de atuação, sem nenhuma opção
    // o formulário de reserva não fechava e ninguém conseguia reservar.
    const id = await produto();
    const feito = await ligarOuDesligarProduto(id, false);
    expect(feito.ok).toBe(true);
  });
});

describe("o SINAL do movimento — a regra mais fácil de quebrar sem perceber", () => {
  it("reposição soma, venda e perda subtraem", async () => {
    const id = await produto();

    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 24,
      usuarioId: operador,
    });
    expect(await estoque(id)).toBe(24);

    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.VENDA,
      quantidade: 3,
      usuarioId: operador,
    });
    expect(await estoque(id)).toBe(21);

    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.PERDA,
      quantidade: 1,
      motivo: "venceu",
      usuarioId: operador,
    });
    expect(await estoque(id)).toBe(20);
  });

  it("quem chama informa sempre POSITIVO: o sinal sai do tipo", async () => {
    const id = await produto();
    const feito = await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.VENDA,
      quantidade: 2,
      usuarioId: operador,
    });

    expect(feito.ok).toBe(true);
    // Gravado negativo, apesar de ter entrado positivo.
    const extrato = await extratoDoProduto(id);
    expect(extrato[0]?.quantidade).toBe(-2);
  });

  it("recusa quantidade zero, negativa ou quebrada", async () => {
    const id = await produto();

    for (const quantidade of [0, -5, 1.5]) {
      const feito = await registrarMovimento({
        produtoId: id,
        tipo: TipoMovimentoEstoque.REPOSICAO,
        quantidade,
        usuarioId: operador,
      });
      expect(feito.ok).toBe(false);
      if (feito.ok) throw new Error("não deveria aceitar");
      expect(feito.falha.codigo).toBe("QUANTIDADE_INVALIDA");
    }
  });

  it("o BANCO também recusa o sinal errado, não só a aplicação", async () => {
    // Se um dia alguém gravar direto, ou a aplicação mudar, a trava continua
    // de pé. Uma reposição negativa somaria para o lado errado e o número
    // continuaria parecendo certo.
    const id = await produto();

    await expect(
      bancoDeTeste.movimentoDeEstoque.create({
        data: { produtoId: id, tipo: TipoMovimentoEstoque.REPOSICAO, quantidade: -10 },
      }),
    ).rejects.toThrow();

    await expect(
      bancoDeTeste.movimentoDeEstoque.create({
        data: { produtoId: id, tipo: TipoMovimentoEstoque.VENDA, quantidade: 10 },
      }),
    ).rejects.toThrow();
  });
});

describe("o ajuste de contagem", () => {
  it("vai para os dois lados, porque a prateleira pode ter mais ou menos", async () => {
    const id = await produto();
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 10,
      usuarioId: operador,
    });

    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.AJUSTE,
      quantidade: 2,
      paraBaixo: true,
      motivo: "contagem da prateleira deu 8",
      usuarioId: operador,
    });
    expect(await estoque(id)).toBe(8);

    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.AJUSTE,
      quantidade: 3,
      motivo: "achei uma caixa guardada",
      usuarioId: operador,
    });
    expect(await estoque(id)).toBe(11);
  });

  it("exige motivo escrito", async () => {
    // Daqui a seis meses ninguém lembra por que o estoque foi corrigido, e sem
    // explicação a próxima pessoa corrige de novo.
    const id = await produto();

    for (const motivo of [undefined, "", "   "]) {
      const feito = await registrarMovimento({
        produtoId: id,
        tipo: TipoMovimentoEstoque.AJUSTE,
        quantidade: 1,
        motivo,
        usuarioId: operador,
      });
      expect(feito.ok).toBe(false);
      if (feito.ok) throw new Error("não deveria aceitar");
      expect(feito.falha.codigo).toBe("MOTIVO_OBRIGATORIO");
    }
  });

  it("o BANCO também exige o motivo do ajuste", async () => {
    const id = await produto();
    await expect(
      bancoDeTeste.movimentoDeEstoque.create({
        data: { produtoId: id, tipo: TipoMovimentoEstoque.AJUSTE, quantidade: 1 },
      }),
    ).rejects.toThrow();
  });
});

describe("estoque negativo é PERMITIDO, de propósito", () => {
  it("a venda que já aconteceu nunca é recusada por falta de saldo", async () => {
    // A venda chega aqui da FICHA FÍSICA da parede: ela já aconteceu. Recusar
    // não devolveria o produto à prateleira — só faria a venda não ser
    // registrada e o cliente não ser cobrado. O negativo é o aviso de que
    // falta lançar uma reposição.
    const id = await produto();

    const feito = await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.VENDA,
      quantidade: 2,
      usuarioId: operador,
    });

    expect(feito.ok).toBe(true);
    expect(await estoque(id)).toBe(-2);
  });

  it("lançar a reposição esquecida acerta a conta sozinho", async () => {
    const id = await produto();
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.VENDA,
      quantidade: 2,
      usuarioId: operador,
    });
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 24,
      usuarioId: operador,
    });

    expect(await estoque(id)).toBe(22);
  });
});

describe("o extrato responde 'por que o estoque está nesse número?'", () => {
  it("lista os movimentos do mais recente para o mais antigo, com quem lançou", async () => {
    const id = await produto();
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 10,
      usuarioId: operador,
    });
    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.VENDA,
      quantidade: 1,
      usuarioId: operador,
    });

    const extrato = await extratoDoProduto(id);
    expect(extrato).toHaveLength(2);
    expect(extrato[0]?.tipo).toBe(TipoMovimentoEstoque.VENDA);
    expect(extrato[0]?.lancadoPor).toBe("Operador do Empório");
    // A soma do extrato é o estoque: não há segunda fonte de verdade.
    expect(extrato.reduce((soma, m) => soma + m.quantidade, 0)).toBe(await estoque(id));
  });
});

describe("a ordem da lista", () => {
  it("regrava todas em bloco, sem dois números iguais", async () => {
    const a = await produto(`${ZZ} A`);
    const b = await produto(`${ZZ} B`);
    const c = await produto(`${ZZ} C`);

    const todos = (await listarProdutos()).map((p) => p.id);
    const invertida = [...todos].reverse();

    const feito = await reordenarProdutos(invertida);
    expect(feito.ok).toBe(true);

    const depois = (await listarProdutos()).map((p) => p.id);
    expect(depois).toEqual(invertida);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("recusa uma ordem incompleta", async () => {
    // Faltando um, ele ficaria com a ordem velha e a lista sairia embaralhada.
    await produto(`${ZZ} A`);
    await produto(`${ZZ} B`);

    const todos = (await listarProdutos()).map((p) => p.id);
    const feito = await reordenarProdutos(todos.slice(1));

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria aceitar");
    expect(feito.falha.codigo).toBe("ORDEM_INCOMPLETA");
  });
});
