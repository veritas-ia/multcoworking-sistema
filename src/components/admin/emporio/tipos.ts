/**
 * O que as telas do emporio recebem do servidor.
 *
 * Declarado aqui, e nao importado de "@/lib/emporio", pela mesma razao que a
 * agenda faz igual: esses modulos falam com o Prisma, e o tipo que a tela
 * precisa e so o formato do JSON que chega. Mantendo a copia, a tela nunca
 * arrasta o banco para o navegador por engano.
 */

export type CategoriaDoProduto = "COMIDA" | "BEBIDA";
export type TipoDeControle = "ESTOQUE" | "CONTADOR";
export type MomentoDoPagamento = "NA_HORA" | "NA_MENSALIDADE";
export type TipoMovimentoEstoque =
  | "REPOSICAO"
  | "VENDA"
  | "PERDA"
  | "AJUSTE";

export type TagNaTela = { id: string; nome: string; cor: string };

export type TagDoPainel = TagNaTela & { ativa: boolean; ordem: number };

export type ProdutoDoEmporio = {
  id: string;
  nome: string;
  categoria: CategoriaDoProduto;
  tags: TagNaTela[];
  /** Em reais, com duas casas: "6.00". */
  preco: string;
  ativo: boolean;
  ordem: number;
  /** Nula e estado normal: produto sem foto aparece com a inicial do nome. */
  foto: { publicId: string; url: string } | null;
  /**
   * A soma dos movimentos. PODE SER NEGATIVO de proposito: a venda que chega
   * ao sistema ja aconteceu, e o negativo e o aviso de que falta lancar uma
   * reposicao.
   */
  estoque: number;
};

export type MovimentoNaLista = {
  id: string;
  tipo: TipoMovimentoEstoque;
  quantidade: number;
  motivo: string | null;
  lancadoPor: string | null;
  /** Vem como texto no JSON. */
  criadoEm: string;
};

export type LinhaParaContar = {
  produtoId: string;
  nome: string;
  categoria: CategoriaDoProduto;
  controle: TipoDeControle;
  /**
   * Em ESTOQUE, quantas unidades o sistema acha que ha. Em CONTADOR, a ultima
   * leitura da maquina — o numero de onde a proxima diferenca sai.
   */
  esperado: number;
};

export type ResultadoDaLinha = {
  produtoId: string;
  nome: string;
  controle: TipoDeControle;
  contado: number;
  esperado: number;
  /**
   * ESTOQUE: contado menos esperado. Negativo e o "FALTOU" da ficha.
   * CONTADOR: quantos cafes a maquina fez desde a leitura anterior.
   */
  diferenca: number;
};

export type ContagemGravada = {
  id: string;
  dia: string;
  horario: string | null;
  observacao: string | null;
  linhas: ResultadoDaLinha[];
  faltaram: number;
  cafesFeitos: number;
};

export type ConsumoLancado = {
  id: string;
  clienteId: string;
  clienteNome: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  /** Em reais, congelado no lancamento. */
  precoUnitario: string;
  valor: string;
  dia: string;
  hora: string;
  sala: string | null;
  momento: MomentoDoPagamento;
  formaPagamento: string | null;
  lancadoPor: string | null;
};

export type FormaDePagamento = { id: string; nome: string; ativa: boolean };

export type SalaParaEscolher = { id: string; nome: string };

/** O cliente CADASTRADO, nunca um nome digitado. */
export type ClienteParaEscolher = {
  id: string;
  nome: string;
  /**
   * PODE SER VAZIO: e o cliente que so tem reserva lancada no telefone do
   * balcao e nunca deixou o numero dele. No emporio isso nao impede nada — o
   * consumo e do cadastro, nao do telefone.
   */
  telefones: string[];
  outrosNomes: string[];
  reservas: number;
  ultimaReserva: string | null;
  empresa: { id: string; nome: string } | null;
};
