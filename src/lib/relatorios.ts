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
import { normalizarTelefone } from "@/lib/telefone";
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
  /** Ranking de horas usadas. Canceladas nao entram. */
  horasPorCliente: HorasDoCliente[];
};

/**
 * Quanto tempo um cliente usou no periodo.
 *
 * Agrupado pelo TELEFONE, nunca pelo nome: o telefone e o identificador unico
 * do sistema (formato internacional, validado na gravacao), enquanto a mesma
 * pessoa escreve o nome de formas diferentes a cada reserva — "Maria",
 * "Maria Silva", "maria silva". Agrupar por nome quebraria a soma dela em
 * varias linhas.
 */
export type HorasDoCliente = {
  telefone: string;
  /** O nome da reserva MAIS RECENTE dele no periodo. */
  nome: string;
  horas: number;
  reservas: number;
};

/** Uma reserva na lista do cliente escolhido. */
export type ReservaDoCliente = {
  data: DataLocal;
  sala: string;
  inicio: string;
  fim: string;
  duracaoHoras: number;
  status: string;
};

export type DetalheDoCliente = {
  periodo: Periodo;
  telefone: string;
  nome: string;
  /**
   * A area de atuacao mais usada por ele. A profissao fica na RESERVA, e nao
   * no cliente, entao quem marcou "Marketing" numa vez e "Outros" noutra nao
   * tem uma resposta unica: mostramos a mais frequente e avisamos.
   */
  profissao: string;
  profissaoDivergente: boolean;
  horas: number;
  /** Contando TODAS as situacoes, inclusive canceladas. */
  totalDeReservas: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  reservas: ReservaDoCliente[];
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

/**
 * So o que o relatorio precisa. Nenhum campo de dinheiro sai daqui.
 *
 * "valor" existe na tabela e NAO entra nesta lista, de proposito. E esta lista
 * que garante a decisao do dono de nao haver faturamento no relatorio — nao o
 * fato de a tela nao desenhar o numero. Ha teste procurando dinheiro dentro da
 * resposta da rota.
 */
type ReservaContada = {
  inicio: Date;
  fim: Date;
  status: StatusReserva;
  profissao: CategoriaProfissao | null;
  nomeCliente: string;
  telefone: string;
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
      fim: true,
      status: true,
      profissao: true,
      nomeCliente: true,
      telefone: true,
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
// Clientes
// -----------------------------------------------------------------------------

/**
 * As situacoes que contam como tempo USADO.
 *
 * Cancelada fica de fora: hora desmarcada nao e hora usada, e somá-la faria o
 * ranking premiar quem mais desmarca. REAGENDADA entra porque a reserva
 * continua de pe — so mudou de horario.
 */
const SITUACOES_QUE_CONTAM: StatusReserva[] = [
  StatusReserva.CONFIRMADA,
  StatusReserva.REAGENDADA,
  StatusReserva.CONCLUIDA,
];

function contouComoUso(reserva: ReservaContada): boolean {
  return SITUACOES_QUE_CONTAM.includes(reserva.status);
}

/** Duracao em horas, com meia hora valendo 0,5. */
function horasDe(reserva: ReservaContada): number {
  return (reserva.fim.getTime() - reserva.inicio.getTime()) / 3_600_000;
}

/** Arredonda para uma casa, para 1.5000000000000002 nao chegar na tela. */
function umaCasa(horas: number): number {
  return Math.round(horas * 10) / 10;
}

/**
 * Quantas horas cada cliente usou, do maior para o menor.
 *
 * As reservas ja vem ordenadas por inicio crescente, entao a ultima que o laco
 * encontra e a mais recente — e e dela que sai o nome mostrado.
 */
function somarHorasPorCliente(reservas: ReservaContada[]): HorasDoCliente[] {
  const mapa = new Map<string, { nome: string; horas: number; reservas: number }>();

  for (const reserva of reservas) {
    if (!contouComoUso(reserva)) {
      continue;
    }

    const atual = mapa.get(reserva.telefone);
    mapa.set(reserva.telefone, {
      nome: reserva.nomeCliente,
      horas: (atual?.horas ?? 0) + horasDe(reserva),
      reservas: (atual?.reservas ?? 0) + 1,
    });
  }

  return [...mapa.entries()]
    .map(([telefone, dados]) => ({
      telefone,
      nome: dados.nome,
      horas: umaCasa(dados.horas),
      reservas: dados.reservas,
    }))
    .sort(
      (a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/** A area de atuacao mais usada pelo cliente, e se houve mais de uma. */
function profissaoPredominante(
  reservas: ReservaContada[],
): { rotulo: string; divergente: boolean } {
  const contagem = new Map<string, number>();

  for (const reserva of reservas) {
    const rotulo = rotuloDaProfissao(reserva.profissao);
    contagem.set(rotulo, (contagem.get(rotulo) ?? 0) + 1);
  }

  if (contagem.size === 0) {
    return { rotulo: rotuloDaProfissao(null), divergente: false };
  }

  const ordenadas = [...contagem.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
  );

  return { rotulo: ordenadas[0]![0], divergente: contagem.size > 1 };
}

/**
 * Procura clientes por telefone ou por nome.
 *
 * O TELEFONE manda: se o que foi digitado vira um celular valido, a busca e
 * exata e devolve no maximo um cliente. Nome e auxiliar, porque dois clientes
 * podem se chamar igual — nesse caso devolve a lista e quem escolhe e a
 * equipe.
 *
 * So procura entre quem TEM reserva no periodo: o campo serve para filtrar o
 * relatorio, nao para vasculhar a base inteira.
 */
export async function procurarClientes(
  periodo: Periodo,
  termo: string,
): Promise<HorasDoCliente[]> {
  const procurado = termo.trim();

  if (procurado.length < 2) {
    return [];
  }

  const reservas = await reservasDoPeriodo(periodo);
  const telefone = normalizarTelefone(procurado);

  if (telefone) {
    return somarHorasPorCliente(
      reservas.filter((reserva) => reserva.telefone === telefone),
    );
  }

  // Busca por nome: sem diferenciar maiuscula nem acento, porque ninguem
  // digita "Joao" e "João" do mesmo jeito duas vezes seguidas.
  const alvo = semAcento(procurado);
  const encontrados = reservas.filter((reserva) =>
    semAcento(reserva.nomeCliente).includes(alvo),
  );

  // O ranking soma so o que contou como uso; um cliente que aparece no periodo
  // apenas com reserva cancelada sumiria da busca. Por isso ele e reposto aqui
  // com zero horas — a equipe precisa conseguir achar essa pessoa.
  const comHoras = somarHorasPorCliente(encontrados);
  const jaListados = new Set(comHoras.map((cliente) => cliente.telefone));

  for (const reserva of encontrados) {
    if (!jaListados.has(reserva.telefone)) {
      jaListados.add(reserva.telefone);
      comHoras.push({
        telefone: reserva.telefone,
        nome: reserva.nomeCliente,
        horas: 0,
        reservas: 0,
      });
    }
  }

  return comHoras;
}

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * O relatorio de UM cliente no periodo.
 *
 * Devolve nulo quando o telefone nao tem nenhuma reserva ali — inclusive
 * quando o telefone nem existe no sistema. A tela nao distingue os dois casos
 * de proposito: o painel e de relatorio, nao um lugar de descobrir se um
 * numero qualquer e cliente da casa.
 */
export async function montarDetalheDoCliente(
  periodo: Periodo,
  telefoneBruto: string,
): Promise<DetalheDoCliente | null> {
  const telefone = normalizarTelefone(telefoneBruto);

  if (!telefone) {
    return null;
  }

  const todas = (await reservasDoPeriodo(periodo)).filter(
    (reserva) => reserva.telefone === telefone,
  );

  if (todas.length === 0) {
    return null;
  }

  const usadas = todas.filter(contouComoUso);
  const profissao = profissaoPredominante(todas);

  return {
    periodo,
    telefone,
    // A ultima reserva do periodo, que e a mais recente: a lista vem ordenada.
    nome: todas[todas.length - 1]!.nomeCliente,
    profissao: profissao.rotulo,
    profissaoDivergente: profissao.divergente,
    horas: umaCasa(usadas.reduce((soma, reserva) => soma + horasDe(reserva), 0)),
    totalDeReservas: todas.length,
    porSala: contarPorSala(todas),
    porStatus: contarPorStatus(todas),
    reservas: todas.map((reserva) => ({
      // O dia em que a reserva COMECA, no relogio de Sao Paulo. Uma reserva nao
      // e fatiada entre dois dias: o numero precisa bater com a agenda.
      data: dataLocalDe(reserva.inicio),
      sala: reserva.sala.nome,
      inicio: horaLocalDe(reserva.inicio),
      fim: horaLocalDe(reserva.fim),
      duracaoHoras: umaCasa(horasDe(reserva)),
      status: NOMES_DOS_STATUS[reserva.status] ?? reserva.status,
    })),
  };
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
    horasPorCliente: somarHorasPorCliente(reservas),
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
