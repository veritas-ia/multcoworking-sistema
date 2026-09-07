/**
 * HORARIO DE FUNCIONAMENTO (Fase 11).
 *
 * O que estes testes protegem:
 *  1. so a equipe logada muda o expediente;
 *  2. as horas so aceitam :00 e :30, fechamento vem depois da abertura, dia
 *     aberto precisa das duas horas e a semana nao pode ficar toda fechada;
 *  3. a regra central do CLAUDE.md: mudar o horario NAO apaga nem cancela
 *     reserva nenhuma — apenas mostra quais ficaram de fora;
 *  4. so aparece na lista quem CABIA no horario antigo. Reserva que a recepcao
 *     ja tinha lancado fora do expediente de proposito nao vira alarme falso.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getHorarios, PUT as putHorarios } from "@/app/api/admin/horarios/route";
import { POST as postConferir } from "@/app/api/admin/horarios/conferir/route";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { dataLocalDe, diaDaSemanaDe, instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

const USUARIO = "teste.fase11.horarios";
const SALA = "ZZ Teste Horarios";
const TELEFONE = "+5511900000077";

/** O padrao do CLAUDE.md: seg-qui 08:00-18:00, sex fechado, sab 09:00-13:00. */
const PADRAO = [
  { diaDaSemana: 0, aberto: false, horaAbertura: null, horaFechamento: null },
  { diaDaSemana: 1, aberto: true, horaAbertura: "08:00", horaFechamento: "18:00" },
  { diaDaSemana: 2, aberto: true, horaAbertura: "08:00", horaFechamento: "18:00" },
  { diaDaSemana: 3, aberto: true, horaAbertura: "08:00", horaFechamento: "18:00" },
  { diaDaSemana: 4, aberto: true, horaAbertura: "08:00", horaFechamento: "18:00" },
  { diaDaSemana: 5, aberto: false, horaAbertura: null, horaFechamento: null },
  { diaDaSemana: 6, aberto: true, horaAbertura: "09:00", horaFechamento: "13:00" },
];

let cookie: string;
let salaId: string;

beforeAll(async () => {
  await aquecerConexao();
});

/** Uma segunda-feira daqui a mais de uma semana, no relogio de Sao Paulo. */
function proximaSegunda(): string {
  const dia = new Date(Date.now() + 8 * 24 * 60 * 60 * 1_000);

  for (let passo = 0; passo < 14; passo += 1) {
    const data = dataLocalDe(dia);
    if (diaDaSemanaDe(data) === 1) {
      return data;
    }
    dia.setDate(dia.getDate() + 1);
  }

  throw new Error("Nao achei uma segunda-feira.");
}

async function restaurarPadrao(): Promise<void> {
  for (const dia of PADRAO) {
    await bancoDeTeste.horarioFuncionamento.update({
      where: { diaDaSemana: dia.diaDaSemana },
      data: {
        aberto: dia.aberto,
        horaAbertura: dia.horaAbertura,
        horaFechamento: dia.horaFechamento,
      },
    });
  }
}

async function limpar(): Promise<void> {
  const salas = await bancoDeTeste.sala.findMany({
    where: { nome: SALA },
    select: { id: true },
  });

  const ids = salas.map((sala) => sala.id);

  if (ids.length > 0) {
    await bancoDeTeste.reserva.deleteMany({ where: { salaId: { in: ids } } });
    await bancoDeTeste.sala.deleteMany({ where: { id: { in: ids } } });
  }

  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  await restaurarPadrao();
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

  const sala = await bancoDeTeste.sala.create({
    data: {
      nome: SALA,
      slug: "zz-teste-horarios",
      precoPorHora: "40.00",
      precoPorHoraNoturno: "75.00",
      ordem: 95,
      ativa: false, // fora do site publico: e sala de teste
    },
    select: { id: true },
  });

  salaId = sala.id;
});

afterEach(limpar);

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

/** Cria uma reserva na sala de teste, no dia e horario pedidos. */
async function reservar(data: string, inicio: string, fim: string): Promise<string> {
  const criada = await bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: "Cliente de Teste",
      telefone: TELEFONE,
      inicio: instanteDe(data, inicio),
      fim: instanteDe(data, fim),
      duracaoMinutos: 60,
      valor: "40.00",
      origem: "ADMIN",
    },
    select: { id: true },
  });

  return criada.id;
}

/** Copia do padrao com um dia trocado. */
function comSegunda(mudanca: Partial<(typeof PADRAO)[number]>) {
  return PADRAO.map((dia) => (dia.diaDaSemana === 1 ? { ...dia, ...mudanca } : dia));
}

// -----------------------------------------------------------------------------

describe("quem pode mexer", () => {
  it("recusa ler sem sessao de admin", async () => {
    expect((await getHorarios(pedidoGet("/api/admin/horarios"))).status).toBe(401);
  });

  it("recusa gravar sem sessao de admin", async () => {
    const resposta = await putHorarios(
      pedidoPost("/api/admin/horarios", { horarios: PADRAO }),
    );

    expect(resposta.status).toBe(401);
  });
});

