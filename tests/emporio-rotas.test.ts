/**
 * AS ROTAS DO EMPORIO (Fase 15, Parte B).
 *
 * O que estes testes protegem, e que os do motor nao alcancam:
 *
 *  1. SO A EQUIPE LOGADA mexe no emporio. O middleware ja barra quem nao tem
 *     cookie assinado, mas ele nao alcanca o banco — um usuario desligado
 *     continuaria entrando com o cookie no prazo. Por isso cada rota confere
 *     de novo, e por isso cada uma tem teste de recusa;
 *  2. a VENDA nao entra pela rota de estoque. Ela nasce do lancamento do
 *     consumo, que grava quem consumiu, quando e por quanto. Deixar vender por
 *     ali criaria saida de estoque SEM DONO, e o emporio pararia de bater com
 *     o que foi cobrado do cliente — sem erro aparecer em lugar nenhum;
 *  3. nao existe DELETE de produto. Produto nunca se exclui.
 */
import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import * as rotaProduto from "@/app/api/admin/emporio/produtos/[id]/route";
import * as rotaEstoque from "@/app/api/admin/emporio/produtos/[id]/estoque/route";
import * as rotaContagem from "@/app/api/admin/emporio/contagem/route";
import * as rotaProdutos from "@/app/api/admin/emporio/produtos/route";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPatch, pedidoPost } from "./apoio/requisicao";

const USUARIO = "zz.emporio.rotas";
const ZZ = "ZZ Rota";

let cookie: string;

