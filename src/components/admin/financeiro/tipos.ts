/**
 * O que as telas do financeiro recebem do servidor.
 *
 * Declarado aqui, e nao importado de "@/lib/financeiro", pela mesma razao que
 * a agenda e o emporio fazem igual: aquele modulo fala com o Prisma, e o tipo
 * que a tela precisa e so o formato do JSON que chega.
 */

export type TipoDeLancamento = "ENTRADA" | "SAIDA";

/**
 * Os tres estados que a equipe le.
 *
 * NENHUM DELES ESTA GRAVADO NO BANCO: o servidor os calcula a partir do
 * vencimento e da data de pagamento. A tela recebe pronto e NAO refaz a
 * conta — o navegador do operador pode estar em outro fuso, e aí ela mostraria
 * uma conta atrasada que não está (ou o contrário).
 */
export type SituacaoDoLancamento = "PAGO" | "PENDENTE" | "ATRASADO";

export type CategoriaNaTela = {
  id: string;
  nome: string;
  tipo: TipoDeLancamento;
  slug: string;
  ativa: boolean;
  ordem: number;
  /** Quantos lançamentos apontam para ela. A tela avisa antes de desligar. */
  lancamentos: number;
};

export type FornecedorNaTela = {
  id: string;
  nome: string;
  ativo: boolean;
  observacao: string | null;
  lancamentos: number;
};

export type LancamentoNaTela = {
  id: string;
  descricao: string;
  /** Em reais, com duas casas. Toda soma na tela passa por centavos. */
  valor: string;
  /** O lado, que vem da categoria — nunca do sinal do valor. */
  tipo: TipoDeLancamento;
  categoria: { id: string; nome: string };
  cliente: { id: string; nome: string } | null;
  empresa: { id: string; nome: string } | null;
  fornecedor: { id: string; nome: string } | null;
  formaPagamento: { id: string; nome: string } | null;
  /** "AAAA-MM-DD" no relógio de São Paulo. */
  vencimento: string;
  pagoEm: string | null;
  situacao: SituacaoDoLancamento;
  diasDeAtraso: number;
  observacao: string | null;
  lancadoPor: string | null;
  criadoEm: string;
  /**
   * DE ONDE A LINHA VEIO.
   *
   * MANUAL  — alguém digitou. Editável à vontade.
   * RESERVA — nasceu do "Recebi no balcão", na agenda.
   * EMPORIO — resume o consumo pago na hora de um dia.
   *
   * A tela usa isto para NÃO oferecer "Corrigir" numa linha automática: ela é
   * espelho da origem, e editar o espelho faria o financeiro mostrar um valor e
   * o relatório outro — a doença da planilha, onde o total digitado dizia
   * R$ 3.033 e as linhas somavam R$ 3.023.
   */
  origem: "MANUAL" | "RESERVA" | "EMPORIO";
};

/** Somado no SERVIDOR, em centavos. A tela só formata. */
export type ResumoDoPeriodo = {
  entradasCentavos: number;
  saidasCentavos: number;
  saldoCentavos: number;
  aReceberCentavos: number;
  aPagarCentavos: number;
  atrasadoAReceberCentavos: number;
  atrasadoAPagarCentavos: number;
  quantas: number;
};

export type FormaDePagamento = { id: string; nome: string; ativa: boolean };

export type EspacoNaTela = {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  observacao: string | null;
  /** Quantos contratos apontam para ele. A tela avisa antes de desligar. */
  contratos: number;
  /**
   * Se há contrato VIGENTE nele, HOJE.
   *
   * Decidido pelo servidor, no relógio de São Paulo: um espaço cujo contrato
   * terminou em março está LIVRE, e mostrá-lo como ocupado faria a equipe
   * deixar de alugá-lo.
   */
  ocupado: boolean;
};

export type ContratoNaTela = {
  id: string;
  /** Quem paga. Exatamente um dos dois, nunca os dois. */
  cliente: { id: string; nome: string } | null;
  empresa: { id: string; nome: string } | null;
  espaco: { id: string; nome: string } | null;
  valorMensal: string;
  diaVencimento: number;
  /** Horas de sala inclusas. NULO = sem cota, toda hora é cobrada. */
  cotaHoras: number | null;
  inicio: string;
  fim: string | null;
  ativo: boolean;
  observacao: string | null;
  /** Se gera cobrança hoje. Vem do SERVIDOR — a tela não refaz conta de fuso. */
  vigente: boolean;
  cobrancas: number;
};

/** O que a geração do mês devolve. A equipe precisa saber o que NÃO entrou. */
export type RelatorioDaGeracao = {
  competencia: string;
  criadas: number;
  /** Já existiam — gerar de novo não cobra em dobro. */
  jaExistiam: number;
  pulados: { contratoId: string; quem: string; motivo: string }[];
  totalCentavos: number;
};

export type EmpresaParaEscolher = { id: string; nome: string; ativa: boolean };
