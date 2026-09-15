/**
 * CATEGORIA BLOQUEADA — o contrato de exclusividade com a advocacia.
 *
 * O que estes testes protegem:
 *  1. o SERVIDOR recusa, e nao so a tela. Esconder o botao nao para quem
 *     manda o pedido direto — e a recusa precisa valer nas TRES portas que
 *     criam reserva: site, recepcao e serie recorrente;
 *  2. as outras categorias reservam normalmente. Uma trava que barra demais
 *     seria pior do que trava nenhuma;
 *  3. reserva de Juridico que JA EXISTE continua de pe, e a equipe continua
 *     podendo remarcar — a regra vale so para reserva nova;
 *  4. o aviso que chega a tela e o texto combinado, e nao um erro tecnico.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { POST as postReservaAdmin } from "@/app/api/admin/reservas/route";
import { reagendarComoAdmin } from "@/lib/agenda-admin";
import {
  AVISO_PROFISSAO_BLOQUEADA,
  PROFISSOES,
  PROFISSOES_BLOQUEADAS,
  profissaoBloqueada,
} from "@/lib/profissoes";
import { criarSerie } from "@/lib/recorrencias";
import { criarReservaPublica } from "@/lib/reservas";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoPost } from "./apoio/requisicao";

const TERCA = "2026-10-27";
const QUARTA = "2026-10-28";
const TELEFONE = "+5511900000777";
const USUARIO = "zz.bloqueio";

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
  await bancoDeTeste.recorrencia.deleteMany({ where: { telefone: TELEFONE } });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  await bancoDeTeste.$disconnect();
});

/** Corpo de um pedido de reserva pelo painel. */
function corpoDoPainel(profissao: string, hora = "10:00") {
  return {
    salaId,
    telefone: TELEFONE,
    nome: "Cliente de Teste",
    profissao,
    data: TERCA,
    inicio: hora,
    fim: `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`,
  };
}

// -----------------------------------------------------------------------------

describe("a regra num lugar so", () => {
  it("bloqueia Juridico e nenhuma outra categoria", () => {
    expect([...PROFISSOES_BLOQUEADAS]).toEqual(["JURIDICO"]);

    for (const opcao of PROFISSOES) {
      expect(profissaoBloqueada(opcao.valor), opcao.rotulo).toBe(
        opcao.valor === "JURIDICO",
      );
    }
  });

  it("nao bloqueia quem nao informou categoria (reservas antigas)", () => {
    expect(profissaoBloqueada(null)).toBe(false);
  });
});

describe("pelo site", () => {
  it("o SERVIDOR recusa Juridico, com o texto combinado", async () => {
    // Chama a funcao que a rota usa, sem passar pela tela nem pela sessao: e
    // exatamente o caminho de quem tenta burlar mandando o pedido direto.
    const resultado = await criarReservaPublica({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Advogado Teste",
      profissao: "JURIDICO",
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.criada).toBe(false);
    if (!resultado.criada && resultado.falha.tipo === "REGRA") {
      expect(resultado.falha.codigo).toBe("PROFISSAO_BLOQUEADA");
      expect(resultado.falha.motivo).toBe(AVISO_PROFISSAO_BLOQUEADA);
    } else {
      throw new Error("Esperava uma recusa de REGRA.");
    }

    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(0);
  });

  it("outra categoria passa pelo mesmo caminho", async () => {
    const resultado = await criarReservaPublica({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Cliente Teste",
      profissao: "CONTABIL",
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.criada).toBe(true);
  });
});

describe("pelo painel", () => {
  it("recusa Juridico com o texto combinado", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", corpoDoPainel("JURIDICO"), { cookie }),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toBe(AVISO_PROFISSAO_BLOQUEADA);
    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(0);
  });

  it("as outras categorias reservam normalmente", async () => {
    const outras = PROFISSOES.filter((opcao) => opcao.valor !== "JURIDICO");

    for (const [indice, opcao] of outras.entries()) {
      // Horarios diferentes para nao esbarrarem umas nas outras.
      const hora = `${String(9 + indice * 2).padStart(2, "0")}:00`;

      const resposta = await postReservaAdmin(
        pedidoPost("/api/admin/reservas", corpoDoPainel(opcao.valor, hora), { cookie }),
      );

      expect(resposta.status, opcao.rotulo).toBe(201);
    }

    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(
      outras.length,
    );
  });
});

describe("pela serie recorrente", () => {
  it("recusa Juridico antes de criar qualquer ocorrencia", async () => {
    // E a maior brecha das tres portas: uma serie cria muitas reservas de uma
    // vez so.
    const resultado = await criarSerie({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Escritório Teste",
      profissao: "JURIDICO",
      horaInicio: "09:00",
      horaFim: "10:00",
      diasDaSemana: [2],
      frequencia: "SEMANAL",
      dataInicio: TERCA,
      dataFim: "2026-11-24",
      operador: OPERADOR,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toBe(AVISO_PROFISSAO_BLOQUEADA);
    }

    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(0);
  });
});

describe("reservas que ja existem", () => {
  it("continuam de pe, e a equipe ainda pode remarcar", async () => {
    // Gravada direto no banco, como as que ja existiam antes da regra.
    const antiga = await bancoDeTeste.reserva.create({
      data: {
        salaId,
        nomeCliente: "Cliente Antigo",
        telefone: TELEFONE,
        profissao: "JURIDICO",
        inicio: instanteDe(TERCA, "14:00"),
        fim: instanteDe(TERCA, "15:00"),
        duracaoMinutos: 60,
        valor: "35.00",
        origem: "ADMIN",
      },
      select: { id: true },
    });

    const remarcada = await reagendarComoAdmin({
      reservaId: antiga.id,
      salaId,
      inicio: instanteDe(QUARTA, "14:00"),
      fim: instanteDe(QUARTA, "15:00"),
      operador: OPERADOR,
    });

    // A regra vale para reserva NOVA. Quem ja reservou nao fica preso.
    expect(remarcada.ok).toBe(true);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: antiga.id },
    });
    expect(noBanco.profissao).toBe("JURIDICO");
    expect(noBanco.inicio).toEqual(instanteDe(QUARTA, "14:00"));
  });
});
