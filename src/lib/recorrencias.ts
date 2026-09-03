/**
 * SERIES RECORRENTES (Fase 9).
 *
 * Uma serie ("toda terca e quarta, das 9 as 11, de setembro a outubro") vira
 * VARIAS reservas normais, cada uma ligada a Recorrencia que a originou.
 * Nao existe "reserva fantasma": tudo que aparece na agenda e uma reserva de
 * verdade, com as mesmas travas e as mesmas mensagens.
 *
 * Duas regras que parecem contraditorias, mas nao sao (decisao da Fase 9):
 *
 *   - a recepcao PODE lancar uma reserva AVULSA em dia fechado (um evento
 *     pontual que a equipe sabe que vai abrir);
 *   - mas uma SERIE PULA os dias fechados. Ninguem quer que uma serie de dois
 *     meses crie reservas em feriados e domingos automaticamente, com o
 *     cliente batendo numa porta trancada.
 *
 * Ocorrencia que esbarra em horario ocupado tambem e pulada — nunca derruba
 * a serie inteira. No fim sai um relatorio dizendo o que entrou e o que ficou
 * de fora, com o motivo.
 */
import { FrequenciaRecorrencia, OrigemReserva, StatusReserva } from "@/generated/prisma/enums";
import {
  datasDaSerie,
  type Frequencia,
  type SemanaDoMes,
} from "@/lib/datas-recorrencia";
import { calcularValor, validarReserva } from "@/lib/disponibilidade";
import { historicoCom } from "@/lib/historico-reserva";
import { prisma } from "@/lib/prisma";
import { ehConflitoDeHorario } from "@/lib/reservas";
import { diaDaSemanaDe, instanteDe, minutosEntre } from "@/lib/tempo";

export type Operador = { id: string; nome: string };

export type OcorrenciaPulada = {
  data: string;
  motivo: string;
  /** Para a tela agrupar: "DIA_FECHADO" ou "CONFLITO". */
  tipo: "DIA_FECHADO" | "CONFLITO";
};

export type RelatorioDaSerie = {
  recorrenciaId: string;
  criadas: { id: string; data: string }[];
  puladas: OcorrenciaPulada[];
};

export type FalhaDaSerie = { codigo: "REGRA"; motivo: string };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDaSerie };

/** Quais dias da semana o coworking abre. Uma consulta so, reaproveitada. */
async function diasAbertos(): Promise<Set<number>> {
  const horarios = await prisma.horarioFuncionamento.findMany({ where: { aberto: true } });
  return new Set(horarios.map((horario) => horario.diaDaSemana));
}

