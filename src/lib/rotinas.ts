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
import {
  ChaveTemplate,
  OrigemReserva,
  StatusMensagem,
  StatusReserva,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { dataLocalDe, dataAmigavelDe, horaLocalDe, instanteDe } from "@/lib/tempo";
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

// -----------------------------------------------------------------------------
// Janela de silencio: nada de mensagem automatica de madrugada
// -----------------------------------------------------------------------------

export type JanelaDeMensagens = { inicial: number; final: number };

/** Os horarios da janela, do painel. Se sumirem do banco, vale 8h-21h. */
export async function lerJanelaDeMensagens(): Promise<JanelaDeMensagens> {
  const linhas = await prisma.configuracao.findMany({
    where: { chave: { in: ["mensagensHoraInicial", "mensagensHoraFinal"] } },
  });

  const valores = new Map(linhas.map((linha) => [linha.chave, Number(linha.valor)]));
  const inicial = valores.get("mensagensHoraInicial");
  const final = valores.get("mensagensHoraFinal");

  return {
    inicial: Number.isInteger(inicial) ? inicial! : 8,
    final: Number.isInteger(final) ? final! : 21,
  };
}

/** Soma dias a uma data "AAAA-MM-DD", sem depender do fuso do aparelho. */
function somarDiasNaData(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const base = new Date(Date.UTC(ano!, mes! - 1, dia!));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** A hora do relogio de Sao Paulo, como numero: "02:30" -> 2. */
function horaCheiaDe(instante: Date): number {
  return Number(horaLocalDe(instante).slice(0, 2));
}

/**
 * O instante em que o LEMBRETE pode sair, respeitando a janela de silencio.
 *
 * Se o horario ideal cai de madrugada, o lembrete e ANTECIPADO para o ultimo
 * minuto permitido antes dele — nunca adiado.
 *
 * O motivo e concreto: adiar o lembrete de 3h de uma reserva das 8h para as
 * 8h da manha entregaria o aviso no instante em que a reserva comeca. Aviso
 * que chega depois nao e aviso. Antecipar sempre chega antes.
 *
 * Medido em producao antes desta regra existir: o lembrete de 13h de uma
 * reserva das 15h caia as 2h da manha, e 38 dos 53 lembretes ja enviados
 * tinham saido fora de hora.
 */
export function momentoDoLembrete(
  ideal: Date,
  janela: JanelaDeMensagens,
): Date {
  const hora = horaCheiaDe(ideal);

  if (hora >= janela.inicial && hora < janela.final) {
    return ideal;
  }

  const dia = dataLocalDe(ideal);
  const horaFinal = `${String(janela.final - 1).padStart(2, "0")}:59`;

  // Depois do fechamento da janela: recua para o fim da janela do MESMO dia.
  // Antes da abertura: recua para o fim da janela do dia ANTERIOR.
  return hora >= janela.final
    ? instanteDe(dia, horaFinal)
    : instanteDe(somarDiasNaData(dia, -1), horaFinal);
}

/**
 * O instante em que o CONVITE PARA AVALIAR pode sair.
 *
 * Aqui a direcao e a contraria da dos lembretes: o convite e ADIADO para a
 * abertura da janela seguinte. Nao da para convidar alguem a avaliar a sala
 * antes de a pessoa ter usado.
 */
export function momentoDaAvaliacao(ideal: Date, janela: JanelaDeMensagens): Date {
  const hora = horaCheiaDe(ideal);

  if (hora >= janela.inicial && hora < janela.final) {
    return ideal;
  }

  const dia = dataLocalDe(ideal);
  const horaInicial = `${String(janela.inicial).padStart(2, "0")}:00`;

  // Antes da abertura: espera abrir no MESMO dia. Depois do fechamento:
  // espera a abertura do dia SEGUINTE.
  return hora < janela.inicial
    ? instanteDe(dia, horaInicial)
    : instanteDe(somarDiasNaData(dia, 1), horaInicial);
}

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
  const janela = await lerJanelaDeMensagens();

  let enviados = 0;
  let falhas = 0;
  let perderamAHora = 0;

  // A busca olha MAIS LONGE do que as 13h do lembrete, porque um lembrete que
  // cairia de madrugada e antecipado para a noite anterior — ou seja, sai
  // quando a reserva ainda esta a quase um dia de distancia.
  const candidatas = await prisma.reserva.findMany({
    where: {
      status: { in: ATIVAS },
      inicio: { gt: agora, lte: maisMinutos(agora, (lembrete.horas + 24) * 60) },
      [lembrete.campoEnviado]: null,
      [lembrete.campoNaoAplicavel]: false,
    },
    include: { sala: { select: { nome: true } } },
  });

  for (const reserva of candidatas) {
    const momento = momentoDoLembrete(
      maisMinutos(reserva.inicio, -lembrete.horas * 60),
      janela,
    );

    // Ainda nao chegou a hora deste lembrete.
    if (agora < maisMinutos(momento, -JANELA_MINUTOS)) {
      continue;
    }

    // Passou da hora: reserva criada tarde demais, ou o sistema ficou fora do
    // ar na hora certa. Marcar impede a rotina de reavaliar isto para sempre.
    if (agora > maisMinutos(momento, JANELA_MINUTOS)) {
      const { count: tarde } = await prisma.reserva.updateMany({
        where: {
          id: reserva.id,
          [lembrete.campoEnviado]: null,
          [lembrete.campoNaoAplicavel]: false,
        },
        data: { [lembrete.campoNaoAplicavel]: true },
      });

      perderamAHora += tarde;
      continue;
    }

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

  // --- as que ja comecaram: marcar "nao aplicavel" ---
  //
  // Reserva criada tarde demais (a recepcao pode lancar para daqui a 30 min,
  // ou ate no passado). O lembrete nunca vai poder sair; sem marcar, a rotina
  // reavaliaria essa reserva para sempre.
  const { count: jaComecaram } = await prisma.reserva.updateMany({
    where: {
      status: { in: ATIVAS },
      inicio: { lte: agora },
      [lembrete.campoEnviado]: null,
      [lembrete.campoNaoAplicavel]: false,
    },
    data: { [lembrete.campoNaoAplicavel]: true },
  });

  return { enviados, naoAplicaveis: perderamAHora + jaComecaram, falhas };
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

  const janela = await lerJanelaDeMensagens();

  // A reserva precisa ter terminado ha HORAS_ATE_A_AVALIACAO. A busca olha
  // MAIS PARA TRAS do que isso, porque um convite que cairia de madrugada e
  // ADIADO para a manha seguinte — e ai a reserva ja terminou faz horas.
  const alvo = maisMinutos(agora, -HORAS_ATE_A_AVALIACAO * 60);
  const de = maisMinutos(alvo, -24 * 60);

  let enviados = 0;
  let falhas = 0;
  let perderamAHora = 0;

  const candidatas = await prisma.reserva.findMany({
    where: {
      status: { not: StatusReserva.CANCELADA },
      fim: { gte: de, lte: maisMinutos(alvo, JANELA_MINUTOS) },
      avaliacaoEnviadaEm: null,
      avaliacaoNaoAplicavel: false,
    },
    include: { sala: { select: { nome: true } } },
  });

  let naoAplicaveisPorRepeticao = 0;

  for (const reserva of candidatas) {
    const momento = momentoDaAvaliacao(
      maisMinutos(reserva.fim, HORAS_ATE_A_AVALIACAO * 60),
      janela,
    );

    // Ainda nao chegou a hora: o termino caiu de madrugada e o convite espera
    // a janela abrir. Convidar alguem a avaliar as 23h so gasta paciencia.
    if (agora < maisMinutos(momento, -JANELA_MINUTOS)) {
      continue;
    }

    // Passou da hora: o sistema ficou fora do ar, ou a reserva e antiga
    // demais. Convite atrasado demais nao faz sentido e so confunde.
    if (agora > maisMinutos(momento, JANELA_MINUTOS)) {
      const { count: tarde } = await prisma.reserva.updateMany({
        where: {
          id: reserva.id,
          avaliacaoEnviadaEm: null,
          avaliacaoNaoAplicavel: false,
        },
        data: { avaliacaoNaoAplicavel: true },
      });

      perderamAHora += tarde;
      continue;
    }

    // UMA VEZ POR CLIENTE, NA VIDA TODA (decisao do dono, 23/10/2026).
    //
    // Ate aqui a regra era uma vez por RESERVA, e quem usa o coworking toda
    // semana juntou 14 convites para avaliar no Google. Convite demais vira
    // incomodo e o cliente para de ler as mensagens do coworking.
    //
    // So conta envio que DEU CERTO: se a mensagem falhou, a pessoa nunca a
    // recebeu, e tirar a proxima chance dela por causa de uma falha nossa
    // seria perder o convite sem ninguem perceber.
    const jaRecebeu = await prisma.logMensagem.findFirst({
      where: {
        telefone: reserva.telefone,
        tipo: ChaveTemplate.avaliacao_pos_uso,
        status: StatusMensagem.ENVIADA,
      },
      select: { id: true },
    });

    if (jaRecebeu) {
      // "Nao aplicavel", e nao "enviada": a mensagem nunca vai sair para esta
      // reserva, e marcar assim impede a rotina de reconferir toda passada.
      const { count: marcadas } = await prisma.reserva.updateMany({
        where: { id: reserva.id, avaliacaoEnviadaEm: null, avaliacaoNaoAplicavel: false },
        data: { avaliacaoNaoAplicavel: true },
      });

      naoAplicaveisPorRepeticao += marcadas;
      continue;
    }

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

  // As tres contagens entram juntas: as que perderam a hora, as antigas
  // demais e as que o cliente ja tinha recebido o convite antes.
  return {
    enviados,
    naoAplicaveis: naoAplicaveis + naoAplicaveisPorRepeticao + perderamAHora,
    falhas,
  };
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
