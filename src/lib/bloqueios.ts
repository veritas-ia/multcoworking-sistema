/**
 * BLOQUEIOS ADMINISTRATIVOS (Fase 9).
 *
 * Bloqueio e espaco ocupado puro, decisao do CLAUDE.md: ele NAO exige o
 * intervalo de 30 min. Uma reserva pode comecar no minuto exato em que um
 * bloqueio termina, e vice-versa. Quem garante isso e o gatilho do banco, que
 * grava o bloqueio com "periodo_com_intervalo" igual ao periodo real.
 *
 * O motivo do bloqueio e INTERNO. Nenhuma rota publica pode devolve-lo.
 *
 * Bloquear varias salas de uma vez (um feriado) cria um bloqueio por sala,
 * todos com o mesmo "grupoId", para poderem sair juntos depois.
 */
import { randomUUID } from "node:crypto";

import { StatusReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { ehConflitoDeHorario } from "@/lib/reservas";

export type Operador = { id: string; nome: string };

export type ReservaAfetada = {
  id: string;
  sala: string;
  nomeCliente: string;
  telefone: string;
  inicio: Date;
  fim: Date;
  status: StatusReserva;
};

export type FalhaDeBloqueio =
  | { codigo: "RESERVAS_NO_CAMINHO"; motivo: string; reservas: ReservaAfetada[] }
  | { codigo: "NAO_ENCONTRADO"; motivo: string }
  | { codigo: "REGRA"; motivo: string };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeBloqueio };

/**
 * Reservas ATIVAS que ocupam o periodo nas salas pedidas.
 *
 * Sao elas que impedem o bloqueio. Canceladas e concluidas nao atrapalham:
 * ja soltaram o horario.
 */
export async function reservasNoCaminho(entrada: {
  salaIds: string[];
  inicio: Date;
  fim: Date;
}): Promise<ReservaAfetada[]> {
  const reservas = await prisma.reserva.findMany({
    where: {
      salaId: { in: entrada.salaIds },
      status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
      inicio: { lt: entrada.fim },
      fim: { gt: entrada.inicio },
    },
    include: { sala: { select: { nome: true } } },
    orderBy: { inicio: "asc" },
  });

  return reservas.map((reserva) => ({
    id: reserva.id,
    sala: reserva.sala.nome,
    nomeCliente: reserva.nomeCliente,
    telefone: reserva.telefone,
    inicio: reserva.inicio,
    fim: reserva.fim,
    status: reserva.status,
  }));
}

export type BloqueioCriado = {
  grupoId: string;
  ids: string[];
  salas: string[];
};

/**
 * Cria o bloqueio em uma ou varias salas.
 *
 * Se houver reserva ativa no caminho, NAO cria nada e devolve a lista — a
 * equipe precisa cancelar ou remarcar cada uma antes. E tudo ou nada: bloquear
 * meio feriado seria pior do que nao bloquear.
 */
