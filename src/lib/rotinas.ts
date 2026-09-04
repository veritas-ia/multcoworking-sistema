/**
 * ROTINAS AUTOMATICAS (Fase 10).
 *
 * Tres coisas acontecem sozinhas, sem ninguem clicar:
 *   1. lembrete 13 HORAS antes da reserva;
 *   2. lembrete 3 HORAS antes;
 *   3. marcar como CONCLUIDA quem ja terminou.
 * Mais uma faxina diaria de dados vencidos.
 *
 * IDEMPOTENCIA — a parte que importa
 * ----------------------------------
 * "Ler, mandar, marcar" e errado: se o servidor reiniciar entre o mandar e o
 * marcar, o cliente leva a mensagem duas vezes. Aqui a ordem e MARCAR PRIMEIRO,
 * MANDAR DEPOIS, e a marcacao e um UPDATE condicional que so o primeiro
 * consegue aplicar ("... WHERE lembrete_13h_enviado_em IS NULL"). Quem nao
 * conseguiu marcar, nao manda. Dois ticks ao mesmo tempo nao se atropelam.
 *
 * O preco: se o envio falhar depois da marcacao, aquele lembrete nao sai. E a
 * troca certa — o CLAUDE.md manda enviar NO MAXIMO uma vez, entao na duvida e
 * melhor faltar do que repetir. A falha fica registrada em LogMensagem.
 */
import { ChaveTemplate, StatusReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dataLocalDe, horaLocalDe } from "@/lib/tempo";
import { enviarMensagem } from "@/lib/whatsapp";

/** Quantas horas antes cada lembrete sai. Decisao do dono na Fase 10. */
export const HORAS_DO_PRIMEIRO_LEMBRETE = 13;
export const HORAS_DO_SEGUNDO_LEMBRETE = 3;

/**
 * Folga de 15 minutos para cada lado.
 *
 * A rotina roda de 5 em 5 minutos, entao a janela precisa ser maior do que o
 * intervalo — senao uma reserva poderia cair entre duas passadas e nunca ser
 * vista. Com 30 minutos de janela e passadas de 5, cada reserva e vista uma
 * meia duzia de vezes; a marcacao condicional garante que so a primeira manda.
 */
export const JANELA_MINUTOS = 15;

const ATIVAS = [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA];

export type ResultadoDaRotina = {
  enviados: number;
  naoAplicaveis: number;
  falhas: number;
};

type Lembrete = {
  horas: number;
  chave: ChaveTemplate;
  campoEnviado: "lembrete13hEnviadoEm" | "lembrete3hEnviadoEm";
  campoNaoAplicavel: "lembrete13hNaoAplicavel" | "lembrete3hNaoAplicavel";
};

const LEMBRETE_13H: Lembrete = {
  horas: HORAS_DO_PRIMEIRO_LEMBRETE,
  chave: ChaveTemplate.lembrete_13h,
  campoEnviado: "lembrete13hEnviadoEm",
  campoNaoAplicavel: "lembrete13hNaoAplicavel",
};

const LEMBRETE_3H: Lembrete = {
  horas: HORAS_DO_SEGUNDO_LEMBRETE,
  chave: ChaveTemplate.lembrete_3h,
  campoEnviado: "lembrete3hEnviadoEm",
  campoNaoAplicavel: "lembrete3hNaoAplicavel",
};

/** O endereco da area "Minhas reservas", para o cliente cancelar ou remarcar. */
export function linkDasReservas(): string {
  const base = process.env.APP_URL?.trim().replace(/\/+$/, "") || "http://localhost:3000";
  return `${base}/minhas-reservas`;
}

function maisMinutos(instante: Date, minutos: number): Date {
  return new Date(instante.getTime() + minutos * 60_000);
}

// -----------------------------------------------------------------------------
// 1 e 2. Lembretes
// -----------------------------------------------------------------------------

