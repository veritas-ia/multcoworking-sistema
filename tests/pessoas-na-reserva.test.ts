/**
 * NUMERO DE PESSOAS NA RESERVA (bloco de precos por faixa).
 *
 * O que estes testes protegem:
 *  1. o numero fica GRAVADO na reserva, e o preco de grupo entra so a noite;
 *  2. de dia, o mesmo grupo nao muda o valor;
 *  3. o numero VIAJA no reagendamento — sem isso, remarcar uma reunia de 8
 *     pessoas para outro dia baixaria o preco sozinho, e ninguem perceberia;
 *  4. o banco recusa numero de pessoas impossivel.
 *
 * Fala com o banco, mas nao passa pelas rotas HTTP: o que esta em jogo aqui e
 * a regra, e a rota ja tem teste proprio.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { criarReservaNaRecepcao, reagendarComoAdmin } from "@/lib/agenda-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

/** Uma terca-feira distante, para nao esbarrar em nada. */
const DIA = "2027-03-09";
const OUTRO_DIA = "2027-03-10";
const TELEFONE = "+5511900000123";

const OPERADOR = { id: "", nome: "Recepção de Teste" };

let salaReuniao: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-de-reuniao" },
    select: { id: true },
  });

  salaReuniao = sala.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.pessoas" },
    create: { nome: "Recepção de Teste", usuario: "zz.pessoas", senhaHash: "x" },
    update: {},
    select: { id: true },
  });

  OPERADOR.id = admin.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.pessoas" } });
  await bancoDeTeste.$disconnect();
});

/** Cria uma reserva pela recepcao e devolve id e valor. */
async function reservar(entrada: {
  dia: string;
  inicio: string;
  fim: string;
  pessoas: number | null;
}) {
  const resultado = await criarReservaNaRecepcao({
    salaId: salaReuniao,
    telefone: TELEFONE,
    nomeCliente: "Cliente de Teste",
    profissao: "OUTROS",
    inicio: instanteDe(entrada.dia, entrada.inicio),
    fim: instanteDe(entrada.dia, entrada.fim),
    pessoas: entrada.pessoas,
    operador: OPERADOR,
  });

  if (!resultado.ok) {
    throw new Error(`Nao criou: ${resultado.falha.motivo}`);
  }

  return resultado.dados;
}

// -----------------------------------------------------------------------------

describe("o numero fica guardado", () => {
  it("grava na reserva o que foi informado", async () => {
    const criada = await reservar({ dia: DIA, inicio: "19:00", fim: "21:00", pessoas: 6 });

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });

    expect(noBanco.pessoas).toBe(6);
  });

  it("fica nulo quando ninguem informou", async () => {
    const criada = await reservar({ dia: DIA, inicio: "09:00", fim: "11:00", pessoas: null });

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });

    expect(noBanco.pessoas).toBeNull();
  });
});

describe("efeito no preco", () => {
  it("a noite, acima do limite, cobra o preco de grupo", async () => {
    const comGrupo = await reservar({ dia: DIA, inicio: "19:00", fim: "21:00", pessoas: 5 });
    await limpar();
    const semGrupo = await reservar({ dia: DIA, inicio: "19:00", fim: "21:00", pessoas: 4 });

    expect(comGrupo.valor).toBe("190.00");
    expect(semGrupo.valor).toBe("150.00");
  });

  it("de dia, o tamanho do grupo NAO muda o valor", async () => {
    const cheia = await reservar({ dia: DIA, inicio: "09:00", fim: "11:00", pessoas: 12 });
    await limpar();
    const vazia = await reservar({ dia: DIA, inicio: "09:00", fim: "11:00", pessoas: 1 });

    expect(cheia.valor).toBe("80.00");
    expect(vazia.valor).toBe("80.00");
  });
});

describe("reagendamento", () => {
  it("leva o numero de pessoas junto para o horario novo", async () => {
    const criada = await reservar({ dia: DIA, inicio: "19:00", fim: "21:00", pessoas: 8 });
    expect(criada.valor).toBe("190.00");

    const remarcada = await reagendarComoAdmin({
      reservaId: criada.id,
      salaId: salaReuniao,
      inicio: instanteDe(OUTRO_DIA, "19:00"),
      fim: instanteDe(OUTRO_DIA, "21:00"),
      operador: OPERADOR,
    });

    expect(remarcada.ok).toBe(true);

    if (remarcada.ok) {
      // Se o numero nao viajasse, cairia para R$150 sem ninguem pedir.
      expect(remarcada.dados.valor).toBe("190.00");
    }

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.id },
    });
    expect(noBanco.pessoas).toBe(8);
  });
});

describe("o banco recusa numero impossivel", () => {
  it("nao aceita zero pessoas", async () => {
    await expect(
      bancoDeTeste.reserva.create({
        data: {
          salaId: salaReuniao,
          nomeCliente: "Teste",
          telefone: TELEFONE,
          pessoas: 0,
          inicio: instanteDe("2027-04-06", "09:00"),
          fim: instanteDe("2027-04-06", "10:00"),
          duracaoMinutos: 60,
          valor: "40.00",
          origem: "ADMIN",
        },
      }),
    ).rejects.toThrow();
  });
});
