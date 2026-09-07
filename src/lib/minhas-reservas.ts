/**
 * ACOES DO CLIENTE SOBRE AS PROPRIAS RESERVAS (Fase 6).
 *
 * Regras do CLAUDE.md aplicadas aqui, sempre no servidor:
 *  - o cliente so enxerga e so mexe nas reservas do telefone que ele provou;
 *  - cancelar e reagendar exigem mais de 12h de antecedencia (configuravel);
 *  - reagendar mantem a MESMA reserva (mesmo id), muda o horario, marca
 *    REAGENDADA, guarda o historico e zera os lembretes;
 *  - cancelar libera o horario na hora (quem faz isso e o gatilho do banco).
 *
 * O codigo novo do WhatsApp NAO e conferido aqui: quem confere e a rota,
 * antes de chamar estas funcoes. Assim este arquivo cuida so da agenda.
 */
import { Prisma } from "@/generated/prisma/client";
import { StatusReserva } from "@/generated/prisma/enums";
import { calcularValor, carregarParametros, validarReserva } from "@/lib/disponibilidade";
import { historicoCom } from "@/lib/historico-reserva";
import { prisma } from "@/lib/prisma";
import { ehConflitoDeHorario } from "@/lib/reservas";
import { minutosEntre } from "@/lib/tempo";

/** Status que ainda podem ser mexidos pelo cliente. */
const ATIVOS: readonly StatusReserva[] = [
  StatusReserva.CONFIRMADA,
  StatusReserva.REAGENDADA,
];

export type MotivoFalha =
  | "NAO_ENCONTRADA"
  | "JA_ENCERRADA"
  | "FORA_DO_PRAZO"
  | "NOVO_HORARIO_FORA_DO_PRAZO"
  | "HORARIO_TOMADO"
  | "REGRA";

export type Falha = { codigo: MotivoFalha; motivo: string };

export type ResultadoAcao<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

export type ReservaNaLista = {
  id: string;
  salaId: string;
  sala: string;
  inicio: Date;
  fim: Date;
  valor: string;
  status: StatusReserva;
  /** Da para cancelar/reagendar agora? Ja considera prazo e status. */
  podeAlterar: boolean;
};

/** Horas de antecedencia que o cliente precisa ter para mexer sozinho. */
export async function janelaDeAlteracaoHoras(): Promise<number> {
  return (await carregarParametros()).janelaCancelamentoHoras;
}

/**
 * Falta mais do que a janela para o inicio?
 *
 * O CLAUDE.md diz "mais de 12h": exatamente 12h NAO basta. A conta e sobre o
 * INICIO da reserva, no instante universal — nao depende de fuso.
 */
export function dentroDoPrazo(
  inicio: Date,
  janelaHoras: number,
  agora: Date,
): boolean {
  return inicio.getTime() - agora.getTime() > janelaHoras * 60 * 60 * 1_000;
}

/**
 * As reservas do telefone: futuras ativas primeiro (da mais proxima para a
 * mais distante), depois o historico (mais recente primeiro).
 *
 * O telefone vem SEMPRE da sessao de quem chamou. Nao existe jeito de pedir
 * as reservas de outra pessoa: nao ha parametro para isso.
 */
export async function listarDoTelefone(telefone: string): Promise<{
  futuras: ReservaNaLista[];
  historico: ReservaNaLista[];
  janelaHoras: number;
}> {
  const agora = new Date();
  const janelaHoras = await janelaDeAlteracaoHoras();

  const reservas = await prisma.reserva.findMany({
    where: { telefone },
    include: { sala: { select: { nome: true } } },
    orderBy: { inicio: "asc" },
  });

  const futuras: ReservaNaLista[] = [];
  const historico: ReservaNaLista[] = [];

  for (const reserva of reservas) {
    const ativa = ATIVOS.includes(reserva.status);
    const noFuturo = reserva.inicio > agora;

    const item: ReservaNaLista = {
      id: reserva.id,
      salaId: reserva.salaId,
      sala: reserva.sala.nome,
      inicio: reserva.inicio,
      fim: reserva.fim,
      valor: reserva.valor.toFixed(2),
      status: reserva.status,
      podeAlterar: ativa && dentroDoPrazo(reserva.inicio, janelaHoras, agora),
    };

    if (ativa && noFuturo) {
      futuras.push(item);
    } else {
      historico.push(item);
    }
  }

  // Historico ao contrario: o que terminou por ultimo aparece primeiro.
  historico.reverse();

  return { futuras, historico, janelaHoras };
}

