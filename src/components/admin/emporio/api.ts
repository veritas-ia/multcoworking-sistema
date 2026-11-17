/** Conversa das telas do emporio com o servidor (Fase 15). */
import { ErroDaApi } from "@/components/reserva/api";

import type {
  CategoriaDoProduto,
  ClienteParaEscolher,
  ConsumoLancado,
  ContagemGravada,
  FormaDePagamento,
  LinhaParaContar,
  MomentoDoPagamento,
  MovimentoNaLista,
  ProdutoDoEmporio,
  SalaParaEscolher,
  TagDoPainel,
  TipoDeControle,
  TipoMovimentoEstoque,
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
// Produtos
// -----------------------------------------------------------------------------

export type RespostaDeProdutos = {
  produtos: ProdutoDoEmporio[];
  tags: TagDoPainel[];
  /**
   * Falso quando as credenciais do Cloudinary estao vazias. A tela avisa que o
   * envio esta indisponivel em vez de deixar a pessoa escolher um arquivo e
   * levar erro depois.
   */
  envioDeImagemDisponivel: boolean;
};

/**
 * Lista os produtos.
 *
 * "somenteAtivos" e para a tela de LANCAMENTO: produto desligado nao se vende.
 * A tela de cadastro precisa de tudo, senao a equipe nao consegue religar o
 * que desligou.
 */
export function buscarProdutos(opcoes?: {
  somenteAtivos?: boolean;
  categoria?: CategoriaDoProduto;
}): Promise<RespostaDeProdutos> {
  const busca = new URLSearchParams();

  if (opcoes?.somenteAtivos) {
    busca.set("ativos", "1");
  }

  if (opcoes?.categoria) {
    busca.set("categoria", opcoes.categoria);
  }

  const query = busca.toString();

  return pedir(`/api/admin/emporio/produtos${query ? `?${query}` : ""}`);
}

export function criarProduto(entrada: {
  nome: string;
  categoria: CategoriaDoProduto;
  preco: string;
  tagIds?: string[];
}): Promise<{ produto: ProdutoDoEmporio }> {
  return pedir("/api/admin/emporio/produtos", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

/**
 * Muda o produto.
 *
 * NAO EXISTE EXCLUIR, de proposito: produto nunca se apaga, mesma regra de
 * salas, empresas e areas de atuacao. Apagar tiraria o historico de vendas em
 * silencio — e a chave estrangeira do banco recusaria de todo jeito.
 */
export function mudarProduto(
  id: string,
  mudanca: {
    nome?: string;
    preco?: string;
    categoria?: CategoriaDoProduto;
    /** A lista COMPLETA de etiquetas. Ausente = nao mexer nelas. */
    tagIds?: string[];
    ativo?: boolean;
  },
): Promise<{ produto: ProdutoDoEmporio }> {
  return pedir(`/api/admin/emporio/produtos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(mudanca),
  });
}

/** Grava a ordem da lista inteira, para nunca haver duas posicoes iguais. */
export function reordenarProdutos(
  ids: string[],
): Promise<{ produtos: ProdutoDoEmporio[] }> {
  return pedir("/api/admin/emporio/produtos", {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
}

export function buscarExtrato(
  produtoId: string,
): Promise<{ movimentos: MovimentoNaLista[] }> {
  return pedir(`/api/admin/emporio/produtos/${produtoId}/estoque`);
}

/**
 * Lanca um movimento de estoque.
 *
 * A QUANTIDADE E SEMPRE POSITIVA: o sinal sai do tipo, no servidor. VENDA nao
 * entra por aqui — ela nasce do lancamento do consumo, que grava de quem foi.
 */
export function lancarMovimento(
  produtoId: string,
  entrada: {
    tipo: Exclude<TipoMovimentoEstoque, "VENDA">;
    quantidade: number;
    motivo?: string | null;
    /** So no AJUSTE: verdadeiro quando a prateleira tinha MENOS. */
    paraBaixo?: boolean;
  },
): Promise<{ movimento: { id: string; estoque: number } }> {
  return pedir(`/api/admin/emporio/produtos/${produtoId}/estoque`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

// -----------------------------------------------------------------------------
// A contagem do dia
// -----------------------------------------------------------------------------

/**
 * A ficha em branco, com o que o sistema ESPERA encontrar.
 *
 * Os filtros existem porque as fichas fisicas sao tres — chocolate, geladeira
 * e cafe —, contadas em horarios diferentes. Quem conta a geladeira as 9h40
 * nao quer a lista do chocolate na frente.
 */
export function buscarFichaParaContar(opcoes?: {
  categoria?: CategoriaDoProduto;
  controle?: TipoDeControle;
}): Promise<{ linhas: LinhaParaContar[] }> {
  const busca = new URLSearchParams();

  if (opcoes?.categoria) {
    busca.set("categoria", opcoes.categoria);
  }

  if (opcoes?.controle) {
    busca.set("controle", opcoes.controle);
  }

  const query = busca.toString();

  return pedir(`/api/admin/emporio/contagem${query ? `?${query}` : ""}`);
}

/** Grava a ficha e reconcilia o estoque com um movimento de AJUSTE. */
export function gravarContagem(entrada: {
  /** O dia da FICHA, nao o do lancamento. */
  dia: string;
  horario?: string | null;
  observacao?: string | null;
  itens: { produtoId: string; quantidade: number }[];
}): Promise<{ contagem: ContagemGravada }> {
  return pedir("/api/admin/emporio/contagem", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

// -----------------------------------------------------------------------------
// O consumo
// -----------------------------------------------------------------------------

export type RespostaDeConsumos = {
  consumos: ConsumoLancado[];
  formasDePagamento: FormaDePagamento[];
};

export function buscarConsumos(entrada: {
  de: string;
  ate: string;
  clienteId?: string;
  momento?: MomentoDoPagamento;
}): Promise<RespostaDeConsumos> {
  const busca = new URLSearchParams({ de: entrada.de, ate: entrada.ate });

  if (entrada.clienteId) {
    busca.set("clienteId", entrada.clienteId);
  }

  if (entrada.momento) {
    busca.set("momento", entrada.momento);
  }

  return pedir(`/api/admin/emporio/consumos?${busca}`);
}

/**
 * Lanca uma linha da ficha.
 *
 * REPARE NO QUE NAO VAI AQUI: o VALOR. Quem multiplica quantidade por preco e
 * o servidor. Mandar o total daqui devolveria o problema que este lancamento
 * veio resolver — um numero digitado que ninguem confere.
 */
export function lancarConsumo(entrada: {
  clienteId: string;
  produtoId: string;
  quantidade: number;
  /** O dia e a hora do PAPEL, nao os do lancamento. */
  dia: string;
  hora: string;
  salaId?: string | null;
  momento: MomentoDoPagamento;
  formaPagamentoId?: string | null;
}): Promise<{ consumo: ConsumoLancado }> {
  return pedir("/api/admin/emporio/consumos", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

// -----------------------------------------------------------------------------
// Apoio: o cliente e a sala
// -----------------------------------------------------------------------------

/**
 * Procura o cliente CADASTRADO, por um pedaco do nome ou do telefone.
 *
 * E a mesma busca do balcao, e de proposito: a recepcionista disse por que sem
 * ninguem perguntar — *"pego o sobrenome para nao ficar tipo Matheus da Toca,
 * Matheus Vitullo"*. Um campo de nome livre aqui recriaria a bagunca dos 44
 * nomes dentro do emporio.
 */
export function procurarClientes(
  termo: string,
  sinal?: AbortSignal,
): Promise<{ clientes: ClienteParaEscolher[] }> {
  return pedir(`/api/admin/clientes?q=${encodeURIComponent(termo)}`, {
    signal: sinal,
  });
}

/** As salas, para anotar onde a pessoa estava — como na ficha de papel. */
export function buscarSalas(): Promise<{ salas: SalaParaEscolher[] }> {
  return pedir("/api/admin/salas");
}

// -----------------------------------------------------------------------------
// A foto do produto
// -----------------------------------------------------------------------------

/**
 * Envia a imagem do produto.
 *
 * O ARQUIVO PASSA PELO NOSSO SERVIDOR e so la e assinado para o Cloudinary. O
 * segredo nunca vem ao navegador: quem o tem apaga tudo que esta lá. Por isso
 * aqui vai FormData, e nao um pedido direto para fora.
 *
 * UMA foto por produto: enviar de novo TROCA a anterior.
 */
export async function enviarFotoDoProduto(
  produtoId: string,
  arquivo: File,
): Promise<{ produto: ProdutoDoEmporio }> {
  const formulario = new FormData();
  formulario.append("arquivo", arquivo);

  let resposta: Response;

  try {
    // Sem "Content-Type" de proposito: o navegador precisa escrever o dele,
    // com a fronteira do formulario. Definindo a mao, o servidor nao consegue
    // separar os campos.
    resposta = await fetch(`/api/admin/emporio/produtos/${produtoId}/foto`, {
      method: "POST",
      body: formulario,
      cache: "no-store",
    });
  } catch {
    throw new ErroDaApi(
      0,
      "Não conseguimos enviar a imagem. Verifique sua conexão.",
    );
  }

  const corpo: unknown = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const { erro, codigo } = lerErro(corpo);
    throw new ErroDaApi(
      resposta.status,
      erro ?? "Não conseguimos enviar a imagem.",
      codigo ?? null,
    );
  }

  return corpo as { produto: ProdutoDoEmporio };
}

/**
 * Tira a imagem do produto.
 *
 * A foto sai do produto MESMO QUE o Cloudinary recuse apagar o arquivo — uma
 * instabilidade lá fora não pode deixar no ar uma imagem que a equipe quer
 * fora. "arquivoApagado" diz se o arquivo também saiu, para a tela avisar.
 */
export function removerFotoDoProduto(
  produtoId: string,
): Promise<{ arquivoApagado: boolean }> {
  return pedir(`/api/admin/emporio/produtos/${produtoId}/foto`, {
    method: "DELETE",
  });
}
