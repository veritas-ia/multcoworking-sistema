/**
 * ROTINAS AUTOMATICAS (Fase 10).
 *
 * Quatro coisas acontecem sozinhas, sem ninguem clicar:
 *   1. lembrete 13 HORAS antes da reserva;
 *   2. lembrete 3 HORAS antes;
 *   3. convite para avaliar, 1 HORA DEPOIS do termino;
 *   4. marcar como CONCLUIDA quem ja terminou.
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
import type { Prisma } from "@/generated/prisma/client";
import { ChaveTemplate, OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dataAmigavelDe, horaLocalDe } from "@/lib/tempo";
import { lerLinkDeAvaliacao } from "@/lib/templates-admin";
import { enviarMensagem, type VariaveisMensagem } from "@/lib/whatsapp";

/** Quantas horas antes cada lembrete sai. Decisao do dono na Fase 10. */
export const HORAS_DO_PRIMEIRO_LEMBRETE = 13;
export const HORAS_DO_SEGUNDO_LEMBRETE = 3;

/** Quanto tempo DEPOIS do termino sai o convite para avaliar. */
export const HORAS_ATE_A_AVALIACAO = 1;

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
        data: dataAmigavelDe(reserva.inicio),
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
// 2b. Convite para avaliar, 1 hora DEPOIS do termino
// -----------------------------------------------------------------------------

/**
 * Convite para avaliar, uma hora depois de a reserva terminar.
 *
 * TRES DIFERENCAS em relacao aos lembretes, todas de proposito:
 *
 *   1. olha para o TERMINO, e nao para o inicio;
 *
 *   2. aceita QUALQUER status menos CANCELADA — e precisa ser assim. Uma hora
 *      depois do termino a reserva ja e CONCLUIDA, porque a rotina de marcar
 *      concluidas roda na mesma passada e mudou o status quase uma hora antes.
 *      Filtrar por CONFIRMADA/REAGENDADA aqui faria a consulta nunca achar
 *      nada, e ninguem receberia a mensagem — sem erro nenhum aparecer;
 *
 *   3. sem o link do Google cadastrado, a rotina NAO FAZ NADA: nao envia e
 *      nem marca. Pedir avaliacao sem dizer onde avaliar so gasta a paciencia
 *      do cliente. No dia em que o link for preenchido, as reservas antigas
 *      ja estarao fora da janela e viram "nao aplicavel" — ninguem leva uma
 *      enxurrada de convites atrasados.
 */
export async function avaliacaoPosUso(agora = new Date()): Promise<ResultadoDaRotina> {
  const link = await lerLinkDeAvaliacao();

  if (link === "") {
    return { enviados: 0, naoAplicaveis: 0, falhas: 0 };
  }

  // A reserva precisa ter terminado ha HORAS_ATE_A_AVALIACAO, com a folga.
  const alvo = maisMinutos(agora, -HORAS_ATE_A_AVALIACAO * 60);
  const de = maisMinutos(alvo, -JANELA_MINUTOS);
  const ate = maisMinutos(alvo, JANELA_MINUTOS);

  let enviados = 0;
  let falhas = 0;

  const candidatas = await prisma.reserva.findMany({
    where: {
      status: { not: StatusReserva.CANCELADA },
      fim: { gte: de, lte: ate },
      avaliacaoEnviadaEm: null,
      avaliacaoNaoAplicavel: false,
    },
    include: { sala: { select: { nome: true } } },
  });

  for (const reserva of candidatas) {
    // MARCAR PRIMEIRO, como nos lembretes: o "count" diz se fomos nos que
    // marcamos. Quem nao marcou, nao manda.
    const { count } = await prisma.reserva.updateMany({
      where: { id: reserva.id, avaliacaoEnviadaEm: null },
      data: { avaliacaoEnviadaEm: agora },
    });

    if (count === 0) {
      continue;
    }

    const resultado = await enviarMensagem({
      chave: ChaveTemplate.avaliacao_pos_uso,
      telefone: reserva.telefone,
      reservaId: reserva.id,
      variaveis: {
        nome: reserva.nomeCliente,
        sala: reserva.sala.nome,
        data: dataAmigavelDe(reserva.inicio),
        link,
      },
    });

    if (resultado.enviada || resultado.simulada) {
      enviados += 1;
    } else {
      falhas += 1;
    }
  }

  // --- as que terminaram ha tempo demais: marcar "nao aplicavel" ---
  //
  // Sem isto, ligar o agendador depois de um tempo desligado dispararia
  // convite atrasado para tudo que ja passou — e a rotina reavaliaria essas
  // reservas a cada cinco minutos, para sempre.
  const { count: naoAplicaveis } = await prisma.reserva.updateMany({
    where: {
      status: { not: StatusReserva.CANCELADA },
      fim: { lt: de },
      avaliacaoEnviadaEm: null,
      avaliacaoNaoAplicavel: false,
    },
    data: { avaliacaoNaoAplicavel: true },
  });

  return { enviados, naoAplicaveis, falhas };
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
  avaliacao: ResultadoDaRotina;
  concluidas: number;
};

