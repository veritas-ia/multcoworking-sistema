/**
 * CONVITE PARA AVALIAR, 1 HORA DEPOIS DO TERMINO.
 *
 * O que estes testes protegem:
 *  1. sai 1 hora depois do TERMINO — nao do inicio;
 *  2. UMA VEZ SO por reserva, mesmo com duas passadas ao mesmo tempo;
 *  3. nao sai para reserva CANCELADA;
 *  4. SAI para reserva CONCLUIDA. Isto nao e detalhe: uma hora depois do
 *     termino a reserva ja e CONCLUIDA, porque a rotina de marcar concluidas
 *     roda na mesma passada. Se alguem "consertar" o filtro para aceitar so
 *     CONFIRMADA/REAGENDADA, ninguem mais recebe nada — e sem erro nenhum
 *     aparecer. Este teste existe para nao deixar;
 *  5. reserva que terminou ha tempo demais nao recebe convite atrasado;
 *  6. sem o link do Google cadastrado, a rotina nao faz nada.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { StatusReserva } from "@/generated/prisma/enums";
import {
  HORAS_ATE_A_AVALIACAO,
  JANELA_MINUTOS,
  avaliacaoPosUso,
  passadaDeRotina,
} from "@/lib/rotinas";
import { CHAVE_DO_LINK } from "@/lib/templates-admin";

import { aquecerConexao, bancoDeTeste, maisMinutos } from "./apoio/banco";

const TELEFONE = "+5511900000999";
const LINK = "https://g.page/r/mult-coworking-teste";

/** Um instante fixo, para nao depender do relogio. */
const AGORA = new Date("2026-11-10T15:00:00.000Z");

let salaId: string;
let linkOriginal = "";

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaId = sala.id;

  const linha = await bancoDeTeste.configuracao.findUnique({
    where: { chave: CHAVE_DO_LINK },
  });
  linkOriginal = linha?.valor ?? "";
});

/** Grava o link do Google, que e o que liga a rotina. */
async function comLink(valor: string): Promise<void> {
  await bancoDeTeste.configuracao.upsert({
    where: { chave: CHAVE_DO_LINK },
    create: { chave: CHAVE_DO_LINK, valor, descricao: "teste" },
    update: { valor },
  });
}

async function limpar(): Promise<void> {
  await bancoDeTeste.logMensagem.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
}

beforeEach(async () => {
  await limpar();
  await comLink(LINK);
});

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await comLink(linkOriginal);
  await bancoDeTeste.$disconnect();
});

/**
 * Cria uma reserva que TERMINOU ha "minutosAtras" minutos.
 * Grava direto no banco, sem passar pelas regras da agenda.
 */
async function reservaTerminadaHa(
  minutosAtras: number,
  status: StatusReserva = StatusReserva.CONCLUIDA,
) {
  const fim = maisMinutos(AGORA, -minutosAtras);
  const inicio = maisMinutos(fim, -60);

  return bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: "Cliente de Teste",
      telefone: TELEFONE,
      profissao: "OUTROS",
      inicio,
      fim,
      duracaoMinutos: 60,
      valor: "35.00",
      status,
      canceladoEm: status === StatusReserva.CANCELADA ? AGORA : null,
      origem: "ADMIN",
    },
  });
}

/** O minuto exato em que o convite deve sair. */
const NA_HORA = HORAS_ATE_A_AVALIACAO * 60;

// -----------------------------------------------------------------------------

describe("quando sai", () => {
  it("sai 1 hora depois do termino", async () => {
    const reserva = await reservaTerminadaHa(NA_HORA);

    const resultado = await avaliacaoPosUso(AGORA);

    expect(resultado.enviados).toBe(1);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
    });
    expect(noBanco.avaliacaoEnviadaEm).not.toBeNull();
  });

  it("NAO sai logo depois do termino", async () => {
    await reservaTerminadaHa(5);

    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(0);
  });

  it("nao sai antes de a reserva terminar", async () => {
    // Termina daqui a uma hora.
    await reservaTerminadaHa(-60);

    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(0);
  });

  it("aceita a folga da janela, para os dois lados", async () => {
    await reservaTerminadaHa(NA_HORA - JANELA_MINUTOS + 1);
    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(1);

    await limpar();
    await reservaTerminadaHa(NA_HORA + JANELA_MINUTOS - 1);
    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(1);
  });
});

