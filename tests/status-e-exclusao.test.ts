/**
 * EXCLUIR RESERVA E MUDAR O STATUS NA MAO (13/11/2026).
 *
 * POR QUE ISTO EXISTE
 *
 * A recepcao lanca reserva DEPOIS que ela aconteceu: o cliente esqueceu de
 * marcar, ela anotou no papel e passa para o sistema no dia seguinte. Isso ja
 * funcionava — a rotina marca concluida sozinha —, mas so a cada 5 minutos, e
 * SO com as rotinas ligadas. Faltava o caminho manual.
 *
 * E faltava o que fazer com lancamento errado: sala trocada, dia trocado,
 * duplicado. Cancelar nao resolve, porque a reserva cancelada CONTINUA
 * contando como reserva no relatorio.
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 *  1. a EVIDENCIA. Excluir apaga a prova, entao a acao fica registrada com o
 *     retrato da reserva e o motivo — e tudo na MESMA transacao, senao uma
 *     falha no meio deixaria a reserva apagada sem registro nenhum;
 *  2. o status nao vira campo livre. Concluir reserva que ainda nao terminou
 *     faria o sistema dizer que algo que nao aconteceu, aconteceu;
 *  3. DESFAZER CANCELAMENTO e o mais perigoso: ao cancelar, o banco LIBERA o
 *     horario, e outro cliente pode ja ter pego a sala.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listarAcoes, TipoDeAcao } from "@/lib/acoes";
import {
  cancelarComoAdmin,
  criarReservaNaRecepcao,
  excluirReserva,
  mudarStatusComoAdmin,
} from "@/lib/agenda-admin";
import { lerHistorico } from "@/lib/historico-reserva";
import { marcarConcluidas } from "@/lib/rotinas";
import { dataLocalDe, instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";

const TELEFONE = "+5511900007777";
const USUARIO = "zz.status";
const NOME = "ZZ Status";

let operador: { id: string; nome: string };
let salaId: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    where: { ativa: true },
    select: { id: true },
  });
  salaId = sala.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.acaoRegistrada.deleteMany({
    where: { usuario: { usuario: USUARIO } },
  });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.cliente.deleteMany({
    where: { reservas: { none: {} }, telefones: { none: {} } },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await limpar();

  const criado = await bancoDeTeste.usuario.create({
    data: { nome: "Recepção de Teste", usuario: USUARIO, senhaHash: "x" },
    select: { id: true, nome: true },
  });

  operador = criado;
});

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** Uma reserva, por padrão ONTEM — o caso que motivou tudo isto. */
async function reserva(opcoes?: { diasAtras?: number; hora?: string }) {
  const dias = opcoes?.diasAtras ?? 1;
  const hora = opcoes?.hora ?? "10:00";
  const dia = dataLocalDe(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));

  const criada = await criarReservaNaRecepcao({
    salaId,
    telefone: TELEFONE,
    nomeCliente: NOME,
    profissaoId: await idDaProfissao("OUTROS"),
    inicio: instanteDe(dia, hora),
    fim: new Date(instanteDe(dia, hora).getTime() + 60 * 60_000),
    operador,
  });

  if (!criada.ok) {
    throw new Error(`não criou: ${criada.falha.motivo}`);
  }

  return criada.dados.id;
}

// -----------------------------------------------------------------------------

describe("a reserva lançada depois de acontecer", () => {
  it("a recepção consegue lançar para ontem, e ela nasce CONFIRMADA", async () => {
    const id = await reserva();

    const linha = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });

    expect(linha.status).toBe("CONFIRMADA");
  });

  it("a rotina marca concluída sozinha — mas só de 5 em 5 minutos", async () => {
    const id = await reserva();
    await marcarConcluidas();

    const linha = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });

    expect(linha.status).toBe("CONCLUIDA");
  });

  it("CONCLUIR na mão não espera a rotina — e funciona com ela desligada", async () => {
    // É o único caminho na prévia, onde CRON_ATIVO é "false" de propósito.
    const id = await reserva();

    const feito = await mudarStatusComoAdmin({
      reservaId: id,
      mudanca: "CONCLUIR",
      operador,
    });

    expect(feito.ok).toBe(true);
    if (!feito.ok) throw new Error("deveria concluir");
    expect(feito.dados.status).toBe("CONCLUIDA");
  });
});

