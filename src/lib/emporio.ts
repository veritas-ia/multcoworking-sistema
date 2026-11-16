/**
 * O EMPORIO: produtos e estoque (Fase 15, Parte A).
 *
 * POR QUE ISTO EXISTE
 *
 * O emporio JA e cobrado hoje, digitado a mao. As "Outras linhas" do controle
 * de horas existem justamente para isso — o comentario no codigo diz
 * "posicoes, emporio, impressoes". Alguem soma a ficha fisica da parede e
 * digita um valor no documento do mes. E o mesmo risco da planilha que deu
 * origem ao controle de horas: um total digitado, sem conferencia.
 *
 * COMO FUNCIONA DE VERDADE (levantado com a recepcionista)
 *
 * Nao existe comanda. O cliente anota na FICHA FISICA o que pegou — nome,
 * sala, forma de pagamento, produto e horario — e a recepcionista le no dia
 * seguinte e lanca no sistema. A ficha continua existindo; o sistema entra
 * depois dela.
 *
 * O ESTOQUE E UMA LISTA DE MOVIMENTOS, e nao um numero na linha do produto.
 * Um numero solto responde "o estoque esta em 3" e nada mais. Quando ele
 * estiver errado — e vai estar, porque a reposicao e lancada a mao — ninguem
 * consegue dizer de onde veio o 3. Somando movimentos, a pergunta "por que
 * esta em 3?" tem resposta, linha por linha.
 */
import {
  CategoriaDoProduto,
  MomentoDoPagamento,
  TipoDeControle,
  TipoMovimentoEstoque,
} from "@/generated/prisma/enums";

import {
  apagarImagem,
  cloudinaryConfigurado,
  enviarImagem,
  PASTAS,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_ACEITOS,
} from "./cloudinary";
import { prisma } from "./prisma";
import { dataLocalDe, horaLocalDe, instanteDe, type DataLocal } from "./tempo";

export {
  CategoriaDoProduto,
  MomentoDoPagamento,
  TipoDeControle,
  TipoMovimentoEstoque,
};

/** Uma etiqueta, como a tela desenha. */
export type TagNaTela = { id: string; nome: string; cor: string };

/** Um produto do emporio, com o estoque somado dos movimentos. */
export type ProdutoDoEmporio = {
  id: string;
  nome: string;
  /** COMIDA ou BEBIDA — as duas fichas físicas que a equipe já usa. */
  categoria: CategoriaDoProduto;
  /** As etiquetas coloridas. Pode ser vazio. */
  tags: TagNaTela[];
  /** Em reais, com duas casas: "6.00". */
  preco: string;
  ativo: boolean;
  ordem: number;
  /**
   * A foto, como no iFood. NULA e estado normal: produto sem foto aparece com
   * a inicial do nome, nunca com um espaco vazio.
   */
  foto: { publicId: string; url: string } | null;
  /**
   * A SOMA dos movimentos. PODE SER NEGATIVO de proposito — ver
   * "registrarMovimento": o consumo que ja aconteceu nunca e recusado, e
   * estoque negativo e o sinal de que falta lancar uma reposicao.
   */
  estoque: number;
};

export type Falha = { motivo: string; codigo: string };
export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

/**
 * Monta o produto como a tela espera.
 *
 * UM lugar so: antes disto a montagem estava copiada em tres funcoes, e
 * acrescentar um campo exigia lembrar das tres — quem esquecesse uma deixaria
 * a tela sem o dado em UM caminho, que e o tipo de falha que ninguem percebe.
 */
function paraTela(
  produto: {
    id: string;
    nome: string;
    categoria: CategoriaDoProduto;
    preco: { toFixed: (casas: number) => string };
    ativo: boolean;
    ordem: number;
    fotoPublicId: string | null;
    fotoUrl: string | null;
    tags: { tag: { id: string; nome: string; cor: string } }[];
  },
  estoque: number,
): ProdutoDoEmporio {
  return {
    id: produto.id,
    nome: produto.nome,
    categoria: produto.categoria,
    tags: produto.tags.map(({ tag }) => ({ id: tag.id, nome: tag.nome, cor: tag.cor })),
    preco: produto.preco.toFixed(2),
    ativo: produto.ativo,
    ordem: produto.ordem,
    foto: fotoDe(produto),
    estoque,
  };
}

const NOME_MINIMO = 2;
const NOME_MAXIMO = 60;
const MOTIVO_MAXIMO = 160;

/** Aceita "6", "6.50" e "6,50". Recusa negativo e texto. */
function precoValido(bruto: string): string | null {
  const limpo = bruto.trim().replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) {
    return null;
  }

  return Number(limpo).toFixed(2);
}

// -----------------------------------------------------------------------------
// Ler
// -----------------------------------------------------------------------------

/**
 * Os produtos, com o estoque de cada um.
 *
 * Duas consultas em vez de uma: a lista de produtos e a soma dos movimentos
 * agrupada por produto. Juntar isso num `include` traria TODOS os movimentos
 * de TODOS os produtos para a memoria so para soma-los — e eles crescem para
 * sempre, enquanto os produtos sao uma duzia.
 */
export async function listarProdutos(opcoes?: {
  /** Verdadeiro nas telas de lancamento: produto desligado nao se vende. */
  somenteAtivos?: boolean;
  /** So uma das fichas: COMIDA ou BEBIDA. */
  categoria?: CategoriaDoProduto;
}): Promise<ProdutoDoEmporio[]> {
  const produtos = await prisma.produto.findMany({
    where: {
      ...(opcoes?.somenteAtivos ? { ativo: true } : {}),
      ...(opcoes?.categoria ? { categoria: opcoes.categoria } : {}),
    },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    include: {
      // As etiquetas vêm junto: são poucas por produto, e uma consulta por
      // produto na tela de lançamento seriam 30 idas ao banco.
      tags: { include: { tag: true } },
    },
  });

  if (produtos.length === 0) {
    return [];
  }

  const somas = await prisma.movimentoDeEstoque.groupBy({
    by: ["produtoId"],
    where: { produtoId: { in: produtos.map((produto) => produto.id) } },
    _sum: { quantidade: true },
  });

  const porProduto = new Map(
    somas.map((soma) => [soma.produtoId, soma._sum.quantidade ?? 0]),
  );

  return produtos.map((produto) =>
    paraTela(produto, porProduto.get(produto.id) ?? 0),
  );
}

