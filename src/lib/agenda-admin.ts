/**
 * AGENDA DA RECEPCAO (Fase 8).
 *
 * O que muda em relacao ao cliente do site:
 *  - a recepcao NAO tem limite de 3 reservas por telefone;
 *  - NAO precisa de codigo do WhatsApp;
 *  - pode lancar no passado, sem antecedencia minima e com qualquer duracao;
 *  - pode cancelar e reagendar DENTRO das 12h.
 *
 * O que continua igual para todo mundo, sem excecao:
 *  - nao sobrepor reservas na mesma sala;
 *  - respeitar os 30 min de intervalo entre reservas;
 *  - respeitar o expediente do dia.
 * Essas tres sao integridade da agenda, nao politica comercial — e a ultima
 * palavra sobre elas e do proprio PostgreSQL (travas da Fase 2).
 *
 * Toda acao daqui grava no historico QUEM fez e QUANDO.
 */
import { Prisma } from "@/generated/prisma/client";
import { OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import {
  calcularValor,
  validarReserva,
  type ResultadoValidacao,
} from "@/lib/disponibilidade";
import { historicoCom, type Momento } from "@/lib/historico-reserva";
import { prisma } from "@/lib/prisma";
import { ehConflitoDeHorario } from "@/lib/reservas";
import { minutosEntre } from "@/lib/tempo";

/** Quem esta operando o painel. Vai para o historico de cada acao. */
export type Operador = { id: string; nome: string };

export type FalhaAdmin =
  | { codigo: "NAO_ENCONTRADA"; motivo: string }
  | { codigo: "JA_ENCERRADA"; motivo: string }
  | { codigo: "HORARIO_TOMADO"; motivo: string }
  | { codigo: "REGRA"; motivo: string };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaAdmin };

const ATIVOS: readonly StatusReserva[] = [
  StatusReserva.CONFIRMADA,
  StatusReserva.REAGENDADA,
];

/**
 * Traduz a recusa do motor numa falha do painel.
 *
 * Choque de horario nao e "regra quebrada", e CONFLITO com o que ja existe na
 * agenda — merece 409 e a mesma mensagem que a area publica usa. Achatar tudo
 * em 422 faria a tela dizer "horario invalido" quando o certo e "alguem chegou
 * antes".
 */
function falhaDaValidacao(validacao: ResultadoValidacao): FalhaAdmin {
  const motivo = validacao.motivo ?? "Horário inválido.";

  if (
    validacao.codigo === "HORARIO_OCUPADO" ||
    validacao.codigo === "INTERVALO_ENTRE_RESERVAS"
  ) {
    return { codigo: "HORARIO_TOMADO", motivo };
  }

  return { codigo: "REGRA", motivo };
}

function momentoDe(reserva: {
  salaId: string;
  inicio: Date;
  fim: Date;
  valor: Prisma.Decimal;
}): Momento {
  return {
    salaId: reserva.salaId,
    inicio: reserva.inicio.toISOString(),
    fim: reserva.fim.toISOString(),
    valor: reserva.valor.toFixed(2),
  };
}

// -----------------------------------------------------------------------------
// Leitura da agenda
// -----------------------------------------------------------------------------

export type ReservaNaAgenda = {
  tipo: "RESERVA";
  id: string;
  salaId: string;
  sala: string;
  inicio: Date;
  fim: Date;
  status: StatusReserva;
  origem: OrigemReserva;
  nomeCliente: string;
  /** Telefone COMPLETO. Isto e area protegida — o CLAUDE.md permite aqui. */
  telefone: string;
  valor: string;
};

export type BloqueioNaAgenda = {
  tipo: "BLOQUEIO";
  id: string;
  salaId: string;
  sala: string;
  inicio: Date;
  fim: Date;
  motivo: string | null;
};

export type ItemDaAgenda = ReservaNaAgenda | BloqueioNaAgenda;

/**
 * Tudo que ocupa a agenda entre dois instantes.
 *
 * Traz reservas CANCELADAS e CONCLUIDAS tambem: no painel a equipe precisa ver
 * o historico do dia, nao so o que esta de pe. A tela distingue pela cor.
 *
 * Bloqueios entram para serem EXIBIDOS. Cria-los e a Fase 9.
 */
