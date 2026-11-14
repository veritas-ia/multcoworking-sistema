/**
 * A CONTAGEM DIARIA DO EMPORIO (Fase 15).
 *
 * POR QUE ELA EXISTE, e por que ela ganhou do lancamento item a item:
 *
 * A rotina real da equipe e CONTAR a prateleira, nao registrar cada venda. E
 * a contagem e AUTOCORRETIVA — o que alguem esqueceu de lancar aparece sozinho
 * na conta do dia seguinte, porque a prateleira nao mente. O lancamento item a
 * item e exato SO SE ninguem esquecer, e quando alguem esquece o sistema nunca
 * descobre.
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 *  1. a contagem RECONCILIA, nao substitui: ela gera um AJUSTE, e o estoque
 *     continua sendo a soma dos movimentos. Duas fontes de verdade para o
 *     mesmo numero e o comeco de dois numeros que discordam na mesma tela;
 *  2. o "esperado" fica CONGELADO na linha. Recalculado depois daria sempre
 *     zero — porque o ajuste ja aconteceu — e o relatorio do que faltou
 *     ficaria vazio justamente no caso que importa;
 *  3. a MAQUINA DE CAFE e outra coisa: leitura acumulada, sem estoque. Tratar
 *     igual faria o estoque de expresso despencar para menos dez mil.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  CategoriaDoProduto,
  criarProduto,
  extratoDoProduto,
  listarProdutos,
  prepararContagem,
  registrarContagem,
  registrarMovimento,
  TipoDeControle,
  TipoMovimentoEstoque,
} from "@/lib/emporio";
import { dataLocalDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

const ZZ = "ZZ Contagem";
const USUARIO = "zz.contagem";

let operador: string;

/** Hoje e ontem no relógio de São Paulo — nunca datas fixas. */
const hoje = (): string => dataLocalDe(new Date());
const ontem = (): string => dataLocalDe(new Date(Date.now() - 24 * 60 * 60 * 1000));
const amanha = (): string => dataLocalDe(new Date(Date.now() + 24 * 60 * 60 * 1000));

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  await bancoDeTeste.itemDaContagem.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.contagemDeEstoque.deleteMany({
    where: { itens: { none: {} } },
  });
  await bancoDeTeste.movimentoDeEstoque.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.produto.deleteMany({ where: { nome: { startsWith: ZZ } } });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await limpar();

  const criado = await bancoDeTeste.usuario.create({
    data: { nome: "Recepção", usuario: USUARIO, senhaHash: "x" },
    select: { id: true },
  });

  operador = criado.id;
});

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** Um produto de prateleira com estoque inicial. */
async function naPrateleira(nome: string, inicial: number): Promise<string> {
  const feito = await criarProduto({
    nome: `${ZZ} ${nome}`,
    categoria: CategoriaDoProduto.COMIDA,
    preco: "5.00",
  });

  if (!feito.ok) throw new Error("não criou o produto");

  if (inicial > 0) {
    await registrarMovimento({
      produtoId: feito.dados.id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: inicial,
      usuarioId: operador,
    });
  }

  return feito.dados.id;
}

/** Um produto medido por contador de máquina. */
async function naMaquina(nome: string): Promise<string> {
  const feito = await criarProduto({
    nome: `${ZZ} ${nome}`,
    categoria: CategoriaDoProduto.BEBIDA,
    preco: "0",
  });

  if (!feito.ok) throw new Error("não criou o produto");

  await bancoDeTeste.produto.update({
    where: { id: feito.dados.id },
    data: { controle: TipoDeControle.CONTADOR },
  });

  return feito.dados.id;
}

async function estoque(id: string): Promise<number> {
  const lista = await listarProdutos();
  return lista.find((produto) => produto.id === id)!.estoque;
}

// -----------------------------------------------------------------------------

