/**
 * OS NUMEROS DO RELATORIO (Dashboard do painel).
 *
 * SO LEITURA. Nada aqui grava, apaga ou altera reserva — o dashboard responde
 * perguntas, nao mexe na agenda.
 *
 * SEM DINHEIRO. Por decisao do dono, nenhuma funcao daqui devolve valor,
 * receita ou faturamento. A reserva guarda o valor no banco; a conta e nunca
 * deixar esse campo sair para o relatorio, e nao apenas escondê-lo na tela.
 *
 * POR QUE OS AGRUPAMENTOS SAO FEITOS AQUI, E NAO NO BANCO
 *
 * O banco guarda tudo em UTC (regra do CLAUDE.md). Agrupar por dia direto no
 * SQL faria uma reserva de segunda-feira as 21h aparecer como TERCA no
 * relatorio — tres horas de diferenca, e ninguem entenderia por que o
 * relatorio discorda da agenda. Aqui cada reserva e convertida para o relogio
 * de Sao Paulo antes de ser contada, com as mesmas funcoes que a agenda usa.
 *
 * O volume e pequeno (um coworking com poucas salas), entao trazer as
 * reservas do periodo e contar em memoria custa menos do que a confusao que
 * um fuso errado causaria.
 */
import { StatusReserva } from "@/generated/prisma/enums";
import type { CategoriaProfissao } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { PROFISSOES, rotuloDaProfissao } from "@/lib/profissoes";
import {
  dataLocalDe,
  diaDaSemanaDe,
  horaLocalDe,
  instanteDe,
  type DataLocal,
} from "@/lib/tempo";

/** Um periodo fechado, com os dois extremos INCLUSIVOS. */
export type Periodo = { de: DataLocal; ate: DataLocal };

export type Fatia = { rotulo: string; total: number };
export type FatiaColorida = Fatia & { cor: string };
export type PontoNoTempo = { data: DataLocal; total: number };
export type BarraDoDia = { diaDaSemana: number; rotulo: string; total: number };

export type Relatorio = {
  periodo: Periodo;
  /** Quantas reservas tem horario dentro do periodo, em qualquer situacao. */
  total: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  porDia: PontoNoTempo[];
  porDiaDaSemana: BarraDoDia[];
  porHora: Fatia[];
  porProfissao: Fatia[];
};

export type Comparacao = {
  atual: Relatorio;
  anterior: Relatorio;
  /** Diferenca percentual do total. Nulo quando o periodo anterior foi zero. */
  variacaoPercentual: number | null;
  variacaoAbsoluta: number;
};

export const NOMES_DOS_DIAS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

const NOMES_DOS_STATUS: Record<string, string> = {
  CONFIRMADA: "Confirmadas",
  REAGENDADA: "Remarcadas",
  CANCELADA: "Canceladas",
  CONCLUIDA: "Concluídas",
};

// -----------------------------------------------------------------------------
// Datas
// -----------------------------------------------------------------------------