describe("o status não é campo livre", () => {
  it("recusa concluir uma reserva que ainda não terminou", async () => {
    // Senão o sistema passaria a dizer que algo que não aconteceu, aconteceu.
    const id = await reserva({ diasAtras: -2 });

    const feito = await mudarStatusComoAdmin({
      reservaId: id,
      mudanca: "CONCLUIR",
      operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria concluir");
    expect(feito.falha.codigo).toBe("REGRA");
  });

  it("recusa reabrir uma reserva que já terminou", async () => {
    // A rotina voltaria a marcá-la como concluída em minutos, e o botão
    // pareceria quebrado.
    const id = await reserva();
    await mudarStatusComoAdmin({ reservaId: id, mudanca: "CONCLUIR", operador });

    const feito = await mudarStatusComoAdmin({
      reservaId: id,
      mudanca: "REABRIR",
      operador,
    });

    expect(feito.ok).toBe(false);
  });

  it("reabrir vale para a reserva futura marcada concluída por engano", async () => {
    const id = await reserva({ diasAtras: -2 });
    await bancoDeTeste.reserva.update({
      where: { id },
      data: { status: "CONCLUIDA" },
    });

    const feito = await mudarStatusComoAdmin({
      reservaId: id,
      mudanca: "REABRIR",
      operador,
    });

    expect(feito.ok).toBe(true);
    if (!feito.ok) throw new Error("deveria reabrir");
    expect(feito.dados.status).toBe("CONFIRMADA");
  });

  it("recusa concluir uma reserva cancelada, explicando o caminho", async () => {
    const id = await reserva();
    await cancelarComoAdmin({ reservaId: id, operador });

    const feito = await mudarStatusComoAdmin({
      reservaId: id,
      mudanca: "CONCLUIR",
      operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria concluir");
    expect(feito.falha.motivo).toContain("Desfaça o cancelamento");
  });
});

describe("desfazer o cancelamento", () => {
  it("devolve a reserva como CONFIRMADA e limpa a data do cancelamento", async () => {
    // Volta como CONFIRMADA, não como REAGENDADA: esse status significa
    // "alguém remarcou isto", e desfazer um cancelamento não remarcou nada.
    const id = await reserva();
    await cancelarComoAdmin({ reservaId: id, operador });

    const feito = await mudarStatusComoAdmin({
      reservaId: id,
      mudanca: "DESFAZER_CANCELAMENTO",
      operador,
    });

    expect(feito.ok).toBe(true);

    const linha = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id },
      select: { status: true, canceladoEm: true },
    });

    expect(linha.status).toBe("CONFIRMADA");
    // Deixá-la preenchida faria a reserva dizer que está ativa E que foi
    // cancelada em tal dia.
    expect(linha.canceladoEm).toBeNull();
  });

  it("RECUSA quando outro cliente já pegou a sala naquele horário", async () => {
    // Ao cancelar, o banco LIBERA o horário. Esta é a armadilha: a trava do
    // banco só enxerga reserva ativa e não barraria sozinha quando a
    // concorrente também já estiver concluída.
    const id = await reserva();
    const quando = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id },
      select: { inicio: true, fim: true },
    });

    await cancelarComoAdmin({ reservaId: id, operador });

    const outra = await criarReservaNaRecepcao({
      salaId,
      telefone: "+5511900007778",
      nomeCliente: "ZZ Outro Cliente",
      profissaoId: await idDaProfissao("OUTROS"),
      inicio: quando.inicio,
      fim: quando.fim,
      operador,
    });

    if (!outra.ok) throw new Error("a segunda reserva deveria caber");

    const feito = await mudarStatusComoAdmin({
      reservaId: id,
      mudanca: "DESFAZER_CANCELAMENTO",
      operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria desfazer");
    expect(feito.falha.codigo).toBe("HORARIO_TOMADO");
    expect(feito.falha.motivo).toContain("ZZ Outro Cliente");

    // A reserva cancelada continua cancelada: a recusa não é só mensagem.
    const linha = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    expect(linha.status).toBe("CANCELADA");

    await bancoDeTeste.reserva.delete({ where: { id: outra.dados.id } });
    await bancoDeTeste.telefoneDoCliente.deleteMany({
      where: { telefone: "+5511900007778" },
    });
  });
});

