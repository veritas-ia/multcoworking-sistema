/**
 * CATEGORIA DE PROFISSAO NA RESERVA.
 *
 * O que estes testes protegem:
 *  1. o campo e OBRIGATORIO em reserva nova, no site e no painel — quem cobra
 *     isso e a aplicacao, porque a coluna precisa aceitar nulo por causa das
 *     reservas antigas;
 *  2. so as cinco opcoes combinadas sao aceitas;
 *  3. o valor fica gravado e VIAJA no reagendamento — remarcar nao e ocasiao
 *     de perguntar de novo, e perder o valor falsearia o relatorio;
 *  4. reserva antiga (sem profissao) continua valida e vira "Não informado".
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { POST as postReservaAdmin } from "@/app/api/admin/reservas/route";
import { criarReservaNaRecepcao, reagendarComoAdmin } from "@/lib/agenda-admin";
import { PROFISSOES, rotuloDaProfissao } from "@/lib/profissoes";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoPost } from "./apoio/requisicao";

const TERCA = "2026-10-20";
const QUARTA = "2026-10-21";
const TELEFONE = "+5511900000456";
const USUARIO = "zz.profissao";

const OPERADOR = { id: "", nome: "Recepção de Teste" };
let salaId: string;
let cookie: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaId = sala.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: USUARIO },
    create: { nome: "Recepção de Teste", usuario: USUARIO, senhaHash: "x" },
    update: {},
    select: { id: true },
  });

  OPERADOR.id = admin.id;
  cookie = `${COOKIE_ADMIN}=${await assinarToken(admin.id)}`;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  await bancoDeTeste.$disconnect();
});

/** Monta o corpo de um pedido de reserva para o painel. */
function corpo(extra: Record<string, unknown> = {}) {
  return {
    salaId,
    telefone: TELEFONE,
    nome: "Cliente de Teste",
    profissao: "JURIDICO",
    data: TERCA,
    inicio: "10:00",
    fim: "11:00",
    ...extra,
  };
}

// -----------------------------------------------------------------------------

describe("a lista de opcoes", () => {
  it("tem as cinco combinadas, nesta ordem", () => {
    expect(PROFISSOES.map((opcao) => opcao.valor)).toEqual([
      "MARKETING",
      "JURIDICO",
      "CONTABIL",
      "SAUDE",
      "OUTROS",
    ]);
  });

  it("chama a ausencia de 'Não informado'", () => {
    expect(rotuloDaProfissao(null)).toBe("Não informado");
    expect(rotuloDaProfissao("SAUDE")).toBe("Área da Saúde");
  });
});

describe("obrigatoriedade", () => {
  it("recusa reserva sem profissao", async () => {
    const semProfissao = corpo();
    delete (semProfissao as Record<string, unknown>).profissao;

    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", semProfissao, { cookie }),
    );

    expect(resposta.status).toBe(400);
    expect((await resposta.json()).erro).toMatch(/área de atuação/i);
  });

  it("recusa uma opcao que nao existe", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", corpo({ profissao: "ASTRONAUTA" }), { cookie }),
    );

    expect(resposta.status).toBe(400);
  });

  it("aceita e grava a opcao escolhida", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", corpo({ profissao: "MARKETING" }), { cookie }),
    );

    const criada = await resposta.json();
    expect(resposta.status).toBe(201);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });
    expect(noBanco.profissao).toBe("MARKETING");
  });
});

describe("reagendamento", () => {
  it("leva a profissao junto para o horario novo", async () => {
    const criada = await criarReservaNaRecepcao({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Cliente de Teste",
      profissao: "CONTABIL",
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
      operador: OPERADOR,
    });

    if (!criada.ok) throw new Error(criada.falha.motivo);

    const remarcada = await reagendarComoAdmin({
      reservaId: criada.dados.id,
      salaId,
      inicio: instanteDe(QUARTA, "14:00"),
      fim: instanteDe(QUARTA, "15:00"),
      operador: OPERADOR,
    });

    expect(remarcada.ok).toBe(true);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.dados.id },
    });

    // Remarcar nao pergunta de novo: perder o valor falsearia o relatorio.
    expect(noBanco.profissao).toBe("CONTABIL");
  });
});

describe("reservas antigas", () => {
  it("continuam validas sem profissao, e viram 'Não informado'", async () => {
    const antiga = await bancoDeTeste.reserva.create({
      data: {
        salaId,
        nomeCliente: "Cliente Antigo",
        telefone: TELEFONE,
        inicio: instanteDe(TERCA, "16:00"),
        fim: instanteDe(TERCA, "17:00"),
        duracaoMinutos: 60,
        valor: "35.00",
        origem: "ADMIN",
      },
      select: { id: true, profissao: true },
    });

    expect(antiga.profissao).toBeNull();
    expect(rotuloDaProfissao(antiga.profissao)).toBe("Não informado");
  });
});