/** Um movimento, como a tela de histórico do produto mostra. */
export type MovimentoNaLista = {
  id: string;
  tipo: TipoMovimentoEstoque;
  quantidade: number;
  motivo: string | null;
  /** Nome de quem lancou, ou nulo quando o usuario foi desligado depois. */
  lancadoPor: string | null;
  criadoEm: Date;
};

/**
 * O extrato de um produto, do mais recente para o mais antigo.
 *
 * E isto que responde "por que o estoque esta em 3?". Sem o extrato, o numero
 * errado nao tem como ser explicado nem corrigido com confianca.
 */
export async function extratoDoProduto(
  produtoId: string,
  limite = 100,
): Promise<MovimentoNaLista[]> {
  const movimentos = await prisma.movimentoDeEstoque.findMany({
    where: { produtoId },
    orderBy: { criadoEm: "desc" },
    take: limite,
    select: {
      id: true,
      tipo: true,
      quantidade: true,
      motivo: true,
      criadoEm: true,
      criadoPor: { select: { nome: true } },
    },
  });

  return movimentos.map((movimento) => ({
    id: movimento.id,
    tipo: movimento.tipo,
    quantidade: movimento.quantidade,
    motivo: movimento.motivo,
    lancadoPor: movimento.criadoPor?.nome ?? null,
    criadoEm: movimento.criadoEm,
  }));
}

// -----------------------------------------------------------------------------
// As etiquetas
// -----------------------------------------------------------------------------

/**
 * As etiquetas do emporio.
 *
 * Lista curta e quase estatica, entao vem inteira — sem paginacao e sem
 * filtro de ativa por padrao: o painel precisa das desligadas para religar.
 */
export async function listarTags(opcoes?: {
  somenteAtivas?: boolean;
}): Promise<(TagNaTela & { ativa: boolean; ordem: number })[]> {
  const tags = await prisma.tagDeProduto.findMany({
    where: opcoes?.somenteAtivas ? { ativa: true } : {},
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });

  return tags.map((tag) => ({
    id: tag.id,
    nome: tag.nome,
    cor: tag.cor,
    ativa: tag.ativa,
    ordem: tag.ordem,
  }));
}

/** "#FFC700" ou "#ffc700". Qualquer outra coisa vira etiqueta invisivel. */
const COR_VALIDA = /^#[0-9A-Fa-f]{6}$/;

/**
 * Cria uma etiqueta.
 *
 * A COR E OBRIGATORIA e conferida aqui e no banco. Uma cor torta nao daria
 * erro na hora: a etiqueta simplesmente sumiria da tela, e ninguem ligaria
 * uma coisa a outra.
 */