describe("excluir, e a evidência que fica", () => {
  it("apaga a reserva e grava a ação com o retrato dela", async () => {
    const id = await reserva();

    const feito = await excluirReserva({
      reservaId: id,
      motivo: "lançada na sala errada",
      operador,
    });

    expect(feito.ok).toBe(true);

    // A reserva sumiu mesmo.
    expect(
      await bancoDeTeste.reserva.findUnique({ where: { id } }),
    ).toBeNull();

    // E a prova ficou.
    const acoes = await listarAcoes({ tipo: TipoDeAcao.RESERVA_EXCLUIDA });
    const nossa = acoes.find((acao) => acao.dados.reservaId === id);

    expect(nossa).toBeDefined();
    expect(nossa?.resumo).toContain(NOME);
    expect(nossa?.motivo).toBe("lançada na sala errada");
    // O nome vai GRAVADO: o usuário pode ser desligado, e a evidência não
    // pode virar "alguém fez isso".
    expect(nossa?.usuarioNome).toBe("Recepção de Teste");
    expect(nossa?.dados.telefone).toBe(TELEFONE);
    expect(nossa?.dados.dia).toBeTruthy();
  });

  it("exige motivo escrito", async () => {
    const id = await reserva();

    for (const motivo of ["", "   ", "ab"]) {
      const feito = await excluirReserva({ reservaId: id, motivo, operador });
      expect(feito.ok).toBe(false);
    }

    // E não apagou nada pelo caminho.
    expect(await bancoDeTeste.reserva.findUnique({ where: { id } })).not.toBeNull();
  });

  it("o BANCO também exige o motivo na ação de exclusão", async () => {
    // Se um dia alguém gravar direto, a trava continua de pé.
    await expect(
      bancoDeTeste.acaoRegistrada.create({
        data: {
          tipo: TipoDeAcao.RESERVA_EXCLUIDA,
          resumo: "x",
          dados: {},
          usuarioId: operador.id,
          usuarioNome: operador.nome,
        },
      }),
    ).rejects.toThrow();
  });

  it("o horário fica LIVRE depois de excluir", async () => {
    // O gatilho do banco tira a linha de ocupação sozinho. Sem isso a sala
    // ficaria presa a uma reserva que não existe mais.
    const id = await reserva();
    const quando = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id },
      select: { inicio: true, fim: true },
    });

    await excluirReserva({ reservaId: id, motivo: "duplicada", operador });

    const outra = await criarReservaNaRecepcao({
      salaId,
      telefone: TELEFONE,
      nomeCliente: NOME,
      profissaoId: await idDaProfissao("OUTROS"),
      inicio: quando.inicio,
      fim: quando.fim,
      operador,
    });

    expect(outra.ok).toBe(true);
  });

  it("reserva que não existe dá NAO_ENCONTRADA, e não erro de servidor", async () => {
    const feito = await excluirReserva({
      reservaId: "01a00000-0000-7000-8000-000000000000",
      motivo: "qualquer coisa",
      operador,
    });

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("não deveria excluir");
    expect(feito.falha.codigo).toBe("NAO_ENCONTRADA");
  });
});

describe("toda mudança de status fica registrada nos DOIS lugares", () => {
  it("no histórico da reserva e no histórico geral", async () => {
    // Na reserva, para quem abre aquela reserva. No geral, para quem procura
    // "o que mexeram na agenda" sem abrir uma por uma.
    const id = await reserva();

    await mudarStatusComoAdmin({ reservaId: id, mudanca: "CONCLUIR", operador });

    const linha = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id },
      select: { historicoAlteracoes: true },
    });

    const historico = lerHistorico(linha.historicoAlteracoes);
    const mudanca = historico.find((item) => item.acao === "STATUS");

    expect(mudanca?.statusDe).toBe("CONFIRMADA");
    expect(mudanca?.statusPara).toBe("CONCLUIDA");

    const acoes = await listarAcoes({ tipo: TipoDeAcao.RESERVA_STATUS_ALTERADO });
    expect(acoes.some((acao) => acao.dados.reservaId === id)).toBe(true);
  });
});
