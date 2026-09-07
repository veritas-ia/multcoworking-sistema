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
  /** O horario fixo da diaria (dia inteiro). */
  diaria: { inicio: string; fim: string };
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

/**
 * As telas do fluxo, na ordem.
 *
 * Nem todas aparecem sempre: "categoria" so existe nas salas que trabalham
 * com diaria, e "inicio"/"fim" nao existem quando a escolha e diaria — o
 * horario dela e fixo. Quem decide o que aparece e "etapasVisiveis", no
 * fluxo; esta lista e so a ordem.
 */
export const ETAPAS = [
  "sala",
  "categoria",
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
/**
 * Quantas telas a barra de progresso mostra por padrao (a confirmacao nao
 * conta, e a categoria so aparece em algumas salas). O fluxo calcula o total
 * de verdade a partir das etapas visiveis.
 */
export const TOTAL_DE_ETAPAS = ETAPAS.length - 2;
