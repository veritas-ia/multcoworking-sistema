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
import type { Prisma } from "@/generated/prisma/client";
import { StatusReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { rotuloDaProfissao } from "@/lib/profissoes";
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
  /**
   * O mesmo ranking, somado por EMPRESA. Sem dinheiro: o faturamento da
   * empresa sai no relatorio dela, aberto de proposito, igual ao do cliente.
   */
  horasPorEmpresa: HorasDaEmpresa[];
};

/**
 * Quanto tempo uma EMPRESA usou no periodo.
 *
 * Junta os varios funcionarios, cada um do seu telefone. Uma reserva entra
 * aqui de dois jeitos: pela empresa gravada nela (o que o cliente respondeu)
 * ou, quando nao ha nenhuma, pelo vinculo do telefone — que e como as
 * reservas ANTIGAS, criadas antes de a pergunta existir, encontram a empresa.
 */
export type HorasDaEmpresa = {
  id: string;
  nome: string;
  horas: number;
  reservas: number;
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
  /** O cadastro. E por ele que a tela abre o relatorio individual. */
  clienteId: string;
  /** Um telefone do cliente, so para a tela mostrar algo reconhecivel. */
  telefone: string;
  /** O nome da PRIMEIRA reserva dele no periodo. Ver "somarHorasPorCliente". */
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
  clienteId: string;
  /** Todos os telefones que ele usou no periodo. Pode ser mais de um. */
  telefones: string[];
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
  /**
   * Quanto este cliente gerou no periodo, EM CENTAVOS.
   *
   * E a SOMA DO VALOR JA GRAVADO em cada reserva nao cancelada — nunca um
   * recalculo. O preco fica congelado na reserva no momento da criacao, entao
   * recalcular aqui criaria uma segunda fonte de verdade: a tela mostraria um
   * numero e a reserva guardaria outro assim que um preco mudasse no painel.
   *
   * Em centavos porque centavo nao tem fracao: somar reais em ponto flutuante
   * acumula diferenca de um centavo aqui e ali ao longo de muitas reservas.
   *
   * Liberado pelo dono em 07/10/2026 e SO AQUI: o relatorio geral e a busca
   * de clientes continuam sem dinheiro nenhum.
   */
  faturamentoCentavos: number;
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
  profissao: { nome: string } | null;
  nomeCliente: string;
  telefone: string;
  /** O cadastro do cliente. Obrigatorio no banco desde 10/11/2026. */
  clienteId: string;
  /** O nome OFICIAL do cadastro, que e o mostrado no relatorio. */
  cliente: { nome: string };
  /** A empresa respondida nesta reserva. Nula na maioria. */
  empresaId: string | null;
  empresa: { nome: string } | null;
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
    // LISTA FECHADA, SEM DINHEIRO. Esta consulta alimenta o relatorio GERAL
    // e a BUSCA de clientes, e nos dois o valor continua proibido. O
    // faturamento liberado em 07/10/2026 vale so para o relatorio de UM
    // cliente, que tem consulta propria logo abaixo.
    select: {
      inicio: true,
      fim: true,
      status: true,
      profissao: { select: { nome: true } },
      nomeCliente: true,
      telefone: true,
      clienteId: true,
      cliente: { select: { nome: true } },
      empresaId: true,
      empresa: { select: { nome: true } },
      sala: { select: { nome: true, cor: true } },
    },
    orderBy: { inicio: "asc" },
  });
}

/** A mesma reserva, mais o valor gravado. So para o relatorio individual. */
type ReservaDoClienteContada = ReservaContada & { valor: Prisma.Decimal };

/**
 * As reservas de UM cliente no periodo, com o valor gravado.
 *
 * Esta e a UNICA consulta do relatorio que traz dinheiro, e e separada da
 * geral de proposito. Deixar o valor entrar na lista fechada compartilhada
 * faria o dado circular tambem no relatorio do coworking inteiro e na busca,
 * onde ele continua proibido — e bastaria alguem mudar uma linha de montagem
 * para ele vazar sem ninguem reparar. Separado assim, a excecao e visivel.
 */
