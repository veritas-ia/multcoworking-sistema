/**
 * PARAMETROS DO PAINEL (Fase 11).
 *
 * O que estes testes protegem:
 *  1. so entra quem tem sessao de admin;
 *  2. os quatro numeros so gravam se fizerem sentido SOZINHOS (faixa, multiplo
 *     de 30) e EM CONJUNTO (antecedencia minima x maxima, duracao minima x
 *     duracao maxima das salas);
 *  3. gravacao e tudo ou nada: uma recusa nao pode deixar metade salva;
 *  4. o intervalo de 30 min e os limites do codigo aparecem, mas so para ler.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import {
  GET as getParametros,
  PATCH as patchParametros,
} from "@/app/api/admin/parametros/route";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPatch } from "./apoio/requisicao";

const USUARIO = "teste.fase11.parametros";
const SENHA = "senha-boa-12345";

/** Os valores do seed, restaurados ao fim de cada teste. */
const ORIGINAIS = {
  duracaoMinimaMinutos: 60,
  janelaCancelamentoHoras: 12,
  antecedenciaMinimaMinutos: 60,
  antecedenciaMaximaDias: 60,
} as const;

let cookie: string;

beforeAll(async () => {
  await aquecerConexao();
});

async function restaurar(): Promise<void> {
  for (const [chave, valor] of Object.entries(ORIGINAIS)) {
    await bancoDeTeste.configuracao.update({
      where: { chave },
      data: { valor: String(valor) },
    });
  }
}

beforeEach(async () => {
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });

  const criado = await bancoDeTeste.usuario.create({
    data: {
      nome: "Admin de Teste",
      usuario: USUARIO,
      senhaHash: await bcrypt.hash(SENHA, 10),
    },
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(criado.id)}`;
  await restaurar();
});

afterEach(async () => {
  await restaurar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
});

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

/** Le um parametro direto do banco, sem passar pela rota. */
async function valorNoBanco(chave: string): Promise<number> {
  const linha = await bancoDeTeste.configuracao.findUniqueOrThrow({ where: { chave } });
  return Number(linha.valor);
}

// -----------------------------------------------------------------------------

describe("quem pode mexer", () => {
  it("recusa quem nao tem sessao de admin", async () => {
    const resposta = await getParametros(pedidoGet("/api/admin/parametros"));

    expect(resposta.status).toBe(401);
  });

  it("recusa gravacao sem sessao de admin", async () => {
    const resposta = await patchParametros(
      pedidoPatch("/api/admin/parametros", ORIGINAIS),
    );

    expect(resposta.status).toBe(401);
    expect(await valorNoBanco("duracaoMinimaMinutos")).toBe(60);
  });
});

describe("leitura", () => {
  it("devolve os quatro parametros com valor, faixa e explicacao", async () => {
    const resposta = await getParametros(pedidoGet("/api/admin/parametros", {}, { cookie }));
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.parametros).toHaveLength(4);

    const duracao = corpo.parametros.find(
      (parametro: { chave: string }) => parametro.chave === "duracaoMinimaMinutos",
    );

    expect(duracao.valor).toBe(60);
    expect(duracao.multiploDe).toBe(30);
    expect(duracao.ajuda.length).toBeGreaterThan(20);
  });

  it("mostra o intervalo entre reservas e os limites do codigo, so para leitura", async () => {
    const resposta = await getParametros(pedidoGet("/api/admin/parametros", {}, { cookie }));
    const corpo = await resposta.json();

    expect(corpo.intervaloMinutos).toBe(30);
    expect(corpo.codigoWhatsapp.maximoDeTentativas).toBe(5);
    expect(corpo.codigoWhatsapp.minutosDeBloqueio).toBe(15);
    expect(corpo.codigoWhatsapp.porHoraPorIp).toBe(20);

    // O intervalo NAO entra na lista de campos editaveis.
    const chaves = corpo.parametros.map((parametro: { chave: string }) => parametro.chave);
    expect(chaves).not.toContain("intervaloMinutos");
  });
});

describe("gravacao", () => {
  it("grava valores validos", async () => {
    const resposta = await patchParametros(
      pedidoPatch(
        "/api/admin/parametros",
        {
          duracaoMinimaMinutos: 90,
          janelaCancelamentoHoras: 24,
          antecedenciaMinimaMinutos: 120,
          antecedenciaMaximaDias: 45,
        },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(200);
    expect(await valorNoBanco("duracaoMinimaMinutos")).toBe(90);
    expect(await valorNoBanco("janelaCancelamentoHoras")).toBe(24);
    expect(await valorNoBanco("antecedenciaMinimaMinutos")).toBe(120);
    expect(await valorNoBanco("antecedenciaMaximaDias")).toBe(45);
  });

  it("recusa duracao minima fora da grade de 30 minutos", async () => {
    const resposta = await patchParametros(
      pedidoPatch(
        "/api/admin/parametros",
        { ...ORIGINAIS, duracaoMinimaMinutos: 45 },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/múltiplo de 30/i);
    expect(await valorNoBanco("duracaoMinimaMinutos")).toBe(60);
  });

  it("recusa valor fora da faixa permitida", async () => {
    const resposta = await patchParametros(
      pedidoPatch(
        "/api/admin/parametros",
        { ...ORIGINAIS, antecedenciaMaximaDias: 4_000 },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect(await valorNoBanco("antecedenciaMaximaDias")).toBe(60);
  });

  it("recusa antecedencia minima maior que a maxima", async () => {
    const resposta = await patchParametros(
      pedidoPatch(
        "/api/admin/parametros",
        { ...ORIGINAIS, antecedenciaMinimaMinutos: 10_000, antecedenciaMaximaDias: 1 },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/nenhuma data/i);
  });

  it("recusa duracao minima maior que a duracao maxima de uma sala ativa", async () => {
    const sala = await bancoDeTeste.sala.findFirst({
      where: { ativa: true, duracaoMaximaMinutos: { not: null } },
      orderBy: { ordem: "asc" },
    });

    // O seed deixa a Sala de Reuniao com teto de 2h; sem ela o teste nao faz sentido.
    expect(sala).not.toBeNull();

    const acimaDoTeto = (sala!.duracaoMaximaMinutos ?? 0) + 30;

    const resposta = await patchParametros(
      pedidoPatch(
        "/api/admin/parametros",
        { ...ORIGINAIS, duracaoMinimaMinutos: acimaDoTeto },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toContain(sala!.nome);
    expect(await valorNoBanco("duracaoMinimaMinutos")).toBe(60);
  });

  it("nao grava nada quando um dos quatro e recusado", async () => {
    const resposta = await patchParametros(
      pedidoPatch(
        "/api/admin/parametros",
        {
          duracaoMinimaMinutos: 45, // este e invalido
          janelaCancelamentoHoras: 48,
          antecedenciaMinimaMinutos: 30,
          antecedenciaMaximaDias: 90,
        },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);

    // Os outros tres continuam como estavam: nao existe "metade salva".
    expect(await valorNoBanco("janelaCancelamentoHoras")).toBe(12);
    expect(await valorNoBanco("antecedenciaMinimaMinutos")).toBe(60);
    expect(await valorNoBanco("antecedenciaMaximaDias")).toBe(60);
  });
});