export async function criarTag(entrada: {
  nome: string;
  cor: string;
}): Promise<Resultado<TagNaTela>> {
  const nome = entrada.nome.trim().replace(/\s+/g, " ");

  if (nome.length < 2 || nome.length > 40) {
    return {
      ok: false,
      falha: { motivo: "O nome da etiqueta precisa ter de 2 a 40 caracteres.", codigo: "NOME_INVALIDO" },
    };
  }

  const cor = entrada.cor.trim();

  if (!COR_VALIDA.test(cor)) {
    return {
      ok: false,
      falha: { motivo: "Escolha uma cor no formato #RRGGBB.", codigo: "COR_INVALIDA" },
    };
  }

  const repetida = await prisma.tagDeProduto.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
    select: { id: true },
  });

  if (repetida) {
    return {
      ok: false,
      falha: { motivo: "Já existe uma etiqueta com este nome.", codigo: "NOME_REPETIDO" },
    };
  }

  const ultima = await prisma.tagDeProduto.findFirst({
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const criada = await prisma.tagDeProduto.create({
    data: { nome, cor: cor.toUpperCase(), ordem: (ultima?.ordem ?? 0) + 1 },
  });

  return { ok: true, dados: { id: criada.id, nome: criada.nome, cor: criada.cor } };
}

// -----------------------------------------------------------------------------
// Cadastrar e editar
// -----------------------------------------------------------------------------

/**
 * Cadastra um produto.
 *
 * Nasce no fim da lista: a ordem e definida no painel por botoes de mover,
 * como nas areas de atuacao. Arrastar nao serve — a recepcao mexe no tablet, e
 * arrastar nao funciona pelo teclado.
 */
export async function criarProduto(entrada: {
  nome: string;
  categoria: CategoriaDoProduto;
  preco: string;
  /** As etiquetas escolhidas. Vazio é válido. */
  tagIds?: string[];
}): Promise<Resultado<ProdutoDoEmporio>> {
  const nome = entrada.nome.trim().replace(/\s+/g, " ");

  if (nome.length < NOME_MINIMO || nome.length > NOME_MAXIMO) {
    return {
      ok: false,
      falha: {
        motivo: `O nome precisa ter de ${NOME_MINIMO} a ${NOME_MAXIMO} caracteres.`,
        codigo: "NOME_INVALIDO",
      },
    };
  }

  const preco = precoValido(entrada.preco);

  if (preco === null) {
    return {
      ok: false,
      falha: {
        motivo: "Use um preço como 6 ou 6,50. Negativo não vale.",
        codigo: "PRECO_INVALIDO",
      },
    };
  }

  // Nome repetido e recusado: duas "Barrinha de cereal" na lista fariam a
  // recepcionista escolher no chute, e o relatorio mostraria o mesmo produto
  // partido em dois.
  const repetido = await prisma.produto.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
    select: { id: true },
  });

  if (repetido) {
    return {
      ok: false,
      falha: { motivo: "Já existe um produto com este nome.", codigo: "NOME_REPETIDO" },
    };
  }

  const ultimo = await prisma.produto.findFirst({
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const criado = await prisma.produto.create({
    data: {
      nome,
      categoria: entrada.categoria,
      preco,
      ordem: (ultimo?.ordem ?? 0) + 1,
      tags: { create: (entrada.tagIds ?? []).map((tagId) => ({ tagId })) },
    },
    include: { tags: { include: { tag: true } } },
  });

  return { ok: true, dados: paraTela(criado, 0) };
}

/**
 * Renomeia e muda o preco.
 *
 * MUDAR O PRECO NAO RETROAGE: cada consumo congela o preco que valia no dia,
 * igual a reserva. Mudar aqui vale so para o proximo lancamento — senao um mes
 * ja fechado mudaria de valor sozinho.
 */
export async function editarProduto(
  id: string,
  entrada: {
    nome: string;
    preco: string;
    categoria?: CategoriaDoProduto;
    /** A lista COMPLETA de etiquetas. Ausente = não mexer nelas. */
    tagIds?: string[];
  },
): Promise<Resultado<ProdutoDoEmporio>> {
  const existente = await prisma.produto.findUnique({ where: { id } });

  if (!existente) {
    return {
      ok: false,
      falha: { motivo: "Produto não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  const nome = entrada.nome.trim().replace(/\s+/g, " ");

  if (nome.length < NOME_MINIMO || nome.length > NOME_MAXIMO) {
    return {
      ok: false,
      falha: {
        motivo: `O nome precisa ter de ${NOME_MINIMO} a ${NOME_MAXIMO} caracteres.`,
        codigo: "NOME_INVALIDO",
      },
    };
  }

  const preco = precoValido(entrada.preco);

  if (preco === null) {
    return {
      ok: false,
      falha: {
        motivo: "Use um preço como 6 ou 6,50. Negativo não vale.",
        codigo: "PRECO_INVALIDO",
      },
    };
  }

  // Salvar o MESMO nome e aceito: a tela manda o nome junto mesmo quando a
  // pessoa so mexeu no preco. Mesma regra das empresas.
  const repetido = await prisma.produto.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" }, id: { not: id } },
    select: { id: true },
  });

  if (repetido) {
    return {
      ok: false,
      falha: { motivo: "Já existe um produto com este nome.", codigo: "NOME_REPETIDO" },
    };
  }

  const salvo = await prisma.produto.update({
    where: { id },
    data: {
      nome,
      preco,
      ...(entrada.categoria ? { categoria: entrada.categoria } : {}),
      // As etiquetas sao REGRAVADAS em bloco quando vierem: a tela manda a
      // lista inteira, e tirar uma e tao normal quanto acrescentar. Sem a
      // lista, ficam como estao.
      ...(entrada.tagIds
        ? {
            tags: {
              deleteMany: {},
              create: entrada.tagIds.map((tagId) => ({ tagId })),
            },
          }
        : {}),
    },
    include: { tags: { include: { tag: true } } },
  });

  const soma = await prisma.movimentoDeEstoque.aggregate({
    where: { produtoId: id },
    _sum: { quantidade: true },
  });

  return { ok: true, dados: paraTela(salvo, soma._sum.quantidade ?? 0) };
}

/**
 * Liga ou desliga o produto.
 *
 * EXCLUIR NAO EXISTE, mesma regra de salas, empresas e areas de atuacao: a
 * chave estrangeira do movimento e ON DELETE RESTRICT. Apagar um produto
 * tiraria o historico de consumo em silencio, e o relatorio do mes passado
 * deixaria de bater.
 *
 * DIFERENTE DAS AREAS DE ATUACAO, aqui NAO existe "o ultimo nao se desliga":
 * um emporio sem nenhum produto ativo e um estado legitimo — simplesmente nao
 * ha o que vender. Na area de atuacao era diferente, porque sem nenhuma opcao
 * o formulario de reserva nao fechava e ninguem conseguia reservar.
 */
export async function ligarOuDesligarProduto(
  id: string,
  ativo: boolean,
): Promise<Resultado<null>> {
  const existente = await prisma.produto.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existente) {
    return {
      ok: false,
      falha: { motivo: "Produto não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  await prisma.produto.update({ where: { id }, data: { ativo } });
  return { ok: true, dados: null };
}

/**
 * Regrava a ordem de TODOS os produtos em bloco.
 *
 * Em bloco, e nao um a um, para nunca haver dois com o mesmo numero — mesma
 * regra das areas de atuacao. A lista precisa vir completa: faltando um, ele
 * ficaria com a ordem velha e a lista sairia embaralhada.
 */
export async function reordenarProdutos(ids: string[]): Promise<Resultado<null>> {
  const todos = await prisma.produto.findMany({ select: { id: true } });
  const conhecidos = new Set(todos.map((produto) => produto.id));

  if (ids.length !== todos.length || ids.some((id) => !conhecidos.has(id))) {
    return {
      ok: false,
      falha: {
        motivo: "A nova ordem precisa listar todos os produtos, uma vez cada.",
        codigo: "ORDEM_INCOMPLETA",
      },
    };
  }

  if (new Set(ids).size !== ids.length) {
    return {
      ok: false,
      falha: {
        motivo: "A nova ordem tem produtos repetidos.",
        codigo: "ORDEM_REPETIDA",
      },
    };
  }

  await prisma.$transaction(
    ids.map((id, indice) =>
      prisma.produto.update({ where: { id }, data: { ordem: indice + 1 } }),
    ),
  );

  return { ok: true, dados: null };
}

// -----------------------------------------------------------------------------
// Estoque
// -----------------------------------------------------------------------------

/**
 * Lanca um movimento de estoque.
 *
 * O SINAL E DECIDIDO AQUI, pelo tipo — quem chama informa a quantidade sempre
 * em positivo e diz o que aconteceu. Pedir o sinal a quem chama seria convidar
 * ao erro de uma REPOSICAO negativa, que somaria para o lado errado e
 * continuaria parecendo certa. O banco tambem confere, pela trava
 * "movimento_sinal_do_tipo": a regra e dele, nao so da aplicacao.
 *
 * ESTOQUE NEGATIVO E PERMITIDO, e isto e decisao de desenho. A venda que chega
 * aqui JA ACONTECEU — esta escrita na ficha fisica da parede. Recusar o
 * lancamento por falta de saldo nao devolveria o produto a prateleira: so
 * faria a venda nao ser registrada, e o cliente nao ser cobrado. O negativo e
 * justamente o aviso de que falta lancar uma reposicao.
 */
export async function registrarMovimento(entrada: {
  produtoId: string;
  tipo: TipoMovimentoEstoque;
  /** SEMPRE positiva. O sinal sai do tipo. */
  quantidade: number;
  /** Obrigatorio no AJUSTE. "paraBaixo" diz o lado do ajuste. */
  motivo?: string | null;
  /** So no AJUSTE: verdadeiro quando a contagem na prateleira deu MENOS. */
  paraBaixo?: boolean;
  usuarioId?: string | null;
}): Promise<Resultado<{ id: string; estoque: number }>> {
  const produto = await prisma.produto.findUnique({
    where: { id: entrada.produtoId },
    select: { id: true },
  });

  if (!produto) {
    return {
      ok: false,
      falha: { motivo: "Produto não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  if (!Number.isInteger(entrada.quantidade) || entrada.quantidade <= 0) {
    return {
      ok: false,
      falha: {
        motivo: "A quantidade precisa ser um número inteiro maior que zero.",
        codigo: "QUANTIDADE_INVALIDA",
      },
    };
  }

  const motivo = entrada.motivo?.trim() || null;

  if (entrada.tipo === TipoMovimentoEstoque.AJUSTE && !motivo) {
    return {
      ok: false,
      falha: {
        motivo: "Escreva por que o estoque está sendo corrigido.",
        codigo: "MOTIVO_OBRIGATORIO",
      },
    };
  }

  if (motivo && motivo.length > MOTIVO_MAXIMO) {
    return {
      ok: false,
      falha: {
        motivo: `O motivo passa de ${MOTIVO_MAXIMO} caracteres.`,
        codigo: "MOTIVO_LONGO",
      },
    };
  }

  const quantidade =
    entrada.tipo === TipoMovimentoEstoque.REPOSICAO
      ? entrada.quantidade
      : entrada.tipo === TipoMovimentoEstoque.AJUSTE
        ? entrada.paraBaixo
          ? -entrada.quantidade
          : entrada.quantidade
        : -entrada.quantidade;

  const criado = await prisma.movimentoDeEstoque.create({
    data: {
      produtoId: entrada.produtoId,
      tipo: entrada.tipo,
      quantidade,
      motivo,
      criadoPorId: entrada.usuarioId ?? null,
    },
    select: { id: true },
  });

  const soma = await prisma.movimentoDeEstoque.aggregate({
    where: { produtoId: entrada.produtoId },
    _sum: { quantidade: true },
  });

  return {
    ok: true,
    dados: { id: criado.id, estoque: soma._sum.quantidade ?? 0 },
  };
}

// -----------------------------------------------------------------------------
// A foto do produto
// -----------------------------------------------------------------------------

/**
 * As duas colunas viram um objeto so, ou nulo.
 *
 * O banco garante que elas andam juntas (trava "produto_foto_completa"): o
 * endereco sem o identificador deixaria arquivo orfao no Cloudinary para
 * sempre, e o identificador sem o endereco mostraria imagem quebrada na tela.
 */
function fotoDe(produto: {
  fotoPublicId: string | null;
  fotoUrl: string | null;
}): { publicId: string; url: string } | null {
  return produto.fotoPublicId && produto.fotoUrl
    ? { publicId: produto.fotoPublicId, url: produto.fotoUrl }
    : null;
}

/**
 * Troca a foto do produto.
 *
 * O ARQUIVO PASSA PELO SERVIDOR, nunca direto do navegador: o API Secret do
 * Cloudinary assina o pedido aqui, e quem tem esse segredo apaga tudo que esta
 * la. Mesma regra das fotos das salas.
 *
 * A VALIDACAO E DAQUI, e nao da tela. A tela tambem confere, mas so para
 * avisar cedo — esconder o botao nao para quem manda o pedido direto.
 */
export async function definirFotoDoProduto(
  id: string,
  arquivo: Blob,
): Promise<Resultado<ProdutoDoEmporio>> {
  const produto = await prisma.produto.findUnique({ where: { id } });

  if (!produto) {
    return {
      ok: false,
      falha: { motivo: "Produto não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  if (!TIPOS_ACEITOS.includes(arquivo.type as (typeof TIPOS_ACEITOS)[number])) {
    return {
      ok: false,
      falha: {
        motivo: "A imagem precisa ser JPG, PNG ou WEBP.",
        codigo: "TIPO_NAO_ACEITO",
      },
    };
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return {
      ok: false,
      falha: {
        motivo: `A imagem passa de ${TAMANHO_MAXIMO_BYTES / (1024 * 1024)} MB.`,
        codigo: "ARQUIVO_GRANDE",
      },
    };
  }

  // So depois de o arquivo passar. Credenciais vazias sao estado NORMAL, nao
  // erro: o painel avisa que o envio esta indisponivel e todo o resto do
  // sistema continua funcionando — e assim a previa roda sem Cloudinary.
  //
  // A ORDEM IMPORTA: um PDF continua sendo um PDF em qualquer servidor, e
  // dizer "envio indisponivel" para quem escolheu o arquivo errado manda a
  // pessoa procurar defeito no lugar errado.
  if (!cloudinaryConfigurado()) {
    return {
      ok: false,
      falha: {
        motivo: "O envio de imagens está indisponível neste servidor.",
        codigo: "CLOUDINARY_DESLIGADO",
      },
    };
  }

  const enviada = await enviarImagem(arquivo, PASTAS.produtos);

  if (!enviada.ok) {
    return { ok: false, falha: { motivo: enviada.motivo, codigo: "ENVIO_RECUSADO" } };
  }

  // A ANTIGA SO SAI DEPOIS QUE A NOVA CHEGOU. Apagando antes, uma falha no
  // envio deixaria o produto sem foto nenhuma — pior do que ficar com a velha.
  const anterior = produto.fotoPublicId;

  const salvo = await prisma.produto.update({
    where: { id },
    data: { fotoPublicId: enviada.foto.publicId, fotoUrl: enviada.foto.url },
    include: { tags: { include: { tag: true } } },
  });

  if (anterior) {
    // Se o Cloudinary recusar, a foto nova ja esta valendo. O arquivo velho
    // fica la ocupando espaco, o que e um problema de conta, nao de sistema.
    await apagarImagem(anterior);
  }

  const soma = await prisma.movimentoDeEstoque.aggregate({
    where: { produtoId: id },
    _sum: { quantidade: true },
  });

  return { ok: true, dados: paraTela(salvo, soma._sum.quantidade ?? 0) };
}

/**
 * Remove a foto do produto.
 *
 * A LINHA SAI DO BANCO DE QUALQUER JEITO, mesmo que o Cloudinary recuse — uma
 * instabilidade la fora nao pode deixar no ar uma imagem que a equipe quer
 * fora. Mesma decisao das fotos das salas.
 *
 * Devolve se o arquivo tambem saiu, para a tela poder avisar que ele pode ter
 * ficado. Na previa a remocao no Cloudinary nao e nem tentada: o arquivo e
 * compartilhado com producao.
 */
export async function removerFotoDoProduto(
  id: string,
): Promise<Resultado<{ arquivoApagado: boolean }>> {
  const produto = await prisma.produto.findUnique({
    where: { id },
    select: { fotoPublicId: true },
  });

  if (!produto) {
    return {
      ok: false,
      falha: { motivo: "Produto não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  if (!produto.fotoPublicId) {
    return { ok: true, dados: { arquivoApagado: true } };
  }

  await prisma.produto.update({
    where: { id },
    data: { fotoPublicId: null, fotoUrl: null },
  });

  return {
    ok: true,
    dados: { arquivoApagado: await apagarImagem(produto.fotoPublicId) },
  };
}

// -----------------------------------------------------------------------------
// A CONTAGEM DIARIA
// -----------------------------------------------------------------------------

/**
 * Uma linha da ficha, pronta para a equipe preencher.
 *
 * Traz o que o sistema ESPERA encontrar, para a pessoa ver a diferenca na hora
 * de digitar — e nao depois, quando ja fechou a tela.
 */
export type LinhaParaContar = {
  produtoId: string;
  nome: string;
  categoria: CategoriaDoProduto;
  controle: TipoDeControle;
  /**
   * Em ESTOQUE, quantas unidades o sistema acha que ha. Em CONTADOR, a ULTIMA
   * LEITURA registrada — e o numero de onde a proxima diferenca sai.
   */
  esperado: number;
};

/** O que a contagem descobriu sobre um produto. */
export type ResultadoDaLinha = {
  produtoId: string;
  nome: string;
  controle: TipoDeControle;
  /** O que a equipe escreveu. */
  contado: number;
  /** O que o sistema esperava. */
  esperado: number;
  /**
   * ESTOQUE: contado - esperado. Negativo e o "FALTOU" da ficha — sumiu sem
   * ninguem lancar. Positivo e sobra: chegou mercadoria que ninguem registrou.
   *
   * CONTADOR: quantos a maquina fez desde a leitura anterior. Nunca negativo.
   */
  diferenca: number;
};

export type ContagemGravada = {
  id: string;
  dia: string;
  horario: string | null;
  observacao: string | null;
  linhas: ResultadoDaLinha[];
  /** Quantas unidades faltaram no total — o numero que a equipe procura. */
  faltaram: number;
  /** Quantas a maquina de cafe fez desde a leitura anterior. */
  cafesFeitos: number;
};

/**
 * Monta a ficha em branco para a equipe preencher.
 *
 * Produto DESLIGADO fica de fora: ele nao esta mais na prateleira, e pedir a
 * contagem dele faria a equipe escrever zero todo dia para sempre.
 */
export async function prepararContagem(opcoes?: {
  categoria?: CategoriaDoProduto;
  controle?: TipoDeControle;
}): Promise<LinhaParaContar[]> {
  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      ...(opcoes?.categoria ? { categoria: opcoes.categoria } : {}),
      ...(opcoes?.controle ? { controle: opcoes.controle } : {}),
    },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, categoria: true, controle: true },
  });

  if (produtos.length === 0) {
    return [];
  }

  const ids = produtos.map((produto) => produto.id);

  // ESTOQUE: o esperado e a soma dos movimentos.
  const somas = await prisma.movimentoDeEstoque.groupBy({
    by: ["produtoId"],
    where: { produtoId: { in: ids } },
    _sum: { quantidade: true },
  });

  const estoquePorProduto = new Map(
    somas.map((soma) => [soma.produtoId, soma._sum.quantidade ?? 0]),
  );

  // CONTADOR: o esperado e a ULTIMA LEITURA, que mora na contagem anterior.
  const leituras = await ultimasLeituras(ids);

  return produtos.map((produto) => ({
    produtoId: produto.id,
    nome: produto.nome,
    categoria: produto.categoria,
    controle: produto.controle,
    esperado:
      produto.controle === TipoDeControle.CONTADOR
        ? (leituras.get(produto.id) ?? 0)
        : (estoquePorProduto.get(produto.id) ?? 0),
  }));
}

/**
 * A ultima leitura registrada de cada produto de contador.
 *
 * Uma consulta so, pegando a linha mais recente por produto. Fazer uma por
 * produto seriam 12 idas ao banco para montar uma tela.
 */
async function ultimasLeituras(ids: string[]): Promise<Map<string, number>> {
  const linhas = await prisma.itemDaContagem.findMany({
    where: { produtoId: { in: ids } },
    orderBy: [{ contagem: { dia: "desc" } }, { contagem: { criadoEm: "desc" } }],
    select: { produtoId: true, quantidade: true },
  });

  const porProduto = new Map<string, number>();

  for (const linha of linhas) {
    // A lista vem da mais recente para a mais antiga: a primeira de cada
    // produto e a que vale.
    if (!porProduto.has(linha.produtoId)) {
      porProduto.set(linha.produtoId, linha.quantidade);
    }
  }

  return porProduto;
}

/**
 * Grava a contagem e RECONCILIA o estoque.
 *
 * O QUE ACONTECE COM CADA LINHA:
 *
 * ESTOQUE — a diferenca entre o contado e o esperado vira um movimento de
 *   AJUSTE, com o dia da ficha escrito no motivo. O estoque continua sendo a
 *   soma dos movimentos: a contagem nao cria uma segunda fonte de verdade, ela
 *   conserta a primeira. Diferenca zero nao gera movimento nenhum — um
 *   movimento que nao move nada so suja o extrato.
 *
 * CONTADOR — nada de movimento: "estoque de expresso" nao existe. A leitura
 *   fica guardada, e o consumo e a diferenca para a leitura anterior.
 *
 * O "esperado" FICA GRAVADO em cada linha. Recalculado depois, ele sempre
 * daria diferenca zero — porque o ajuste ja aconteceu —, e o relatorio do que
 * faltou ficaria vazio justamente no caso que importa.
 */
export async function registrarContagem(entrada: {
  /** "AAAA-MM-DD", o dia da FICHA — nao o do lancamento. */
  dia: string;
  horario?: string | null;
  observacao?: string | null;
  itens: { produtoId: string; quantidade: number }[];
  usuarioId?: string | null;
  /** Para teste: o "hoje" usado na conferência de data futura. */
  agora?: Date;
}): Promise<Resultado<ContagemGravada>> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.dia)) {
    return {
      ok: false,
      falha: { motivo: "Informe o dia da contagem.", codigo: "DIA_INVALIDO" },
    };
  }

  // Contagem de amanha nao existe: a prateleira de amanha ninguem viu.
  const hoje = dataLocalDe(entrada.agora ?? new Date());

  if (entrada.dia > hoje) {
    return {
      ok: false,
      falha: {
        motivo: "Não dá para contar um dia que ainda não aconteceu.",
        codigo: "DIA_NO_FUTURO",
      },
    };
  }

  if (entrada.itens.length === 0) {
    return {
      ok: false,
      falha: { motivo: "Informe ao menos um produto.", codigo: "SEM_ITENS" },
    };
  }

  const repetidos =
    new Set(entrada.itens.map((item) => item.produtoId)).size !==
    entrada.itens.length;

  if (repetidos) {
    return {
      ok: false,
      falha: {
        motivo: "O mesmo produto aparece duas vezes na contagem.",
        codigo: "PRODUTO_REPETIDO",
      },
    };
  }

  for (const item of entrada.itens) {
    if (!Number.isInteger(item.quantidade) || item.quantidade < 0) {
      return {
        ok: false,
        falha: {
          motivo: "A quantidade contada precisa ser um número inteiro, zero ou mais.",
          codigo: "QUANTIDADE_INVALIDA",
        },
      };
    }
  }

  const ids = entrada.itens.map((item) => item.produtoId);
  const esperados = await prepararContagem();
  const porId = new Map(esperados.map((linha) => [linha.produtoId, linha]));

  const desconhecido = ids.find((id) => !porId.has(id));

  if (desconhecido) {
    return {
      ok: false,
      falha: {
        motivo: "Um dos produtos da contagem não existe ou está desligado.",
        codigo: "NAO_ENCONTRADO",
      },
    };
  }

  // LEITURA DE MAQUINA NAO ANDA PARA TRAS.
  //
  // O contador e acumulado: ele so cresce. Uma leitura menor que a anterior e
  // quase sempre erro de digitacao, e aceitar faria o consumo do dia sair
  // negativo — um numero que nao bate com nada e que ninguem vai conferir.
  for (const item of entrada.itens) {
    const linha = porId.get(item.produtoId)!;

    if (
      linha.controle === TipoDeControle.CONTADOR &&
      item.quantidade < linha.esperado
    ) {
      return {
        ok: false,
        falha: {
          motivo: `A leitura de "${linha.nome}" (${item.quantidade}) é menor que a anterior (${linha.esperado}). O contador da máquina só aumenta — confira o número.`,
          codigo: "LEITURA_MENOR",
        },
      };
    }
  }

  const [ano, mes, dia] = entrada.dia.split("-");

  const gravada = await prisma.$transaction(async (tx) => {
    const contagem = await tx.contagemDeEstoque.create({
      data: {
        dia: new Date(`${entrada.dia}T00:00:00.000Z`),
        horario: entrada.horario?.trim() || null,
        observacao: entrada.observacao?.trim() || null,
        criadoPorId: entrada.usuarioId ?? null,
        itens: {
          create: entrada.itens.map((item) => ({
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            esperado: porId.get(item.produtoId)!.esperado,
          })),
        },
      },
      select: { id: true },
    });

    for (const item of entrada.itens) {
      const linha = porId.get(item.produtoId)!;

      if (linha.controle === TipoDeControle.CONTADOR) {
        continue;
      }

      const diferenca = item.quantidade - linha.esperado;

      if (diferenca === 0) {
        continue;
      }

      await tx.movimentoDeEstoque.create({
        data: {
          produtoId: item.produtoId,
          tipo: TipoMovimentoEstoque.AJUSTE,
          quantidade: diferenca,
          motivo: `Contagem de ${dia}/${mes}/${ano}`,
          criadoPorId: entrada.usuarioId ?? null,
        },
      });
    }

    return contagem;
  });

  const linhas: ResultadoDaLinha[] = entrada.itens.map((item) => {
    const linha = porId.get(item.produtoId)!;

    return {
      produtoId: item.produtoId,
      nome: linha.nome,
      controle: linha.controle,
      contado: item.quantidade,
      esperado: linha.esperado,
      diferenca: item.quantidade - linha.esperado,
    };
  });

  return {
    ok: true,
    dados: {
      id: gravada.id,
      dia: entrada.dia,
      horario: entrada.horario?.trim() || null,
      observacao: entrada.observacao?.trim() || null,
      linhas,
      // O "FALTOU" da ficha: só o que sumiu, em módulo. A sobra não compensa
      // a falta — são dois problemas diferentes e somá-los esconderia os dois.
      faltaram: linhas
        .filter((l) => l.controle === TipoDeControle.ESTOQUE && l.diferenca < 0)
        .reduce((soma, l) => soma - l.diferenca, 0),
      cafesFeitos: linhas
        .filter((l) => l.controle === TipoDeControle.CONTADOR)
        .reduce((soma, l) => soma + l.diferenca, 0),
    },
  };
}

// -----------------------------------------------------------------------------
// O LANCAMENTO DO CONSUMO
// -----------------------------------------------------------------------------

/** Uma linha lancada, como a tela mostra. */
export type ConsumoLancado = {
  id: string;
  clienteId: string;
  clienteNome: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  /** Em reais, congelado: "7.50". */
  precoUnitario: string;
  valor: string;
  /** "AAAA-MM-DD" e "HH:MM" no relógio de São Paulo, do papel. */
  dia: string;
  hora: string;
  sala: string | null;
  momento: MomentoDoPagamento;
  formaPagamento: string | null;
  lancadoPor: string | null;
};

/** As formas de pagamento que a equipe usa. */
export async function listarFormasDePagamento(opcoes?: {
  somenteAtivas?: boolean;
}): Promise<{ id: string; nome: string; ativa: boolean }[]> {
  const formas = await prisma.formaDePagamento.findMany({
    where: opcoes?.somenteAtivas ? { ativa: true } : {},
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
  });

  return formas.map((forma) => ({
    id: forma.id,
    nome: forma.nome,
    ativa: forma.ativa,
  }));
}

/**
 * LANCA UM CONSUMO, lido da ficha fisica.
 *
 * O QUE O SISTEMA FAZ QUE A PESSOA FAZIA DE CABECA:
 *
 *  1. multiplica quantidade x preco e CONGELA os dois na linha. Reajustar o
 *     produto no painel depois nao muda o que ja foi consumido — mesma regra
 *     do valor congelado na reserva;
 *  2. da baixa no ESTOQUE, para a contagem do dia seguinte poder conferir. E
 *     essa conferencia que vira a coluna "FALTOU" da ficha;
 *  3. guarda DE QUEM foi, pelo cadastro — nunca por nome digitado.
 *
 * A HORA E A DO PAPEL, nao a do lancamento. A recepcionista le a ficha no dia
 * seguinte; carimbar a hora de agora faria o relatorio dizer que todo mundo
 * consome no fim do dia.
 *
 * CAFE NAO DA BAIXA NO ESTOQUE: ele e medido por contador da maquina, e
 * "estoque de expresso" nao existe. O consumo dele e registrado do mesmo
 * jeito — precisa entrar na cobranca quando for cobrado —, mas sem movimento.
 */
export async function lancarConsumo(entrada: {
  clienteId: string;
  produtoId: string;
  quantidade: number;
  /** "AAAA-MM-DD", o dia da FICHA. */
  dia: string;
  /** "HH:MM", a hora da FICHA. */
  hora: string;
  salaId?: string | null;
  momento: MomentoDoPagamento;
  formaPagamentoId?: string | null;
  usuarioId?: string | null;
  /** Para teste: o "hoje" usado na conferência de data futura. */
  agora?: Date;
}): Promise<Resultado<ConsumoLancado>> {
  if (!Number.isInteger(entrada.quantidade) || entrada.quantidade <= 0) {
    return {
      ok: false,
      falha: {
        motivo: "A quantidade precisa ser um número inteiro maior que zero.",
        codigo: "QUANTIDADE_INVALIDA",
      },
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.dia)) {
    return {
      ok: false,
      falha: { motivo: "Informe o dia do consumo.", codigo: "DIA_INVALIDO" },
    };
  }

  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(entrada.hora)) {
    return {
      ok: false,
      falha: { motivo: "Informe a hora como 09:40.", codigo: "HORA_INVALIDA" },
    };
  }

  const quando = instanteDe(entrada.dia as DataLocal, entrada.hora);
  const agora = entrada.agora ?? new Date();

  // Consumo de amanha nao existe. A ficha e sempre do passado.
  if (quando > agora) {
    return {
      ok: false,
      falha: {
        motivo: "Não dá para lançar um consumo que ainda não aconteceu.",
        codigo: "DIA_NO_FUTURO",
      },
    };
  }

  const produto = await prisma.produto.findUnique({
    where: { id: entrada.produtoId },
    select: { id: true, nome: true, preco: true, ativo: true, controle: true },
  });

  if (!produto || !produto.ativo) {
    return {
      ok: false,
      falha: {
        motivo: "Produto não encontrado ou desligado.",
        codigo: "NAO_ENCONTRADO",
      },
    };
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: entrada.clienteId },
    select: { id: true, nome: true, ativo: true },
  });

  if (!cliente || !cliente.ativo) {
    return {
      ok: false,
      falha: {
        motivo: "Cliente não encontrado ou desligado.",
        codigo: "NAO_ENCONTRADO",
      },
    };
  }

  // A FORMA DE PAGAMENTO SO EXISTE NO "NA_HORA".
  //
  // No NA_MENSALIDADE ainda nao foi pago: gravar uma forma ali seria dizer
  // que aconteceu algo que nao aconteceu, e o relatorio de formas passaria a
  // contar dinheiro que ninguem recebeu. O banco tambem recusa.
  const naHora = entrada.momento === MomentoDoPagamento.NA_HORA;
  const formaPagamentoId = naHora ? (entrada.formaPagamentoId ?? null) : null;

  if (formaPagamentoId) {
    const forma = await prisma.formaDePagamento.findUnique({
      where: { id: formaPagamentoId },
      select: { ativa: true },
    });

    if (!forma?.ativa) {
      return {
        ok: false,
        falha: {
          motivo: "Forma de pagamento não encontrada ou desligada.",
          codigo: "NAO_ENCONTRADO",
        },
      };
    }
  }

  if (entrada.salaId) {
    const sala = await prisma.sala.findUnique({
      where: { id: entrada.salaId },
      select: { id: true },
    });

    if (!sala) {
      return {
        ok: false,
        falha: { motivo: "Sala não encontrada.", codigo: "NAO_ENCONTRADO" },
      };
    }
  }

  // O VALOR E CALCULADO AQUI, NUNCA RECEBIDO DA TELA. Aceitar o total de
  // quem chama devolveria o problema que esta funcao veio resolver: um numero
  // digitado que ninguem confere.
  const precoUnitario = produto.preco;
  const valorCentavos = Math.round(Number(precoUnitario) * 100) * entrada.quantidade;

  const gravado = await prisma.$transaction(async (tx) => {
    const consumo = await tx.consumoDoEmporio.create({
      data: {
        clienteId: cliente.id,
        produtoId: produto.id,
        quantidade: entrada.quantidade,
        precoUnitario,
        valor: (valorCentavos / 100).toFixed(2),
        consumidoEm: quando,
        salaId: entrada.salaId ?? null,
        momento: entrada.momento,
        formaPagamentoId,
        criadoPorId: entrada.usuarioId ?? null,
      },
      include: {
        cliente: { select: { nome: true } },
        produto: { select: { nome: true } },
        sala: { select: { nome: true } },
        formaPagamento: { select: { nome: true } },
        criadoPor: { select: { nome: true } },
      },
    });

    // A BAIXA NO ESTOQUE, que e o que permite a contagem conferir depois.
    // Cafe fica de fora: contador nao tem estoque.
    if (produto.controle === TipoDeControle.ESTOQUE) {
      await tx.movimentoDeEstoque.create({
        data: {
          produtoId: produto.id,
          tipo: TipoMovimentoEstoque.VENDA,
          quantidade: -entrada.quantidade,
          motivo: `Consumo de ${cliente.nome}`,
          criadoPorId: entrada.usuarioId ?? null,
        },
      });
    }

    return consumo;
  });

  return { ok: true, dados: paraTelaOConsumo(gravado) };
}

