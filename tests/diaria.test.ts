/**
 * CATEGORIA DIARIA (bloco de precos por faixa).
 *
 * O que estes testes protegem:
 *  1. a diaria custa o preco fechado, seja qual for o horario;
 *  2. o horario NAO vem do pedido, vem da configuracao — senao daria para
 *     pedir "diaria das 08:00 as 09:00" e pagar R$350 por uma hora, ou o
 *     contrario, ocupar o dia inteiro sem querer;
 *  3. quem reserva a diaria OCUPA a sala: nao entra reserva por hora em cima;
 *  4. sala que nao trabalha com diaria recusa;
 *  5. a duracao maxima da sala nao atrapalha — a de Reuniao tem teto de 2h e
 *     a diaria tem 10h;
 *  6. o cliente so consegue nos dias cujo expediente cobre a janela inteira;
 *     a recepcao continua podendo em qualquer dia.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { POST as postReservaAdmin } from "@/app/api/admin/reservas/route";
import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import { validarReserva } from "@/lib/disponibilidade";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoPost } from "./apoio/requisicao";

/**
 * 2026-10-13 e terca (aberta 08:00-22:00); 2026-10-17 e sabado (09:00-13:00).
 *
 * Dentro dos 60 dias de antecedencia maxima de proposito: as conferencias no
 * modo CLIENTE recusam data distante demais, e o teste falaria de outra coisa.
 */
const TERCA = "2026-10-13";
const SABADO = "2026-10-17";
const TELEFONE = "+5511900000321";
const USUARIO = "zz.diaria";

const OPERADOR = { id: "", nome: "Recepção de Teste" };

let salaReuniao: string;
let salaContainer: string;
let cookie: string;

beforeAll(async () => {
  await aquecerConexao();

  const reuniao = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-de-reuniao" },
    select: { id: true, aceitaDiaria: true },
  });
  const container = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true, aceitaDiaria: true },
  });

  // Guarda contra o teste passar de graca se alguem mexer no cadastro.
  expect(reuniao.aceitaDiaria).toBe(true);
  expect(container.aceitaDiaria).toBe(false);

  salaReuniao = reuniao.id;
  salaContainer = container.id;

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

/** Lanca uma diaria pela recepcao. */
async function diaria(dia: string, salaId = salaReuniao) {
  return criarReservaNaRecepcao({
    salaId,
    telefone: TELEFONE,
    nomeCliente: "Cliente da Diária",
    profissao: "OUTROS",
    inicio: instanteDe(dia, "08:00"),
    fim: instanteDe(dia, "18:00"),
    categoria: "DIARIA",
    operador: OPERADOR,
  });
}

// -----------------------------------------------------------------------------

describe("preco e horario", () => {
  it("custa o preco fechado da sala", async () => {
    const criada = await diaria(TERCA);

    expect(criada.ok).toBe(true);
    if (criada.ok) {
      expect(criada.dados.valor).toBe("350.00");
    }
  });

  it("grava a categoria e o dia inteiro", async () => {
    const criada = await diaria(TERCA);
    if (!criada.ok) throw new Error(criada.falha.motivo);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: criada.dados.id },
    });

    expect(noBanco.categoria).toBe("DIARIA");
    expect(noBanco.inicio).toEqual(instanteDe(TERCA, "08:00"));
    expect(noBanco.fim).toEqual(instanteDe(TERCA, "18:00"));
    expect(noBanco.duracaoMinutos).toBe(600);
  });

  it("IGNORA o horario mandado no pedido e usa o da configuracao", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost(
        "/api/admin/reservas",
        {
          salaId: salaReuniao,
          telefone: TELEFONE,
          nome: "Esperto",
          profissao: "OUTROS",
          data: TERCA,
          categoria: "DIARIA",
          // Pedindo uma "diaria" de uma hora, para pagar R$350 por 1h — ou,
          // pior, para ocupar menos do que a diaria deveria ocupar.
          inicio: "08:00",
          fim: "09:00",
        },
        { cookie },
      ),
    );

    const corpo = await resposta.json();

    expect(resposta.status).toBe(201);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: corpo.id },
    });

    expect(noBanco.fim).toEqual(instanteDe(TERCA, "18:00"));
    expect(noBanco.valor.toFixed(2)).toBe("350.00");
  });
});

describe("a diaria ocupa a sala", () => {
  it("nao deixa entrar reserva por hora no mesmo dia e sala", async () => {
    const criada = await diaria(TERCA);
    expect(criada.ok).toBe(true);

    const porHora = await validarReserva({
      salaId: salaReuniao,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(porHora.valido).toBe(false);
    expect(porHora.codigo).toBe("HORARIO_OCUPADO");
  });

  it("nao atrapalha a agenda de OUTRA sala no mesmo dia", async () => {
    await diaria(TERCA);

    const noutraSala = await validarReserva({
      salaId: salaContainer,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(noutraSala.valido).toBe(true);
  });
});

describe("quais salas aceitam", () => {
  it("recusa diaria em sala que nao trabalha com isso", async () => {
    const resultado = await diaria(TERCA, salaContainer);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toMatch(/diária/i);
    }
  });
});

describe("duracao maxima da sala", () => {
  it("NAO atrapalha a diaria, mesmo com teto de 2 horas", async () => {
    const teto = await bancoDeTeste.sala.findUniqueOrThrow({
      where: { id: salaReuniao },
      select: { duracaoMaximaMinutos: true },
    });

    // Se este cadastro mudar, o teste perde a graca — melhor avisar.
    expect(teto.duracaoMaximaMinutos).toBe(120);

    const comoCliente = await validarReserva({
      salaId: salaReuniao,
      inicio: instanteDe(TERCA, "08:00"),
      fim: instanteDe(TERCA, "18:00"),
      categoria: "DIARIA",
    });

    expect(comoCliente.valido).toBe(true);
  });

  it("continua valendo para reserva por hora", async () => {
    const tresHoras = await validarReserva({
      salaId: salaReuniao,
      inicio: instanteDe(TERCA, "09:00"),
      fim: instanteDe(TERCA, "12:00"),
    });

    expect(tresHoras.valido).toBe(false);
    expect(tresHoras.codigo).toBe("DURACAO_MAXIMA_DA_SALA");
  });
});

describe("em que dias o cliente consegue", () => {
  it("consegue num dia cujo expediente cobre a janela inteira", async () => {
    const resultado = await validarReserva({
      salaId: salaReuniao,
      inicio: instanteDe(TERCA, "08:00"),
      fim: instanteDe(TERCA, "18:00"),
      categoria: "DIARIA",
    });

    expect(resultado.valido).toBe(true);
  });

  it("NAO consegue no sabado, que abre as 09:00", async () => {
    const resultado = await validarReserva({
      salaId: salaReuniao,
      inicio: instanteDe(SABADO, "08:00"),
      fim: instanteDe(SABADO, "18:00"),
      categoria: "DIARIA",
    });

    expect(resultado.valido).toBe(false);
    expect(resultado.codigo).toBe("ANTES_DA_ABERTURA");
  });

  it("a recepcao consegue no sabado, como em qualquer lancamento avulso", async () => {
    const criada = await diaria(SABADO);

    expect(criada.ok).toBe(true);
    if (criada.ok) {
      expect(criada.dados.valor).toBe("350.00");
    }
  });
});