type ReservaDoCliente = Prisma.ReservaGetPayload<{
  include: { sala: { select: { nome: true } } };
}>;

/**
 * Busca a reserva garantindo que ela e de quem esta pedindo.
 *
 * Reserva inexistente e reserva de outra pessoa devolvem EXATAMENTE a mesma
 * resposta. Se fossem diferentes, daria para descobrir quais identificadores
 * existem testando um por um.
 */
async function buscarDoDono(
  reservaId: string,
  telefone: string,
): Promise<ReservaDoCliente | null> {
  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: { sala: { select: { nome: true } } },
  });

  if (!reserva || reserva.telefone !== telefone) {
    return null;
  }

  return reserva;
}

const NAO_ENCONTRADA: Falha = {
  codigo: "NAO_ENCONTRADA",
  motivo: "Reserva não encontrada.",
};

/** Confere dono, status e prazo — a checagem comum das duas acoes. */
async function reservaAlteravel(
  reservaId: string,
  telefone: string,
): Promise<ResultadoAcao<{ reserva: ReservaDoCliente; janelaHoras: number }>> {
  const reserva = await buscarDoDono(reservaId, telefone);

  if (!reserva) {
    return { ok: false, falha: NAO_ENCONTRADA };
  }

  if (!ATIVOS.includes(reserva.status)) {
    return {
      ok: false,
      falha: {
        codigo: "JA_ENCERRADA",
        motivo:
          reserva.status === StatusReserva.CANCELADA
            ? "Esta reserva já foi cancelada."
            : "Esta reserva já foi concluída.",
      },
    };
  }

  const janelaHoras = await janelaDeAlteracaoHoras();

  if (!dentroDoPrazo(reserva.inicio, janelaHoras, new Date())) {
    return {
      ok: false,
      falha: {
        codigo: "FORA_DO_PRAZO",
        motivo: `Faltam menos de ${janelaHoras} horas para o início. Fale com a recepção pelo WhatsApp.`,
      },
    };
  }

  return { ok: true, dados: { reserva, janelaHoras } };
}

// -----------------------------------------------------------------------------
// Cancelar
// -----------------------------------------------------------------------------

export type ReservaCancelada = {
  id: string;
  sala: string;
  inicio: Date;
  fim: Date;
  nomeCliente: string;
};

/**
 * Cancela a reserva. O valor NAO e recalculado: cancelamento nao mexe em preco.
 *
 * O horario e liberado na mesma transacao pelo gatilho do PostgreSQL, que
 * apaga a linha de ocupacao assim que o status deixa de ser ativo.
 */
export async function cancelarReserva(entrada: {
  reservaId: string;
  telefone: string;
}): Promise<ResultadoAcao<ReservaCancelada>> {
  const conferencia = await reservaAlteravel(entrada.reservaId, entrada.telefone);

  if (!conferencia.ok) {
    return conferencia;
  }

  const { reserva } = conferencia.dados;
  const agora = new Date();

  await prisma.reserva.update({
    where: { id: reserva.id },
    data: {
      status: StatusReserva.CANCELADA,
      canceladoEm: agora,
      historicoAlteracoes: historicoCom(reserva.historicoAlteracoes, {
        em: agora.toISOString(),
        acao: "CANCELADA",
        por: "CLIENTE",
        de: {
          salaId: reserva.salaId,
          inicio: reserva.inicio.toISOString(),
          fim: reserva.fim.toISOString(),
          valor: reserva.valor.toFixed(2),
        },
      }),
    },
  });

  return {
    ok: true,
    dados: {
      id: reserva.id,
      sala: reserva.sala.nome,
      inicio: reserva.inicio,
      fim: reserva.fim,
      nomeCliente: reserva.nomeCliente,
    },
  };
}

// -----------------------------------------------------------------------------
// Reagendar
// -----------------------------------------------------------------------------

export type ReservaReagendada = {
  id: string;
  sala: string;
  inicio: Date;
  fim: Date;
  /** Valor RECALCULADO com o preco atual da sala. */
  valor: string;
  nomeCliente: string;
};