/** O "params" que o Next entrega a rota. */
function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function limpar(): Promise<void> {
  await bancoDeTeste.itemDaContagem.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.contagemDeEstoque.deleteMany({ where: { itens: { none: {} } } });
  await bancoDeTeste.movimentoDeEstoque.deleteMany({
    where: { produto: { nome: { startsWith: ZZ } } },
  });
  await bancoDeTeste.produto.deleteMany({ where: { nome: { startsWith: ZZ } } });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await aquecerConexao();
  await limpar();

  const criado = await bancoDeTeste.usuario.create({
    data: {
      nome: "Operador do Empório",
      usuario: USUARIO,
      senhaHash: await bcrypt.hash("senha-boa-12345", 10),
    },
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(criado.id)}`;
});

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** Cadastra pela ROTA e devolve o identificador. */
async function criarPelaRota(nome = `${ZZ} Barrinha`, preco = "6,00"): Promise<string> {
  const resposta = await rotaProdutos.POST(
    pedidoPost(
      "/api/admin/emporio/produtos",
      { nome, categoria: "COMIDA", preco },
      { cookie },
    ),
  );

  expect(resposta.status).toBe(201);
  const corpo = (await resposta.json()) as { produto: { id: string } };
  return corpo.produto.id;
}

// -----------------------------------------------------------------------------

describe("só a equipe logada mexe no empório", () => {
  it("recusa sem cookie em todas as rotas", async () => {
    const semCookie = [
      rotaProdutos.GET(pedidoGet("/api/admin/emporio/produtos")),
      rotaProdutos.POST(
        pedidoPost("/api/admin/emporio/produtos", {
          nome: "x",
          categoria: "COMIDA",
          preco: "1",
        }),
      ),
      rotaProdutos.PUT(pedidoPost("/api/admin/emporio/produtos", { ids: ["x"] })),
      rotaProduto.PATCH(
        pedidoPatch("/api/admin/emporio/produtos/x", { ativo: false }),
        params("x"),
      ),
      rotaEstoque.GET(pedidoGet("/api/admin/emporio/produtos/x/estoque"), params("x")),
      rotaEstoque.POST(
        pedidoPost("/api/admin/emporio/produtos/x/estoque", {
          tipo: "REPOSICAO",
          quantidade: 1,
        }),
        params("x"),
      ),
    ];

    for (const resposta of await Promise.all(semCookie)) {
      expect(resposta.status).toBe(401);
    }
  });

  it("recusa o cookie de um usuário DESLIGADO depois do login", async () => {
    // O middleware não alcança o banco: só esta conferência pega isso.
    const id = await criarPelaRota();
    await bancoDeTeste.usuario.updateMany({
      where: { usuario: USUARIO },
      data: { ativo: false },
    });

    const resposta = await rotaProduto.PATCH(
      pedidoPatch(`/api/admin/emporio/produtos/${id}`, { ativo: false }, { cookie }),
      params(id),
    );

    expect(resposta.status).toBe(401);
  });
});

describe("cadastrar e listar", () => {
  it("cadastra e devolve o produto com estoque zero", async () => {
    const id = await criarPelaRota(`${ZZ} Café`, "5,50");

    const resposta = await rotaProdutos.GET(
      pedidoGet("/api/admin/emporio/produtos", {}, { cookie }),
    );

    const corpo = (await resposta.json()) as {
      produtos: { id: string; preco: string; estoque: number; foto: unknown }[];
      envioDeImagemDisponivel: boolean;
    };

    const nosso = corpo.produtos.find((produto) => produto.id === id);
    expect(nosso?.preco).toBe("5.50");
    expect(nosso?.estoque).toBe(0);
    expect(nosso?.foto).toBeNull();
    // A tela usa isto para avisar antes, em vez de deixar escolher o arquivo
    // e levar erro depois.
    expect(typeof corpo.envioDeImagemDisponivel).toBe("boolean");
  });

  it("'ativos=1' esconde o desligado — é a lista de quem lança", async () => {
    const id = await criarPelaRota();
    await rotaProduto.PATCH(
      pedidoPatch(`/api/admin/emporio/produtos/${id}`, { ativo: false }, { cookie }),
      params(id),
    );

    const soAtivos = (await (
      await rotaProdutos.GET(
        pedidoGet("/api/admin/emporio/produtos", { ativos: "1" }, { cookie }),
      )
    ).json()) as { produtos: { id: string }[] };

    const tudo = (await (
      await rotaProdutos.GET(pedidoGet("/api/admin/emporio/produtos", {}, { cookie }))
    ).json()) as { produtos: { id: string }[] };

    expect(soAtivos.produtos.map((p) => p.id)).not.toContain(id);
    // Sem isto a equipe não conseguiria religar o que desligou.
    expect(tudo.produtos.map((p) => p.id)).toContain(id);
  });

  it("recusa preço inválido com 422, e não com erro de servidor", async () => {
    const resposta = await rotaProdutos.POST(
      pedidoPost(
        "/api/admin/emporio/produtos",
        { nome: `${ZZ} Errado`, categoria: "COMIDA", preco: "-1" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("produto que não existe dá 404", async () => {
    const resposta = await rotaProduto.PATCH(
      pedidoPatch(
        "/api/admin/emporio/produtos/01a00000-0000-7000-8000-000000000000",
        { ativo: false },
        { cookie },
      ),
      params("01a00000-0000-7000-8000-000000000000"),
    );

    expect(resposta.status).toBe(404);
  });

  it("NÃO existe DELETE de produto", () => {
    // Produto nunca se exclui, mesma regra de salas, empresas e áreas de
    // atuação. Se um dia alguém acrescentar, este teste cai.
    expect("DELETE" in rotaProduto).toBe(false);
  });
});

describe("o estoque pela rota", () => {
  it("lança reposição e o extrato volta junto", async () => {
    const id = await criarPelaRota();

    const resposta = await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        { tipo: "REPOSICAO", quantidade: 24 },
        { cookie },
      ),
      params(id),
    );

    expect(resposta.status).toBe(201);
    const corpo = (await resposta.json()) as {
      estoque: number;
      movimentos: { quantidade: number; lancadoPor: string | null }[];
    };

    expect(corpo.estoque).toBe(24);
    // Quem lançou fica gravado: o extrato precisa dizer de quem foi a conta.
    expect(corpo.movimentos[0]?.lancadoPor).toBe("Operador do Empório");
  });

  it("A VENDA NÃO ENTRA por aqui", async () => {
    // Ela nasce do lançamento do consumo, que grava quem consumiu, quando e
    // por quanto. Por esta rota viraria saída de estoque SEM DONO, e o
    // empório pararia de bater com o que foi cobrado — sem erro aparecer.
    const id = await criarPelaRota();

    const resposta = await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        { tipo: "VENDA", quantidade: 1 },
        { cookie },
      ),
      params(id),
    );

    expect(resposta.status).toBe(400);
  });

  it("recusa quantidade negativa: o sinal é decidido pelo servidor", async () => {
    // Aceitar o sinal de quem chama convidaria ao erro de uma reposição
    // negativa, que somaria para o lado errado e continuaria parecendo certa.
    const id = await criarPelaRota();

    const resposta = await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        { tipo: "REPOSICAO", quantidade: -5 },
        { cookie },
      ),
      params(id),
    );

    expect(resposta.status).toBe(400);
  });

  it("ajuste sem motivo é recusado com 422", async () => {
    const id = await criarPelaRota();

    const resposta = await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        { tipo: "AJUSTE", quantidade: 2, paraBaixo: true },
        { cookie },
      ),
      params(id),
    );

    expect(resposta.status).toBe(422);
  });

  it("o ajuste para baixo chega como saída", async () => {
    const id = await criarPelaRota();

    await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        { tipo: "REPOSICAO", quantidade: 10 },
        { cookie },
      ),
      params(id),
    );

    const resposta = await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        {
          tipo: "AJUSTE",
          quantidade: 2,
          paraBaixo: true,
          motivo: "contagem da prateleira deu 8",
        },
        { cookie },
      ),
      params(id),
    );

    const corpo = (await resposta.json()) as { estoque: number };
    expect(corpo.estoque).toBe(8);
  });
});

describe("a ordem pela rota", () => {
  it("regrava a lista inteira e devolve na ordem nova", async () => {
    await criarPelaRota(`${ZZ} A`);
    await criarPelaRota(`${ZZ} B`);

    const atual = (await (
      await rotaProdutos.GET(pedidoGet("/api/admin/emporio/produtos", {}, { cookie }))
    ).json()) as { produtos: { id: string }[] };

    const invertida = atual.produtos.map((p) => p.id).reverse();

    const resposta = await rotaProdutos.PUT(
      pedidoPost("/api/admin/emporio/produtos", { ids: invertida }, { cookie }),
    );

    expect(resposta.status).toBe(200);
    const corpo = (await resposta.json()) as { produtos: { id: string }[] };
    expect(corpo.produtos.map((p) => p.id)).toEqual(invertida);
  });

  it("recusa ordem incompleta com 422", async () => {
    await criarPelaRota(`${ZZ} A`);
    await criarPelaRota(`${ZZ} B`);

    const atual = (await (
      await rotaProdutos.GET(pedidoGet("/api/admin/emporio/produtos", {}, { cookie }))
    ).json()) as { produtos: { id: string }[] };

    const resposta = await rotaProdutos.PUT(
      pedidoPost(
        "/api/admin/emporio/produtos",
        { ids: atual.produtos.map((p) => p.id).slice(1) },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });
});

describe("a contagem pela rota", () => {
  /** Hoje no relógio de São Paulo — nunca uma data fixa. */
  const hoje = (): string =>
    new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  it("recusa sem cookie", async () => {
    const semCookie = [
      rotaContagem.GET(pedidoGet("/api/admin/emporio/contagem")),
      rotaContagem.POST(
        pedidoPost("/api/admin/emporio/contagem", {
          dia: hoje(),
          itens: [{ produtoId: "x", quantidade: 1 }],
        }),
      ),
    ];

    for (const resposta of await Promise.all(semCookie)) {
      expect(resposta.status).toBe(401);
    }
  });

  it("a ficha em branco traz o esperado de cada produto", async () => {
    const id = await criarPelaRota(`${ZZ} Suflair`, "7,50");

    await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        { tipo: "REPOSICAO", quantidade: 6 },
        { cookie },
      ),
      params(id),
    );

    const resposta = await rotaContagem.GET(
      pedidoGet("/api/admin/emporio/contagem", {}, { cookie }),
    );

    const corpo = (await resposta.json()) as {
      linhas: { produtoId: string; esperado: number }[];
    };

    expect(corpo.linhas.find((l) => l.produtoId === id)?.esperado).toBe(6);
  });

  it("gravar a contagem reconcilia o estoque e devolve a diferença", async () => {
    const id = await criarPelaRota(`${ZZ} Suflair`, "7,50");

    await rotaEstoque.POST(
      pedidoPost(
        `/api/admin/emporio/produtos/${id}/estoque`,
        { tipo: "REPOSICAO", quantidade: 6 },
        { cookie },
      ),
      params(id),
    );

    const resposta = await rotaContagem.POST(
      pedidoPost(
        "/api/admin/emporio/contagem",
        {
          dia: hoje(),
          horario: "09:40",
          observacao: "1 cookies",
          itens: [{ produtoId: id, quantidade: 4 }],
        },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(201);
    const corpo = (await resposta.json()) as {
      contagem: { faltaram: number; linhas: { diferenca: number }[] };
    };

    expect(corpo.contagem.linhas[0]?.diferenca).toBe(-2);
    expect(corpo.contagem.faltaram).toBe(2);

    // E o estoque passou a bater com a prateleira.
    const lista = (await (
      await rotaProdutos.GET(pedidoGet("/api/admin/emporio/produtos", {}, { cookie }))
    ).json()) as { produtos: { id: string; estoque: number }[] };

    expect(lista.produtos.find((p) => p.id === id)?.estoque).toBe(4);
  });

  it("recusa horário em formato torto, com 400", async () => {
    const id = await criarPelaRota(`${ZZ} Suflair`, "7,50");

    const resposta = await rotaContagem.POST(
      pedidoPost(
        "/api/admin/emporio/contagem",
        { dia: hoje(), horario: "9h40", itens: [{ produtoId: id, quantidade: 1 }] },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(400);
  });
});