describe("conferencia do que foi digitado", () => {
  it("devolve os sete dias", async () => {
    const corpo = await (
      await getHorarios(pedidoGet("/api/admin/horarios", {}, { cookie }))
    ).json();

    expect(corpo.horarios).toHaveLength(7);
  });

  it("recusa hora que nao termina em :00 nem :30", async () => {
    const resposta = await putHorarios(
      pedidoPost(
        "/api/admin/horarios",
        { horarios: comSegunda({ horaAbertura: "08:15" }) },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/:00 ou :30/);
  });

  it("recusa fechamento antes da abertura", async () => {
    const resposta = await putHorarios(
      pedidoPost(
        "/api/admin/horarios",
        { horarios: comSegunda({ horaAbertura: "18:00", horaFechamento: "08:00" }) },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/depois da abertura/);
  });

  it("recusa dia aberto sem as horas preenchidas", async () => {
    const resposta = await putHorarios(
      pedidoPost(
        "/api/admin/horarios",
        { horarios: comSegunda({ horaAbertura: null }) },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("recusa fechar a semana inteira", async () => {
    const resposta = await putHorarios(
      pedidoPost(
        "/api/admin/horarios",
        {
          horarios: PADRAO.map((dia) => ({
            ...dia,
            aberto: false,
            horaAbertura: null,
            horaFechamento: null,
          })),
        },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/pelo menos um dia/i);
  });
});

describe("reservas que ficam fora do novo horario", () => {
  it("aponta a reserva que deixa de caber quando o dia fecha", async () => {
    const segunda = proximaSegunda();
    await reservar(segunda, "09:00", "10:00");

    const resposta = await postConferir(
      pedidoPost(
        "/api/admin/horarios/conferir",
        { horarios: comSegunda({ aberto: false, horaAbertura: null, horaFechamento: null }) },
        { cookie },
      ),
    );

    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.reservas).toHaveLength(1);
    expect(corpo.reservas[0].data).toBe(segunda);
    expect(corpo.reservas[0].motivo).toMatch(/fechado/);
  });

  it("aponta a reserva que passa a comecar antes da abertura", async () => {
    const segunda = proximaSegunda();
    await reservar(segunda, "09:00", "10:00");

    const corpo = await (
      await postConferir(
        pedidoPost(
          "/api/admin/horarios/conferir",
          { horarios: comSegunda({ horaAbertura: "10:00" }) },
          { cookie },
        ),
      )
    ).json();

    expect(corpo.reservas).toHaveLength(1);
    expect(corpo.reservas[0].motivo).toMatch(/antes da nova abertura \(10:00\)/);
  });

  it("NAO aponta reserva que a recepcao ja tinha lancado fora do expediente", async () => {
    const segunda = proximaSegunda();
    // 19:00 ja esta fora do expediente atual (08:00-18:00): foi de proposito.
    await reservar(segunda, "19:00", "20:00");

    const corpo = await (
      await postConferir(
        pedidoPost(
          "/api/admin/horarios/conferir",
          { horarios: comSegunda({ horaAbertura: "10:00", horaFechamento: "16:00" }) },
          { cookie },
        ),
      )
    ).json();

    expect(corpo.reservas).toHaveLength(0);
  });

  it("nao aponta nada quando o novo horario e mais largo", async () => {
    const segunda = proximaSegunda();
    await reservar(segunda, "09:00", "10:00");

    const corpo = await (
      await postConferir(
        pedidoPost(
          "/api/admin/horarios/conferir",
          { horarios: comSegunda({ horaAbertura: "07:00", horaFechamento: "22:00" }) },
          { cookie },
        ),
      )
    ).json();

    expect(corpo.reservas).toHaveLength(0);
  });

  it("conferir NAO grava nada", async () => {
    await postConferir(
      pedidoPost(
        "/api/admin/horarios/conferir",
        { horarios: comSegunda({ horaAbertura: "10:00" }) },
        { cookie },
      ),
    );

    const segunda = await bancoDeTeste.horarioFuncionamento.findUniqueOrThrow({
      where: { diaDaSemana: 1 },
    });

    expect(segunda.horaAbertura).toBe("08:00");
  });
});

describe("gravacao", () => {
  it("grava o novo horario e devolve as reservas afetadas SEM mexer nelas", async () => {
    const segunda = proximaSegunda();
    const reservaId = await reservar(segunda, "09:00", "10:00");

    const resposta = await putHorarios(
      pedidoPost(
        "/api/admin/horarios",
        { horarios: comSegunda({ horaAbertura: "10:00" }) },
        { cookie },
      ),
    );

    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(corpo.reservasForaDoHorario).toHaveLength(1);
    expect(corpo.reservasForaDoHorario[0].id).toBe(reservaId);

    // O horario mudou...
    const dia = await bancoDeTeste.horarioFuncionamento.findUniqueOrThrow({
      where: { diaDaSemana: 1 },
    });
    expect(dia.horaAbertura).toBe("10:00");

    // ...e a reserva continua exatamente como estava.
    const reserva = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reservaId },
    });
    expect(reserva.status).toBe("CONFIRMADA");
    expect(reserva.canceladoEm).toBeNull();
    expect(reserva.inicio).toEqual(instanteDe(segunda, "09:00"));
  });
});