export async function criarBloqueio(entrada: {
  salaIds: string[];
  inicio: Date;
  fim: Date;
  motivo: string | null;
  operador: Operador;
}): Promise<Resultado<BloqueioCriado>> {
  if (entrada.salaIds.length === 0) {
    return { ok: false, falha: { codigo: "REGRA", motivo: "Escolha pelo menos uma sala." } };
  }

  if (entrada.fim <= entrada.inicio) {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "O fim precisa ser depois do início." },
    };
  }

  const atrapalham = await reservasNoCaminho({
    salaIds: entrada.salaIds,
    inicio: entrada.inicio,
    fim: entrada.fim,
  });

  if (atrapalham.length > 0) {
    return {
      ok: false,
      falha: {
        codigo: "RESERVAS_NO_CAMINHO",
        motivo:
          atrapalham.length === 1
            ? "Há 1 reserva neste período. Cancele ou remarque antes de bloquear."
            : `Há ${atrapalham.length} reservas neste período. Cancele ou remarque cada uma antes de bloquear.`,
        reservas: atrapalham,
      },
    };
  }

  const grupoId = randomUUID();

  try {
    const criados = await prisma.$transaction(
      entrada.salaIds.map((salaId) =>
        prisma.bloqueio.create({
          data: {
            salaId,
            inicio: entrada.inicio,
            fim: entrada.fim,
            motivo: entrada.motivo,
            grupoId,
            criadoPorId: entrada.operador.id,
          },
          include: { sala: { select: { nome: true } } },
        }),
      ),
    );

    return {
      ok: true,
      dados: {
        grupoId,
        ids: criados.map((bloqueio) => bloqueio.id),
        salas: criados.map((bloqueio) => bloqueio.sala.nome),
      },
    };
  } catch (erro: unknown) {
    // Rede de seguranca: entre a conferencia e a gravacao alguem pode ter
    // criado uma reserva. O banco e a palavra final.
    if (ehConflitoDeHorario(erro)) {
      return {
        ok: false,
        falha: {
          codigo: "RESERVAS_NO_CAMINHO",
          motivo:
            "Alguma coisa acabou de ocupar este período. Recarregue a agenda e tente de novo.",
          reservas: await reservasNoCaminho({
            salaIds: entrada.salaIds,
            inicio: entrada.inicio,
            fim: entrada.fim,
          }),
        },
      };
    }
    throw erro;
  }
}

/** Muda horario e motivo de um bloqueio. */
export async function editarBloqueio(entrada: {
  id: string;
  inicio: Date;
  fim: Date;
  motivo: string | null;
}): Promise<Resultado<{ id: string }>> {
  const bloqueio = await prisma.bloqueio.findUnique({ where: { id: entrada.id } });

  if (!bloqueio) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Bloqueio não encontrado." } };
  }

  if (entrada.fim <= entrada.inicio) {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "O fim precisa ser depois do início." },
    };
  }

  const atrapalham = await reservasNoCaminho({
    salaIds: [bloqueio.salaId],
    inicio: entrada.inicio,
    fim: entrada.fim,
  });

  if (atrapalham.length > 0) {
    return {
      ok: false,
      falha: {
        codigo: "RESERVAS_NO_CAMINHO",
        motivo: `Há ${atrapalham.length} ${atrapalham.length === 1 ? "reserva" : "reservas"} no novo período. Cancele ou remarque antes.`,
        reservas: atrapalham,
      },
    };
  }

  try {
    await prisma.bloqueio.update({
      where: { id: entrada.id },
      data: { inicio: entrada.inicio, fim: entrada.fim, motivo: entrada.motivo },
    });
  } catch (erro: unknown) {
    if (ehConflitoDeHorario(erro)) {
      return {
        ok: false,
        falha: {
          codigo: "RESERVAS_NO_CAMINHO",
          motivo: "Este período acabou de ser ocupado. Recarregue a agenda.",
          reservas: [],
        },
      };
    }
    throw erro;
  }

  return { ok: true, dados: { id: entrada.id } };
}

/** Apaga um bloqueio. O horario volta para a agenda na hora (gatilho do banco). */
export async function removerBloqueio(id: string): Promise<Resultado<{ removidos: number }>> {
  const bloqueio = await prisma.bloqueio.findUnique({ where: { id } });

  if (!bloqueio) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Bloqueio não encontrado." } };
  }

  await prisma.bloqueio.delete({ where: { id } });
  return { ok: true, dados: { removidos: 1 } };
}

/** Apaga o grupo inteiro — o feriado em todas as salas de uma vez. */
export async function removerGrupoDeBloqueios(
  grupoId: string,
): Promise<Resultado<{ removidos: number }>> {
  const { count } = await prisma.bloqueio.deleteMany({ where: { grupoId } });

  if (count === 0) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Bloqueio não encontrado." } };
  }

  return { ok: true, dados: { removidos: count } };
}

/** Quantos bloqueios existem no mesmo grupo — a tela usa para oferecer a escolha. */
export async function tamanhoDoGrupo(grupoId: string | null): Promise<number> {
  if (!grupoId) {
    return 1;
  }
  return prisma.bloqueio.count({ where: { grupoId } });
}
