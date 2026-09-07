/**
 * CADASTRO DE SALAS (Fase 11).
 *
 * O que estes testes protegem:
 *  1. so a equipe logada mexe nas salas;
 *  2. o endereco (slug) nasce do nome, nunca repete e NUNCA muda depois —
 *     e ele que esta nos QR codes impressos;
 *  3. preco, capacidade, ordem e duracao maxima so gravam se fizerem sentido;
 *  4. desligar tira a sala do site sem tocar nas reservas ja marcadas, e a
 *     ultima sala ativa nao pode ser desligada.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getSalasPublicas } from "@/app/api/publico/salas/route";
import { GET as getSalas, POST as postSala } from "@/app/api/admin/salas/route";
import { PATCH as patchSala } from "@/app/api/admin/salas/[id]/route";
import { enderecoDe } from "@/lib/salas-admin";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPatch, pedidoPost } from "./apoio/requisicao";

const USUARIO = "teste.fase11.salas";
/** Tudo que este arquivo cria comeca assim, para a limpeza achar depois. */
const PREFIXO = "ZZ Teste";

let cookie: string;

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  const criadas = await bancoDeTeste.sala.findMany({
    where: { nome: { startsWith: PREFIXO } },
    select: { id: true },
  });

  const ids = criadas.map((sala) => sala.id);

  if (ids.length > 0) {
    await bancoDeTeste.reserva.deleteMany({ where: { salaId: { in: ids } } });
    await bancoDeTeste.sala.deleteMany({ where: { id: { in: ids } } });
  }

  // As salas do seed voltam a ficar ligadas, para nao contaminar outros testes.
  await bancoDeTeste.sala.updateMany({
    where: { nome: { not: { startsWith: PREFIXO } } },
    data: { ativa: true },
  });

  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await limpar();

  const criado = await bancoDeTeste.usuario.create({
    data: {
      nome: "Admin de Teste",
      usuario: USUARIO,
      senhaHash: await bcrypt.hash("senha-boa-12345", 10),
    },
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(criado.id)}`;
});

afterEach(limpar);

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

/** Cadastra uma sala pela rota e devolve o corpo da resposta. */
async function cadastrar(dados: Record<string, unknown>) {
  const resposta = await postSala(
    pedidoPost(
      "/api/admin/salas",
      {
        nome: `${PREFIXO} Sala`,
        capacidade: null,
        precoPorHora: 40,
        precoPorHoraNoturno: 75,
        precoPorHoraNoturnoGrupo: null,
        pessoasParaGrupo: null,
        aceitaDiaria: false,
        precoDiaria: null,
        cor: "#FFC700",
        duracaoMaximaMinutos: null,
        ordem: 90,
        ...dados,
      },
      { cookie },
    ),
  );

  return { status: resposta.status, corpo: await resposta.json() };
}

function contexto(id: string) {
  return { params: Promise.resolve({ id }) };
}

// -----------------------------------------------------------------------------

describe("quem pode mexer", () => {
  it("recusa listar sem sessao de admin", async () => {
    expect((await getSalas(pedidoGet("/api/admin/salas"))).status).toBe(401);
  });

  it("recusa cadastrar sem sessao de admin", async () => {
    const resposta = await postSala(
      pedidoPost("/api/admin/salas", { nome: `${PREFIXO} Invasora`, precoPorHora: 10 }),
    );

    expect(resposta.status).toBe(401);
    expect(
      await bancoDeTeste.sala.count({ where: { nome: `${PREFIXO} Invasora` } }),
    ).toBe(0);
  });
});

describe("endereco da sala", () => {
  it("tira acento e espaco do nome", () => {
    expect(enderecoDe("Sala de Reunião")).toBe("sala-de-reuniao");
    expect(enderecoDe("Espaço Café 3")).toBe("espaco-cafe-3");
  });

  it("gera o endereco a partir do nome ao cadastrar", async () => {
    const { status, corpo } = await cadastrar({ nome: `${PREFIXO} Mezanino` });

    expect(status).toBe(201);
    expect(corpo.sala.slug).toBe(enderecoDe(`${PREFIXO} Mezanino`));
  });

  it("nao repete endereco quando dois nomes viram o mesmo texto", async () => {
    const primeira = await cadastrar({ nome: `${PREFIXO} Ático` });
    const segunda = await cadastrar({ nome: `${PREFIXO} Atico` });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(201);
    expect(segunda.corpo.sala.slug).not.toBe(primeira.corpo.sala.slug);
  });

  it("NAO muda o endereco quando a sala e renomeada", async () => {
    const { corpo } = await cadastrar({ nome: `${PREFIXO} Antiga` });
    const enderecoOriginal = corpo.sala.slug;

    const resposta = await patchSala(
      pedidoPatch(
        `/api/admin/salas/${corpo.sala.id}`,
        {
          nome: `${PREFIXO} Nome Novo`,
          capacidade: null,
          precoPorHora: 40,
          precoPorHoraNoturno: 75,
          precoPorHoraNoturnoGrupo: null,
          pessoasParaGrupo: null,
          aceitaDiaria: false,
          precoDiaria: null,
          cor: "#FFC700",
          duracaoMaximaMinutos: null,
          ordem: 90,
        },
        { cookie },
      ),
      contexto(corpo.sala.id),
    );

    const atualizada = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(atualizada.sala.nome).toBe(`${PREFIXO} Nome Novo`);
    // O QR code impresso continua valendo.
    expect(atualizada.sala.slug).toBe(enderecoOriginal);
  });

  it("recusa nome ja usado por outra sala", async () => {
    await cadastrar({ nome: `${PREFIXO} Repetida` });
    const segunda = await cadastrar({ nome: `${PREFIXO} repetida` });

    expect(segunda.status).toBe(409);
  });
});

describe("conferencia dos campos", () => {
  it("recusa preco negativo", async () => {
    const { status } = await cadastrar({ precoPorHora: -10 });
    expect(status).toBe(422);
  });

  it("recusa preco com mais de dois numeros depois da virgula", async () => {
    const { status, corpo } = await cadastrar({ precoPorHora: 40.005 });

    expect(status).toBe(422);
    expect(corpo.erro).toMatch(/dois números/i);
  });

  it("recusa duracao maxima fora da grade de 30 minutos", async () => {
    const { status, corpo } = await cadastrar({ duracaoMaximaMinutos: 45 });

    expect(status).toBe(422);
    expect(corpo.erro).toMatch(/múltipla de 30/i);
  });

  it("recusa duracao maxima menor que a duracao minima de reserva", async () => {
    const { status, corpo } = await cadastrar({ duracaoMaximaMinutos: 30 });

    expect(status).toBe(422);
    expect(corpo.erro).toMatch(/duração mínima/i);
  });

  it("aceita duracao maxima em branco: vai ate o fechamento do dia", async () => {
    const { status, corpo } = await cadastrar({ duracaoMaximaMinutos: null });

    expect(status).toBe(201);
    expect(corpo.sala.duracaoMaximaMinutos).toBeNull();
  });
});

describe("ligar e desligar", () => {
  it("sala desligada some do site publico, mas continua no painel", async () => {
    const { corpo } = await cadastrar({ nome: `${PREFIXO} Sumindo` });
    const id: string = corpo.sala.id;

    const antes = await (await getSalasPublicas()).json();
    expect(antes.salas.some((sala: { id: string }) => sala.id === id)).toBe(true);

    const resposta = await patchSala(
      pedidoPatch(`/api/admin/salas/${id}`, { ativa: false }, { cookie }),
      contexto(id),
    );

    expect(resposta.status).toBe(200);

    const depois = await (await getSalasPublicas()).json();
    expect(depois.salas.some((sala: { id: string }) => sala.id === id)).toBe(false);

    const noPainel = await (await getSalas(pedidoGet("/api/admin/salas", {}, { cookie }))).json();
    expect(noPainel.salas.some((sala: { id: string }) => sala.id === id)).toBe(true);
  });

  it("desligar NAO mexe nas reservas ja marcadas", async () => {
    const { corpo } = await cadastrar({ nome: `${PREFIXO} Com Reserva` });
    const id: string = corpo.sala.id;

    const inicio = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000);
    inicio.setUTCMinutes(0, 0, 0);

    const reserva = await bancoDeTeste.reserva.create({
      data: {
        salaId: id,
        nomeCliente: "Cliente de Teste",
        telefone: "+5511900000099",
        inicio,
        fim: new Date(inicio.getTime() + 60 * 60_000),
        duracaoMinutos: 60,
        valor: "40.00",
        origem: "ADMIN",
      },
      select: { id: true },
    });

    const listaAntes = await (
      await getSalas(pedidoGet("/api/admin/salas", {}, { cookie }))
    ).json();
    const antes = listaAntes.salas.find((sala: { id: string }) => sala.id === id);
    expect(antes.reservasFuturas).toBe(1);

    await patchSala(
      pedidoPatch(`/api/admin/salas/${id}`, { ativa: false }, { cookie }),
      contexto(id),
    );

    const aindaExiste = await bancoDeTeste.reserva.findUnique({
      where: { id: reserva.id },
      select: { status: true },
    });

    expect(aindaExiste?.status).toBe("CONFIRMADA");
  });

  it("recusa desligar a ultima sala ativa", async () => {
    const ativas = await bancoDeTeste.sala.findMany({
      where: { ativa: true },
      select: { id: true },
      orderBy: { ordem: "asc" },
    });

    // Desliga todas menos a ultima.
    for (const sala of ativas.slice(0, -1)) {
      const resposta = await patchSala(
        pedidoPatch(`/api/admin/salas/${sala.id}`, { ativa: false }, { cookie }),
        contexto(sala.id),
      );
      expect(resposta.status).toBe(200);
    }

    const sobrou = ativas[ativas.length - 1]!;

    const resposta = await patchSala(
      pedidoPatch(`/api/admin/salas/${sobrou.id}`, { ativa: false }, { cookie }),
      contexto(sobrou.id),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/última sala ativa/i);

    const conferencia = await bancoDeTeste.sala.findUniqueOrThrow({
      where: { id: sobrou.id },
      select: { ativa: true },
    });
    expect(conferencia.ativa).toBe(true);
  });
});

describe("cor da sala", () => {
  it("guarda a cor escolhida", async () => {
    const { status, corpo } = await cadastrar({
      nome: `${PREFIXO} Colorida`,
      cor: "#9AD5F0",
    });

    expect(status).toBe(201);
    expect(corpo.sala.cor).toBe("#9AD5F0");
  });

  it("recusa cor fora da paleta oferecida", async () => {
    // Paleta fechada de proposito: cor livre acabaria em texto ilegivel na
    // agenda — um azul-marinho com texto preto em cima, por exemplo.
    const { status, corpo } = await cadastrar({
      nome: `${PREFIXO} Escura`,
      cor: "#000080",
    });

    expect(status).toBe(422);
    expect(corpo.erro).toMatch(/cores oferecidas/i);
  });

  it("recusa texto que nem e cor", async () => {
    const { status } = await cadastrar({ nome: `${PREFIXO} Torta`, cor: "azul" });
    expect(status).toBe(422);
  });
});
