/** Formatos que a area publica troca com o servidor (Fase 4 + rotas da Fase 5). */

export type Sala = {
  id: string;
  slug: string;
  nome: string;
  capacidade: number | null;
  /** Preco de DIA. Texto, para nao perder centavos no caminho. */
  precoPorHora: string;
  /** Preco depois do inicio da faixa noturna. */
  precoPorHoraNoturno: string;
  /** Preco noturno para grupo grande. Nulo = a sala nao cobra diferente. */
  precoPorHoraNoturnoGrupo: string | null;
  /** ACIMA de quantas pessoas vale o preco de grupo. */
  pessoasParaGrupo: number | null;
  aceitaDiaria: boolean;
  precoDiaria: string | null;
};

export type DiaDeExpediente = {
  diaDaSemana: number;
  horaAbertura: string;
  horaFechamento: string;
};

export type Agenda = {
  diasFechados: number[];
  diasAbertos: DiaDeExpediente[];
  primeiraData: string;
  ultimaData: string;
  antecedenciaMinimaMinutos: number;
  antecedenciaMaximaDias: number;
  duracaoMinimaMinutos: number;
  janelaCancelamentoHoras: number;
  /** A partir de que hora vale o preco noturno. */
  horaInicioNoturno: string;
  /** Textos de politica editaveis no painel, ja com as variaveis trocadas. */
  textos: TextosDePolitica;
};

export type TextosDePolitica = {
  politicaCancelamento: string;
  avisoDoValor: string;
};

export type Bloco = {
  horario: string;
  disponivelParaInicio: boolean;
};

export type Sessao = {
  identificado: boolean;
  telefoneMascarado: string | null;
};

export type ReservaCriada = {
  id: string;
  sala: string;
  data: string;
  inicio: string;
  fim: string;
  valorEstimado: string;
  status: string;
};

/** As 8 telas do fluxo, na ordem. */
export const ETAPAS = [
  "sala",
  "data",
  "inicio",
  "fim",
  "telefone",
  "nome",
  "resumo",
  "confirmacao",
] as const;

export type Etapa = (typeof ETAPAS)[number];

/** Quantas telas aparecem na barra de progresso (a confirmacao nao conta). */
export const TOTAL_DE_ETAPAS = ETAPAS.length - 1;