export async function itensDaAgenda(entrada: {
  de: Date;
  ate: Date;
  salaId?: string;
}): Promise<ItemDaAgenda[]> {
  const janela = { inicio: { lt: entrada.ate }, fim: { gt: entrada.de } };
  const daSala = entrada.salaId ? { salaId: entrada.salaId } : {};

  const [reservas, bloqueios] = await Promise.all([
    prisma.reserva.findMany({
      where: { ...janela, ...daSala },
      include: { sala: { select: { nome: true } } },
      orderBy: { inicio: "asc" },
    }),
    prisma.bloqueio.findMany({
      where: { ...janela, ...daSala },
      include: { sala: { select: { nome: true } } },
      orderBy: { inicio: "asc" },
    }),
  ]);

  const itens: ItemDaAgenda[] = [
    ...reservas.map(
      (reserva): ReservaNaAgenda => ({
        tipo: "RESERVA",
        id: reserva.id,
        salaId: reserva.salaId,
        sala: reserva.sala.nome,
        inicio: reserva.inicio,
        fim: reserva.fim,
        status: reserva.status,
        origem: reserva.origem,
        nomeCliente: reserva.nomeCliente,
        telefone: reserva.telefone,
        valor: reserva.valor.toFixed(2),
      }),
    ),
    ...bloqueios.map(
      (bloqueio): BloqueioNaAgenda => ({
        tipo: "BLOQUEIO",
        id: bloqueio.id,
        salaId: bloqueio.salaId,
        sala: bloqueio.sala.nome,
        inicio: bloqueio.inicio,
        fim: bloqueio.fim,
        motivo: bloqueio.motivo,
      }),
    ),
  ];

  return itens.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** Uma reserva com tudo, para o painel lateral. */
export async function reservaCompleta(reservaId: string) {
  return prisma.reserva.findUnique({
    where: { id: reservaId },
    include: { sala: { select: { id: true, nome: true } } },
  });
}

// -----------------------------------------------------------------------------
// Criar pela recepcao
// -----------------------------------------------------------------------------

export async function criarReservaNaRecepcao(entrada: {
  salaId: string;
  telefone: string;
  nomeCliente: string;
  inicio: Date;
  fim: Date;
  operador: Operador;
}): Promise<Resultado<{ id: string; sala: string; valor: string }>> {
  // Modo ADMIN: sem antecedencia minima, sem limite de duracao, pode no passado.
  const validacao = await validarReserva({
    salaId: entrada.salaId,
    inicio: entrada.inicio,
    fim: entrada.fim,
    modo: "ADMIN",
  });

  if (!validacao.valido) {
    return { ok: false, falha: falhaDaValidacao(validacao) };
  }

  const valor = await calcularValor(entrada.salaId, entrada.inicio, entrada.fim);
  const agora = new Date();

  try {
    // Sem trava por telefone: a recepcao nao tem limite de 3 reservas.
    const criada = await prisma.reserva.create({
      data: {
        salaId: entrada.salaId,
        nomeCliente: entrada.nomeCliente,
        telefone: entrada.telefone,
        inicio: entrada.inicio,
        fim: entrada.fim,
        duracaoMinutos: minutosEntre(entrada.inicio, entrada.fim),
        valor,
        status: StatusReserva.CONFIRMADA,
        origem: OrigemReserva.ADMIN,
        historicoAlteracoes: historicoCom([], {
          em: agora.toISOString(),
          acao: "CRIADA",
          por: "ADMIN",
          quemId: entrada.operador.id,
          quemNome: entrada.operador.nome,
        }),
      },
      include: { sala: { select: { nome: true } } },
    });

    return {
      ok: true,
      dados: { id: criada.id, sala: criada.sala.nome, valor: valor.toFixed(2) },
    };
  } catch (erro: unknown) {
    if (ehConflitoDeHorario(erro)) {
      return {
        ok: false,
        falha: {
          codigo: "HORARIO_TOMADO",
          motivo: "Este horário já está ocupado nesta sala.",
        },
      };
    }
    throw erro;
  }
}

// -----------------------------------------------------------------------------
// Editar cadastro (nome e telefone) — sem WhatsApp
// -----------------------------------------------------------------------------

export async function editarCadastro(entrada: {
  reservaId: string;
  nomeCliente: string;
  telefone: string;
  operador: Operador;
}): Promise<Resultado<{ id: string }>> {
  const reserva = await prisma.reserva.findUnique({ where: { id: entrada.reservaId } });

  if (!reserva) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Reserva não encontrada." } };
  }

  const camposEditados: string[] = [];
  if (reserva.nomeCliente !== entrada.nomeCliente) {
    camposEditados.push("nome");
  }
  if (reserva.telefone !== entrada.telefone) {
    camposEditados.push("telefone");
  }

  if (camposEditados.length === 0) {
    return { ok: true, dados: { id: reserva.id } };
  }

  await prisma.reserva.update({
    where: { id: reserva.id },
    data: {
      nomeCliente: entrada.nomeCliente,
      telefone: entrada.telefone,
      historicoAlteracoes: historicoCom(reserva.historicoAlteracoes, {
        em: new Date().toISOString(),
        acao: "EDITADA",
        por: "ADMIN",
        quemId: entrada.operador.id,
        quemNome: entrada.operador.nome,
        camposEditados,
      }),
    },
  });

  return { ok: true, dados: { id: reserva.id } };
}