async function reservasDoClienteNoPeriodo(
  periodo: Periodo,
  clienteId: string,
): Promise<ReservaDoClienteContada[]> {
  return prisma.reserva.findMany({
    where: {
      clienteId,
      inicio: {
        gte: instanteDe(periodo.de, "00:00"),
        lt: instanteDe(somarDias(periodo.ate, 1), "00:00"),
      },
    },
    select: {
      inicio: true,
      fim: true,
      status: true,
      profissao: { select: { nome: true } },
      nomeCliente: true,
      telefone: true,
      clienteId: true,
      cliente: { select: { nome: true } },
      empresaId: true,
      empresa: { select: { nome: true } },
      sala: { select: { nome: true, cor: true } },
      valor: true,
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

/**
 * A ordem em que as profissoes aparecem no painel.
 *
 * O grafico segue ESSA ordem, e nao a quantidade: assim as barras ficam no
 * mesmo lugar quando a equipe troca de periodo, e da para comparar dois meses
 * sem reler os rotulos. Antes a ordem era uma lista escrita no codigo; hoje
 * ela e a coluna "ordem", que a equipe arrasta no painel.
 */
async function ordemDasProfissoes(): Promise<string[]> {
  const linhas = await prisma.profissao.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { nome: true },
  });

  return linhas.map((linha) => linha.nome);
}

function contarPorProfissao(
  reservas: ReservaContada[],
  emOrdem: string[],
): Fatia[] {
  const mapa = new Map<string, number>();

  for (const reserva of reservas) {
    const rotulo = rotuloDaProfissao(reserva.profissao);
    mapa.set(rotulo, (mapa.get(rotulo) ?? 0) + 1);
  }

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

/**
 * "150.00" do banco vira 15000 centavos.
 *
 * O valor vem como Decimal e e convertido UMA vez, ja em centavos, antes de
 * somar. Somar reais em ponto flutuante vai acumulando diferenca de centavo.
 */
function emCentavosDoBanco(valor: Prisma.Decimal): number {
  return Math.round(Number(valor) * 100);
}

/** Arredonda para uma casa, para 1.5000000000000002 nao chegar na tela. */
function umaCasa(horas: number): number {
  return Math.round(horas * 10) / 10;
}

/**
 * Quantas horas cada cliente usou, do maior para o menor.
 *
 * O NOME MOSTRADO E O DA PRIMEIRA RESERVA do numero, nao o da mais recente
 * (mudado em 29/10/2026, decisao do dono). As reservas vem ordenadas por
 * inicio crescente, entao o primeiro nome visto e o que fica.
 *
 * O motivo veio de um caso real: o telefone do atendimento comercial do
 * coworking acumulou 14 reservas de QUATRO clientes diferentes (Toca,
 * Prestare, Matheus Toca e Rafael Passos). Pela regra antiga, o bloco inteiro
 * de 28 horas levava o nome da ULTIMA reserva — "Rafael Passos" — e o dono leu
 * aquilo como 28 horas de um cliente que tinha 1,5. O primeiro nome e o da
 * reserva mais antiga, que e a que deu origem ao numero no relatorio.
 *
 * O TELEFONE DE BALCAO e a excecao, e ele muda o AGRUPAMENTO, nao so o
 * rotulo: num numero marcado pela equipe, cada NOME vira um cliente. E o que
 * faz a Toca aparecer com as 22,5 horas dela e o Rafael com 1,5, em vez de um
 * bloco de 28. Ver "telefones-balcao.ts".
 */
function somarHorasPorCliente(reservas: ReservaContada[]): HorasDoCliente[] {
  const mapa = new Map<
    string,
    { clienteId: string; telefone: string; nome: string; horas: number; reservas: number }
  >();

  for (const reserva of reservas) {
    if (!contouComoUso(reserva)) {
      continue;
    }

    const chave = chaveDoCliente(reserva);
    const atual = mapa.get(chave);

    mapa.set(chave, {
      clienteId: reserva.clienteId,
      // Um cadastro pode ter mais de um telefone. Aqui fica o da primeira
      // reserva do periodo, so para a tela mostrar algo reconhecivel; quem
      // identifica o cliente e o cadastro.
      telefone: atual?.telefone ?? reserva.telefone,
      // O NOME OFICIAL DO CADASTRO manda (Fase 14): ele nao depende do
      // periodo escolhido na tela, entao o mesmo cliente nao troca de rotulo
      // quando a equipe muda o filtro. Sem cadastro, cai na regra antiga —
      // o nome da primeira reserva deste cliente no periodo.
      nome: reserva.cliente.nome,
      horas: (atual?.horas ?? 0) + horasDe(reserva),
      reservas: (atual?.reservas ?? 0) + 1,
    });
  }

  return [...mapa.values()]
    .map((dados) => ({
      clienteId: dados.clienteId,
      telefone: dados.telefone,
      nome: dados.nome,
      horas: umaCasa(dados.horas),
      reservas: dados.reservas,
    }))
    .sort(
      (a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR"),
    );
}

/**
 * O que identifica um cliente dentro do relatorio: o CADASTRO.
 *
 * Ate a Fase 14 era o telefone, com uma excecao escrita a mao para o telefone
 * de balcao (que juntava pessoas diferentes). As duas coisas sumiram: o
 * cadastro e quem diz quem e quem, e o telefone de balcao ja nasceu dividido
 * em uma pessoa por nome na migracao. Menos regra, mesmo resultado.
 *
 * E e o cadastro que junta o mesmo Rafael de DOIS telefones — coisa que
 * nenhuma regra sobre telefone ou nome conseguia fazer sozinha.
 */
function chaveDoCliente(reserva: ReservaContada): string {
  return reserva.clienteId;
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

  // O NOME SO SERVE PARA ACHAR O CADASTRO. Dai em diante vale o cadastro.
  //
  // Este era um defeito de verdade, corrigido em 29/10/2026: a busca somava
  // apenas as reservas cujo NOME batia, e nao as do cliente. Quem escreveu o
  // proprio nome de dois jeitos aparecia aqui com uma fracao das horas, e o
  // grafico logo abaixo mostrava o total certo. Os dois numeros discordavam
  // na mesma tela, e o dono perdeu a confianca no painel inteiro por causa
  // disso.
  const achadas = reservas.filter((reserva) =>
    // Procura no nome escrito na reserva E no nome oficial do cadastro: a
    // equipe pode estar lembrando de qualquer um dos dois.
    semAcento(reserva.nomeCliente).includes(alvo) ||
      semAcento(reserva.cliente.nome).includes(alvo),
  );
  const chavesAchadas = new Set(achadas.map(chaveDoCliente));

  const doCliente = reservas.filter((reserva) =>
    chavesAchadas.has(chaveDoCliente(reserva)),
  );

  // O ranking soma so o que contou como uso; um cliente que aparece no periodo
  // apenas com reserva cancelada sumiria da busca. Por isso ele e reposto aqui
  // com zero horas — a equipe precisa conseguir achar essa pessoa.
  const comHoras = somarHorasPorCliente(doCliente);
  const jaListados = new Set(comHoras.map((cliente) => cliente.clienteId));

  // A lista vem ordenada por inicio, e o laco guarda o PRIMEIRO nome de cada
  // cliente — o mesmo que o grafico mostra.
  for (const reserva of doCliente) {
    if (!jaListados.has(reserva.clienteId)) {
      comHoras.push({
        clienteId: reserva.clienteId,
        telefone: reserva.telefone,
        nome: reserva.cliente.nome ?? reserva.nomeCliente,
        horas: 0,
        reservas: 0,
      });
      jaListados.add(reserva.clienteId);
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
  clienteId: string,
): Promise<DetalheDoCliente | null> {
  // ABRE PELO CADASTRO, e nao pelo telefone.
  //
  // Isto foi um defeito de verdade entre 10/11/2026 e o fechamento da fase:
  // o grafico ja agrupava pelo cadastro, mas o detalhe ainda filtrava por
  // telefone. Num cliente com DOIS numeros — o Rafael, depois de juntado —
  // o grafico dizia 5 h e o detalhe mostrava 2 h. Dois numeros discordando
  // na mesma tela e exatamente a doenca que esta fase veio curar.
  const todas = await reservasDoClienteNoPeriodo(periodo, clienteId);

  if (todas.length === 0) {
    return null;
  }

  const usadas = todas.filter(contouComoUso);
  const profissao = profissaoPredominante(todas);

  return {
    periodo,
    clienteId,
    // TODOS os telefones que o cliente usou no periodo. Um cadastro pode ter
    // mais de um — e justamente o caso que a fase veio resolver.
    telefones: [...new Set(todas.map((reserva) => reserva.telefone))],
    nome: todas[0]!.cliente.nome,
    profissao: profissao.rotulo,
    profissaoDivergente: profissao.divergente,
    horas: umaCasa(usadas.reduce((soma, reserva) => soma + horasDe(reserva), 0)),
    totalDeReservas: todas.length,
    // Soma do valor JA GRAVADO, so das que contaram como uso. Cancelada nao
    // entra, igual as horas: reserva desmarcada nao virou dinheiro.
    faturamentoCentavos: usadas.reduce(
      (soma, reserva) => soma + emCentavosDoBanco(reserva.valor),
      0,
    ),
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
// Empresas
// -----------------------------------------------------------------------------

/**
 * De qual empresa e cada TELEFONE, pelo vinculo do painel.
 *
 * Isto existe para as reservas ANTIGAS. Elas nasceram antes de a pergunta
 * existir e tem "empresaId" nulo — preencher um valor nelas agora seria
 * inventar resposta que o cliente nunca deu. Entao a empresa delas e
 * descoberta aqui, na hora de montar o relatorio.
 */
async function vinculosDeTelefone(): Promise<Map<string, { id: string; nome: string }>> {
  const vinculos = await prisma.telefoneDaEmpresa.findMany({
    select: { telefone: true, empresa: { select: { id: true, nome: true } } },
  });

  return new Map(
    vinculos.map((vinculo) => [
      vinculo.telefone,
      { id: vinculo.empresa.id, nome: vinculo.empresa.nome },
    ]),
  );
}

/**
 * A empresa de uma reserva: primeiro a que esta GRAVADA nela, depois o
 * vinculo do telefone.
 *
 * Essa ordem e a regra, e nao um detalhe: o que o cliente respondeu naquele
 * dia vale mais do que o vinculo de hoje. Quem mudou de empresa nao leva as
 * reservas antigas com ele.
 */
function empresaDaReserva(
  reserva: ReservaContada,
  vinculos: Map<string, { id: string; nome: string }>,
): { id: string; nome: string } | null {
  if (reserva.empresaId && reserva.empresa) {
    return { id: reserva.empresaId, nome: reserva.empresa.nome };
  }

  return vinculos.get(reserva.telefone) ?? null;
}

function somarHorasPorEmpresa(
  reservas: ReservaContada[],
  vinculos: Map<string, { id: string; nome: string }>,
): HorasDaEmpresa[] {
  const mapa = new Map<string, { nome: string; horas: number; reservas: number }>();

  for (const reserva of reservas) {
    if (!contouComoUso(reserva)) {
      continue;
    }

    const empresa = empresaDaReserva(reserva, vinculos);

    if (!empresa) {
      continue;
    }

    const atual = mapa.get(empresa.id);
    mapa.set(empresa.id, {
      nome: empresa.nome,
      horas: (atual?.horas ?? 0) + horasDe(reserva),
      reservas: (atual?.reservas ?? 0) + 1,
    });
  }

  return [...mapa.entries()]
    .map(([id, dados]) => ({
      id,
      nome: dados.nome,
      horas: umaCasa(dados.horas),
      reservas: dados.reservas,
    }))
    .sort((a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Uma pessoa que reservou no nome da empresa. */
export type PessoaDaEmpresa = {
  nome: string;
  /** Inteiro, como no relatorio de clientes: e a equipe vendo o proprio cliente. */
  telefoneVisivel: string;
  horas: number;
  reservas: number;
};

export type DetalheDaEmpresa = {
  periodo: Periodo;
  id: string;
  nome: string;
  horas: number;
  totalDeReservas: number;
  /**
   * Soma do valor JA GRAVADO nas reservas nao canceladas.
   *
   * Autorizado pelo dono, igual ao relatorio de um cliente: e para a empresa
   * que paga a conta do mes. NUNCA um recalculo — o preco fica congelado na
   * reserva, e recalcular aqui criaria um segundo numero discordando dela.
   */
  faturamentoCentavos: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  /** Quem reservou no nome dela, do que mais usou para o que menos usou. */
  pessoas: PessoaDaEmpresa[];
};

/**
 * As reservas de UMA empresa no periodo, com o valor gravado.
 *
 * Consulta SEPARADA, pelo mesmo motivo da do cliente: deixar o "valor" entrar
 * na lista fechada compartilhada faria o dinheiro circular no relatorio do
 * coworking inteiro e na busca, onde ele continua proibido.
 */
async function reservasDaEmpresaNoPeriodo(
  periodo: Periodo,
  empresaId: string,
): Promise<ReservaDoClienteContada[]> {
  const vinculados = await prisma.telefoneDaEmpresa.findMany({
    where: { empresaId },
    select: { telefone: true },
  });

  return prisma.reserva.findMany({
    where: {
      inicio: {
        gte: instanteDe(periodo.de, "00:00"),
        lt: instanteDe(somarDias(periodo.ate, 1), "00:00"),
      },
      OR: [
        // O que o cliente respondeu.
        { empresaId },
        // E as reservas ANTIGAS daqueles telefones, que nunca foram
        // perguntadas. A condicao de empresa nula importa: sem ela, uma
        // reserva que a pessoa marcou para OUTRA empresa entraria aqui so
        // porque o telefone dela esta vinculado a esta.
        ...(vinculados.length > 0
          ? [{ empresaId: null, telefone: { in: vinculados.map((v) => v.telefone) } }]
          : []),
      ],
    },
    select: {
      inicio: true,
      fim: true,
      status: true,
      profissao: { select: { nome: true } },
      nomeCliente: true,
      telefone: true,
      clienteId: true,
      cliente: { select: { nome: true } },
      empresaId: true,
      empresa: { select: { nome: true } },
      sala: { select: { nome: true, cor: true } },
      valor: true,
    },
    orderBy: { inicio: "asc" },
  });
}

/**
 * O relatorio de UMA empresa. Nulo quando ela nao tem nada no periodo.
 *
 * Este e o unico lugar, junto do relatorio de um cliente, em que o dinheiro
 * aparece. O relatorio GERAL e a BUSCA continuam sem valor nenhum.
 */
export async function montarDetalheDaEmpresa(
  periodo: Periodo,
  empresaId: string,
): Promise<DetalheDaEmpresa | null> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { id: true, nome: true },
  });

  if (!empresa) {
    return null;
  }

  const todas = await reservasDaEmpresaNoPeriodo(periodo, empresaId);

  if (todas.length === 0) {
    return null;
  }

  const usadas = todas.filter(contouComoUso);

  const porPessoa = new Map<string, { nome: string; horas: number; reservas: number }>();

  for (const reserva of todas) {
    const atual = porPessoa.get(reserva.telefone);
    porPessoa.set(reserva.telefone, {
      // A lista vem ordenada por inicio: fica o nome da PRIMEIRA reserva,
      // mesma regra do grafico de horas por cliente.
      nome: reserva.cliente.nome,
      horas: (atual?.horas ?? 0) + (contouComoUso(reserva) ? horasDe(reserva) : 0),
      reservas: (atual?.reservas ?? 0) + 1,
    });
  }

  return {
    periodo,
    id: empresa.id,
    nome: empresa.nome,
    horas: umaCasa(usadas.reduce((soma, reserva) => soma + horasDe(reserva), 0)),
    totalDeReservas: todas.length,
    faturamentoCentavos: usadas.reduce(
      (soma, reserva) => soma + emCentavosDoBanco(reserva.valor),
      0,
    ),
    porSala: contarPorSala(todas),
    porStatus: contarPorStatus(todas),
    pessoas: [...porPessoa.entries()]
      .map(([telefone, dados]) => ({
        nome: dados.nome,
        telefoneVisivel: telefone,
        horas: umaCasa(dados.horas),
        reservas: dados.reservas,
      }))
      .sort((a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

// -----------------------------------------------------------------------------
// Montagem
// -----------------------------------------------------------------------------

export async function montarRelatorio(periodo: Periodo): Promise<Relatorio> {
  const [reservas, vinculos, ordem] = await Promise.all([
    reservasDoPeriodo(periodo),
    vinculosDeTelefone(),
    ordemDasProfissoes(),
  ]);

  return {
    periodo,
    total: reservas.length,
    porSala: contarPorSala(reservas),
    porStatus: contarPorStatus(reservas),
    porDia: contarPorDia(reservas, periodo),
    porDiaDaSemana: contarPorDiaDaSemana(reservas),
    porHora: contarPorHora(reservas),
    porProfissao: contarPorProfissao(reservas, ordem),
    // Agrupado pelo CADASTRO. O telefone de balcao ja nasce dividido em uma
    // pessoa por nome — na migracao, para o que existia, e na marcacao, daqui
    // em diante —, entao o relatorio nao precisa saber que ele existe.
    horasPorCliente: somarHorasPorCliente(reservas),
    horasPorEmpresa: somarHorasPorEmpresa(reservas, vinculos),
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
