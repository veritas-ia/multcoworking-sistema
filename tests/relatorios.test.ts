/**
 * OS NUMEROS DO RELATORIO.
 *
 * O que estes testes protegem:
 *  1. o FUSO. O banco guarda em UTC; uma reserva de segunda as 21h nao pode
 *     virar terca no relatorio. E o erro mais provavel aqui, e o mais dificil
 *     de perceber olhando a tela;
 *  2. o relatorio nao devolve DINHEIRO nenhum — decisao do dono;
 *  3. o periodo de comparacao tem o mesmo tamanho do atual, senao fevereiro
 *     "cairia" so por ter menos dias;
 *  4. dias sem reserva aparecem como zero, para a linha do grafico nao pular
 *     o domingo e sugerir movimento onde nao houve;
 *  5. reserva sem profissao vira "Não informado", e nao some da conta.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  compararPeriodos,
  diasNoPeriodo,
  montarRelatorio,
  periodoAnterior,
  somarDias,
} from "@/lib/relatorios";
import { GET as getRelatorios } from "@/app/api/admin/relatorios/route";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet } from "./apoio/requisicao";

/** 2026-11-02 e uma SEGUNDA. */
const SEGUNDA = "2026-11-02";
const TERCA = "2026-11-03";
const TELEFONE = "+5511900000789";

let salaCI: string;
let salaContainer: string;
let cookie: string;