export async function criarSerie(entrada: {
  salaId: string;
  telefone: string;
  nomeCliente: string;
  horaInicio: string;
  horaFim: string;
  diasDaSemana: number[];
  frequencia: Frequencia;
  semanaDoMes?: SemanaDoMes | null;
  dataInicio: string;
  dataFim: string;
  operador: Operador;
}): Promise<Resultado<RelatorioDaSerie>> {
  if (entrada.diasDaSemana.length === 0) {
    return { ok: false, falha: { codigo: "REGRA", motivo: "Escolha pelo menos um dia da semana." } };
  }

  if (entrada.dataFim < entrada.dataInicio) {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "A data final precisa ser depois da inicial." },
    };
  }

  if (entrada.frequencia === "MENSAL" && !entrada.semanaDoMes) {
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: "Na repetição mensal, escolha qual semana do mês (primeira, segunda, terceira ou última).",
      },
    };
  }

  if (entrada.horaFim <= entrada.horaInicio) {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "O horário de término precisa ser depois do de início." },
    };
  }

  const datas = datasDaSerie({
    diasDaSemana: entrada.diasDaSemana,
    frequencia: entrada.frequencia,
    semanaDoMes: entrada.semanaDoMes,
    dataInicio: entrada.dataInicio,
    dataFim: entrada.dataFim,
  });

  if (datas.length === 0) {
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: "Nenhuma data cai nesse período com essa repetição. Confira os dias e as datas.",
      },
    };
  }

  const abertos = await diasAbertos();

  const recorrencia = await prisma.recorrencia.create({
    data: {
      salaId: entrada.salaId,
      nomeCliente: entrada.nomeCliente,
      telefone: entrada.telefone,
      diasDaSemana: entrada.diasDaSemana,
      horaInicio: entrada.horaInicio,
      horaFim: entrada.horaFim,
      frequencia: entrada.frequencia as FrequenciaRecorrencia,
      semanaDoMes: entrada.frequencia === "MENSAL" ? (entrada.semanaDoMes ?? null) : null,
      dataInicio: new Date(`${entrada.dataInicio}T00:00:00.000Z`),
      dataFim: new Date(`${entrada.dataFim}T00:00:00.000Z`),
      criadoPorId: entrada.operador.id,
    },
    select: { id: true },
  });

  const criadas: { id: string; data: string }[] = [];
  const puladas: OcorrenciaPulada[] = [];
  const agora = new Date();

  for (const data of datas) {
    if (!abertos.has(diaDaSemanaDe(data))) {
      puladas.push({ data, tipo: "DIA_FECHADO", motivo: "o coworking não abre neste dia" });
      continue;
    }

    const inicio = instanteDe(data, entrada.horaInicio);
    const fim = instanteDe(data, entrada.horaFim);

    // Modo ADMIN: sem antecedencia minima e sem limite de duracao. A
    // sobreposicao e o intervalo de 30 min continuam valendo.
    const validacao = await validarReserva({
      salaId: entrada.salaId,
      inicio,
      fim,
      modo: "ADMIN",
    });

    if (!validacao.valido) {
      puladas.push({
        data,
        tipo: "CONFLITO",
        motivo: (validacao.motivo ?? "horário indisponível").replace(/\.$/, "").toLowerCase(),
      });
      continue;
    }

    try {
      const valor = await calcularValor(entrada.salaId, inicio, fim);

      const reserva = await prisma.reserva.create({
        data: {
          salaId: entrada.salaId,
          nomeCliente: entrada.nomeCliente,
          telefone: entrada.telefone,
          inicio,
          fim,
          duracaoMinutos: minutosEntre(inicio, fim),
          valor,
          status: StatusReserva.CONFIRMADA,
          origem: OrigemReserva.ADMIN,
          recorrenciaId: recorrencia.id,
          historicoAlteracoes: historicoCom([], {
            em: agora.toISOString(),
            acao: "CRIADA",
            por: "ADMIN",
            quemId: entrada.operador.id,
            quemNome: entrada.operador.nome,
          }),
        },
        select: { id: true },
      });

      criadas.push({ id: reserva.id, data });
    } catch (erro: unknown) {
      // Uma ocorrencia que esbarra em algo NUNCA derruba a serie inteira.
      if (ehConflitoDeHorario(erro)) {
        puladas.push({ data, tipo: "CONFLITO", motivo: "horário já ocupado" });
        continue;
      }
      throw erro;
    }
  }

  return { ok: true, dados: { recorrenciaId: recorrencia.id, criadas, puladas } };
}

/**
 * Cancela a serie inteira: todas as ocorrencias ATIVAS que ainda nao
 * comecaram. O que ja passou fica no historico como esteve.
 */
export async function cancelarSerie(entrada: {
  recorrenciaId: string;
  operador: Operador;
}): Promise<Resultado<{ canceladas: number; telefone: string | null }>> {
  const recorrencia = await prisma.recorrencia.findUnique({
    where: { id: entrada.recorrenciaId },
    select: { id: true, telefone: true },
  });

  if (!recorrencia) {
    return { ok: false, falha: { codigo: "REGRA", motivo: "Série não encontrada." } };
  }

  const agora = new Date();

  const futuras = await prisma.reserva.findMany({
    where: {
      recorrenciaId: recorrencia.id,
      status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
      inicio: { gt: agora },
    },
    select: { id: true, historicoAlteracoes: true, salaId: true, inicio: true, fim: true, valor: true },
  });

  for (const reserva of futuras) {
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
          de: {
            salaId: reserva.salaId,
            inicio: reserva.inicio.toISOString(),
            fim: reserva.fim.toISOString(),
            valor: reserva.valor.toFixed(2),
          },
        }),
      },
    });
  }

  await prisma.recorrencia.update({
    where: { id: recorrencia.id },
    data: { ativa: false },
  });

  return {
    ok: true,
    dados: { canceladas: futuras.length, telefone: recorrencia.telefone },
  };
}

/** Dados da serie, para a tela perguntar "só esta ou a série inteira?". */
export async function resumoDaSerie(recorrenciaId: string) {
  const recorrencia = await prisma.recorrencia.findUnique({
    where: { id: recorrenciaId },
    include: { sala: { select: { nome: true } } },
  });

  if (!recorrencia) {
    return null;
  }

  const agora = new Date();

  const [total, futurasAtivas] = await Promise.all([
    prisma.reserva.count({ where: { recorrenciaId } }),
    prisma.reserva.count({
      where: {
        recorrenciaId,
        status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
        inicio: { gt: agora },
      },
    }),
  ]);

  return { recorrencia, total, futurasAtivas };
}