/**
 * Move a reserva para outro horario, podendo trocar de sala.
 *
 * Continua sendo a MESMA reserva (mesmo id), agora marcada como REAGENDADA.
 *
 * Sobre o valor: e recalculado com o preco ATUAL da sala. A regra do "valor
 * congelado" do CLAUDE.md protege quem NAO mexeu na reserva contra aumento de
 * preco; quem remarca — trocando de sala ou de duracao — esta fazendo um
 * acordo novo. (Decisao confirmada com o dono do projeto na Fase 6.)
 */
export async function reagendarReserva(entrada: {
  reservaId: string;
  telefone: string;
  salaId: string;
  inicio: Date;
  fim: Date;
}): Promise<ResultadoAcao<ReservaReagendada>> {
  const conferencia = await reservaAlteravel(entrada.reservaId, entrada.telefone);

  if (!conferencia.ok) {
    return conferencia;
  }

  const { reserva, janelaHoras } = conferencia.dados;

  // O horario NOVO tambem precisa estar a mais de 12h — regra do CLAUDE.md.
  if (!dentroDoPrazo(entrada.inicio, janelaHoras, new Date())) {
    return {
      ok: false,
      falha: {
        codigo: "NOVO_HORARIO_FORA_DO_PRAZO",
        motivo: `O novo horário também precisa estar a mais de ${janelaHoras} horas de agora.`,
      },
    };
  }

  // A propria reserva nao pode contar como horario ocupado, senao ela
  // brigaria consigo mesma ao andar poucos minutos.
  const validacao = await validarReserva({
    salaId: entrada.salaId,
    inicio: entrada.inicio,
    fim: entrada.fim,
    ignorarReservaId: reserva.id,
  });

  if (!validacao.valido) {
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: validacao.motivo ?? "Este horário não está disponível.",
      },
    };
  }

  // O numero de pessoas viaja com a reserva: remarcar nao e ocasiao de
  // perguntar de novo, e sem ele o preco de grupo sumiria no reagendamento.
  const valor = await calcularValor(entrada.salaId, entrada.inicio, entrada.fim, {
    pessoas: reserva.pessoas,
  });
  const agora = new Date();

  try {
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: {
        salaId: entrada.salaId,
        inicio: entrada.inicio,
        fim: entrada.fim,
        duracaoMinutos: minutosEntre(entrada.inicio, entrada.fim),
        valor,
        status: StatusReserva.REAGENDADA,
        // Lembretes zerados: eles passam a valer para o horario novo.
        lembrete13hEnviadoEm: null,
        lembrete3hEnviadoEm: null,
        lembrete13hNaoAplicavel: false,
        lembrete3hNaoAplicavel: false,
        historicoAlteracoes: historicoCom(reserva.historicoAlteracoes, {
          em: agora.toISOString(),
          acao: "REAGENDADA",
          por: "CLIENTE",
          de: {
            salaId: reserva.salaId,
            inicio: reserva.inicio.toISOString(),
            fim: reserva.fim.toISOString(),
            valor: reserva.valor.toFixed(2),
          },
          para: {
            salaId: entrada.salaId,
            inicio: entrada.inicio.toISOString(),
            fim: entrada.fim.toISOString(),
            valor: valor.toFixed(2),
          },
        }),
      },
    });
  } catch (erro: unknown) {
    if (ehConflitoDeHorario(erro)) {
      return {
        ok: false,
        falha: {
          codigo: "HORARIO_TOMADO",
          motivo: "Este horário acabou de ser reservado. Escolha outro, por favor.",
        },
      };
    }
    throw erro;
  }

  const sala = await prisma.sala.findUnique({
    where: { id: entrada.salaId },
    select: { nome: true },
  });

  return {
    ok: true,
    dados: {
      id: reserva.id,
      sala: sala?.nome ?? "",
      inicio: entrada.inicio,
      fim: entrada.fim,
      valor: valor.toFixed(2),
      nomeCliente: reserva.nomeCliente,
    },
  };
}

/**
 * Esta reserva e mesmo deste telefone?
 *
 * Usada pelas rotas de grade no reagendamento. E preciso conferir o dono
 * ANTES de ignorar a reserva na grade: sem isso, qualquer pessoa poderia
 * mandar um identificador qualquer e, vendo um horario "abrir", descobrir
 * a que reserva aquele identificador pertence.
 */
export async function ehDonoDaReserva(
  reservaId: string,
  telefone: string,
): Promise<boolean> {
  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    select: { telefone: true },
  });

  return reserva?.telefone === telefone;
}