/** Tudo que roda de 5 em 5 minutos. */

// -----------------------------------------------------------------------------
// 5. Confirmacao agrupada
// -----------------------------------------------------------------------------

/**
 * Quanto tempo esperar, depois da ULTIMA reserva do telefone, antes de mandar
 * a confirmacao.
 *
 * A janela e DESLIZANTE: cada reserva nova reinicia a contagem. E isso que
 * mantem a leva inteira — quem marca as 10:00, 10:02 e 10:04 recebe UMA
 * mensagem as 10:07, com as tres, e nao tres mensagens soltas.
 */
export const MINUTOS_PARA_AGRUPAR = 3;

/**
 * A CONFIRMACAO DE QUEM MARCOU VARIAS RESERVAS SEGUIDAS, NUMA MENSAGEM SO.
 *
 * O site reserva uma de cada vez: quem quer tres passa pelo fluxo tres vezes.
 * Antes isso virava tres mensagens, cada uma com um valor, e o cliente nunca
 * via o total. Agora a confirmacao espera a poeira baixar e sai somada.
 *
 * SO VALE PARA O SITE. A recepcao continua confirmando na hora, uma por
 * reserva: ali o cliente costuma estar no balcao e a equipe confirma na
 * frente dele.
 *
 * O QUE ESTA ROTINA NAO TOCA: os lembretes de 13h e 3h continuam individuais,
 * um por reserva no dia de cada uma, e a mensagem de cancelamento tambem —
 * cancelar a reserva do dia 20 nao pode dizer que cancelou as outras.
 */
export async function confirmacoesAgrupadas(
  agora = new Date(),
): Promise<ResultadoDaRotina> {
  const limite = maisMinutos(agora, -MINUTOS_PARA_AGRUPAR);

  const pendentes = await prisma.reserva.findMany({
    where: {
      confirmacaoEnviadaEm: null,
      // So o site. A recepcao ja confirmou na hora.
      origem: OrigemReserva.PUBLICO,
      status: { in: ATIVAS },
    },
    include: { sala: { select: { nome: true } } },
    orderBy: { inicio: "asc" },
  });

  const porTelefone = new Map<string, typeof pendentes>();

  for (const reserva of pendentes) {
    porTelefone.set(reserva.telefone, [
      ...(porTelefone.get(reserva.telefone) ?? []),
      reserva,
    ]);
  }

  let enviados = 0;
  let falhas = 0;

  for (const [telefone, reservas] of porTelefone) {
    // A janela ainda esta aberta se a reserva MAIS RECENTE deste telefone tem
    // menos de 3 minutos. Nesse caso a pessoa pode estar marcando outra agora.
    const maisRecente = Math.max(...reservas.map((r) => r.criadoEm.getTime()));

    if (maisRecente > limite.getTime()) {
      continue;
    }

    // MARCAR PRIMEIRO, MANDAR DEPOIS. O "count" diz quantas conseguimos
    // marcar: se outro tick chegou antes, ele volta 0 e nao mandamos nada.
    const { count } = await prisma.reserva.updateMany({
      where: { id: { in: reservas.map((r) => r.id) }, confirmacaoEnviadaEm: null },
      data: { confirmacaoEnviadaEm: agora },
    });

    if (count === 0) {
      continue;
    }

    const resultado = await enviarUmaConfirmacao(telefone, reservas);

    if (resultado.enviada || resultado.simulada) {
      enviados += 1;
    } else {
      falhas += 1;
    }
  }

  return { enviados, naoAplicaveis: 0, falhas };
}