/** Soma dias a uma data "AAAA-MM-DD", sem depender do fuso do aparelho. */
export function somarDias(data: DataLocal, dias: number): DataLocal {
  const [ano, mes, dia] = data.split("-").map(Number);
  const base = new Date(Date.UTC(ano!, mes! - 1, dia!));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Quantos dias o periodo cobre, contando os dois extremos. */
export function diasNoPeriodo(periodo: Periodo): number {
  const [a1, m1, d1] = periodo.de.split("-").map(Number);
  const [a2, m2, d2] = periodo.ate.split("-").map(Number);
  const de = Date.UTC(a1!, m1! - 1, d1!);
  const ate = Date.UTC(a2!, m2! - 1, d2!);
  return Math.floor((ate - de) / 86_400_000) + 1;
}

/**
 * O periodo IMEDIATAMENTE anterior, do mesmo tamanho.
 *
 * "Este mes contra o anterior" com meses de tamanhos diferentes compararia 31
 * dias com 28 e diria que fevereiro caiu 10%. Aqui o periodo de comparacao
 * tem sempre o MESMO numero de dias, colado antes do atual.
 */
export function periodoAnterior(periodo: Periodo): Periodo {
  const dias = diasNoPeriodo(periodo);
  return {
    de: somarDias(periodo.de, -dias),
    ate: somarDias(periodo.de, -1),
  };
}

// -----------------------------------------------------------------------------
// A consulta
// -----------------------------------------------------------------------------

/** So o que o relatorio precisa. Nenhum campo de dinheiro sai daqui. */
type ReservaContada = {
  inicio: Date;
  status: StatusReserva;
  profissao: CategoriaProfissao | null;
  sala: { nome: string; cor: string };
};

async function reservasDoPeriodo(periodo: Periodo): Promise<ReservaContada[]> {
  return prisma.reserva.findMany({
    where: {
      // Do primeiro instante do primeiro dia ate o ultimo do ultimo, no
      // relogio de Sao Paulo.
      inicio: {
        gte: instanteDe(periodo.de, "00:00"),
        lt: instanteDe(somarDias(periodo.ate, 1), "00:00"),
      },
    },
    // Lista fechada: o "valor" da reserva NAO entra no relatorio.
    select: {
      inicio: true,
      status: true,
      profissao: true,
      sala: { select: { nome: true, cor: true } },
    },
    orderBy: { inicio: "asc" },
  });
}

// -----------------------------------------------------------------------------
// As contagens
// -----------------------------------------------------------------------------

function contarPorSala(reservas: ReservaContada[]): FatiaColorida[] {
  const mapa = new Map<string, { total: number; cor: string }>();

  for (const reserva of reservas) {
    const atual = mapa.get(reserva.sala.nome);
    mapa.set(reserva.sala.nome, {
      total: (atual?.total ?? 0) + 1,
      cor: reserva.sala.cor,
    });
  }

  return [...mapa.entries()]
    .map(([rotulo, dados]) => ({ rotulo, total: dados.total, cor: dados.cor }))
    .sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function contarPorStatus(reservas: ReservaContada[]): Fatia[] {
  const mapa = new Map<string, number>();

  for (const reserva of reservas) {
    mapa.set(reserva.status, (mapa.get(reserva.status) ?? 0) + 1);
  }

  // Ordem fixa, e nao por tamanho: a equipe le sempre na mesma sequencia, e
  // uma barra que troca de lugar a cada filtro atrapalha a comparacao.
  return Object.keys(NOMES_DOS_STATUS)
    .map((status) => ({
      rotulo: NOMES_DOS_STATUS[status] ?? status,
      total: mapa.get(status) ?? 0,
    }))
    .filter((fatia) => fatia.total > 0);
}

/**
 * Um ponto por DIA do periodo, inclusive os dias sem nenhuma reserva.
 *
 * Os dias vazios entram de proposito: sem eles a linha do grafico "pula" o
 * feriado e o domingo, e o desenho sugere movimento onde nao houve nenhum.
 */
function contarPorDia(reservas: ReservaContada[], periodo: Periodo): PontoNoTempo[] {
  const mapa = new Map<DataLocal, number>();

  for (const reserva of reservas) {
    const dia = dataLocalDe(reserva.inicio);
    mapa.set(dia, (mapa.get(dia) ?? 0) + 1);
  }

  const pontos: PontoNoTempo[] = [];

  for (let dia = periodo.de; dia <= periodo.ate; dia = somarDias(dia, 1)) {
    pontos.push({ data: dia, total: mapa.get(dia) ?? 0 });
  }

  return pontos;
}

function contarPorDiaDaSemana(reservas: ReservaContada[]): BarraDoDia[] {
  const totais = new Array<number>(7).fill(0);

  for (const reserva of reservas) {
    totais[diaDaSemanaDe(dataLocalDe(reserva.inicio))] += 1;
  }

  return totais.map((total, diaDaSemana) => ({
    diaDaSemana,
    rotulo: NOMES_DOS_DIAS[diaDaSemana]!,
    total,
  }));
}

function contarPorHora(reservas: ReservaContada[]): Fatia[] {
  const mapa = new Map<string, number>();

  for (const reserva of reservas) {
    // Agrupa pela HORA cheia: "09:30" e "09:00" contam juntos como "09h".
    const hora = `${horaLocalDe(reserva.inicio).slice(0, 2)}h`;
    mapa.set(hora, (mapa.get(hora) ?? 0) + 1);
  }

  return [...mapa.entries()]
    .map(([rotulo, total]) => ({ rotulo, total }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo));
}

function contarPorProfissao(reservas: ReservaContada[]): Fatia[] {
  const mapa = new Map<string, number>();

  for (const reserva of reservas) {
    const rotulo = rotuloDaProfissao(reserva.profissao);
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + 1);
  }

  // Ordem fixa das opcoes, com "Não informado" por ultimo — ele nao e uma
  // area de atuacao, e so a marca das reservas anteriores ao campo.
  const emOrdem = PROFISSOES.map((opcao) => opcao.rotulo);

  return [...mapa.entries()]
    .map(([rotulo, total]) => ({ rotulo, total }))
    .sort((a, b) => {
      const posicaoA = emOrdem.indexOf(a.rotulo);
      const posicaoB = emOrdem.indexOf(b.rotulo);
      return (
        (posicaoA === -1 ? 99 : posicaoA) - (posicaoB === -1 ? 99 : posicaoB)
      );
    });
}

// -----------------------------------------------------------------------------
// Montagem
// -----------------------------------------------------------------------------

export async function montarRelatorio(periodo: Periodo): Promise<Relatorio> {
  const reservas = await reservasDoPeriodo(periodo);

  return {
    periodo,
    total: reservas.length,
    porSala: contarPorSala(reservas),
    porStatus: contarPorStatus(reservas),
    porDia: contarPorDia(reservas, periodo),
    porDiaDaSemana: contarPorDiaDaSemana(reservas),
    porHora: contarPorHora(reservas),
    porProfissao: contarPorProfissao(reservas),
  };
}

/**
 * O periodo pedido e o de comparacao, lado a lado.
 *
 * A variacao percentual e NULA quando o periodo anterior nao teve nenhuma
 * reserva: "aumentou infinito por cento" nao diz nada a ninguem, e a tela
 * prefere escrever "sem base de comparacao".
 */
export async function compararPeriodos(
  periodo: Periodo,
  comparacao?: Periodo,
): Promise<Comparacao> {
  const anteriorPedido = comparacao ?? periodoAnterior(periodo);

  const [atual, anterior] = await Promise.all([
    montarRelatorio(periodo),
    montarRelatorio(anteriorPedido),
  ]);

  const variacaoAbsoluta = atual.total - anterior.total;

  return {
    atual,
    anterior,
    variacaoAbsoluta,
    variacaoPercentual:
      anterior.total === 0
        ? null
        : Math.round((variacaoAbsoluta / anterior.total) * 1000) / 10,
  };
}
