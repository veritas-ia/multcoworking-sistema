/**
 * CATEGORIA DE PROFISSAO NA RESERVA.
 *
 * O que estes testes protegem:
 *  1. o campo e OBRIGATORIO em reserva nova, no site e no painel — quem cobra
 *     isso e a aplicacao, porque a coluna precisa aceitar nulo por causa das
 *     reservas antigas;
 *  2. so uma opcao que EXISTE e esta ativa e aceita — a lista virou tabela
 *     editavel em 27/10/2026, entao quem confere e o banco, nao um enum;
 *  3. o valor fica gravado e VIAJA no reagendamento — remarcar nao e ocasiao
 *     de perguntar de novo, e perder o valor falsearia o relatorio;
 *  4. reserva antiga (sem profissao) continua valida e vira "Não informado".
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { POST as postReservaAdmin } from "@/app/api/admin/reservas/route";
import { criarReservaNaRecepcao, reagendarComoAdmin } from "@/lib/agenda-admin";
import {
  listarProfissoesParaEscolher,
  rotuloDaProfissao,
} from "@/lib/profissoes";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";
import { pedidoPost } from "./apoio/requisicao";

const TERCA = "2026-10-20";
const QUARTA = "2026-10-21";
const TELEFONE = "+5511900000456";
const USUARIO = "zz.profissao";

const OPERADOR = { id: "", nome: "Recepção de Teste" };
let salaId: string;
let cookie: string;
/** Os ids das areas usadas aqui, resolvidos uma vez no beforeAll. */
const ID: Record<string, string> = {};

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

  for (const slug of ["MARKETING", "JURIDICO", "CONTABIL", "SAUDE", "OUTROS"]) {
    ID[slug] = await idDaProfissao(slug);
  }
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
    profissaoId: ID.OUTROS,
    data: TERCA,
    inicio: "10:00",
    fim: "11:00",
    ...extra,
  };
}

// -----------------------------------------------------------------------------

describe("a lista de opcoes", () => {
  it("traz as cinco que a migração criou, na ordem do painel", async () => {
    // A lista virou TABELA: a migracao e que semeia estas cinco, porque o
    // deploy roda "migrate deploy" e NAO roda o seed. Sem isso o formulario
    // de reserva chegaria em producao sem opcao nenhuma.
    const lista = await listarProfissoesParaEscolher();

    expect(lista.map((opcao) => opcao.nome)).toEqual([
      "Marketing",
      "Jurídico",
      "Contábil",
      "Área da Saúde",
      "Outros",
    ]);
  });

  it("a bloqueada VEM na lista, com o aviso dela", async () => {
    // De proposito: escondida, o advogado nao acharia a opcao dele,
    // escolheria "Outros" e a reserva passaria.
    const juridico = (await listarProfissoesParaEscolher()).find(
      (opcao) => opcao.nome === "Jurídico",
    );

    expect(juridico?.bloqueada).toBe(true);
    expect(juridico?.avisoBloqueio).toMatch(/área jurídica/i);
  });

  it("chama a ausencia de 'Não informado'", () => {
    expect(rotuloDaProfissao(null)).toBe("Não informado");
    expect(rotuloDaProfissao({ nome: "Área da Saúde" })).toBe("Área da Saúde");
  });
});

describe("obrigatoriedade", () => {
  it("recusa reserva sem profissao", async () => {
    const semProfissao = corpo();
    delete (semProfissao as Record<string, unknown>).profissaoId;

    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", semProfissao, { cookie }),
    );

    expect(resposta.status).toBe(400);
    expect((await resposta.json()).erro).toMatch(/área de atuação/i);
  });

  it("recusa uma opcao que nao existe", async () => {
    // Agora a recusa vem do SERVIDOR conferindo no banco, e nao de uma lista
    // escrita na rota: 422 de regra, nao 400 de formato.
    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", corpo({ profissaoId: "nao-existe" }), {
        cookie,
      }),
    );

    expect(resposta.status).toBe(422);
  });

  it("recusa uma opcao DESLIGADA no painel", async () => {
    const desligada = await bancoDeTeste.profissao.create({
      data: { nome: "ZZ Desligada", slug: "ZZ_DESLIGADA", ativa: false },
      select: { id: true },
    });

    try {
      const resposta = await postReservaAdmin(
        pedidoPost("/api/admin/reservas", corpo({ profissaoId: desligada.id }), {
          cookie,
        }),
      );

      expect(resposta.status).toBe(422);
    } finally {
      await bancoDeTeste.profissao.delete({ where: { id: desligada.id } });
    }
  });

  it("aceita e grava a opcao escolhida", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", corpo({ profissaoId: ID.MARKETING }), {
        cookie,
      }),
    );

    const criada = await resposta.json();
    expect(resposta.status).toBe(201);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
      include: { profissao: { select: { nome: true } } },
    });
    expect(noBanco.profissao?.nome).toBe("Marketing");
  });
});

describe("reagendamento", () => {
  it("leva a profissao junto para o horario novo", async () => {
    const criada = await criarReservaNaRecepcao({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Cliente de Teste",
      profissaoId: ID.CONTABIL!,
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
      include: { profissao: { select: { nome: true } } },
    });

    // Remarcar nao pergunta de novo: perder o valor falsearia o relatorio.
    expect(noBanco.profissao?.nome).toBe("Contábil");
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
      select: { id: true, profissaoId: true, profissao: true },
    });

    expect(antiga.profissaoId).toBeNull();
    expect(rotuloDaProfissao(antiga.profissao)).toBe("Não informado");
  });
});