describe("a ficha em branco", () => {
  it("mostra o que o sistema ESPERA encontrar em cada produto", async () => {
    // Para a pessoa ver a diferença na hora de digitar, e não depois.
    const id = await naPrateleira("Suflair", 4);

    const ficha = await prepararContagem();
    const linha = ficha.find((item) => item.produtoId === id);

    expect(linha?.esperado).toBe(4);
    expect(linha?.controle).toBe(TipoDeControle.ESTOQUE);
  });

  it("produto DESLIGADO fica de fora", async () => {
    // Ele não está mais na prateleira: pedir a contagem dele faria a equipe
    // escrever zero todo dia, para sempre.
    const id = await naPrateleira("Saiu de linha", 2);
    await bancoDeTeste.produto.update({ where: { id }, data: { ativo: false } });

    const ficha = await prepararContagem();
    expect(ficha.map((linha) => linha.produtoId)).not.toContain(id);
  });

  it("dá para pedir só uma das fichas", async () => {
    await naPrateleira("Chocolate", 1);
    const cafe = await naMaquina("Expresso");

    const soContador = await prepararContagem({
      controle: TipoDeControle.CONTADOR,
    });

    expect(soContador.map((l) => l.produtoId)).toContain(cafe);
    for (const linha of soContador) {
      expect(linha.controle).toBe(TipoDeControle.CONTADOR);
    }
  });
});

describe("a contagem RECONCILIA o estoque — não cria outra verdade", () => {
  it("contou MENOS: a diferença vira ajuste e o estoque passa a bater", async () => {
    // É o "FALTOU" da ficha: sumiu sem ninguém lançar.
    const id = await naPrateleira("Suflair", 6);

    const feito = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 4 }],
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria gravar");
    expect(feito.dados.linhas[0]?.diferenca).toBe(-2);
    expect(feito.dados.faltaram).toBe(2);

    // O estoque continua sendo a SOMA DOS MOVIMENTOS, e agora bate com a
    // prateleira.
    expect(await estoque(id)).toBe(4);
  });

  it("o ajuste entra no EXTRATO, com o dia da ficha escrito", async () => {
    // Sem isso ninguém explicaria, três meses depois, de onde veio o -2.
    const id = await naPrateleira("Suflair", 6);
    await registrarContagem({
      dia: "2026-11-03",
      itens: [{ produtoId: id, quantidade: 4 }],
      usuarioId: operador,
    });

    const extrato = await extratoDoProduto(id);
    const ajuste = extrato.find((m) => m.tipo === TipoMovimentoEstoque.AJUSTE);

    expect(ajuste?.quantidade).toBe(-2);
    expect(ajuste?.motivo).toBe("Contagem de 03/11/2026");
    expect(ajuste?.lancadoPor).toBe("Recepção");
  });

  it("contou MAIS: sobra também é ajuste, para o outro lado", async () => {
    // Chegou mercadoria que ninguém registrou. É um problema diferente de
    // faltar, e por isso não entra no "faltaram".
    const id = await naPrateleira("Suflair", 2);

    const feito = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 5 }],
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria gravar");
    expect(feito.dados.linhas[0]?.diferenca).toBe(3);
    expect(feito.dados.faltaram).toBe(0);
    expect(await estoque(id)).toBe(5);
  });

  it("bateu certo: NENHUM movimento é criado", async () => {
    // Um movimento que não move nada só suja o extrato.
    const id = await naPrateleira("Suflair", 4);
    const antes = (await extratoDoProduto(id)).length;

    await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 4 }],
      usuarioId: operador,
    });

    expect((await extratoDoProduto(id)).length).toBe(antes);
    expect(await estoque(id)).toBe(4);
  });

  it("contar DUAS VEZES no mesmo dia não conta em dobro", async () => {
    // A segunda contagem reconcilia contra o estoque JÁ ajustado, então ela
    // encontra diferença zero. É o que torna a rotina segura de repetir.
    const id = await naPrateleira("Suflair", 6);

    await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 4 }],
      usuarioId: operador,
    });

    const segunda = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 4 }],
      usuarioId: operador,
    });

    if (!segunda.ok) throw new Error("deveria gravar");
    expect(segunda.dados.linhas[0]?.diferenca).toBe(0);
    expect(await estoque(id)).toBe(4);
  });

  it("a reposição lançada ENTRE duas contagens entra na conta", async () => {
    // É o "3+1=4" escrito à mão na ficha: sem registrar o que chegou, a conta
    // não fecha e a contagem acusaria uma sobra que não existe.
    const id = await naPrateleira("Suflair", 3);

    await registrarContagem({
      dia: ontem(),
      itens: [{ produtoId: id, quantidade: 3 }],
      usuarioId: operador,
    });

    await registrarMovimento({
      produtoId: id,
      tipo: TipoMovimentoEstoque.REPOSICAO,
      quantidade: 1,
      usuarioId: operador,
    });

    const hoje_ = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 4 }],
      usuarioId: operador,
    });

    if (!hoje_.ok) throw new Error("deveria gravar");
    // Tinha 3, chegou 1, contou 4: nada sumiu.
    expect(hoje_.dados.linhas[0]?.diferenca).toBe(0);
    expect(hoje_.dados.faltaram).toBe(0);
  });
});