/** Monta o consumo como a tela espera. */
function paraTelaOConsumo(consumo: {
  id: string;
  clienteId: string;
  produtoId: string;
  quantidade: number;
  precoUnitario: { toFixed: (casas: number) => string };
  valor: { toFixed: (casas: number) => string };
  consumidoEm: Date;
  momento: MomentoDoPagamento;
  cliente: { nome: string };
  produto: { nome: string };
  sala: { nome: string } | null;
  formaPagamento: { nome: string } | null;
  criadoPor: { nome: string } | null;
}): ConsumoLancado {
  return {
    id: consumo.id,
    clienteId: consumo.clienteId,
    clienteNome: consumo.cliente.nome,
    produtoId: consumo.produtoId,
    produtoNome: consumo.produto.nome,
    quantidade: consumo.quantidade,
    precoUnitario: consumo.precoUnitario.toFixed(2),
    valor: consumo.valor.toFixed(2),
    dia: dataLocalDe(consumo.consumidoEm),
    hora: horaLocalDe(consumo.consumidoEm),
    sala: consumo.sala?.nome ?? null,
    momento: consumo.momento,
    formaPagamento: consumo.formaPagamento?.nome ?? null,
    lancadoPor: consumo.criadoPor?.nome ?? null,
  };
}

/**
 * Os consumos de um periodo, para a tela conferir contra a ficha.
 *
 * O periodo e em DIAS do relogio de Sao Paulo, e nao em instantes: a
 * recepcionista pensa em "o que foi lancado no dia 14", e o dia dela comeca a
 * meia-noite daqui, nao a do banco.
 */
export async function listarConsumos(entrada: {
  de: string;
  ate: string;
  clienteId?: string;
  momento?: MomentoDoPagamento;
}): Promise<ConsumoLancado[]> {
  const consumos = await prisma.consumoDoEmporio.findMany({
    where: {
      consumidoEm: {
        gte: instanteDe(entrada.de as DataLocal, "00:00"),
        lt: instanteDe(somarDiasLocal(entrada.ate, 1), "00:00"),
      },
      ...(entrada.clienteId ? { clienteId: entrada.clienteId } : {}),
      ...(entrada.momento ? { momento: entrada.momento } : {}),
    },
    orderBy: [{ consumidoEm: "desc" }],
    include: {
      cliente: { select: { nome: true } },
      produto: { select: { nome: true } },
      sala: { select: { nome: true } },
      formaPagamento: { select: { nome: true } },
      criadoPor: { select: { nome: true } },
    },
  });

  return consumos.map(paraTelaOConsumo);
}

/** "2026-11-14" + 1 -> "2026-11-15". */
function somarDiasLocal(dia: string, dias: number): DataLocal {
  const data = new Date(`${dia}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10) as DataLocal;
}