// -----------------------------------------------------------------------------
// Cancelar — sem a trava de 12h
// -----------------------------------------------------------------------------

export type ReservaAfetada = {
  id: string;
  sala: string;
  inicio: Date;
  fim: Date;
  nomeCliente: string;
  telefone: string;
  valor: string;
};

export async function cancelarComoAdmin(entrada: {
  reservaId: string;
  operador: Operador;
}): Promise<Resultado<ReservaAfetada>> {
  const reserva = await prisma.reserva.findUnique({
    where: { id: entrada.reservaId },
    include: { sala: { select: { nome: true } } },
  });

  if (!reserva) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Reserva não encontrada." } };
  }

  if (!ATIVOS.includes(reserva.status)) {
    return {
      ok: false,
      falha: {
        codigo: "JA_ENCERRADA",
        motivo:
          reserva.status === StatusReserva.CANCELADA
            ? "Esta reserva já está cancelada."
            : "Esta reserva já foi concluída.",
      },
    };
  }

  const agora = new Date();

  // Nao ha checagem de 12h aqui: o CLAUDE.md diz que o admin cancela sempre.
  await prisma.reserva.update({
    where: { id: reserva.id },
    data: {
      status: StatusReserva.CANCELADA,
      canceladoEm: agora,
      historicoAlteracoes: historicoCom(reserva.historicoAlteracoes, {
        em: agora.toISOString(),
        acao: "CANCELADA",
        por: "ADMIN",
        quemId: entrada.operador.id,
        quemNome: entrada.operador.nome,
        de: momentoDe(reserva),
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
      telefone: reserva.telefone,
      valor: reserva.valor.toFixed(2),
    },
  };
}

// -----------------------------------------------------------------------------
// Reagendar — sem a trava de 12h
// -----------------------------------------------------------------------------

export async function reagendarComoAdmin(entrada: {
  reservaId: string;
  salaId: string;
  inicio: Date;
  fim: Date;
  operador: Operador;
}): Promise<Resultado<ReservaAfetada>> {
  const reserva = await prisma.reserva.findUnique({ where: { id: entrada.reservaId } });

  if (!reserva) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Reserva não encontrada." } };
  }

  if (!ATIVOS.includes(reserva.status)) {
    return {
      ok: false,
      falha: {
        codigo: "JA_ENCERRADA",
        motivo: "Só dá para remarcar uma reserva ativa.",
      },
    };
  }

  const validacao = await validarReserva({
    salaId: entrada.salaId,
    inicio: entrada.inicio,
    fim: entrada.fim,
    ignorarReservaId: reserva.id,
    modo: "ADMIN",
  });

  if (!validacao.valido) {
    return { ok: false, falha: falhaDaValidacao(validacao) };
  }

  // Mesma regra da Fase 6: remarcar recalcula o valor pelo preco atual.
  const valor = await calcularValor(entrada.salaId, entrada.inicio, entrada.fim);
  const agora = new Date();

  try {
    const atualizada = await prisma.reserva.update({
      where: { id: reserva.id },
      data: {
        salaId: entrada.salaId,
        inicio: entrada.inicio,
        fim: entrada.fim,
        duracaoMinutos: minutosEntre(entrada.inicio, entrada.fim),
        valor,
        status: StatusReserva.REAGENDADA,
        lembrete24hEnviadoEm: null,
        lembrete2hEnviadoEm: null,
        historicoAlteracoes: historicoCom(reserva.historicoAlteracoes, {
          em: agora.toISOString(),
          acao: "REAGENDADA",
          por: "ADMIN",
          quemId: entrada.operador.id,
          quemNome: entrada.operador.nome,
          de: momentoDe(reserva),
          para: {
            salaId: entrada.salaId,
            inicio: entrada.inicio.toISOString(),
            fim: entrada.fim.toISOString(),
            valor: valor.toFixed(2),
          },
        }),
      },
      include: { sala: { select: { nome: true } } },
    });

    return {
      ok: true,
      dados: {
        id: atualizada.id,
        sala: atualizada.sala.nome,
        inicio: atualizada.inicio,
        fim: atualizada.fim,
        nomeCliente: atualizada.nomeCliente,
        telefone: atualizada.telefone,
        valor: valor.toFixed(2),
      },
    };
  } catch (erro: unknown) {
    if (ehConflitoDeHorario(erro)) {
      return {
        ok: false,
        falha: {
          codigo: "HORARIO_TOMADO",
          motivo: "Este horário já está ocupado nesta sala.",
        },
      };
    }
    throw erro;
  }
}
