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
import { TipoMovimentoEstoque } from "@/generated/prisma/enums";

import {
  apagarImagem,
  cloudinaryConfigurado,
  enviarImagem,
  PASTAS,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_ACEITOS,
} from "./cloudinary";
import { prisma } from "./prisma";

export { TipoMovimentoEstoque };

/** Um produto do emporio, com o estoque somado dos movimentos. */
export type ProdutoDoEmporio = {
  id: string;
  nome: string;
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
}): Promise<ProdutoDoEmporio[]> {
  const produtos = await prisma.produto.findMany({
    where: opcoes?.somenteAtivos ? { ativo: true } : {},
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
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

  return produtos.map((produto) => ({
    id: produto.id,
    nome: produto.nome,
    preco: produto.preco.toFixed(2),
    ativo: produto.ativo,
    ordem: produto.ordem,
    foto: fotoDe(produto),
    estoque: porProduto.get(produto.id) ?? 0,
  }));
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
  preco: string;
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
    data: { nome, preco, ordem: (ultimo?.ordem ?? 0) + 1 },
  });

  return {
    ok: true,
    dados: {
      id: criado.id,
      nome: criado.nome,
      preco: criado.preco.toFixed(2),
      ativo: criado.ativo,
      ordem: criado.ordem,
      foto: fotoDe(criado),
      estoque: 0,
    },
  };
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
  entrada: { nome: string; preco: string },
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
    data: { nome, preco },
  });

  const soma = await prisma.movimentoDeEstoque.aggregate({
    where: { produtoId: id },
    _sum: { quantidade: true },
  });

  return {
    ok: true,
    dados: {
      id: salvo.id,
      nome: salvo.nome,
      preco: salvo.preco.toFixed(2),
      ativo: salvo.ativo,
      ordem: salvo.ordem,
      foto: fotoDe(salvo),
      estoque: soma._sum.quantidade ?? 0,
    },
  };
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

  return {
    ok: true,
    dados: {
      id: salvo.id,
      nome: salvo.nome,
      preco: salvo.preco.toFixed(2),
      ativo: salvo.ativo,
      ordem: salvo.ordem,
      foto: fotoDe(salvo),
      estoque: soma._sum.quantidade ?? 0,
    },
  };
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