describe("o 'esperado' fica CONGELADO na linha", () => {
  it("continua contando a história depois do ajuste", async () => {
    // Recalculado depois, ele daria sempre zero — porque o ajuste já
    // aconteceu — e o relatório do que faltou ficaria vazio justamente no
    // caso que importa.
    const id = await naPrateleira("Suflair", 6);

    const feito = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 4 }],
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria gravar");

    const linha = await bancoDeTeste.itemDaContagem.findFirstOrThrow({
      where: { contagemId: feito.dados.id, produtoId: id },
    });

    expect(linha.esperado).toBe(6);
    expect(linha.quantidade).toBe(4);
    // E o estoque de hoje já é outro: 4. Sem o congelamento, a diferença
    // sumiria.
    expect(await estoque(id)).toBe(4);
  });
});

describe("a máquina de café é OUTRA COISA", () => {
  it("a leitura não mexe no estoque — ela vira consumo", async () => {
    // "Estoque de expresso" não existe. Tratar igual faria o estoque
    // despencar para menos dez mil.
    const id = await naMaquina("Expresso");

    await registrarContagem({
      dia: ontem(),
      itens: [{ produtoId: id, quantidade: 10939 }],
      usuarioId: operador,
    });

    const feito = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 10949 }],
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria gravar");
    // Os 10 cafés do dia saem da DIFERENÇA entre as duas leituras.
    expect(feito.dados.linhas[0]?.diferenca).toBe(10);
    expect(feito.dados.cafesFeitos).toBe(10);
    // E nenhum movimento de estoque foi criado.
    expect(await extratoDoProduto(id)).toHaveLength(0);
    expect(await estoque(id)).toBe(0);
  });

  it("os números reais da ficha dão o consumo real", async () => {
    // Expresso nos dias 3 a 7: 10939, 10949, 10958, 10972, 10975.
    const id = await naMaquina("Expresso");
    const leituras = [10939, 10949, 10958, 10972, 10975];
    const diferencas: number[] = [];

    for (const [indice, leitura] of leituras.entries()) {
      const feito = await registrarContagem({
        dia: `2026-11-0${indice + 3}`,
        itens: [{ produtoId: id, quantidade: leitura }],
        usuarioId: operador,
      });

      if (!feito.ok) throw new Error("deveria gravar");
      diferencas.push(feito.dados.linhas[0]!.diferenca);
    }

    // A primeira não tem anterior: conta como zero, e não como 10939.
    expect(diferencas).toEqual([10939, 10, 9, 14, 3]);
  });

  it("RECUSA leitura menor que a anterior", async () => {
    // O contador só cresce. Uma leitura menor é quase sempre erro de
    // digitação, e aceitar faria o consumo do dia sair negativo — um número
    // que não bate com nada e que ninguém vai conferir.
    const id = await naMaquina("Expresso");

    await registrarContagem({
      dia: ontem(),
      itens: [{ produtoId: id, quantidade: 10949 }],
      usuarioId: operador,
    });

    const feito = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 1094 }],
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria gravar");
    expect(feito.falha.codigo).toBe("LEITURA_MENOR");
    expect(feito.falha.motivo).toContain("10949");
  });
});

