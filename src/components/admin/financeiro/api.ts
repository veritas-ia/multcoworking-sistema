/** Conversa das telas do financeiro com o servidor (Fase 16, Parte A). */
import { ErroDaApi } from "@/components/reserva/api";

import type {
  CategoriaNaTela,
  ContratoNaTela,
  EmpresaParaEscolher,
  EspacoNaTela,
  PainelFinanceiro,
  RelatorioDaGeracao,
  FormaDePagamento,
  FornecedorNaTela,
  LancamentoNaTela,
  ResumoDoPeriodo,
  SituacaoDoLancamento,
  TipoDeLancamento,
} from "./tipos";

type CorpoDeErro = { erro?: string; codigo?: string };

function lerErro(corpo: unknown): CorpoDeErro {
  return typeof corpo === "object" && corpo !== null ? (corpo as CorpoDeErro) : {};
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;

  try {
    resposta = await fetch(caminho, {
      ...init,
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ErroDaApi(
      0,
      "Não conseguimos falar com o servidor. Verifique sua conexão.",
    );
  }

  const corpo: unknown = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const { erro, codigo } = lerErro(corpo);
    throw new ErroDaApi(
      resposta.status,
      erro ?? "Algo deu errado por aqui. Tente de novo.",
      codigo ?? null,
    );
  }

  return corpo as T;
}

// -----------------------------------------------------------------------------
// Lançamentos
// -----------------------------------------------------------------------------

export type RespostaDeLancamentos = {
  lancamentos: LancamentoNaTela[];
  resumo: ResumoDoPeriodo;
  /** Vêm junto para o formulário: só as ATIVAS. */
  categorias: CategoriaNaTela[];
  fornecedores: FornecedorNaTela[];
  formasDePagamento: FormaDePagamento[];
  /** O dia de hoje no relógio de São Paulo, decidido pelo servidor. */
  hoje: string;
};

/**
 * As contas de um período.
 *
 * "base" escolhe qual data manda: "vencimento" é a visão de CONTAS (o que
 * vence no mês, pago ou não) e "pagamento" é a de CAIXA (o que entrou e saiu
 * de verdade). Uma conta de outubro paga em novembro é despesa de outubro e
 * caixa de novembro — por isso são duas visões, e não um filtro só.
 */
export function buscarLancamentos(entrada: {
  de: string;
  ate: string;
  base?: "vencimento" | "pagamento";
  tipo?: TipoDeLancamento;
  categoriaId?: string;
  fornecedorId?: string;
  situacao?: SituacaoDoLancamento;
}): Promise<RespostaDeLancamentos> {
  const busca = new URLSearchParams({ de: entrada.de, ate: entrada.ate });

  if (entrada.base) busca.set("base", entrada.base);
  if (entrada.tipo) busca.set("tipo", entrada.tipo);
  if (entrada.categoriaId) busca.set("categoriaId", entrada.categoriaId);
  if (entrada.fornecedorId) busca.set("fornecedorId", entrada.fornecedorId);
  if (entrada.situacao) busca.set("situacao", entrada.situacao);

  return pedir(`/api/admin/financeiro/lancamentos?${busca}`);
}

export type EntradaDeLancamento = {
  descricao: string;
  /** Em reais, como a pessoa digita: "1250" ou "1250,50". */
  valor: string;
  categoriaId: string;
  clienteId?: string | null;
  empresaId?: string | null;
  fornecedorId?: string | null;
  formaPagamentoId?: string | null;
  vencimento: string;
  /** Preenchido = já aconteceu. Nulo = pendente. */
  pagoEm?: string | null;
  observacao?: string | null;
};

/**
 * Lança uma entrada ou uma saída.
 *
 * REPARE NO QUE NÃO VAI AQUI: o LADO. Ele é o tipo da categoria escolhida —
 * se a tela pudesse mandar, uma despesa poderia entrar do lado das receitas e
 * o caixa do mês somaria para o lado errado.
 */
export function lancar(
  entrada: EntradaDeLancamento,
): Promise<{ lancamento: LancamentoNaTela }> {
  return pedir("/api/admin/financeiro/lancamentos", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/** Corrige o lançamento. Tudo que a equipe digitou, a equipe corrige. */
export function editarLancamento(
  id: string,
  mudanca: Partial<EntradaDeLancamento>,
): Promise<{ lancamento: LancamentoNaTela }> {
  return pedir(`/api/admin/financeiro/lancamentos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(mudanca),
  });
}

/**
 * Marca como pago, ou desmarca com "pagoEm: null".
 *
 * É ação própria, e não "editar a data": é o que a equipe faz dezenas de vezes
 * por mês, e abrir o formulário inteiro para uma data só seria atrito.
 */
export function marcarPagamento(
  id: string,
  entrada: { pagoEm: string | null; formaPagamentoId?: string | null },
): Promise<{ lancamento: LancamentoNaTela }> {
  return pedir(`/api/admin/financeiro/lancamentos/${id}/pagamento`, {
    method: "PATCH",
    body: JSON.stringify(entrada),
  });
}

/**
 * Exclui, com MOTIVO obrigatório.
 *
 * O motivo vai no corpo, e não no endereço: é um texto sobre dinheiro, e na
 * barra de endereço ele apareceria no registro do servidor e no histórico do
 * navegador. O registro e a exclusão acontecem na mesma transação no servidor.
 */
export function excluirLancamento(
  id: string,
  motivo: string,
): Promise<{ resumo: string }> {
  return pedir(`/api/admin/financeiro/lancamentos/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ motivo }),
  });
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------

export function buscarCategorias(opcoes?: {
  tipo?: TipoDeLancamento;
  somenteAtivas?: boolean;
}): Promise<{ categorias: CategoriaNaTela[] }> {
  const busca = new URLSearchParams();

  if (opcoes?.tipo) busca.set("tipo", opcoes.tipo);
  if (opcoes?.somenteAtivas) busca.set("ativas", "1");

  const query = busca.toString();

  return pedir(`/api/admin/financeiro/categorias${query ? `?${query}` : ""}`);
}

export function criarCategoria(entrada: {
  nome: string;
  tipo: TipoDeLancamento;
}): Promise<{ categoria: CategoriaNaTela }> {
  return pedir("/api/admin/financeiro/categorias", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/**
 * Renomeia, liga ou desliga.
 *
 * O TIPO NÃO ESTÁ AQUI, e isso é regra: virar o lado de uma categoria
 * inverteria o sinal de todo lançamento que aponta para ela. Para trocar o
 * lado, cria-se outra.
 */
export function editarCategoria(
  id: string,
  mudanca: { nome?: string; ativa?: boolean },
): Promise<{ categoria: CategoriaNaTela }> {
  return pedir(`/api/admin/financeiro/categorias/${id}`, {
    method: "PATCH",
    body: JSON.stringify(mudanca),
  });
}

/** Grava a ordem de UM lado, com a lista completa dele. */
export function reordenarCategorias(
  ids: string[],
): Promise<{ categorias: CategoriaNaTela[] }> {
  return pedir("/api/admin/financeiro/categorias", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

// -----------------------------------------------------------------------------
// Fornecedores
// -----------------------------------------------------------------------------

export function buscarFornecedores(opcoes?: {
  somenteAtivos?: boolean;
}): Promise<{ fornecedores: FornecedorNaTela[] }> {
  return pedir(
    `/api/admin/financeiro/fornecedores${opcoes?.somenteAtivos ? "?ativos=1" : ""}`,
  );
}

export function criarFornecedor(entrada: {
  nome: string;
  observacao?: string | null;
}): Promise<{ fornecedor: FornecedorNaTela }> {
  return pedir("/api/admin/financeiro/fornecedores", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

export function editarFornecedor(
  id: string,
  mudanca: { nome?: string; observacao?: string | null; ativo?: boolean },
): Promise<{ fornecedor: FornecedorNaTela }> {
  return pedir(`/api/admin/financeiro/fornecedores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(mudanca),
  });
}

/**
 * DESVINCULA a linha da origem: ela vira manual e fica editável.
 *
 * É a saída de emergência — nada fica trancado para sempre; só não se solta
 * sem perceber. SÓ VALE PARA A LINHA DE RESERVA: a do empório é recalculada a
 * cada consumo do dia, e soltá-la faria o dinheiro do dia aparecer duas vezes.
 */
export function desvincular(
  id: string,
): Promise<{ lancamento: LancamentoNaTela }> {
  return pedir(`/api/admin/financeiro/lancamentos/${id}/desvincular`, {
    method: "POST",
  });
}

// -----------------------------------------------------------------------------
// Espaços mensais (Fase 16, Parte C)
// -----------------------------------------------------------------------------

export function buscarEspacos(opcoes?: {
  somenteAtivos?: boolean;
}): Promise<{ espacos: EspacoNaTela[] }> {
  return pedir(
    `/api/admin/financeiro/espacos${opcoes?.somenteAtivos ? "?ativos=1" : ""}`,
  );
}

export function criarEspaco(entrada: {
  nome: string;
  observacao?: string | null;
}): Promise<{ espaco: EspacoNaTela }> {
  return pedir("/api/admin/financeiro/espacos", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/**
 * Renomeia, anota ou desliga.
 *
 * EXCLUIR NÃO EXISTE. E espaço com contrato VIGENTE não se desliga: o contrato
 * continuaria cobrando, e a equipe veria um espaço "fora do ar" gerando
 * dinheiro todo mês. A recusa vem do servidor e explica isso.
 */
export function editarEspaco(
  id: string,
  mudanca: { nome?: string; observacao?: string | null; ativo?: boolean },
): Promise<{ espaco: EspacoNaTela }> {
  return pedir(`/api/admin/financeiro/espacos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(mudanca),
  });
}

export function reordenarEspacos(
  ids: string[],
): Promise<{ espacos: EspacoNaTela[] }> {
  return pedir("/api/admin/financeiro/espacos", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

// -----------------------------------------------------------------------------
// Contratos e mensalidades
// -----------------------------------------------------------------------------

export type RespostaDeContratos = {
  contratos: ContratoNaTela[];
  /** Só os ativos: espaço desligado não se escolhe num contrato novo. */
  espacos: EspacoNaTela[];
  hoje: string;
};

export function buscarContratos(opcoes?: {
  somenteVigentes?: boolean;
}): Promise<RespostaDeContratos> {
  return pedir(
    `/api/admin/financeiro/contratos${opcoes?.somenteVigentes ? "?vigentes=1" : ""}`,
  );
}

export type EntradaDeContrato = {
  clienteId?: string | null;
  empresaId?: string | null;
  espacoId?: string | null;
  valorMensal: string;
  diaVencimento: number;
  /** NULO = sem horas inclusas. Zero é recusado pelo servidor. */
  cotaHoras?: number | null;
  inicio: string;
  fim?: string | null;
  observacao?: string | null;
};

export function criarContrato(
  entrada: EntradaDeContrato,
): Promise<{ contrato: ContratoNaTela }> {
  return pedir("/api/admin/financeiro/contratos", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/**
 * Edita o contrato.
 *
 * AUMENTAR O VALOR NÃO RETROAGE: as cobranças já geradas ficam com o valor que
 * era, porque ele viajou para o lançamento e congelou lá. Mesma regra do valor
 * da reserva e do preço do empório.
 */
export function editarContrato(
  id: string,
  mudanca: Partial<EntradaDeContrato> & { ativo?: boolean },
): Promise<{ contrato: ContratoNaTela }> {
  return pedir(`/api/admin/financeiro/contratos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(mudanca),
  });
}

/** O extrato do mensalista: o que foi cobrado, pago e o que está em atraso. */
export function buscarCobrancas(
  contratoId: string,
): Promise<{ cobrancas: LancamentoNaTela[] }> {
  return pedir(`/api/admin/financeiro/contratos/${contratoId}/cobrancas`);
}

/**
 * GERA as cobranças de um mês.
 *
 * É IDEMPOTENTE: clicar duas vezes em "gerar dezembro" não cobra em dobro — a
 * trava é o índice único (contrato, mês) no banco. A resposta traz o relatório
 * do que nasceu, do que já existia e do que ficou de fora, com o motivo.
 */
export function gerarMensalidades(
  competencia: string,
): Promise<{ relatorio: RelatorioDaGeracao }> {
  return pedir("/api/admin/financeiro/mensalidades/gerar", {
    method: "POST",
    body: JSON.stringify({ competencia }),
  });
}

/** As empresas, para escolher quem paga o contrato. */
export function buscarEmpresas(): Promise<{
  empresas: EmpresaParaEscolher[];
}> {
  return pedir("/api/admin/empresas");
}

// -----------------------------------------------------------------------------
// O painel (Fase 16, Parte E)
// -----------------------------------------------------------------------------

/**
 * O painel de um mês. SÓ LEITURA — a rota não tem método de escrita.
 *
 * Todos os números vêm SOMADOS do servidor, em centavos; a tela só formata e
 * desenha. Somar aqui abriria uma segunda conta do mesmo número, e um dia as
 * duas discordariam na mesma página.
 */
export function buscarPainel(competencia?: string): Promise<{
  painel: PainelFinanceiro;
  hoje: string;
}> {
  const busca = new URLSearchParams();

  if (competencia) {
    busca.set("competencia", competencia);
  }

  const query = busca.toString();

  return pedir(`/api/admin/financeiro/painel${query ? `?${query}` : ""}`);
}