describe("uma vez so", () => {
  it("nao reenvia numa segunda passada", async () => {
    await reservaTerminadaHa(NA_HORA);

    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(1);
    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(0);
  });

  it("duas passadas AO MESMO TEMPO enviam uma vez so", async () => {
    await reservaTerminadaHa(NA_HORA);

    // E o caso que a marcacao condicional existe para resolver: marcar
    // primeiro, mandar depois. Quem nao conseguiu marcar, nao manda.
    const [uma, outra] = await Promise.all([
      avaliacaoPosUso(AGORA),
      avaliacaoPosUso(AGORA),
    ]);

    expect(uma.enviados + outra.enviados).toBe(1);

    const enviadas = await bancoDeTeste.logMensagem.count({
      where: { telefone: TELEFONE, tipo: "avaliacao_pos_uso" },
    });
    expect(enviadas).toBe(1);
  });
});

describe("quais reservas", () => {
  it("NAO sai para reserva cancelada", async () => {
    await reservaTerminadaHa(NA_HORA, StatusReserva.CANCELADA);

    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(0);
  });

  it("SAI para reserva concluida", async () => {
    // Uma hora depois do termino a reserva JA E concluida: a rotina de marcar
    // concluidas roda na mesma passada e mudou o status quase uma hora antes.
    // Filtrar so por CONFIRMADA/REAGENDADA aqui nao enviaria nada, nunca.
    await reservaTerminadaHa(NA_HORA, StatusReserva.CONCLUIDA);

    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(1);
  });

  it("SAI para reserva ainda marcada como confirmada", async () => {
    await reservaTerminadaHa(NA_HORA, StatusReserva.CONFIRMADA);

    expect((await avaliacaoPosUso(AGORA)).enviados).toBe(1);
  });
});

describe("nao envia atrasado", () => {
  it("reserva que terminou ha muito tempo vira 'nao aplicavel'", async () => {
    const reserva = await reservaTerminadaHa(60 * 24);

    const resultado = await avaliacaoPosUso(AGORA);

    expect(resultado.enviados).toBe(0);
    expect(resultado.naoAplicaveis).toBe(1);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
    });
    expect(noBanco.avaliacaoNaoAplicavel).toBe(true);
    expect(noBanco.avaliacaoEnviadaEm).toBeNull();
  });

  it("marcada como 'nao aplicavel' nao e reavaliada", async () => {
    await reservaTerminadaHa(60 * 24);

    expect((await avaliacaoPosUso(AGORA)).naoAplicaveis).toBe(1);
    expect((await avaliacaoPosUso(AGORA)).naoAplicaveis).toBe(0);
  });
});

describe("sem o link do Google", () => {
  it("a rotina nao envia e nao marca nada", async () => {
    await comLink("");
    const reserva = await reservaTerminadaHa(NA_HORA);

    const resultado = await avaliacaoPosUso(AGORA);

    expect(resultado).toEqual({ enviados: 0, naoAplicaveis: 0, falhas: 0 });

    // Continua pendente: no dia em que o link for preenchido, ela ja estara
    // fora da janela e vira "nao aplicavel" — sem enxurrada de atrasados.
    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
    });
    expect(noBanco.avaliacaoEnviadaEm).toBeNull();
    expect(noBanco.avaliacaoNaoAplicavel).toBe(false);
  });
});

describe("na passada completa", () => {
  it("entra junto com os lembretes e o marcar concluidas", async () => {
    await reservaTerminadaHa(NA_HORA, StatusReserva.CONFIRMADA);

    const resumo = await passadaDeRotina(AGORA);

    expect(resumo.avaliacao.enviados).toBe(1);
    // A mesma passada tambem fecha a reserva.
    expect(resumo.concluidas).toBeGreaterThanOrEqual(1);
  });
});