async function rodarLembrete(
  lembrete: Lembrete,
  agora: Date,
): Promise<ResultadoDaRotina> {
  const alvo = maisMinutos(agora, lembrete.horas * 60);
  const de = maisMinutos(alvo, -JANELA_MINUTOS);
  const ate = maisMinutos(alvo, JANELA_MINUTOS);

  let enviados = 0;
  let falhas = 0;

  // --- as que estao na janela agora ---
  const candidatas = await prisma.reserva.findMany({
    where: {
      status: { in: ATIVAS },
      inicio: { gte: de, lte: ate },
      [lembrete.campoEnviado]: null,
      [lembrete.campoNaoAplicavel]: false,
    },
    include: { sala: { select: { nome: true } } },
  });

  for (const reserva of candidatas) {
    // MARCAR PRIMEIRO. O "count" diz se fomos nos que marcamos: se outro tick
    // (ou outro processo) chegou antes, ele volta 0 e a gente nao manda nada.
    const { count } = await prisma.reserva.updateMany({
      where: { id: reserva.id, [lembrete.campoEnviado]: null },
      data: { [lembrete.campoEnviado]: agora },
    });

    if (count === 0) {
      continue;
    }

    const resultado = await enviarMensagem({
      chave: lembrete.chave,
      telefone: reserva.telefone,
      reservaId: reserva.id,
      variaveis: {
        nome: reserva.nomeCliente,
        sala: reserva.sala.nome,
        data: dataLocalDe(reserva.inicio),
        inicio: horaLocalDe(reserva.inicio),
        fim: horaLocalDe(reserva.fim),
        link: linkDasReservas(),
      },
    });

    if (resultado.enviada || resultado.simulada) {
      enviados += 1;
    } else {
      falhas += 1;
    }
  }

  // --- as que perderam a hora: marcar "nao aplicavel" ---
  //
  // Reserva criada tarde demais (a recepcao pode lancar para daqui a 30 min,
  // ou ate no passado). O lembrete nunca vai poder sair; sem marcar, a rotina
  // reavaliaria essa reserva para sempre.
  const { count: naoAplicaveis } = await prisma.reserva.updateMany({
    where: {
      status: { in: ATIVAS },
      inicio: { lt: de },
      [lembrete.campoEnviado]: null,
      [lembrete.campoNaoAplicavel]: false,
    },
    data: { [lembrete.campoNaoAplicavel]: true },
  });

  return { enviados, naoAplicaveis, falhas };
}

export function lembrete13h(agora = new Date()): Promise<ResultadoDaRotina> {
  return rodarLembrete(LEMBRETE_13H, agora);
}

export function lembrete3h(agora = new Date()): Promise<ResultadoDaRotina> {
  return rodarLembrete(LEMBRETE_3H, agora);
}

// -----------------------------------------------------------------------------
// 3. Marcar concluidas
// -----------------------------------------------------------------------------

/**
 * Reserva ativa cujo horario de termino ja passou vira CONCLUIDA.
 *
 * Um UPDATE so, sem laco: nao ha mensagem para enviar, entao nao existe o
 * risco de "marcou mas nao mandou". Rodar duas vezes seguidas nao muda nada,
 * porque a segunda nao encontra mais nenhuma ativa vencida.
 */
export async function marcarConcluidas(agora = new Date()): Promise<{ concluidas: number }> {
  const { count } = await prisma.reserva.updateMany({
    where: { status: { in: ATIVAS }, fim: { lte: agora } },
    data: { status: StatusReserva.CONCLUIDA },
  });

  return { concluidas: count };
}

// -----------------------------------------------------------------------------
// 4. Faxina
// -----------------------------------------------------------------------------

export type ResultadoDaFaxina = {
  codigos: number;
  sessoes: number;
  tentativasDeLogin: number;
};

/** Horas que um dado vencido ainda fica guardado antes de ser apagado. */
const CARENCIA_HORAS = 24;

/**
 * Apaga o que ja nao serve para nada.
 *
 * NAO mexe em LogMensagem de proposito: ainda esta em aberto se o texto das
 * mensagens sera guardado para auditoria (item 9 do AJUSTES-FASE-FINAL.md).
 * Apagar agora seria decidir isso por conta propria.
 */
export async function faxina(agora = new Date()): Promise<ResultadoDaFaxina> {
  const limite = maisMinutos(agora, -CARENCIA_HORAS * 60);

  const [codigos, sessoes, tentativas] = await Promise.all([
    // Codigos vencidos ou ja usados. Sao dados de acesso: nao ficam guardados.
    prisma.codigoVerificacao.deleteMany({
      where: {
        OR: [{ expiraEm: { lt: limite } }, { usadoEm: { lt: limite } }],
      },
    }),
    prisma.sessaoCliente.deleteMany({ where: { expiraEm: { lt: agora } } }),
    // A janela do bloqueio de login e de 15 min; o resto e peso morto.
    prisma.tentativaLogin.deleteMany({ where: { criadoEm: { lt: limite } } }),
  ]);

  return {
    codigos: codigos.count,
    sessoes: sessoes.count,
    tentativasDeLogin: tentativas.count,
  };
}

// -----------------------------------------------------------------------------
// A passada completa
// -----------------------------------------------------------------------------

export type ResumoDaPassada = {
  lembrete13h: ResultadoDaRotina;
  lembrete3h: ResultadoDaRotina;
  concluidas: number;
};

/** Tudo que roda de 5 em 5 minutos. */
export async function passadaDeRotina(agora = new Date()): Promise<ResumoDaPassada> {
  return {
    lembrete13h: await lembrete13h(agora),
    lembrete3h: await lembrete3h(agora),
    concluidas: (await marcarConcluidas(agora)).concluidas,
  };
}