beforeAll(async () => {
  await aquecerConexao();

  const ci = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-ci" },
    select: { id: true },
  });
  const container = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });

  salaCI = ci.id;
  salaContainer = container.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.relatorios" },
    create: { nome: "Admin de Teste", usuario: "zz.relatorios", senhaHash: "x" },
    update: {},
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(admin.id)}`;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.relatorios" } });
  await bancoDeTeste.$disconnect();
});

/** Grava uma reserva direto no banco, sem passar pelas regras da agenda. */
async function reserva(entrada: {
  dia: string;
  inicio: string;
  fim: string;
  salaId?: string;
  status?: "CONFIRMADA" | "CANCELADA" | "CONCLUIDA" | "REAGENDADA";
  profissao?: "MARKETING" | "JURIDICO" | "CONTABIL" | "SAUDE" | "OUTROS" | null;
}) {
  return bancoDeTeste.reserva.create({
    data: {
      salaId: entrada.salaId ?? salaCI,
      nomeCliente: "Cliente de Teste",
      telefone: TELEFONE,
      profissao: entrada.profissao === undefined ? "MARKETING" : entrada.profissao,
      inicio: instanteDe(entrada.dia, entrada.inicio),
      fim: instanteDe(entrada.dia, entrada.fim),
      duracaoMinutos: 60,
      valor: "40.00",
      status: entrada.status ?? "CONFIRMADA",
      // O banco exige a data do cancelamento junto com o status CANCELADA
      // (trava "reserva_cancelamento_coerente"): status cancelado sem data
      // deixaria a agenda sem saber quando aquilo aconteceu.
      canceladoEm: entrada.status === "CANCELADA" ? new Date() : null,
      origem: "ADMIN",
    },
  });
}

// -----------------------------------------------------------------------------

describe("contas de calendario", () => {
  it("conta os dois extremos do periodo", () => {
    expect(diasNoPeriodo({ de: "2026-11-01", ate: "2026-11-01" })).toBe(1);
    expect(diasNoPeriodo({ de: "2026-11-01", ate: "2026-11-07" })).toBe(7);
  });

  it("atravessa a virada do mes", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("o periodo anterior tem o MESMO tamanho e termina colado no atual", () => {
    const anterior = periodoAnterior({ de: "2026-11-01", ate: "2026-11-30" });

    expect(anterior).toEqual({ de: "2026-10-02", ate: "2026-10-31" });
    expect(diasNoPeriodo(anterior)).toBe(30);
  });
});

describe("o fuso de Sao Paulo", () => {
  it("reserva de segunda as 21h conta na SEGUNDA, e nao na terca", async () => {
    // Em UTC isto e terca-feira as 00:00 — o erro que este teste existe para
    // pegar. O relatorio tem de concordar com a agenda, que mostra segunda.
    await reserva({ dia: SEGUNDA, inicio: "21:00", fim: "22:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.total).toBe(1);
    expect(relatorio.porDia).toEqual([{ data: SEGUNDA, total: 1 }]);

    const segunda = relatorio.porDiaDaSemana.find((dia) => dia.diaDaSemana === 1);
    expect(segunda?.total).toBe(1);
    expect(relatorio.porHora).toEqual([{ rotulo: "21h", total: 1 }]);
  });

  it("nao puxa reserva do dia seguinte para dentro do periodo", async () => {
    await reserva({ dia: TERCA, inicio: "09:00", fim: "10:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.total).toBe(0);
  });
});

describe("o que o relatorio conta", () => {
  it("conta TODOS os status, e mostra a divisao entre eles", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", status: "CANCELADA" });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "15:00", status: "CONCLUIDA" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.total).toBe(3);
    expect(relatorio.porStatus).toEqual([
      { rotulo: "Confirmadas", total: 1 },
      { rotulo: "Canceladas", total: 1 },
      { rotulo: "Concluídas", total: 1 },
    ]);
  });

  it("separa por sala, da mais usada para a menos", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", salaId: salaContainer });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", salaId: salaContainer });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "15:00", salaId: salaCI });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.porSala[0]?.total).toBe(2);
    expect(relatorio.porSala[1]?.total).toBe(1);
    // A cor da sala vem junto, para o grafico usar a mesma da agenda.
    expect(relatorio.porSala[0]?.cor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("mostra os dias vazios como zero", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: somarDias(SEGUNDA, 2) });

    expect(relatorio.porDia).toEqual([
      { data: SEGUNDA, total: 1 },
      { data: TERCA, total: 0 },
      { data: somarDias(SEGUNDA, 2), total: 0 },
    ]);
  });

  it("junta a meia hora na hora cheia", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({ dia: SEGUNDA, inicio: "09:30", fim: "10:30", salaId: salaContainer });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.porHora).toEqual([{ rotulo: "09h", total: 2 }]);
  });
});

describe("profissao", () => {
  it("agrupa pelas areas e chama a ausencia de 'Não informado'", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", profissao: "SAUDE" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", profissao: "SAUDE" });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "15:00", profissao: null });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.porProfissao).toEqual([
      { rotulo: "Área da Saúde", total: 2 },
      { rotulo: "Não informado", total: 1 },
    ]);
  });
});

describe("comparacao entre periodos", () => {
  it("calcula a variacao contra o periodo anterior do mesmo tamanho", async () => {
    // Periodo atual: 2 reservas. Anterior (mesmo tamanho, colado antes): 1.
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00" });
    await reserva({ dia: somarDias(SEGUNDA, -1), inicio: "09:00", fim: "10:00" });

    const comparacao = await compararPeriodos({ de: SEGUNDA, ate: SEGUNDA });

    expect(comparacao.atual.total).toBe(2);
    expect(comparacao.anterior.total).toBe(1);
    expect(comparacao.variacaoAbsoluta).toBe(1);
    expect(comparacao.variacaoPercentual).toBe(100);
  });

  it("sem base de comparacao, a variacao percentual e nula", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const comparacao = await compararPeriodos({ de: SEGUNDA, ate: SEGUNDA });

    expect(comparacao.anterior.total).toBe(0);
    // "Aumentou infinito por cento" nao diz nada a ninguem.
    expect(comparacao.variacaoPercentual).toBeNull();
    expect(comparacao.variacaoAbsoluta).toBe(1);
  });
});

describe("sem dinheiro", () => {
  it("o relatorio nao devolve valor, receita nem faturamento", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });
    const texto = JSON.stringify(relatorio);

    // A reserva vale R$40 no banco. Se esse numero aparecer aqui, alguem
    // abriu a porta do dinheiro sem querer.
    expect(texto).not.toContain("valor");
    expect(texto).not.toContain("40.00");
    expect(texto).not.toMatch(/receita|faturamento/i);
  });
});

// =============================================================================
// A rota do painel
// =============================================================================

describe("GET /api/admin/relatorios", () => {
  it("recusa quem nao tem sessao de admin", async () => {
    const resposta = await getRelatorios(
      pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA }),
    );

    expect(resposta.status).toBe(401);
  });

  it("devolve os numeros do periodo pedido", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const corpo = await (
      await getRelatorios(
        pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA }, { cookie }),
      )
    ).json();

    expect(corpo.atual.total).toBe(1);
    expect(corpo.anterior.total).toBe(0);
  });

  it("recusa periodo invertido", async () => {
    const resposta = await getRelatorios(
      pedidoGet(
        "/api/admin/relatorios",
        { de: "2026-11-10", ate: "2026-11-01" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("recusa periodo maior que um ano", async () => {
    const resposta = await getRelatorios(
      pedidoGet(
        "/api/admin/relatorios",
        { de: "2020-01-01", ate: "2026-12-31" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("aceita um periodo de comparacao escolhido a mao", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const corpo = await (
      await getRelatorios(
        pedidoGet(
          "/api/admin/relatorios",
          {
            de: SEGUNDA,
            ate: SEGUNDA,
            compararDe: somarDias(SEGUNDA, -7),
            compararAte: somarDias(SEGUNDA, -7),
          },
          { cookie },
        ),
      )
    ).json();

    expect(corpo.anterior.periodo).toEqual({
      de: somarDias(SEGUNDA, -7),
      ate: somarDias(SEGUNDA, -7),
    });
  });
});
