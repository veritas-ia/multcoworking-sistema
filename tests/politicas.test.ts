/**
 * TEXTOS DE POLITICA (Fase 11).
 *
 * O que estes testes protegem:
 *  1. so a equipe logada edita os textos;
 *  2. variavel inventada nao passa — um {{codigo}} no lugar errado viraria
 *     texto quebrado no celular do cliente, e ninguem veria antes dele;
 *  3. se a linha nao existir no banco, vale o texto padrao: a area publica
 *     nunca fica sem politica de cancelamento na tela;
 *  4. o {{horas}} chega ao site ja trocado pelo prazo configurado.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getAgendaPublica } from "@/app/api/publico/agenda/route";
import {
  GET as getPoliticas,
  PATCH as patchPoliticas,
} from "@/app/api/admin/politicas/route";
import { POLITICAS } from "@/lib/politicas";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPatch } from "./apoio/requisicao";

const USUARIO = "teste.fase11.politicas";

const PADROES = Object.fromEntries(
  POLITICAS.map((politica) => [politica.chave, politica.padrao]),
) as Record<string, string>;

let cookie: string;

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  await bancoDeTeste.configuracao.deleteMany({
    where: { chave: { in: POLITICAS.map((politica) => politica.chave) } },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await limpar();

  const admin = await bancoDeTeste.usuario.create({
    data: {
      nome: "Admin de Teste",
      usuario: USUARIO,
      senhaHash: await bcrypt.hash("senha-boa-12345", 10),
    },
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(admin.id)}`;
});

afterEach(limpar);

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

// -----------------------------------------------------------------------------

describe("quem pode mexer", () => {
  it("recusa ler sem sessao de admin", async () => {
    expect((await getPoliticas(pedidoGet("/api/admin/politicas"))).status).toBe(401);
  });

  it("recusa gravar sem sessao de admin", async () => {
    const resposta = await patchPoliticas(pedidoPatch("/api/admin/politicas", PADROES));

    expect(resposta.status).toBe(401);
  });
});

describe("leitura", () => {
  it("cai no texto padrao quando a linha nao existe no banco", async () => {
    const corpo = await (
      await getPoliticas(pedidoGet("/api/admin/politicas", {}, { cookie }))
    ).json();

    expect(corpo.textos.politicaCancelamento).toBe(PADROES.politicaCancelamento);
    expect(corpo.textos.avisoDoValor).toBe(PADROES.avisoDoValor);
  });

  it("informa quais variaveis cada texto aceita", async () => {
    const corpo = await (
      await getPoliticas(pedidoGet("/api/admin/politicas", {}, { cookie }))
    ).json();

    const cancelamento = corpo.definicoes.find(
      (definicao: { chave: string }) => definicao.chave === "politicaCancelamento",
    );
    const valor = corpo.definicoes.find(
      (definicao: { chave: string }) => definicao.chave === "avisoDoValor",
    );

    expect(cancelamento.variaveis).toEqual(["{{horas}}"]);
    expect(valor.variaveis).toEqual([]);
  });
});

describe("gravacao", () => {
  it("grava textos validos", async () => {
    const resposta = await patchPoliticas(
      pedidoPatch(
        "/api/admin/politicas",
        {
          politicaCancelamento: "Dá para remarcar sozinho até {{horas}} horas antes.",
          avisoDoValor: "Pagamento no local.",
        },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(200);

    const guardado = await bancoDeTeste.configuracao.findUniqueOrThrow({
      where: { chave: "politicaCancelamento" },
    });
    expect(guardado.valor).toContain("{{horas}}");
  });

  it("recusa variavel que nao existe naquele texto", async () => {
    const resposta = await patchPoliticas(
      pedidoPatch(
        "/api/admin/politicas",
        {
          politicaCancelamento: "Seu código é {{codigo}}.",
          avisoDoValor: PADROES.avisoDoValor,
        },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/\{\{codigo\}\}/);
  });

  it("recusa variavel em texto que nao aceita nenhuma", async () => {
    const resposta = await patchPoliticas(
      pedidoPatch(
        "/api/admin/politicas",
        {
          politicaCancelamento: PADROES.politicaCancelamento,
          avisoDoValor: "Valor de {{horas}} reais.",
        },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/não aceita variáveis/i);
  });

  it("recusa texto vazio", async () => {
    const resposta = await patchPoliticas(
      pedidoPatch(
        "/api/admin/politicas",
        { politicaCancelamento: "   ", avisoDoValor: PADROES.avisoDoValor },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/vazio/i);
  });

  it("recusa texto longo demais", async () => {
    const resposta = await patchPoliticas(
      pedidoPatch(
        "/api/admin/politicas",
        { politicaCancelamento: "a".repeat(5_000), avisoDoValor: PADROES.avisoDoValor },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("nao grava nada quando um dos textos e recusado", async () => {
    await patchPoliticas(
      pedidoPatch(
        "/api/admin/politicas",
        { politicaCancelamento: "Texto bom.", avisoDoValor: "Vale {{nome}}." },
        { cookie },
      ),
    );

    const guardado = await bancoDeTeste.configuracao.findUnique({
      where: { chave: "politicaCancelamento" },
    });

    expect(guardado).toBeNull();
  });
});

describe("o que chega ao site", () => {
  it("troca {{horas}} pelo prazo configurado", async () => {
    await patchPoliticas(
      pedidoPatch(
        "/api/admin/politicas",
        {
          politicaCancelamento: "Cancele até {{horas}} horas antes.",
          avisoDoValor: PADROES.avisoDoValor,
        },
        { cookie },
      ),
    );

    const janela = await bancoDeTeste.configuracao.findUniqueOrThrow({
      where: { chave: "janelaCancelamentoHoras" },
    });

    const corpo = await (await getAgendaPublica()).json();

    expect(corpo.textos.politicaCancelamento).toBe(
      `Cancele até ${janela.valor} horas antes.`,
    );
    // A area publica recebe a frase pronta: nada de {{...}} sobrando na tela.
    expect(corpo.textos.politicaCancelamento).not.toContain("{{");
  });
});