describe("o que a contagem recusa", () => {
  it("dia no futuro", async () => {
    // A prateleira de amanhã ninguém viu.
    const id = await naPrateleira("Suflair", 1);

    const feito = await registrarContagem({
      dia: amanha(),
      itens: [{ produtoId: id, quantidade: 1 }],
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria gravar");
    expect(feito.falha.codigo).toBe("DIA_NO_FUTURO");
  });

  it("o mesmo produto duas vezes na mesma ficha", async () => {
    const id = await naPrateleira("Suflair", 1);

    const feito = await registrarContagem({
      dia: hoje(),
      itens: [
        { produtoId: id, quantidade: 1 },
        { produtoId: id, quantidade: 2 },
      ],
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);
  });

  it("quantidade negativa ou quebrada", async () => {
    const id = await naPrateleira("Suflair", 1);

    for (const quantidade of [-1, 1.5]) {
      const feito = await registrarContagem({
        dia: hoje(),
        itens: [{ produtoId: id, quantidade }],
        usuarioId: operador,
      });
      expect(feito.ok).toBe(false);
    }
  });

  it("produto desligado", async () => {
    const id = await naPrateleira("Saiu de linha", 2);
    await bancoDeTeste.produto.update({ where: { id }, data: { ativo: false } });

    const feito = await registrarContagem({
      dia: hoje(),
      itens: [{ produtoId: id, quantidade: 2 }],
      usuarioId: operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria gravar");
    expect(feito.falha.codigo).toBe("NAO_ENCONTRADO");
  });

  it("o BANCO também recusa quantidade negativa", async () => {
    const id = await naPrateleira("Suflair", 1);
    const contagem = await bancoDeTeste.contagemDeEstoque.create({
      data: { dia: new Date("2026-11-03T00:00:00.000Z") },
      select: { id: true },
    });

    await expect(
      bancoDeTeste.itemDaContagem.create({
        data: { contagemId: contagem.id, produtoId: id, quantidade: -1, esperado: 0 },
      }),
    ).rejects.toThrow();

    await bancoDeTeste.contagemDeEstoque.delete({ where: { id: contagem.id } });
  });

  it("o BANCO recusa horário em formato torto", async () => {
    // Formato errado não dá erro: a hora só aparece estranha na tela, e
    // ninguém sabe de onde veio.
    await expect(
      bancoDeTeste.contagemDeEstoque.create({
        data: { dia: new Date("2026-11-03T00:00:00.000Z"), horario: "9h40" },
      }),
    ).rejects.toThrow();
  });
});

describe("a ficha guarda o que estava escrita nela", () => {
  it("o horário e a observação do 'FALTOU'", async () => {
    const id = await naPrateleira("Cookies", 3);

    const feito = await registrarContagem({
      dia: "2026-11-06",
      horario: "09:40",
      observacao: "1 cookies",
      itens: [{ produtoId: id, quantidade: 2 }],
      usuarioId: operador,
    });

    if (!feito.ok) throw new Error("deveria gravar");

    const gravada = await bancoDeTeste.contagemDeEstoque.findUniqueOrThrow({
      where: { id: feito.dados.id },
    });

    expect(gravada.horario).toBe("09:40");
    expect(gravada.observacao).toBe("1 cookies");
    // O dia é o da FICHA, não o do lançamento.
    expect(gravada.dia.toISOString().slice(0, 10)).toBe("2026-11-06");
  });
});
