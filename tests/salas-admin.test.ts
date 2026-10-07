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
import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import { enderecoDe } from "@/lib/salas-admin";
import { instanteDe } from "@/lib/tempo";
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
        precoPorHoraGrupo: null,
        precoPorHoraNoturno: 75,
        precoPorHoraNoturnoGrupo: null,
        pessoasParaGrupo: null,
        aceitaDiaria: false,
        precoDiaria: null,
        precoDiariaGrupo: null,
        pessoasParaGrupoDiaria: null,
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
          precoPorHoraGrupo: null,
          precoPorHoraNoturno: 75,
          precoPorHoraNoturnoGrupo: null,
          pessoasParaGrupo: null,
          aceitaDiaria: false,
          precoDiaria: null,
          precoDiariaGrupo: null,
          pessoasParaGrupoDiaria: null,
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

// =============================================================================
// Preco de grupo: os campos novos e a regra de NAO RETROAGIR
// =============================================================================

describe("preços de grupo editáveis na tela", () => {
  /** O corpo de um PATCH completo, com os campos de grupo preenchidos. */
  function corpoComGrupo(extra: Record<string, unknown> = {}) {
    return {
      nome: `${PREFIXO} Com Grupo`,
      capacidade: 10,
      precoPorHora: 40,
      precoPorHoraGrupo: 75,
      precoPorHoraNoturno: 75,
      precoPorHoraNoturnoGrupo: 95,
      pessoasParaGrupo: 4,
      aceitaDiaria: true,
      precoDiaria: 350,
      precoDiariaGrupo: 450,
      pessoasParaGrupoDiaria: 5,
      cor: "#FFC700",
      duracaoMaximaMinutos: null,
      ordem: 90,
      ...extra,
    };
  }

  /** Quem lanca as reservas de apoio destes testes. */
  async function operadorDeTeste() {
    return bancoDeTeste.usuario.findFirstOrThrow({
      where: { usuario: USUARIO },
      select: { id: true, nome: true },
    });
  }

  /** Nome unico por chamada: o cadastro recusa nome repetido. */
  let contador = 0;

  async function salvar(extra: Record<string, unknown> = {}) {
    contador += 1;
    const nome = `${PREFIXO} Com Grupo ${contador}`;
    const { corpo } = await cadastrar({ nome, ordem: 90 });

    if (!corpo.sala) {
      throw new Error(`Nao cadastrou a sala de apoio: ${JSON.stringify(corpo)}`);
    }

    const resposta = await patchSala(
      pedidoPatch(
        `/api/admin/salas/${corpo.sala.id}`,
        corpoComGrupo({ nome, ...extra }),
        { cookie },
      ),
      contexto(corpo.sala.id),
    );

    return {
      id: corpo.sala.id,
      nome,
      status: resposta.status,
      body: await resposta.json(),
    };
  }

  /** Edita uma sala que JA existe, mantendo o mesmo id. */
  async function reeditar(id: string, nome: string, extra: Record<string, unknown>) {
    const resposta = await patchSala(
      pedidoPatch(`/api/admin/salas/${id}`, corpoComGrupo({ nome, ...extra }), { cookie }),
      contexto(id),
    );

    return { status: resposta.status, body: await resposta.json() };
  }

  it("grava os três campos novos", async () => {
    const { status, body } = await salvar();

    expect(status).toBe(200);
    expect(body.sala.precoPorHoraGrupo).toBe("75.00");
    expect(body.sala.precoDiariaGrupo).toBe("450.00");
    expect(body.sala.pessoasParaGrupoDiaria).toBe(5);
  });

  it("recusa preço de grupo MENOR que o preço base", async () => {
    const dia = await salvar({ precoPorHoraGrupo: 30 });
    expect(dia.status).not.toBe(200);
    expect(dia.body.erro ?? dia.body.motivo).toMatch(/menor que o preço de dia/i);

    const noite = await salvar({ precoPorHoraNoturnoGrupo: 50 });
    expect(noite.status).not.toBe(200);

    const diaria = await salvar({ precoDiariaGrupo: 300 });
    expect(diaria.status).not.toBe(200);
    expect(diaria.body.erro ?? diaria.body.motivo).toMatch(/menos que a diária normal/i);
  });

  it("recusa corte fora da faixa 1 a 10 — nos DOIS cortes", async () => {
    // Diaria.
    expect((await salvar({ pessoasParaGrupoDiaria: 0 })).status).not.toBe(200);
    expect((await salvar({ pessoasParaGrupoDiaria: 11 })).status).not.toBe(200);
    expect((await salvar({ pessoasParaGrupoDiaria: 10 })).status).toBe(200);

    // Por hora: a mesma faixa, para a tela nao ter duas regras diferentes
    // para a mesma pergunta.
    expect((await salvar({ pessoasParaGrupo: 0 })).status).not.toBe(200);
    expect((await salvar({ pessoasParaGrupo: 11 })).status).not.toBe(200);
    expect((await salvar({ pessoasParaGrupo: 10 })).status).toBe(200);
  });

  it("recusa preço negativo", async () => {
    expect((await salvar({ precoPorHoraGrupo: -1 })).status).not.toBe(200);
    expect((await salvar({ precoDiariaGrupo: -1 })).status).not.toBe(200);
  });

  it("recusa preço de grupo sem dizer a partir de quantas pessoas", async () => {
    const semCorte = await salvar({ pessoasParaGrupo: null });
    expect(semCorte.status).not.toBe(200);

    const diariaSemCorte = await salvar({ pessoasParaGrupoDiaria: null });
    expect(diariaSemCorte.status).not.toBe(200);
  });

  it("NÃO RETROAGE: a reserva já gravada mantém o valor antigo", async () => {
    // 1) Sala com o preco de dia para grupo em R$75.
    const { id, nome } = await salvar();

    // 2) Uma reserva de 2h com 6 pessoas (grupo): 2 x R$75 = R$150.
    const antes = await criarReservaNaRecepcao({
      salaId: id,
      telefone: "+5511900000777",
      nomeCliente: "Cliente de Teste",
      profissao: "OUTROS",
      inicio: instanteDe("2027-05-04", "14:00"),
      fim: instanteDe("2027-05-04", "16:00"),
      pessoas: 6,
      operador: await operadorDeTeste(),
    });

    if (!antes.ok) {
      throw new Error(`Nao criou: ${antes.falha.motivo}`);
    }
    expect(antes.dados.valor).toBe("150.00");

    // 3) A equipe DOBRA o preco de dia para grupo na tela, NESTA MESMA sala.
    const subiu = await reeditar(id, nome, { precoPorHoraGrupo: 150 });
    expect(subiu.status).toBe(200);

    // 4) A reserva ja gravada NAO muda. O valor fica congelado na criacao, e
    //    a edicao mexe so na tabela de salas.
    const guardada = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: antes.dados.id },
      select: { valor: true },
    });
    expect(guardada.valor.toFixed(2)).toBe("150.00");

    // 5) Uma reserva NOVA, igual, ja sai pelo preco novo: 2 x R$150 = R$300.
    const depois = await criarReservaNaRecepcao({
      salaId: id,
      telefone: "+5511900000777",
      nomeCliente: "Cliente de Teste",
      profissao: "OUTROS",
      inicio: instanteDe("2027-05-05", "14:00"),
      fim: instanteDe("2027-05-05", "16:00"),
      pessoas: 6,
      operador: await operadorDeTeste(),
    });

    if (!depois.ok) {
      throw new Error(`Nao criou: ${depois.falha.motivo}`);
    }
    expect(depois.dados.valor).toBe("300.00");
  });

  it("salvar preço não escreve em NENHUMA reserva", async () => {
    const { id, nome } = await salvar();

    const criada = await criarReservaNaRecepcao({
      salaId: id,
      telefone: "+5511900000777",
      nomeCliente: "Cliente de Teste",
      profissao: "OUTROS",
      inicio: instanteDe("2027-05-06", "14:00"),
      fim: instanteDe("2027-05-06", "16:00"),
      pessoas: 6,
      operador: await operadorDeTeste(),
    });

    if (!criada.ok) {
      throw new Error("Nao criou a reserva de apoio.");
    }

    const antes = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.dados.id },
    });

    await reeditar(id, nome, {
      precoPorHora: 99,
      precoPorHoraGrupo: 199,
      precoDiaria: 999,
      precoDiariaGrupo: 1999,
    });

    const depois = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.dados.id },
    });

    // A LINHA INTEIRA precisa estar intacta, e nao so o valor: se um dia
    // alguem acrescentar um "recalcular reservas" ao salvar da sala, e aqui
    // que estoura.
    expect(depois).toEqual(antes);
  });
});