/** Uma reserva usa o texto de sempre; varias, o texto somado. */
async function enviarUmaConfirmacao(
  telefone: string,
  reservas: { id: string; nomeCliente: string; inicio: Date; fim: Date; valor: Prisma.Decimal; sala: { nome: string } }[],
) {
  const primeira = reservas[0]!;
  const nome = primeira.nomeCliente;

  if (reservas.length === 1) {
    return enviarMensagem({
      chave: ChaveTemplate.reserva_confirmada,
      telefone,
      reservaId: primeira.id,
      variaveis: {
        nome,
        sala: primeira.sala.nome,
        data: dataAmigavelDe(primeira.inicio),
        inicio: horaLocalDe(primeira.inicio),
        fim: horaLocalDe(primeira.fim),
        valor: emReaisPorExtenso(somarValores(reservas)),
      },
    });
  }

  return enviarMensagem({
    chave: ChaveTemplate.reservas_confirmadas,
    telefone,
    // A mensagem fala de varias reservas; o registro fica preso a PRIMEIRA
    // so para nao se perder. Amarrar a uma unica nao faria sentido, e repetir
    // o mesmo log em todas inflaria o historico.
    reservaId: primeira.id,
    variaveis: variaveisDaConfirmacaoAgrupada(reservas),
  });
}

/**
 * As variaveis da mensagem de varias reservas: quantidade, lista e TOTAL.
 *
 * Separada para poder ser conferida sozinha. O numero que importa aqui e o
 * total somado — e ele que o cliente nao via antes, e e o unico que, se
 * sair errado, sai errado em silencio: a mensagem continua bonita.
 */
export function variaveisDaConfirmacaoAgrupada(
  reservas: { nomeCliente: string; inicio: Date; fim: Date; valor: Prisma.Decimal; sala: { nome: string } }[],
): VariaveisMensagem {
  return {
    nome: reservas[0]!.nomeCliente,
    quantidade: String(reservas.length),
    lista: reservas
      .map(
        (r) =>
          `• ${dataAmigavelDe(r.inicio)}, ${horaLocalDe(r.inicio)} às ${horaLocalDe(r.fim)} — ${r.sala.nome}`,
      )
      .join("\n"),
    valor: emReaisPorExtenso(somarValores(reservas)),
    link: linkDasReservas(),
  };
}

/** Soma em CENTAVOS: somar reais em ponto flutuante acumula diferenca. */
function somarValores(reservas: { valor: Prisma.Decimal }[]): number {
  return reservas.reduce(
    (soma, reserva) => soma + Math.round(Number(reserva.valor) * 100),
    0,
  );
}

function emReaisPorExtenso(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

export async function passadaDeRotina(agora = new Date()): Promise<ResumoDaPassada> {
  return {
    lembrete13h: await lembrete13h(agora),
    lembrete3h: await lembrete3h(agora),
    // A avaliacao roda ANTES de marcar concluidas so por clareza de leitura;
    // a ordem nao muda o resultado, porque ela aceita CONCLUIDA tambem.
    avaliacao: await avaliacaoPosUso(agora),
    concluidas: (await marcarConcluidas(agora)).concluidas,
  };
}
