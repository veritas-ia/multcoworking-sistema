/**
 * O FINANCEIRO: entradas e saídas do caixa (Fase 16, Parte A).
 *
 * O QUE ESTA FASE RESOLVE
 *
 * Até aqui o sistema sabia quanto cada reserva valia e quanto o empório
 * vendeu, mas não sabia NADA do caixa do coworking: aluguel, energia,
 * funcionários, mensalidade dos espaços. O "faturamento" dos relatórios é
 * receita de reserva, e não lucro — para dizer lucro é preciso conhecer a
 * despesa.
 *
 * AS DUAS DECISÕES DE DESENHO QUE EXPLICAM O RESTO DESTE ARQUIVO
 *
 * 1. O SINAL NUNCA ESTÁ NO VALOR. O valor é sempre positivo (com trava no
 *    banco) e quem diz o lado é o TIPO DA CATEGORIA. Um valor negativo
 *    gravado abriria a porta para uma "entrada de -200" subtraindo do caixa
 *    sem ninguém desconfiar do número na lista.
 *
 * 2. NÃO EXISTE COLUNA DE SITUAÇÃO. "Pago", "pendente" e "atrasado" saem de
 *    dois fatos — a data de pagamento e a de vencimento. Uma coluna de status
 *    precisaria de uma rotina virando-a todo dia; com CRON_ATIVO="false",
 *    como na prévia, nada ficaria atrasado nunca, e isso pareceria defeito sem
 *    dar erro em lugar nenhum. Pior: a coluna poderia discordar da data de
 *    vencimento ao lado dela na mesma tela.
 *
 * O QUE A EQUIPE PODE CORRIGIR, E O QUE NÃO (regra do dono, 17/11/2026)
 *
 * Tudo que é digitado aqui é editável e apagável — erro de digitação é normal,
 * e travar a correção faria a equipe parar de usar a tela. A exclusão exige
 * MOTIVO e fica registrada no histórico de ações, igual à da reserva: sem a
 * prova, ninguém explica por que o caixa de um mês fechado mudou.
 */
import type { Prisma } from "@/generated/prisma/client";
import { TipoDeLancamento } from "@/generated/prisma/enums";

import { registrarAcao, TipoDeAcao } from "./acoes";
import { prisma } from "./prisma";
import {
  dataLocalDe,
  horaLocalDe,
  instanteDe,
  type DataLocal,
} from "./tempo";

export { TipoDeLancamento };

export type Falha = { motivo: string; codigo: string };
export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

/** O operador, para a evidência da exclusão. */
export type Operador = { id: string; nome: string };

/**
 * Os três estados que a equipe lê — CALCULADOS, nunca gravados.
 *
 * ATRASADO é pendente cujo vencimento já passou. Quem decide isso é o
 * servidor, no relógio de São Paulo: refazendo a conta no navegador, o
 * operador num fuso diferente veria uma conta atrasada que não está, ou o
 * contrário.
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
  /** Em reais, com duas casas: "1250.00". A soma é feita em centavos. */
  valor: string;
  /** O lado, que vem da categoria — nunca do sinal do valor. */
  tipo: TipoDeLancamento;
  categoria: { id: string; nome: string };
  /** De quem veio ou para quem foi. Os três podem ser nulos. */
  cliente: { id: string; nome: string } | null;
  empresa: { id: string; nome: string } | null;
  fornecedor: { id: string; nome: string } | null;
  formaPagamento: { id: string; nome: string } | null;
  /** "AAAA-MM-DD" no relógio de São Paulo. */
  vencimento: string;
  pagoEm: string | null;
  situacao: SituacaoDoLancamento;
  /** Quantos dias de atraso. Zero quando não está atrasado. */
  diasDeAtraso: number;
  observacao: string | null;
  lancadoPor: string | null;
  criadoEm: Date;
  /**
   * DE ONDE A LINHA VEIO.
   *
   * MANUAL  — alguem digitou. Editavel a vontade.
   * RESERVA — nasceu do "Recebi" da agenda. Corrige-se na reserva, ou
   *           desvincula-se para virar manual.
   * EMPORIO — resume o consumo pago na hora de um dia. NAO tem desvincular:
   *           ela e RECALCULADA a cada lancamento do dia, e soltar seria
   *           desfeito no proximo consumo — ver "desvincular".
   */
  origem: "MANUAL" | "RESERVA" | "EMPORIO" | "MENSALIDADE";
};

// -----------------------------------------------------------------------------
// Apoio
// -----------------------------------------------------------------------------

/** "6,50" ou "6.5" -> 650 centavos. Recusa o que não for número. */
export function centavosDe(reais: string): number | null {
  const limpo = reais.trim().replace(",", ".");

  if (!/^\d{1,9}(\.\d{1,2})?$/.test(limpo)) {
    return null;
  }

  return Math.round(Number(limpo) * 100);
}

/** 650 -> "6.50", o jeito que o banco guarda. */
function reaisDe(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/** Um Decimal do Prisma -> "1250.00". */
function comoTexto(valor: { toFixed: (casas: number) => string }): string {
  return valor.toFixed(2);
}

/**
 * Um DATE do Postgres -> "AAAA-MM-DD".
 *
 * A coluna é DATE, sem hora: o Prisma a entrega como meia-noite UTC. Usar
 * "dataLocalDe" aqui VOLTARIA UM DIA (meia-noite UTC é 21h do dia anterior em
 * São Paulo), e todo vencimento apareceria um dia mais cedo na tela. Por isso
 * a leitura é em UTC, de propósito.
 */
function diaDe(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" -> o DATE que o Postgres espera, sem fuso no meio. */
function paraData(dia: string): Date {
  return new Date(`${dia}T00:00:00.000Z`);
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O nome interno, que nunca muda depois de criado. */
function slugDe(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Quantos dias inteiros separam dois dias. */
function diasEntre(de: string, ate: string): number {
  const um = Date.parse(`${de}T00:00:00.000Z`);
  const outro = Date.parse(`${ate}T00:00:00.000Z`);

  return Math.round((outro - um) / 86_400_000);
}

/**
 * A situação, calculada.
 *
 * "hoje" entra como parâmetro para o teste poder fixá-lo. Sem isso, o teste do
 * atraso dependeria do dia em que a suíte roda — defeito que este projeto já
 * teve duas vezes, uma delas hoje mesmo.
 */
export function situacaoDe(
  lancamento: { vencimento: string; pagoEm: string | null },
  hoje: string,
): { situacao: SituacaoDoLancamento; diasDeAtraso: number } {
  if (lancamento.pagoEm) {
    return { situacao: "PAGO", diasDeAtraso: 0 };
  }

  if (lancamento.vencimento < hoje) {
    return {
      situacao: "ATRASADO",
      diasDeAtraso: diasEntre(lancamento.vencimento, hoje),
    };
  }

  return { situacao: "PENDENTE", diasDeAtraso: 0 };
}

// -----------------------------------------------------------------------------
// Categorias
// -----------------------------------------------------------------------------

/**
 * As categorias, agrupáveis por lado.
 *
 * Vem tudo, inclusive as desligadas: o painel precisa delas para religar. A
 * tela de lançamento pede só as ativas.
 */
export async function listarCategorias(opcoes?: {
  tipo?: TipoDeLancamento;
  somenteAtivas?: boolean;
}): Promise<CategoriaNaTela[]> {
  const categorias = await prisma.categoriaFinanceira.findMany({
    where: {
      ...(opcoes?.tipo ? { tipo: opcoes.tipo } : {}),
      ...(opcoes?.somenteAtivas ? { ativa: true } : {}),
    },
    orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { nome: "asc" }],
    include: { _count: { select: { lancamentos: true } } },
  });

  return categorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.nome,
    tipo: categoria.tipo,
    slug: categoria.slug,
    ativa: categoria.ativa,
    ordem: categoria.ordem,
    lancamentos: categoria._count.lancamentos,
  }));
}

/**
 * Cria uma categoria.
 *
 * O TIPO NÃO TEM PADRÃO, de propósito: um silencioso poria uma despesa do lado
 * das receitas, e o caixa do mês somaria para o lado errado.
 */
export async function criarCategoria(entrada: {
  nome: string;
  tipo: TipoDeLancamento;
}): Promise<Resultado<CategoriaNaTela>> {
  const nome = entrada.nome.trim();

  if (nome.length < 2) {
    return {
      ok: false,
      falha: { motivo: "Escreva o nome da categoria.", codigo: "NOME_INVALIDO" },
    };
  }

  const slug = slugDe(nome);

  if (!slug) {
    return {
      ok: false,
      falha: {
        motivo: "O nome precisa ter letras ou números.",
        codigo: "NOME_INVALIDO",
      },
    };
  }

  const repetida = await prisma.categoriaFinanceira.findFirst({
    where: { OR: [{ slug }, { tipo: entrada.tipo, nome }] },
    select: { id: true },
  });

  if (repetida) {
    return {
      ok: false,
      falha: { motivo: "Já existe uma categoria com esse nome.", codigo: "REPETIDA" },
    };
  }

  // A nova entra no fim da lista DO LADO DELA: a ordem é por tipo, e as duas
  // listas aparecem em telas diferentes.
  const ultima = await prisma.categoriaFinanceira.findFirst({
    where: { tipo: entrada.tipo },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const criada = await prisma.categoriaFinanceira.create({
    data: {
      nome,
      slug,
      tipo: entrada.tipo,
      ordem: (ultima?.ordem ?? 0) + 1,
    },
  });

  return {
    ok: true,
    dados: {
      id: criada.id,
      nome: criada.nome,
      tipo: criada.tipo,
      slug: criada.slug,
      ativa: criada.ativa,
      ordem: criada.ordem,
      lancamentos: 0,
    },
  };
}

/**
 * Renomeia, liga ou desliga uma categoria.
 *
 * O TIPO NÃO ESTÁ AQUI, e isso é regra: virar o lado de uma categoria
 * inverteria o sinal de todo lançamento que aponta para ela — meses de caixa
 * mudariam de lado de uma vez, e cada linha continuaria parecendo certa.
 *
 * RENOMEAR TROCA O RÓTULO TAMBÉM NOS LANÇAMENTOS ANTIGOS, e isso é o desejado:
 * eles apontam para a categoria e não guardam o texto, então categoria que
 * mudou de nome não vira duas no relatório. Mesma regra das empresas.
 */
export async function editarCategoria(
  id: string,
  mudanca: { nome?: string; ativa?: boolean },
): Promise<Resultado<CategoriaNaTela>> {
  const atual = await prisma.categoriaFinanceira.findUnique({
    where: { id },
    select: { id: true, tipo: true, ativa: true },
  });

  if (!atual) {
    return {
      ok: false,
      falha: { motivo: "Categoria não encontrada.", codigo: "NAO_ENCONTRADA" },
    };
  }

  const nome = mudanca.nome?.trim();

  if (nome !== undefined) {
    if (nome.length < 2) {
      return {
        ok: false,
        falha: { motivo: "Escreva o nome da categoria.", codigo: "NOME_INVALIDO" },
      };
    }

    const repetida = await prisma.categoriaFinanceira.findFirst({
      where: { tipo: atual.tipo, nome, id: { not: id } },
      select: { id: true },
    });

    if (repetida) {
      return {
        ok: false,
        falha: {
          motivo: "Já existe uma categoria com esse nome.",
          codigo: "REPETIDA",
        },
      };
    }
  }

  /*
   * A ÚLTIMA CATEGORIA ATIVA DE UM LADO NÃO SE DESLIGA.
   *
   * Sem nenhuma categoria escolhível, o formulário de lançamento não fecha e
   * NINGUÉM consegue lançar daquele lado. O erro apareceria como "escolha a
   * categoria" numa lista vazia, e ninguém ligaria uma coisa à outra. Mesma
   * regra da última área de atuação.
   */
  if (mudanca.ativa === false && atual.ativa) {
    const outras = await prisma.categoriaFinanceira.count({
      where: { tipo: atual.tipo, ativa: true, id: { not: id } },
    });

    if (outras === 0) {
      return {
        ok: false,
        falha: {
          motivo:
            atual.tipo === TipoDeLancamento.ENTRADA
              ? "Esta é a última categoria de entrada ligada. Sem nenhuma, ninguém consegue lançar uma entrada."
              : "Esta é a última categoria de saída ligada. Sem nenhuma, ninguém consegue lançar uma saída.",
          codigo: "ULTIMA_ATIVA",
        },
      };
    }
  }

  // O SLUG NÃO ENTRA no update: é ele que amarra a categoria ao que já está
  // gravado. Mudando, um relatório antigo deixaria de bater com a lista.
  const salva = await prisma.categoriaFinanceira.update({
    where: { id },
    data: {
      ...(nome !== undefined ? { nome } : {}),
      ...(mudanca.ativa !== undefined ? { ativa: mudanca.ativa } : {}),
    },
    include: { _count: { select: { lancamentos: true } } },
  });

  return {
    ok: true,
    dados: {
      id: salva.id,
      nome: salva.nome,
      tipo: salva.tipo,
      slug: salva.slug,
      ativa: salva.ativa,
      ordem: salva.ordem,
      lancamentos: salva._count.lancamentos,
    },
  };
}

/**
 * Grava a ordem de um LADO inteiro.
 *
 * A lista vem completa e é regravada em bloco, para nunca haver duas
 * categorias na mesma posição. Mesma regra das áreas de atuação.
 */
export async function reordenarCategorias(
  ids: string[],
): Promise<Resultado<null>> {
  if (ids.length === 0) {
    return {
      ok: false,
      falha: { motivo: "Informe a ordem.", codigo: "SEM_IDS" },
    };
  }

  const categorias = await prisma.categoriaFinanceira.findMany({
    where: { id: { in: ids } },
    select: { id: true, tipo: true },
  });

  if (categorias.length !== ids.length) {
    return {
      ok: false,
      falha: { motivo: "Categoria não encontrada.", codigo: "NAO_ENCONTRADA" },
    };
  }

  // Misturar os dois lados numa reordenação daria duas categorias na mesma
  // posição dentro de um lado — e a lista pularia de lugar a cada visita.
  const lados = new Set(categorias.map((categoria) => categoria.tipo));

  if (lados.size > 1) {
    return {
      ok: false,
      falha: {
        motivo: "Reordene as entradas e as saídas separadamente.",
        codigo: "LADOS_MISTURADOS",
      },
    };
  }

  await prisma.$transaction(
    ids.map((id, indice) =>
      prisma.categoriaFinanceira.update({
        where: { id },
        data: { ordem: indice + 1 },
      }),
    ),
  );

  return { ok: true, dados: null };
}

// -----------------------------------------------------------------------------
// Fornecedores
// -----------------------------------------------------------------------------

export async function listarFornecedores(opcoes?: {
  somenteAtivos?: boolean;
}): Promise<FornecedorNaTela[]> {
  const fornecedores = await prisma.fornecedor.findMany({
    where: opcoes?.somenteAtivos ? { ativo: true } : {},
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    include: { _count: { select: { lancamentos: true } } },
  });

  return fornecedores.map((fornecedor) => ({
    id: fornecedor.id,
    nome: fornecedor.nome,
    ativo: fornecedor.ativo,
    observacao: fornecedor.observacao,
    lancamentos: fornecedor._count.lancamentos,
  }));
}

export async function criarFornecedor(entrada: {
  nome: string;
  observacao?: string | null;
}): Promise<Resultado<FornecedorNaTela>> {
  const nome = entrada.nome.trim();

  if (nome.length < 2) {
    return {
      ok: false,
      falha: { motivo: "Escreva o nome do fornecedor.", codigo: "NOME_INVALIDO" },
    };
  }

  const repetido = await prisma.fornecedor.findUnique({
    where: { nome },
    select: { id: true },
  });

  if (repetido) {
    return {
      ok: false,
      falha: { motivo: "Já existe um fornecedor com esse nome.", codigo: "REPETIDO" },
    };
  }

  const criado = await prisma.fornecedor.create({
    data: { nome, observacao: entrada.observacao?.trim() || null },
  });

  return {
    ok: true,
    dados: {
      id: criado.id,
      nome: criado.nome,
      ativo: criado.ativo,
      observacao: criado.observacao,
      lancamentos: 0,
    },
  };
}

/**
 * Renomeia, anota ou desliga um fornecedor.
 *
 * EXCLUIR NÃO EXISTE, mesma regra de salas, empresas, áreas de atuação e
 * clientes: apagar tiraria as despesas dele do relatório em silêncio. A chave
 * estrangeira do banco é RESTRICT e recusaria de todo jeito.
 */
export async function editarFornecedor(
  id: string,
  mudanca: { nome?: string; observacao?: string | null; ativo?: boolean },
): Promise<Resultado<FornecedorNaTela>> {
  const atual = await prisma.fornecedor.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!atual) {
    return {
      ok: false,
      falha: { motivo: "Fornecedor não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  const nome = mudanca.nome?.trim();

  if (nome !== undefined) {
    if (nome.length < 2) {
      return {
        ok: false,
        falha: {
          motivo: "Escreva o nome do fornecedor.",
          codigo: "NOME_INVALIDO",
        },
      };
    }

    const repetido = await prisma.fornecedor.findFirst({
      where: { nome, id: { not: id } },
      select: { id: true },
    });

    if (repetido) {
      return {
        ok: false,
        falha: {
          motivo: "Já existe um fornecedor com esse nome.",
          codigo: "REPETIDO",
        },
      };
    }
  }

  const salvo = await prisma.fornecedor.update({
    where: { id },
    data: {
      ...(nome !== undefined ? { nome } : {}),
      ...(mudanca.observacao !== undefined
        ? { observacao: mudanca.observacao?.trim() || null }
        : {}),
      ...(mudanca.ativo !== undefined ? { ativo: mudanca.ativo } : {}),
    },
    include: { _count: { select: { lancamentos: true } } },
  });

  return {
    ok: true,
    dados: {
      id: salvo.id,
      nome: salvo.nome,
      ativo: salvo.ativo,
      observacao: salvo.observacao,
      lancamentos: salvo._count.lancamentos,
    },
  };
}

// -----------------------------------------------------------------------------
// Lançamentos
// -----------------------------------------------------------------------------

/** O que a consulta traz junto, num lugar só. */
const COM_OS_LIGADOS = {
  categoria: { select: { id: true, nome: true, tipo: true } },
  cliente: { select: { id: true, nome: true } },
  empresa: { select: { id: true, nome: true } },
  fornecedor: { select: { id: true, nome: true } },
  formaPagamento: { select: { id: true, nome: true } },
} as const;

type LinhaDoBanco = Prisma.LancamentoGetPayload<{
  include: typeof COM_OS_LIGADOS;
}>;

/**
 * Monta o lançamento como a tela espera.
 *
 * UM lugar só: com a montagem copiada, acrescentar um campo exigiria lembrar
 * de todas as cópias, e quem esquecesse uma deixaria a tela sem o dado em UM
 * caminho — o tipo de falha que ninguém percebe.
 */
function paraTela(linha: LinhaDoBanco, hoje: string): LancamentoNaTela {
  const vencimento = diaDe(linha.vencimento);
  const pagoEm = linha.pagoEm ? diaDe(linha.pagoEm) : null;
  const { situacao, diasDeAtraso } = situacaoDe({ vencimento, pagoEm }, hoje);

  return {
    id: linha.id,
    descricao: linha.descricao,
    valor: comoTexto(linha.valor),
    // O LADO VEM DA CATEGORIA, sempre. Nunca do sinal do valor, que é sempre
    // positivo, e nunca de uma cópia gravada na própria linha.
    tipo: linha.categoria.tipo,
    categoria: { id: linha.categoria.id, nome: linha.categoria.nome },
    cliente: linha.cliente,
    empresa: linha.empresa,
    fornecedor: linha.fornecedor,
    formaPagamento: linha.formaPagamento,
    vencimento,
    pagoEm,
    situacao,
    diasDeAtraso,
    observacao: linha.observacao,
    lancadoPor: linha.criadoPorNome,
    criadoEm: linha.criadoEm,
    origem: linha.reservaId
      ? "RESERVA"
      : linha.emporioDia
        ? "EMPORIO"
        : linha.contratoId
          ? "MENSALIDADE"
          : "MANUAL",
  };
}

export type EntradaDeLancamento = {
  descricao: string;
  /** Em reais, como a tela digita: "1250", "1250.50" ou "1250,50". */
  valor: string;
  categoriaId: string;
  clienteId?: string | null;
  empresaId?: string | null;
  fornecedorId?: string | null;
  formaPagamentoId?: string | null;
  /** "AAAA-MM-DD". */
  vencimento: string;
  /** "AAAA-MM-DD" ou nulo. Preenchido = já aconteceu. */
  pagoEm?: string | null;
  observacao?: string | null;
};

/** Confere o que não depende do banco. */
function conferirCampos(entrada: EntradaDeLancamento): Falha | null {
  if (entrada.descricao.trim().length < 2) {
    return { motivo: "Escreva do que se trata.", codigo: "DESCRICAO_INVALIDA" };
  }

  const centavos = centavosDe(entrada.valor);

  if (centavos === null) {
    return { motivo: "Escreva o valor como 1250,00.", codigo: "VALOR_INVALIDO" };
  }

  if (centavos <= 0) {
    // O banco também recusa, pela trava "lancamento_valor_positivo". A regra é
    // dele, não só da aplicação.
    return {
      motivo: "O valor precisa ser maior que zero. O lado é a categoria que diz.",
      codigo: "VALOR_INVALIDO",
    };
  }

  if (!DIA.test(entrada.vencimento)) {
    return { motivo: "Informe o vencimento.", codigo: "VENCIMENTO_INVALIDO" };
  }

  if (entrada.pagoEm && !DIA.test(entrada.pagoEm)) {
    return {
      motivo: "Informe a data do pagamento.",
      codigo: "PAGAMENTO_INVALIDO",
    };
  }

  /*
   * CLIENTE E FORNECEDOR JUNTOS NÃO EXISTE: ou o dinheiro veio de um cliente,
   * ou foi para um fornecedor. Os dois preenchidos deixariam o relatório sem
   * saber de quem é a linha. O banco também recusa.
   */
  if (entrada.clienteId && entrada.fornecedorId) {
    return {
      motivo: "Escolha um cliente ou um fornecedor, não os dois.",
      codigo: "CLIENTE_E_FORNECEDOR",
    };
  }

  return null;
}

/** Confere o que existe e está ligado. */
async function conferirLigados(
  entrada: EntradaDeLancamento,
): Promise<Falha | null> {
  const categoria = await prisma.categoriaFinanceira.findUnique({
    where: { id: entrada.categoriaId },
    select: { ativa: true },
  });

  if (!categoria) {
    return { motivo: "Categoria não encontrada.", codigo: "CATEGORIA_INVALIDA" };
  }

  // Categoria DESLIGADA recusa lançamento NOVO, mas os antigos dela continuam
  // de pé — desligar é decisão sobre o futuro.
  if (!categoria.ativa) {
    return {
      motivo: "Essa categoria está desligada. Religue-a ou escolha outra.",
      codigo: "CATEGORIA_DESLIGADA",
    };
  }

  if (entrada.clienteId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: entrada.clienteId },
      select: { id: true },
    });

    if (!cliente) {
      return { motivo: "Cliente não encontrado.", codigo: "CLIENTE_INVALIDO" };
    }
  }

  if (entrada.empresaId) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: entrada.empresaId },
      select: { ativa: true },
    });

    if (!empresa) {
      return { motivo: "Empresa não encontrada.", codigo: "EMPRESA_INVALIDA" };
    }
  }

  if (entrada.fornecedorId) {
    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: entrada.fornecedorId },
      select: { ativo: true },
    });

    if (!fornecedor) {
      return {
        motivo: "Fornecedor não encontrado.",
        codigo: "FORNECEDOR_INVALIDO",
      };
    }

    if (!fornecedor.ativo) {
      return {
        motivo: "Esse fornecedor está desligado. Religue-o ou escolha outro.",
        codigo: "FORNECEDOR_DESLIGADO",
      };
    }
  }

  if (entrada.formaPagamentoId) {
    const forma = await prisma.formaDePagamento.findUnique({
      where: { id: entrada.formaPagamentoId },
      select: { id: true },
    });

    if (!forma) {
      return {
        motivo: "Forma de pagamento não encontrada.",
        codigo: "FORMA_INVALIDA",
      };
    }
  }

  return null;
}

/**
 * LANÇA uma entrada ou uma saída.
 *
 * O LADO NÃO VEM DA TELA: ele é o tipo da categoria escolhida. A tela nem tem
 * como mandar "é uma entrada" — se tivesse, um pedido montado à mão poria uma
 * despesa do lado das receitas e o caixa do mês somaria para o lado errado.
 */
export async function lancar(
  entrada: EntradaDeLancamento,
  operador?: Operador | null,
  agora?: Date,
): Promise<Resultado<LancamentoNaTela>> {
  const erroDeCampo = conferirCampos(entrada);

  if (erroDeCampo) {
    return { ok: false, falha: erroDeCampo };
  }

  const erroDeLigado = await conferirLigados(entrada);

  if (erroDeLigado) {
    return { ok: false, falha: erroDeLigado };
  }

  const criado = await prisma.lancamento.create({
    data: {
      descricao: entrada.descricao.trim(),
      valor: reaisDe(centavosDe(entrada.valor)!),
      categoriaId: entrada.categoriaId,
      clienteId: entrada.clienteId ?? null,
      empresaId: entrada.empresaId ?? null,
      fornecedorId: entrada.fornecedorId ?? null,
      formaPagamentoId: entrada.formaPagamentoId ?? null,
      vencimento: paraData(entrada.vencimento),
      pagoEm: entrada.pagoEm ? paraData(entrada.pagoEm) : null,
      observacao: entrada.observacao?.trim() || null,
      criadoPorId: operador?.id ?? null,
      criadoPorNome: operador?.nome ?? null,
    },
    include: COM_OS_LIGADOS,
  });

  return { ok: true, dados: paraTela(criado, dataLocalDe(agora ?? new Date())) };
}

/**
 * EDITA um lançamento.
 *
 * TUDO É EDITÁVEL AQUI, e isso é decisão do dono: *"entrada e saída vão poder
 * ser editáveis manualmente, né? Porque seria ideal."* Erro de digitação é
 * normal, e travar a correção faria a equipe parar de usar a tela.
 *
 * O que NÃO é editável no sistema está noutro lugar e por outra razão: o valor
 * congelado numa reserva antiga e o demonstrativo já enviado ao cliente. Aqui
 * é dinheiro que a própria equipe digitou.
 */
export async function editarLancamento(
  id: string,
  mudanca: Partial<EntradaDeLancamento>,
  agora?: Date,
): Promise<Resultado<LancamentoNaTela>> {
  const atual = await prisma.lancamento.findUnique({
    where: { id },
    include: COM_OS_LIGADOS,
  });

  if (!atual) {
    return {
      ok: false,
      falha: { motivo: "Lançamento não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  // A conferência roda sobre o lançamento COMO ELE FICARIA, e não só sobre o
  // que veio na mudança: trocar só o cliente, numa linha que já tem
  // fornecedor, continua sendo cliente e fornecedor juntos.
  const depois: EntradaDeLancamento = {
    descricao: mudanca.descricao ?? atual.descricao,
    valor: mudanca.valor ?? comoTexto(atual.valor),
    categoriaId: mudanca.categoriaId ?? atual.categoriaId,
    clienteId:
      mudanca.clienteId !== undefined ? mudanca.clienteId : atual.clienteId,
    empresaId:
      mudanca.empresaId !== undefined ? mudanca.empresaId : atual.empresaId,
    fornecedorId:
      mudanca.fornecedorId !== undefined
        ? mudanca.fornecedorId
        : atual.fornecedorId,
    formaPagamentoId:
      mudanca.formaPagamentoId !== undefined
        ? mudanca.formaPagamentoId
        : atual.formaPagamentoId,
    vencimento: mudanca.vencimento ?? diaDe(atual.vencimento),
    pagoEm:
      mudanca.pagoEm !== undefined
        ? mudanca.pagoEm
        : atual.pagoEm
          ? diaDe(atual.pagoEm)
          : null,
    observacao:
      mudanca.observacao !== undefined ? mudanca.observacao : atual.observacao,
  };

  const erroDeCampo = conferirCampos(depois);

  if (erroDeCampo) {
    return { ok: false, falha: erroDeCampo };
  }

  /*
   * A CATEGORIA DESLIGADA continua valendo quando ela JÁ ERA a da linha.
   *
   * Sem esta ressalva, corrigir o valor de uma despesa antiga ficaria
   * impossível depois de a equipe desligar a categoria — e a mensagem falaria
   * de categoria, que não é o que a pessoa está tentando mudar.
   */
  const mudouDeCategoria = depois.categoriaId !== atual.categoriaId;
  const erroDeLigado = await conferirLigados({
    ...depois,
    ...(mudouDeCategoria ? {} : { categoriaId: atual.categoriaId }),
  });

  if (erroDeLigado && (mudouDeCategoria || erroDeLigado.codigo !== "CATEGORIA_DESLIGADA")) {
    return { ok: false, falha: erroDeLigado };
  }

  const salvo = await prisma.lancamento.update({
    where: { id },
    data: {
      descricao: depois.descricao.trim(),
      valor: reaisDe(centavosDe(depois.valor)!),
      categoriaId: depois.categoriaId,
      clienteId: depois.clienteId ?? null,
      empresaId: depois.empresaId ?? null,
      fornecedorId: depois.fornecedorId ?? null,
      formaPagamentoId: depois.formaPagamentoId ?? null,
      vencimento: paraData(depois.vencimento),
      pagoEm: depois.pagoEm ? paraData(depois.pagoEm) : null,
      observacao: depois.observacao?.trim() || null,
    },
    include: COM_OS_LIGADOS,
  });

  return { ok: true, dados: paraTela(salvo, dataLocalDe(agora ?? new Date())) };
}

/**
 * Marca como pago, ou desfaz.
 *
 * É uma ação PRÓPRIA, e não "editar o campo da data": é o que a equipe faz
 * dezenas de vezes por mês, e abrir o formulário inteiro para preencher uma
 * data só seria atrito a cada conta paga.
 *
 * DESMARCAR existe porque marcar errado acontece. Ele limpa a data, e a linha
 * volta a pendente — ou a atrasada, se o vencimento já passou. Nada além
 * disso é tocado.
 */
export async function marcarPagamento(
  id: string,
  entrada: { pagoEm: string | null; formaPagamentoId?: string | null },
  agora?: Date,
): Promise<Resultado<LancamentoNaTela>> {
  const atual = await prisma.lancamento.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!atual) {
    return {
      ok: false,
      falha: { motivo: "Lançamento não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  if (entrada.pagoEm !== null && !DIA.test(entrada.pagoEm)) {
    return {
      ok: false,
      falha: {
        motivo: "Informe a data do pagamento.",
        codigo: "PAGAMENTO_INVALIDO",
      },
    };
  }

  if (entrada.formaPagamentoId) {
    const forma = await prisma.formaDePagamento.findUnique({
      where: { id: entrada.formaPagamentoId },
      select: { id: true },
    });

    if (!forma) {
      return {
        ok: false,
        falha: {
          motivo: "Forma de pagamento não encontrada.",
          codigo: "FORMA_INVALIDA",
        },
      };
    }
  }

  const salvo = await prisma.lancamento.update({
    where: { id },
    data: {
      pagoEm: entrada.pagoEm ? paraData(entrada.pagoEm) : null,
      ...(entrada.formaPagamentoId !== undefined
        ? { formaPagamentoId: entrada.formaPagamentoId }
        : {}),
    },
    include: COM_OS_LIGADOS,
  });

  return { ok: true, dados: paraTela(salvo, dataLocalDe(agora ?? new Date())) };
}

/**
 * EXCLUI um lançamento, com evidência obrigatória.
 *
 * POR QUE EXCLUIR EXISTE AQUI: lançamento duplicado ou posto na conta errada.
 * Deixá-lo "pendente para sempre" sujaria as contas a pagar; zerar o valor é
 * impossível (o banco recusa valor zero, e é bom que recuse).
 *
 * O MOTIVO É OBRIGATÓRIO e o registro vai na MESMA TRANSAÇÃO. Gravando por
 * fora, uma falha no meio deixaria o lançamento apagado sem registro nenhum —
 * exatamente o que isto existe para impedir.
 *
 * O RESUMO É CONGELADO: a linha não existirá mais para ser consultada, e a
 * categoria dela pode ser renomeada depois. Montar a frase na hora de LER
 * deixaria o histórico em branco justamente no caso que mais importa.
 */
export async function excluirLancamento(entrada: {
  id: string;
  motivo: string;
  operador: Operador;
}): Promise<Resultado<{ resumo: string }>> {
  const motivo = entrada.motivo.trim();

  if (motivo.length < 3) {
    return {
      ok: false,
      falha: {
        motivo: "Escreva por que este lançamento está sendo excluído.",
        codigo: "MOTIVO_OBRIGATORIO",
      },
    };
  }

  const alvo = await prisma.lancamento.findUnique({
    where: { id: entrada.id },
    include: COM_OS_LIGADOS,
  });

  if (!alvo) {
    return {
      ok: false,
      falha: { motivo: "Lançamento não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  const lado =
    alvo.categoria.tipo === TipoDeLancamento.ENTRADA ? "Entrada" : "Saída";
  const de =
    alvo.cliente?.nome ?? alvo.empresa?.nome ?? alvo.fornecedor?.nome ?? null;

  const resumo = [
    `${lado} de R$ ${comoTexto(alvo.valor).replace(".", ",")}`,
    `“${alvo.descricao}”`,
    `em ${alvo.categoria.nome}`,
    `com vencimento ${diaDe(alvo.vencimento).split("-").reverse().join("/")}`,
    de ? `· ${de}` : null,
    alvo.pagoEm ? "· já estava paga" : "· não estava paga",
  ]
    .filter(Boolean)
    .join(" ");

  await prisma.$transaction(async (tx) => {
    await registrarAcao(tx, {
      tipo: TipoDeAcao.LANCAMENTO_EXCLUIDO,
      resumo,
      // O RETRATO COMPLETO vai junto: sem ele, o resumo responde "o quê" mas
      // não permite reconstruir a linha se alguém precisar.
      dados: {
        id: alvo.id,
        descricao: alvo.descricao,
        valor: comoTexto(alvo.valor),
        tipo: alvo.categoria.tipo,
        categoria: alvo.categoria.nome,
        cliente: alvo.cliente?.nome ?? null,
        empresa: alvo.empresa?.nome ?? null,
        fornecedor: alvo.fornecedor?.nome ?? null,
        formaPagamento: alvo.formaPagamento?.nome ?? null,
        vencimento: diaDe(alvo.vencimento),
        pagoEm: alvo.pagoEm ? diaDe(alvo.pagoEm) : null,
        observacao: alvo.observacao,
        lancadoPor: alvo.criadoPorNome,
      },
      usuario: entrada.operador,
      motivo,
    });

    await tx.lancamento.delete({ where: { id: entrada.id } });
  });

  return { ok: true, dados: { resumo } };
}

/**
 * Os lançamentos de um período.
 *
 * QUAL DATA MANDA, e por que é uma escolha e não um detalhe:
 *
 *  - "vencimento" é a visão de CONTAS: o que vence neste mês, pago ou não. É
 *    com ela que a equipe trabalha no dia a dia;
 *  - "pagamento" é a visão de CAIXA: o que entrou e saiu de verdade. Uma conta
 *    de outubro paga em novembro é despesa de outubro e caixa de novembro, e
 *    misturar as duas visões num filtro só daria um número que não bate com
 *    nenhuma das duas.
 */
export async function listarLancamentos(entrada: {
  de: string;
  ate: string;
  base?: "vencimento" | "pagamento";
  tipo?: TipoDeLancamento;
  categoriaId?: string;
  clienteId?: string;
  empresaId?: string;
  fornecedorId?: string;
  situacao?: SituacaoDoLancamento;
  agora?: Date;
}): Promise<LancamentoNaTela[]> {
  const base = entrada.base ?? "vencimento";
  const janela = { gte: paraData(entrada.de), lte: paraData(entrada.ate) };

  const linhas = await prisma.lancamento.findMany({
    where: {
      ...(base === "vencimento"
        ? { vencimento: janela }
        : // Na visão de caixa, quem nunca foi pago não entra: ele não moveu
          // dinheiro nenhum ainda.
          { pagoEm: janela }),
      ...(entrada.tipo ? { categoria: { tipo: entrada.tipo } } : {}),
      ...(entrada.categoriaId ? { categoriaId: entrada.categoriaId } : {}),
      ...(entrada.clienteId ? { clienteId: entrada.clienteId } : {}),
      ...(entrada.empresaId ? { empresaId: entrada.empresaId } : {}),
      ...(entrada.fornecedorId ? { fornecedorId: entrada.fornecedorId } : {}),
    },
    orderBy: [{ vencimento: "asc" }, { criadoEm: "asc" }],
    include: COM_OS_LIGADOS,
  });

  const hoje = dataLocalDe(entrada.agora ?? new Date());
  const naTela = linhas.map((linha) => paraTela(linha, hoje));

  /*
   * O FILTRO DE SITUAÇÃO É FEITO AQUI, e não no banco, porque "atrasado" não
   * existe como coluna — ele é calculado. Pedir ao banco uma condição
   * equivalente duplicaria a regra em dois lugares, e um dia os dois
   * discordariam sobre o que é "hoje".
   */
  return entrada.situacao
    ? naTela.filter((linha) => linha.situacao === entrada.situacao)
    : naTela;
}

export type ResumoDoPeriodo = {
  /** Em centavos, sempre. */
  entradasCentavos: number;
  saidasCentavos: number;
  saldoCentavos: number;
  /** O que vence no período e ainda não foi pago. */
  aReceberCentavos: number;
  aPagarCentavos: number;
  /** Pendente cujo vencimento já passou. */
  atrasadoAReceberCentavos: number;
  atrasadoAPagarCentavos: number;
  quantas: number;
};

/**
 * O resumo do período, SOMADO EM CENTAVOS.
 *
 * Somar reais em ponto flutuante acumula diferença de um centavo ao longo de
 * muitas linhas — e um caixa com um centavo de diferença faz a equipe
 * desconfiar do número inteiro. Mesma regra do demonstrativo e do relatório.
 *
 * ENTRADA E SAÍDA SÃO SOMADAS SEPARADAS e só então subtraídas. Somar tudo num
 * acumulador com sinal daria o mesmo saldo, mas perderia os dois números que
 * a equipe realmente quer ver.
 */
export function resumir(lancamentos: readonly LancamentoNaTela[]): ResumoDoPeriodo {
  let entradas = 0;
  let saidas = 0;
  let aReceber = 0;
  let aPagar = 0;
  let atrasadoAReceber = 0;
  let atrasadoAPagar = 0;

  for (const linha of lancamentos) {
    const centavos = centavosDe(linha.valor) ?? 0;
    const ehEntrada = linha.tipo === TipoDeLancamento.ENTRADA;

    if (linha.situacao === "PAGO") {
      if (ehEntrada) {
        entradas += centavos;
      } else {
        saidas += centavos;
      }

      continue;
    }

    if (ehEntrada) {
      aReceber += centavos;
      if (linha.situacao === "ATRASADO") atrasadoAReceber += centavos;
    } else {
      aPagar += centavos;
      if (linha.situacao === "ATRASADO") atrasadoAPagar += centavos;
    }
  }

  return {
    entradasCentavos: entradas,
    saidasCentavos: saidas,
    saldoCentavos: entradas - saidas,
    aReceberCentavos: aReceber,
    aPagarCentavos: aPagar,
    atrasadoAReceberCentavos: atrasadoAReceber,
    atrasadoAPagarCentavos: atrasadoAPagar,
    quantas: lancamentos.length,
  };
}

/** O dia de hoje no relógio de São Paulo, para a tela não calcular por conta. */
export function hojeLocal(agora?: Date): DataLocal {
  return dataLocalDe(agora ?? new Date());
}

// -----------------------------------------------------------------------------
// FASE 16, PARTE B — O LANÇAMENTO ESPELHA A ORIGEM
// -----------------------------------------------------------------------------

/**
 * O PROBLEMA QUE ESTA PARTE RESOLVE, e o que ela recusa resolver.
 *
 * A receita de reserva e de empório existe no relatório e NÃO existia no
 * caixa. Digitar de novo no financeiro criaria dois números para o mesmo
 * dinheiro — a doença da planilha da Toca, onde o total digitado dizia
 * R$ 3.033 e as linhas somavam R$ 3.023. Então o lançamento APONTA para a
 * origem em vez de ser redigitado.
 *
 * O QUE NÃO ENTRA NO CAIXA AUTOMATICAMENTE, e isto é o ponto mais importante
 * daqui:
 *
 *  - **a reserva, por existir.** O mensalista paga as horas dele no
 *    demonstrativo, no fim do ciclo. Se cada reserva virasse entrada, as
 *    mesmas horas entrariam DUAS VEZES — uma como reserva, outra como
 *    mensalidade — e cada linha continuaria parecendo certa. A reserva só vira
 *    entrada quando alguém diz que recebeu, no balcão;
 *  - **o consumo NA_MENSALIDADE.** Ele vai no demonstrativo. Cobrar no caixa
 *    também seria cobrar duas vezes pela mesma barrinha.
 *
 * O que entra sozinho é só o que o sistema SABE que foi pago: o consumo
 * NA_HORA, onde a própria recepcionista informou a forma de pagamento.
 */

/** O nome interno da categoria onde cada origem entra. */
const CATEGORIA_DE_RESERVA = "reservas";
const CATEGORIA_DE_EMPORIO = "emporio";

/**
 * Acha a categoria de uma origem automática.
 *
 * ELA É USADA MESMO DESLIGADA, de propósito. "Desligar" é decisão sobre o que
 * a equipe ESCOLHE num lançamento manual; a automática não é escolha. Recusar
 * o recebimento porque alguém desligou a categoria perderia o registro de
 * dinheiro que entrou de verdade — e o erro apareceria como "categoria
 * desligada" na agenda, onde ninguém ligaria uma coisa à outra.
 */
async function categoriaDaOrigem(slug: string): Promise<string | null> {
  const categoria = await prisma.categoriaFinanceira.findUnique({
    where: { slug },
    select: { id: true },
  });

  return categoria?.id ?? null;
}

/** "2026-11-17" e "09:00"–"10:00" -> "Sala CI · 17/11 09:00–10:00 · Maria". */
function descricaoDaReserva(reserva: {
  sala: { nome: string };
  inicio: Date;
  fim: Date;
  nomeCliente: string;
}): string {
  const dia = dataLocalDe(reserva.inicio).split("-").reverse().slice(0, 2).join("/");

  return `${reserva.sala.nome} · ${dia} ${horaLocalDe(reserva.inicio)}–${horaLocalDe(reserva.fim)} · ${reserva.nomeCliente}`;
}

/**
 * A RECEPÇÃO RECEBEU O PAGAMENTO DE UMA RESERVA.
 *
 * É ação de uma PESSOA, nunca automática: o sistema não tem como saber que
 * alguém pagou R$ 40 no balcão. O botão existe na agenda porque é ali que a
 * recepção está quando o cliente paga.
 *
 * O MENSALISTA NÃO É MARCADO AQUI — ele paga no fim do mês, pelo
 * demonstrativo. Marcar os dois contaria o mesmo dinheiro duas vezes.
 */
export async function registrarRecebimentoDaReserva(entrada: {
  reservaId: string;
  /** "AAAA-MM-DD". Padrão: hoje. */
  pagoEm?: string;
  formaPagamentoId?: string | null;
  operador?: Operador | null;
  agora?: Date;
}): Promise<Resultado<LancamentoNaTela>> {
  const reserva = await prisma.reserva.findUnique({
    where: { id: entrada.reservaId },
    select: {
      id: true,
      valor: true,
      inicio: true,
      fim: true,
      nomeCliente: true,
      status: true,
      clienteId: true,
      empresaId: true,
      sala: { select: { nome: true } },
      lancamento: { select: { id: true } },
    },
  });

  if (!reserva) {
    return {
      ok: false,
      falha: { motivo: "Reserva não encontrada.", codigo: "NAO_ENCONTRADA" },
    };
  }

  /*
   * RESERVA CANCELADA NÃO GERA RECEITA.
   *
   * O caixa passaria a mostrar dinheiro de algo que não aconteceu. Se o
   * cliente pagou e desmarcou depois, e o coworking ficou com o valor, isso é
   * outra coisa — a equipe lança à mão, com a descrição dizendo o que foi.
   */
  if (reserva.status === "CANCELADA") {
    return {
      ok: false,
      falha: {
        motivo:
          "Esta reserva está cancelada. Se o cliente pagou e não usou, lance à mão explicando o caso.",
        codigo: "RESERVA_CANCELADA",
      },
    };
  }

  // JÁ RECEBIDA: devolve o que existe, em vez de criar a segunda linha. Dois
  // cliques no botão criariam duas entradas do mesmo dinheiro — o índice
  // único do banco também recusa, mas aqui a resposta é útil em vez de erro.
  if (reserva.lancamento) {
    const atual = await prisma.lancamento.findUniqueOrThrow({
      where: { id: reserva.lancamento.id },
      include: COM_OS_LIGADOS,
    });

    return {
      ok: true,
      dados: paraTela(atual, dataLocalDe(entrada.agora ?? new Date())),
    };
  }

  const categoriaId = await categoriaDaOrigem(CATEGORIA_DE_RESERVA);

  if (!categoriaId) {
    return {
      ok: false,
      falha: {
        motivo:
          "A categoria “Reservas de sala” não existe. Cadastre-a em Financeiro → Categorias.",
        codigo: "CATEGORIA_INVALIDA",
      },
    };
  }

  const hoje = dataLocalDe(entrada.agora ?? new Date());
  const pagoEm = entrada.pagoEm ?? hoje;

  if (!DIA.test(pagoEm)) {
    return {
      ok: false,
      falha: { motivo: "Informe a data do recebimento.", codigo: "PAGAMENTO_INVALIDO" },
    };
  }

  const criado = await prisma.lancamento.create({
    data: {
      descricao: descricaoDaReserva(reserva),
      // O VALOR É O CONGELADO NA RESERVA, nunca um recálculo: o preço da sala
      // pode ter mudado desde então, e o cliente pagou o que estava gravado.
      valor: comoTexto(reserva.valor),
      categoriaId,
      clienteId: reserva.clienteId,
      empresaId: reserva.empresaId,
      formaPagamentoId: entrada.formaPagamentoId ?? null,
      // Vence no dia da reserva e foi pago no dia do recebimento: é a verdade
      // das duas datas, e é o que faz a visão de caixa bater com o extrato.
      vencimento: paraData(dataLocalDe(reserva.inicio)),
      pagoEm: paraData(pagoEm),
      reservaId: reserva.id,
      criadoPorId: entrada.operador?.id ?? null,
      criadoPorNome: entrada.operador?.nome ?? null,
    },
    include: COM_OS_LIGADOS,
  });

  return { ok: true, dados: paraTela(criado, hoje) };
}

/**
 * DESFAZ o recebimento de uma reserva.
 *
 * Apaga a linha do caixa e REGISTRA a ação, com um motivo descrito pelo
 * próprio sistema: aqui o "por quê" é a ação em si ("a recepção desfez o
 * recebimento"), e pedir texto a cada clique faria a equipe escrever "a" para
 * passar da tela. A evidência continua existindo, que é o que importa.
 */
export async function desfazerRecebimentoDaReserva(entrada: {
  reservaId: string;
  operador: Operador;
}): Promise<Resultado<null>> {
  const alvo = await prisma.lancamento.findUnique({
    where: { reservaId: entrada.reservaId },
    include: COM_OS_LIGADOS,
  });

  if (!alvo) {
    return {
      ok: false,
      falha: {
        motivo: "Esta reserva não tem recebimento registrado.",
        codigo: "NAO_ENCONTRADO",
      },
    };
  }

  const resumo = `Recebimento desfeito · ${alvo.descricao} · R$ ${comoTexto(alvo.valor).replace(".", ",")}`;

  await prisma.$transaction(async (tx) => {
    await registrarAcao(tx, {
      tipo: TipoDeAcao.LANCAMENTO_EXCLUIDO,
      resumo,
      dados: {
        id: alvo.id,
        descricao: alvo.descricao,
        valor: comoTexto(alvo.valor),
        categoria: alvo.categoria.nome,
        reservaId: entrada.reservaId,
        pagoEm: alvo.pagoEm ? diaDe(alvo.pagoEm) : null,
        origem: "RESERVA",
      },
      usuario: entrada.operador,
      motivo: "recebimento desfeito na agenda",
    });

    await tx.lancamento.delete({ where: { id: alvo.id } });
  });

  return { ok: true, dados: null };
}

/**
 * SINCRONIZA O EMPÓRIO DE UM DIA com o caixa.
 *
 * UMA LINHA POR DIA E POR FORMA DE PAGAMENTO, e não uma por consumo: uma
 * barrinha de R$ 6,50 por linha daria ~150 linhas de empório por mês afogando
 * as ~20 contas de verdade. O dinheiro também não chega assim — chega como UM
 * comprovante de Pix do dia. O detalhe item a item fica na tela do empório.
 *
 * ELA RECALCULA, em vez de somar o que chegou agora. Assim lançar o quinto
 * consumo do dia dá o mesmo resultado que lançar os cinco de uma vez, e rodar
 * duas vezes não dobra nada. É a mesma escolha da contagem do estoque, e pela
 * mesma razão: um acumulador erra para sempre se rodar duas vezes; um
 * recálculo se autocorrige.
 *
 * SÓ O NA_HORA ENTRA. O NA_MENSALIDADE vai no demonstrativo, e cobrar no
 * caixa também seria cobrar duas vezes pela mesma barrinha.
 */
export async function sincronizarEmporioDoDia(
  dia: string,
  operador?: Operador | null,
): Promise<Resultado<{ linhas: number }>> {
  if (!DIA.test(dia)) {
    return {
      ok: false,
      falha: { motivo: "Informe o dia.", codigo: "DIA_INVALIDO" },
    };
  }

  const categoriaId = await categoriaDaOrigem(CATEGORIA_DE_EMPORIO);

  if (!categoriaId) {
    return {
      ok: false,
      falha: {
        motivo:
          "A categoria “Empório” não existe. Cadastre-a em Financeiro → Categorias.",
        codigo: "CATEGORIA_INVALIDA",
      },
    };
  }

  const inicio = instanteDe(dia as DataLocal, "00:00");
  const fim = instanteDe(somarUmDia(dia) as DataLocal, "00:00");

  const consumos = await prisma.consumoDoEmporio.findMany({
    where: {
      momento: "NA_HORA",
      consumidoEm: { gte: inicio, lt: fim },
    },
    select: { valor: true, quantidade: true, formaPagamentoId: true },
  });

  /*
   * A SOMA É EM CENTAVOS, por forma de pagamento. Somar reais em ponto
   * flutuante acumula diferença, e aqui são dezenas de linhas por dia.
   */
  const porForma = new Map<
    string,
    { formaPagamentoId: string | null; centavos: number; itens: number }
  >();

  for (const consumo of consumos) {
    const chave = consumo.formaPagamentoId ?? "";
    const atual = porForma.get(chave) ?? {
      formaPagamentoId: consumo.formaPagamentoId,
      centavos: 0,
      itens: 0,
    };

    atual.centavos += centavosDe(comoTexto(consumo.valor)) ?? 0;
    atual.itens += consumo.quantidade;
    porForma.set(chave, atual);
  }

  const formas = await prisma.formaDePagamento.findMany({
    select: { id: true, nome: true },
  });
  const nomeDaForma = new Map(formas.map((forma) => [forma.id, forma.nome]));

  let linhas = 0;

  for (const grupo of porForma.values()) {
    if (grupo.centavos <= 0) {
      // Dia só com cortesia (café de graça): não há dinheiro para registrar,
      // e uma linha de R$ 0,00 só sujaria o caixa. O banco também recusaria.
      continue;
    }

    const nome = grupo.formaPagamentoId
      ? (nomeDaForma.get(grupo.formaPagamentoId) ?? "sem forma")
      : "sem forma anotada";

    const descricao = `Empório · ${dia.split("-").reverse().slice(0, 2).join("/")} · ${grupo.itens} ${grupo.itens === 1 ? "item" : "itens"} · ${nome}`;

    const existente = await prisma.lancamento.findFirst({
      where: {
        emporioDia: paraData(dia),
        formaPagamentoId: grupo.formaPagamentoId,
      },
      select: { id: true },
    });

    if (existente) {
      await prisma.lancamento.update({
        where: { id: existente.id },
        data: { descricao, valor: reaisDe(grupo.centavos) },
      });
    } else {
      await prisma.lancamento.create({
        data: {
          descricao,
          valor: reaisDe(grupo.centavos),
          categoriaId,
          formaPagamentoId: grupo.formaPagamentoId,
          // O consumo pago na hora JÁ ENTROU: vence e é pago no mesmo dia, o
          // do consumo. Deixá-lo pendente poria na lista de trabalho um
          // dinheiro que já está na gaveta.
          vencimento: paraData(dia),
          pagoEm: paraData(dia),
          emporioDia: paraData(dia),
          criadoPorId: operador?.id ?? null,
          criadoPorNome: operador?.nome ?? null,
        },
      });
    }

    linhas += 1;
  }

  return { ok: true, dados: { linhas } };
}

/** "2026-11-17" -> "2026-11-18". */
function somarUmDia(dia: string): string {
  const data = new Date(`${dia}T12:00:00.000Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

/**
 * DESVINCULA um lançamento da origem: ele vira manual e fica editável.
 *
 * É a saída de emergência que o dono pediu quando perguntou se tudo seria
 * editável — nada fica trancado para sempre; só não se solta sem perceber.
 *
 * SÓ VALE PARA A LINHA DE RESERVA, e isso não é limitação por preguiça: a
 * linha do EMPÓRIO é RECALCULADA a cada consumo lançado naquele dia. Soltá-la
 * não a tornaria editável de verdade — o próximo consumo do mesmo dia criaria
 * outra linha ao lado, e o dinheiro do dia apareceria DUAS VEZES no caixa.
 * Para corrigir o empório, corrige-se o consumo na tela dele, e a linha se
 * refaz; para um acerto fora disso, lança-se uma linha manual explicando.
 */
export async function desvincular(
  id: string,
  agora?: Date,
): Promise<Resultado<LancamentoNaTela>> {
  const alvo = await prisma.lancamento.findUnique({
    where: { id },
    select: { id: true, reservaId: true, emporioDia: true, contratoId: true },
  });

  if (!alvo) {
    return {
      ok: false,
      falha: { motivo: "Lançamento não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  if (alvo.emporioDia) {
    return {
      ok: false,
      falha: {
        motivo:
          "A linha do empório é recalculada a cada consumo do dia — soltá-la faria o dinheiro do dia aparecer duas vezes. Corrija o consumo na tela do empório, ou lance uma linha à mão explicando o acerto.",
        codigo: "EMPORIO_NAO_DESVINCULA",
      },
    };
  }

  if (!alvo.reservaId && !alvo.contratoId) {
    return {
      ok: false,
      falha: {
        motivo: "Este lançamento já é manual.",
        codigo: "JA_MANUAL",
      },
    };
  }

  /*
   * A COBRANÇA DE MENSALIDADE TAMBÉM SE DESVINCULA, e pela mesma razão da
   * reserva: ela é criada UMA vez, não recalculada. Soltá-la é assumir o
   * controle daquela linha — e o mês dela volta a poder ser gerado, porque o
   * índice único só olha as linhas ainda ligadas ao contrato.
   *
   * O caso de uso é a renegociação de um mês específico: solta, muda o valor,
   * e o contrato segue intacto para os meses seguintes.
   *
   * A COMPETÊNCIA SAI JUNTO, obrigatoriamente: a trava do banco
   * ("lancamento_competencia_com_contrato") recusa competência sem contrato —
   * e com razão, porque ela sozinha deixaria a linha dizendo que cobre um mês
   * de um contrato que ela não tem mais.
   */
  const salvo = await prisma.lancamento.update({
    where: { id },
    data: { reservaId: null, contratoId: null, competencia: null },
    include: COM_OS_LIGADOS,
  });

  return { ok: true, dados: paraTela(salvo, dataLocalDe(agora ?? new Date())) };
}

// -----------------------------------------------------------------------------
// FASE 16, PARTE C — OS ESPAÇOS MENSAIS E AS MENSALIDADES
// -----------------------------------------------------------------------------

/**
 * O QUE ESTA PARTE TRAZ PARA DENTRO DO SISTEMA.
 *
 * As salas privativas alugadas por MÊS — de onde vem a maior parte do dinheiro
 * do coworking, e que o sistema nunca viu. Ele cuidava das 3 salas alugadas
 * por HORA.
 *
 * E ela responde a pergunta do dono — *"como que o sistema iria saber que tá
 * pago?"* — do jeito que o dinheiro realmente chega: o contrato diz QUANTO e
 * QUANDO, a cobrança do mês nasce dele, e alguém marca que recebeu. **Um Pix
 * por mês, uma linha por mês.**
 */

export type EspacoNaTela = {
  id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  observacao: string | null;
  /** Quantos contratos apontam para ele. A tela avisa antes de desligar. */
  contratos: number;
  /** Se há contrato VIGENTE nele. É isto que diz se o espaço está ocupado. */
  ocupado: boolean;
};

export type ContratoNaTela = {
  id: string;
  /** Quem paga. Exatamente um dos dois, nunca os dois. */
  cliente: { id: string; nome: string } | null;
  empresa: { id: string; nome: string } | null;
  espaco: { id: string; nome: string } | null;
  /** Em reais, com duas casas. */
  valorMensal: string;
  diaVencimento: number;
  /** Horas de sala inclusas. NULO = sem cota, toda hora é cobrada. */
  cotaHoras: number | null;
  inicio: string;
  fim: string | null;
  ativo: boolean;
  observacao: string | null;
  /** Se ele gera cobrança hoje: ativo, já começou e ainda não terminou. */
  vigente: boolean;
  /** Quantas cobranças já foram geradas. */
  cobrancas: number;
};

// -----------------------------------------------------------------------------
// Os espaços
// -----------------------------------------------------------------------------

export async function listarEspacos(opcoes?: {
  somenteAtivos?: boolean;
  agora?: Date;
}): Promise<EspacoNaTela[]> {
  const espacos = await prisma.espaco.findMany({
    where: opcoes?.somenteAtivos ? { ativo: true } : {},
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    include: {
      contratos: {
        select: { id: true, ativo: true, inicio: true, fim: true },
      },
    },
  });

  const hoje = paraData(dataLocalDe(opcoes?.agora ?? new Date()));

  return espacos.map((espaco) => ({
    id: espaco.id,
    nome: espaco.nome,
    ativo: espaco.ativo,
    ordem: espaco.ordem,
    observacao: espaco.observacao,
    contratos: espaco.contratos.length,
    /*
     * OCUPADO É SOBRE HOJE, não sobre existir contrato.
     *
     * Um espaço com contrato que terminou em março está LIVRE, e mostrá-lo
     * como ocupado faria a equipe deixar de alugá-lo. Quem decide é o
     * servidor, no relógio de São Paulo.
     */
    ocupado: espaco.contratos.some(
      (contrato) =>
        contrato.ativo &&
        contrato.inicio <= hoje &&
        (contrato.fim === null || contrato.fim >= hoje),
    ),
  }));
}

export async function criarEspaco(entrada: {
  nome: string;
  observacao?: string | null;
}): Promise<Resultado<EspacoNaTela>> {
  const nome = entrada.nome.trim();

  if (nome.length < 1) {
    return {
      ok: false,
      falha: { motivo: "Escreva o nome do espaço.", codigo: "NOME_INVALIDO" },
    };
  }

  const repetido = await prisma.espaco.findUnique({
    where: { nome },
    select: { id: true },
  });

  if (repetido) {
    return {
      ok: false,
      falha: { motivo: "Já existe um espaço com esse nome.", codigo: "REPETIDO" },
    };
  }

  const ultimo = await prisma.espaco.findFirst({
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const criado = await prisma.espaco.create({
    data: {
      nome,
      observacao: entrada.observacao?.trim() || null,
      ordem: (ultimo?.ordem ?? 0) + 1,
    },
  });

  return {
    ok: true,
    dados: {
      id: criado.id,
      nome: criado.nome,
      ativo: criado.ativo,
      ordem: criado.ordem,
      observacao: criado.observacao,
      contratos: 0,
      ocupado: false,
    },
  };
}

/**
 * Renomeia, anota ou desliga um espaço.
 *
 * EXCLUIR NÃO EXISTE: desliga-se, mesma regra de salas, empresas, áreas de
 * atuação, clientes, categorias e fornecedores. A chave é RESTRICT.
 */
export async function editarEspaco(
  id: string,
  mudanca: { nome?: string; observacao?: string | null; ativo?: boolean },
  agora?: Date,
): Promise<Resultado<EspacoNaTela>> {
  const atual = await prisma.espaco.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!atual) {
    return {
      ok: false,
      falha: { motivo: "Espaço não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  const nome = mudanca.nome?.trim();

  if (nome !== undefined) {
    if (nome.length < 1) {
      return {
        ok: false,
        falha: { motivo: "Escreva o nome do espaço.", codigo: "NOME_INVALIDO" },
      };
    }

    const repetido = await prisma.espaco.findFirst({
      where: { nome, id: { not: id } },
      select: { id: true },
    });

    if (repetido) {
      return {
        ok: false,
        falha: { motivo: "Já existe um espaço com esse nome.", codigo: "REPETIDO" },
      };
    }
  }

  /*
   * ESPAÇO OCUPADO NÃO SE DESLIGA.
   *
   * Desligado, ele sai da lista de escolha de contrato novo — mas o contrato
   * VIGENTE dele continuaria cobrando, e a equipe veria um espaço "fora do
   * ar" gerando dinheiro todo mês. Primeiro encerra-se o contrato.
   */
  if (mudanca.ativo === false) {
    const hoje = paraData(dataLocalDe(agora ?? new Date()));

    const vigente = await prisma.contratoMensal.count({
      where: {
        espacoId: id,
        ativo: true,
        inicio: { lte: hoje },
        OR: [{ fim: null }, { fim: { gte: hoje } }],
      },
    });

    if (vigente > 0) {
      return {
        ok: false,
        falha: {
          motivo:
            "Este espaço tem contrato vigente. Encerre o contrato antes de desligar o espaço.",
          codigo: "ESPACO_OCUPADO",
        },
      };
    }
  }

  await prisma.espaco.update({
    where: { id },
    data: {
      ...(nome !== undefined ? { nome } : {}),
      ...(mudanca.observacao !== undefined
        ? { observacao: mudanca.observacao?.trim() || null }
        : {}),
      ...(mudanca.ativo !== undefined ? { ativo: mudanca.ativo } : {}),
    },
  });

  const lista = await listarEspacos({ agora });
  const salvo = lista.find((espaco) => espaco.id === id);

  return salvo
    ? { ok: true, dados: salvo }
    : {
        ok: false,
        falha: { motivo: "Espaço não encontrado.", codigo: "NAO_ENCONTRADO" },
      };
}

/** Grava a ordem da lista inteira, para nunca haver duas posições iguais. */
export async function reordenarEspacos(ids: string[]): Promise<Resultado<null>> {
  if (ids.length === 0) {
    return { ok: false, falha: { motivo: "Informe a ordem.", codigo: "SEM_IDS" } };
  }

  const quantos = await prisma.espaco.count({ where: { id: { in: ids } } });

  if (quantos !== ids.length) {
    return {
      ok: false,
      falha: { motivo: "Espaço não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  await prisma.$transaction(
    ids.map((id, indice) =>
      prisma.espaco.update({ where: { id }, data: { ordem: indice + 1 } }),
    ),
  );

  return { ok: true, dados: null };
}

// -----------------------------------------------------------------------------
// Os contratos
// -----------------------------------------------------------------------------

/** "2026-12" — o mês cobrado. */
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * O DIA DO VENCIMENTO DENTRO DE UM MÊS.
 *
 * O contrato que vence dia 31 não tem onde cair em fevereiro. Cai no ÚLTIMO
 * dia do mês — e não no dia 1º do mês seguinte, que mudaria a competência da
 * cobrança, nem no dia 28 fixo, que atrasaria o vencimento nos meses de 30 e
 * 31 dias.
 */
export function vencimentoDaCompetencia(
  competencia: string,
  diaVencimento: number,
): string {
  const [ano, mes] = competencia.split("-").map(Number);
  // O dia 0 do mês seguinte é o último do mês atual: funciona em fevereiro e
  // em ano bissexto sem nenhuma tabela de dias.
  const ultimo = new Date(Date.UTC(ano!, mes!, 0)).getUTCDate();
  const dia = Math.min(diaVencimento, ultimo);

  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

const COM_O_CONTRATO = {
  cliente: { select: { id: true, nome: true } },
  empresa: { select: { id: true, nome: true } },
  espaco: { select: { id: true, nome: true } },
  _count: { select: { cobrancas: true } },
} as const;

type LinhaDoContrato = Prisma.ContratoMensalGetPayload<{
  include: typeof COM_O_CONTRATO;
}>;

function contratoParaTela(linha: LinhaDoContrato, hoje: string): ContratoNaTela {
  const inicio = diaDe(linha.inicio);
  const fim = linha.fim ? diaDe(linha.fim) : null;

  return {
    id: linha.id,
    cliente: linha.cliente,
    empresa: linha.empresa,
    espaco: linha.espaco,
    valorMensal: comoTexto(linha.valorMensal),
    diaVencimento: linha.diaVencimento,
    cotaHoras: linha.cotaHoras,
    inicio,
    fim,
    ativo: linha.ativo,
    observacao: linha.observacao,
    /*
     * VIGENTE é "gera cobrança hoje": ativo, já começou e ainda não terminou.
     *
     * Quem decide é o SERVIDOR, no relógio de São Paulo — refazer a conta no
     * navegador poria a regra de fuso em dois lugares, e o do operador pode
     * estar em outro.
     */
    vigente: linha.ativo && inicio <= hoje && (fim === null || fim >= hoje),
    cobrancas: linha._count.cobrancas,
  };
}

export async function listarContratos(opcoes?: {
  somenteVigentes?: boolean;
  agora?: Date;
}): Promise<ContratoNaTela[]> {
  const contratos = await prisma.contratoMensal.findMany({
    orderBy: [{ ativo: "desc" }, { criadoEm: "asc" }],
    include: COM_O_CONTRATO,
  });

  const hoje = dataLocalDe(opcoes?.agora ?? new Date());
  const naTela = contratos.map((linha) => contratoParaTela(linha, hoje));

  return opcoes?.somenteVigentes
    ? naTela.filter((contrato) => contrato.vigente)
    : naTela;
}

export type EntradaDeContrato = {
  clienteId?: string | null;
  empresaId?: string | null;
  espacoId?: string | null;
  /** Em reais, como a tela digita. */
  valorMensal: string;
  diaVencimento: number;
  cotaHoras?: number | null;
  inicio: string;
  fim?: string | null;
  observacao?: string | null;
};

/** Confere o que não depende do banco. */
function conferirContrato(entrada: EntradaDeContrato): Falha | null {
  const temCliente = Boolean(entrada.clienteId);
  const temEmpresa = Boolean(entrada.empresaId);

  /*
   * UM PAGADOR, E EXATAMENTE UM (trava também no banco).
   *
   * Nenhum deixaria a cobrança sem dono — ela nasceria no caixa sem dizer de
   * quem é, e o relatório por cliente não a veria. Os dois deixariam a tela
   * sem saber para quem emitir.
   */
  if (temCliente === temEmpresa) {
    return {
      motivo: "Escolha quem paga: uma pessoa ou uma empresa.",
      codigo: "PAGADOR_INVALIDO",
    };
  }

  const centavos = centavosDe(entrada.valorMensal);

  if (centavos === null || centavos <= 0) {
    return {
      motivo: "Escreva o valor da mensalidade, como 2400,00.",
      codigo: "VALOR_INVALIDO",
    };
  }

  if (
    !Number.isInteger(entrada.diaVencimento) ||
    entrada.diaVencimento < 1 ||
    entrada.diaVencimento > 31
  ) {
    return {
      motivo: "O dia do vencimento precisa ser de 1 a 31.",
      codigo: "DIA_INVALIDO",
    };
  }

  /*
   * COTA ZERO É RECUSADA, e não tratada como "sem cota".
   *
   * Quem não tem horas inclusas deixa o campo em BRANCO. Um zero gravado diria
   * "tem plano com zero hora" — a mesma coisa, dita de um jeito que a tela
   * leria como "tem plano com horas" e mostraria "0 de 0 usadas".
   */
  if (entrada.cotaHoras !== undefined && entrada.cotaHoras !== null) {
    if (!Number.isInteger(entrada.cotaHoras) || entrada.cotaHoras <= 0) {
      return {
        motivo:
          "A cota de horas precisa ser um número maior que zero. Deixe em branco se não há horas inclusas.",
        codigo: "COTA_INVALIDA",
      };
    }
  }

  if (!DIA.test(entrada.inicio)) {
    return { motivo: "Informe o início do contrato.", codigo: "INICIO_INVALIDO" };
  }

  if (entrada.fim) {
    if (!DIA.test(entrada.fim)) {
      return { motivo: "Informe o fim do contrato.", codigo: "FIM_INVALIDO" };
    }

    if (entrada.fim < entrada.inicio) {
      return {
        motivo: "O fim do contrato não pode ser antes do início.",
        codigo: "FIM_INVALIDO",
      };
    }
  }

  return null;
}

/** Confere o que existe e está ligado. */
async function conferirLigadosDoContrato(
  entrada: EntradaDeContrato,
): Promise<Falha | null> {
  if (entrada.clienteId) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: entrada.clienteId },
      select: { ativo: true },
    });

    if (!cliente) {
      return { motivo: "Cliente não encontrado.", codigo: "CLIENTE_INVALIDO" };
    }
  }

  if (entrada.empresaId) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: entrada.empresaId },
      select: { ativa: true },
    });

    if (!empresa) {
      return { motivo: "Empresa não encontrada.", codigo: "EMPRESA_INVALIDA" };
    }

    /*
     * EMPRESA DESLIGADA É RECUSADA, mesma regra do vínculo de cliente de
     * 11/11: fazer um contrato para uma empresa que saiu do coworking poria
     * cobrança no nome de quem ninguém vai cobrar.
     */
    if (!empresa.ativa) {
      return {
        motivo: "Essa empresa está desligada. Religue-a antes de fazer o contrato.",
        codigo: "EMPRESA_DESLIGADA",
      };
    }
  }

  if (entrada.espacoId) {
    const espaco = await prisma.espaco.findUnique({
      where: { id: entrada.espacoId },
      select: { ativo: true },
    });

    if (!espaco) {
      return { motivo: "Espaço não encontrado.", codigo: "ESPACO_INVALIDO" };
    }

    if (!espaco.ativo) {
      return {
        motivo: "Esse espaço está desligado. Religue-o ou escolha outro.",
        codigo: "ESPACO_DESLIGADO",
      };
    }
  }

  return null;
}

/**
 * O MESMO ESPAÇO NÃO PODE TER DOIS CONTRATOS AO MESMO TEMPO.
 *
 * Dois mensalistas na mesma sala privativa é um problema físico, não de
 * cadastro — e ninguém descobriria pelo sistema: as duas cobranças sairiam
 * certas, todo mês, e o conflito apareceria na porta da sala.
 *
 * A conferência é por PERÍODO: um contrato que terminou em março não atrapalha
 * outro que começa em abril. Contrato sem fim ocupa dali para frente.
 */
async function espacoLivreNoPeriodo(entrada: {
  espacoId: string;
  inicio: string;
  fim: string | null;
  exceto?: string;
}): Promise<{ id: string; nome: string } | null> {
  const concorrentes = await prisma.contratoMensal.findMany({
    where: {
      espacoId: entrada.espacoId,
      ativo: true,
      ...(entrada.exceto ? { id: { not: entrada.exceto } } : {}),
    },
    select: {
      id: true,
      inicio: true,
      fim: true,
      cliente: { select: { nome: true } },
      empresa: { select: { nome: true } },
    },
  });

  for (const outro of concorrentes) {
    const comecaOutro = diaDe(outro.inicio);
    const terminaOutro = outro.fim ? diaDe(outro.fim) : null;

    // Dois períodos se cruzam quando cada um começa antes do outro acabar.
    // Período sem fim é tratado como "até sempre".
    const cruzam =
      (terminaOutro === null || entrada.inicio <= terminaOutro) &&
      (entrada.fim === null || comecaOutro <= entrada.fim);

    if (cruzam) {
      return {
        id: outro.id,
        nome: outro.cliente?.nome ?? outro.empresa?.nome ?? "outro contrato",
      };
    }
  }

  return null;
}

export async function criarContrato(
  entrada: EntradaDeContrato,
  agora?: Date,
): Promise<Resultado<ContratoNaTela>> {
  const erroDeCampo = conferirContrato(entrada);

  if (erroDeCampo) {
    return { ok: false, falha: erroDeCampo };
  }

  const erroDeLigado = await conferirLigadosDoContrato(entrada);

  if (erroDeLigado) {
    return { ok: false, falha: erroDeLigado };
  }

  if (entrada.espacoId) {
    const ocupante = await espacoLivreNoPeriodo({
      espacoId: entrada.espacoId,
      inicio: entrada.inicio,
      fim: entrada.fim ?? null,
    });

    if (ocupante) {
      return {
        ok: false,
        falha: {
          motivo: `Este espaço já tem contrato de ${ocupante.nome} nesse período. Encerre o contrato dele antes, ou escolha outro espaço.`,
          codigo: "ESPACO_OCUPADO",
        },
      };
    }
  }

  const criado = await prisma.contratoMensal.create({
    data: {
      clienteId: entrada.clienteId ?? null,
      empresaId: entrada.empresaId ?? null,
      espacoId: entrada.espacoId ?? null,
      valorMensal: reaisDe(centavosDe(entrada.valorMensal)!),
      diaVencimento: entrada.diaVencimento,
      cotaHoras: entrada.cotaHoras ?? null,
      inicio: paraData(entrada.inicio),
      fim: entrada.fim ? paraData(entrada.fim) : null,
      observacao: entrada.observacao?.trim() || null,
    },
    include: COM_O_CONTRATO,
  });

  return {
    ok: true,
    dados: contratoParaTela(criado, dataLocalDe(agora ?? new Date())),
  };
}

/**
 * EDITA o contrato.
 *
 * **AUMENTAR O VALOR NÃO RETROAGE**, e isto é regra registrada: as cobranças
 * já geradas ficam com o valor que era. O valor viaja para o lançamento no
 * momento da geração e fica congelado lá — mesma regra do valor da reserva e
 * do preço do empório. Se retroagisse, o faturamento de um mês fechado mudaria
 * sozinho quando a equipe reajustasse a mensalidade, e nenhum relatório antigo
 * seria confiável.
 */
export async function editarContrato(
  id: string,
  mudanca: Partial<EntradaDeContrato> & { ativo?: boolean },
  agora?: Date,
): Promise<Resultado<ContratoNaTela>> {
  const atual = await prisma.contratoMensal.findUnique({
    where: { id },
    include: COM_O_CONTRATO,
  });

  if (!atual) {
    return {
      ok: false,
      falha: { motivo: "Contrato não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  // A conferência roda sobre o contrato COMO ELE FICARIA, e não só sobre o que
  // veio na mudança: trocar só o pagador, num contrato que já tem empresa,
  // continua sendo cliente e empresa juntos.
  const depois: EntradaDeContrato = {
    clienteId:
      mudanca.clienteId !== undefined ? mudanca.clienteId : atual.clienteId,
    empresaId:
      mudanca.empresaId !== undefined ? mudanca.empresaId : atual.empresaId,
    espacoId: mudanca.espacoId !== undefined ? mudanca.espacoId : atual.espacoId,
    valorMensal: mudanca.valorMensal ?? comoTexto(atual.valorMensal),
    diaVencimento: mudanca.diaVencimento ?? atual.diaVencimento,
    cotaHoras:
      mudanca.cotaHoras !== undefined ? mudanca.cotaHoras : atual.cotaHoras,
    inicio: mudanca.inicio ?? diaDe(atual.inicio),
    fim:
      mudanca.fim !== undefined
        ? mudanca.fim
        : atual.fim
          ? diaDe(atual.fim)
          : null,
    observacao:
      mudanca.observacao !== undefined ? mudanca.observacao : atual.observacao,
  };

  const erroDeCampo = conferirContrato(depois);

  if (erroDeCampo) {
    return { ok: false, falha: erroDeCampo };
  }

  const erroDeLigado = await conferirLigadosDoContrato(depois);

  if (erroDeLigado) {
    return { ok: false, falha: erroDeLigado };
  }

  if (depois.espacoId) {
    const ocupante = await espacoLivreNoPeriodo({
      espacoId: depois.espacoId,
      inicio: depois.inicio,
      fim: depois.fim ?? null,
      exceto: id,
    });

    if (ocupante) {
      return {
        ok: false,
        falha: {
          motivo: `Este espaço já tem contrato de ${ocupante.nome} nesse período.`,
          codigo: "ESPACO_OCUPADO",
        },
      };
    }
  }

  const salvo = await prisma.contratoMensal.update({
    where: { id },
    data: {
      clienteId: depois.clienteId ?? null,
      empresaId: depois.empresaId ?? null,
      espacoId: depois.espacoId ?? null,
      valorMensal: reaisDe(centavosDe(depois.valorMensal)!),
      diaVencimento: depois.diaVencimento,
      cotaHoras: depois.cotaHoras ?? null,
      inicio: paraData(depois.inicio),
      fim: depois.fim ? paraData(depois.fim) : null,
      observacao: depois.observacao?.trim() || null,
      ...(mudanca.ativo !== undefined ? { ativo: mudanca.ativo } : {}),
    },
    include: COM_O_CONTRATO,
  });

  return {
    ok: true,
    dados: contratoParaTela(salvo, dataLocalDe(agora ?? new Date())),
  };
}

// -----------------------------------------------------------------------------
// A geração das mensalidades
// -----------------------------------------------------------------------------

export type RelatorioDaGeracao = {
  competencia: string;
  /** Quantas cobranças nasceram agora. */
  criadas: number;
  /** Quantas já existiam — gerar de novo não cobra em dobro. */
  jaExistiam: number;
  /** Os contratos que não entraram, com o motivo. */
  pulados: { contratoId: string; quem: string; motivo: string }[];
  /** O total gerado, em centavos. */
  totalCentavos: number;
};

/**
 * GERA AS COBRANÇAS DE UM MÊS.
 *
 * É AÇÃO DA EQUIPE, e não rotina automática — por uma razão prática: a prévia
 * roda com `CRON_ATIVO="false"`, e uma rotina simplesmente não aconteceria
 * lá. Pior: ninguém veria que não aconteceu. Um botão acontece quando a pessoa
 * clica, na frente dela, com o resultado na tela.
 *
 * É IDEMPOTENTE, e isto não é detalhe: o índice único
 * (`contrato_id`, `competencia`) é o que faz clicar duas vezes em "gerar
 * dezembro" não cobrar em dobro. Sem ele, dois cliques dobrariam a receita do
 * mês e **cada linha continuaria parecendo certa** — o erro só apareceria no
 * extrato do cliente.
 *
 * O VALOR É CONGELADO NA COBRANÇA. Reajustar a mensalidade depois não muda o
 * que já foi gerado: mesma regra do valor da reserva e do preço do empório. Se
 * retroagisse, o faturamento de um mês fechado mudaria sozinho.
 *
 * ELA NASCE **PENDENTE**, nunca paga. O sistema não tem como saber que o Pix
 * caiu — quem sabe é quem olhou a conta. É o mesmo princípio do "Recebi no
 * balcão": o dinheiro entra no caixa quando uma pessoa diz que entrou.
 */
export async function gerarMensalidades(entrada: {
  /** "2026-12". */
  competencia: string;
  operador?: Operador | null;
  agora?: Date;
}): Promise<Resultado<RelatorioDaGeracao>> {
  if (!COMPETENCIA.test(entrada.competencia)) {
    return {
      ok: false,
      falha: { motivo: "Informe o mês como 2026-12.", codigo: "COMPETENCIA_INVALIDA" },
    };
  }

  const categoriaId = await categoriaDaOrigem("mensalidades");

  if (!categoriaId) {
    return {
      ok: false,
      falha: {
        motivo:
          "A categoria “Mensalidades” não existe. Cadastre-a em Financeiro → Categorias.",
        codigo: "CATEGORIA_INVALIDA",
      },
    };
  }

  const contratos = await prisma.contratoMensal.findMany({
    where: { ativo: true },
    include: {
      cliente: { select: { id: true, nome: true } },
      empresa: { select: { id: true, nome: true } },
      espaco: { select: { nome: true } },
    },
  });

  const primeiroDoMes = `${entrada.competencia}-01`;
  const ultimoDoMes = vencimentoDaCompetencia(entrada.competencia, 31);

  const relatorio: RelatorioDaGeracao = {
    competencia: entrada.competencia,
    criadas: 0,
    jaExistiam: 0,
    pulados: [],
    totalCentavos: 0,
  };

  for (const contrato of contratos) {
    const quem = contrato.cliente?.nome ?? contrato.empresa?.nome ?? "sem nome";
    const comeca = diaDe(contrato.inicio);
    const termina = contrato.fim ? diaDe(contrato.fim) : null;

    /*
     * O CONTRATO PRECISA ESTAR VIGENTE **DENTRO DAQUELE MÊS**, e não hoje.
     *
     * Isto é o que permite gerar um mês passado que ficou esquecido, e o que
     * impede gerar dezembro para um contrato que terminou em março. Comparar
     * com "hoje" faria as duas coisas erradas ao mesmo tempo.
     */
    if (comeca > ultimoDoMes) {
      relatorio.pulados.push({
        contratoId: contrato.id,
        quem,
        motivo: `o contrato começa em ${comeca.split("-").reverse().join("/")}, depois deste mês`,
      });
      continue;
    }

    if (termina !== null && termina < primeiroDoMes) {
      relatorio.pulados.push({
        contratoId: contrato.id,
        quem,
        motivo: `o contrato terminou em ${termina.split("-").reverse().join("/")}, antes deste mês`,
      });
      continue;
    }

    const jaExiste = await prisma.lancamento.findFirst({
      where: { contratoId: contrato.id, competencia: entrada.competencia },
      select: { id: true },
    });

    if (jaExiste) {
      relatorio.jaExistiam += 1;
      continue;
    }

    const vencimento = vencimentoDaCompetencia(
      entrada.competencia,
      contrato.diaVencimento,
    );

    const mesPorExtenso = new Date(
      Date.UTC(
        Number(entrada.competencia.slice(0, 4)),
        Number(entrada.competencia.slice(5, 7)) - 1,
        1,
      ),
    ).toLocaleDateString("pt-BR", {
      timeZone: "UTC",
      month: "long",
      year: "numeric",
    });

    const descricao = contrato.espaco
      ? `Mensalidade ${mesPorExtenso} · ${contrato.espaco.nome} · ${quem}`
      : `Mensalidade ${mesPorExtenso} · ${quem}`;

    try {
      await prisma.lancamento.create({
        data: {
          descricao,
          // O VALOR DO CONTRATO, congelado aqui. Reajuste depois não mexe.
          valor: comoTexto(contrato.valorMensal),
          categoriaId,
          clienteId: contrato.clienteId,
          empresaId: contrato.empresaId,
          vencimento: paraData(vencimento),
          // NASCE PENDENTE: o sistema não sabe que o Pix caiu.
          pagoEm: null,
          contratoId: contrato.id,
          competencia: entrada.competencia,
          criadoPorId: entrada.operador?.id ?? null,
          criadoPorNome: entrada.operador?.nome ?? null,
        },
      });

      relatorio.criadas += 1;
      relatorio.totalCentavos += centavosDe(comoTexto(contrato.valorMensal)) ?? 0;
    } catch {
      /*
       * O ÍNDICE ÚNICO BARROU: outra pessoa clicou em "gerar" no mesmo
       * instante. Isto conta como "já existia", e não como erro — o resultado
       * para a equipe é o mesmo, e derrubar a geração inteira por causa de uma
       * linha faria as outras deixarem de nascer.
       */
      relatorio.jaExistiam += 1;
    }
  }

  return { ok: true, dados: relatorio };
}

/**
 * As cobranças de um contrato, da mais recente para a mais antiga.
 *
 * É o extrato do mensalista: o que já foi cobrado, o que ele pagou e o que
 * está em atraso.
 */
export async function cobrancasDoContrato(
  contratoId: string,
  agora?: Date,
): Promise<LancamentoNaTela[]> {
  const linhas = await prisma.lancamento.findMany({
    where: { contratoId },
    orderBy: [{ competencia: "desc" }],
    include: COM_OS_LIGADOS,
  });

  const hoje = dataLocalDe(agora ?? new Date());

  return linhas.map((linha) => paraTela(linha, hoje));
}

// -----------------------------------------------------------------------------
// FASE 16, PARTE E — O PAINEL DO FINANCEIRO
// -----------------------------------------------------------------------------

/**
 * O PAINEL É SÓ LEITURA, e isso é regra — mesma do dashboard de relatórios:
 * não existe rota de escrita nele, e nada aqui altera lançamento, contrato ou
 * configuração. Ele monta números a partir do que já está gravado.
 *
 * O QUE ELE NÃO MOSTRA, E POR QUÊ
 *
 *  - **SALDO DO BANCO.** O sistema não conhece o dinheiro que já estava na
 *    conta antes dele existir. Um "saldo acumulado" somaria só o que foi
 *    lançado aqui e apareceria na tela como se fosse o saldo de verdade —
 *    errado, e do jeito que ninguém desconfia. O painel mostra o RESULTADO DO
 *    PERÍODO. Quem quiser um saldo de partida lança uma entrada normal.
 *  - **DRE.** Decisão do dono em 17/11: *"DRE é balanço, é parte de
 *    contábeis"*. O que está aqui é caixa — entrou menos saiu —, e é por isso
 *    que o número se chama "resultado" e não "lucro": lucro contábil tem
 *    depreciação, provisão e competência, que o sistema não tem.
 */

export type FatiaDoPainel = {
  categoria: string;
  centavos: number;
  /** Quantas linhas somaram nela — a equipe pergunta "de quantas contas?". */
  quantas: number;
};

export type MesDoPainel = {
  /** "2026-12". */
  competencia: string;
  entradasCentavos: number;
  saidasCentavos: number;
  resultadoCentavos: number;
};

export type PainelFinanceiro = {
  competencia: string;
  /** O mês de comparação: o anterior no calendário. */
  competenciaAnterior: string;
  /**
   * O CAIXA DO MÊS: só o que entrou e saiu DE VERDADE (tem data de pagamento).
   * É a visão "pagamento", não a de vencimento.
   */
  entradasCentavos: number;
  saidasCentavos: number;
  resultadoCentavos: number;
  /**
   * A margem, em porcentagem com uma casa. NULA quando não entrou nada: zero
   * diria "margem de 0%", que é uma informação diferente de "não há o que
   * dividir" — e dividir por zero daria Infinity na tela.
   */
  margem: number | null;
  /** Os mesmos números do mês anterior, para a comparação. */
  anterior: { entradasCentavos: number; saidasCentavos: number; resultadoCentavos: number };
  /** A INADIMPLÊNCIA: pendente cujo vencimento já passou, em qualquer mês. */
  atrasadoAReceberCentavos: number;
  atrasadoAPagarCentavos: number;
  quantasAtrasadasAReceber: number;
  quantasAtrasadasAPagar: number;
  /** Onde o dinheiro entrou e saiu, por categoria, do maior para o menor. */
  entradasPorCategoria: FatiaDoPainel[];
  saidasPorCategoria: FatiaDoPainel[];
  /** Os últimos meses, para ver a tendência. O mês escolhido é o último. */
  evolucao: MesDoPainel[];
  /** O que VENCE nos próximos meses e ainda não foi pago. */
  projecao: { competencia: string; aReceberCentavos: number; aPagarCentavos: number }[];
};

/** "2026-12" + n meses. */
function somarCompetencia(competencia: string, meses: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1 + meses, 1));

  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** O primeiro e o último dia de "2026-12". */
function limitesDoMes(competencia: string): { de: string; ate: string } {
  return {
    de: `${competencia}-01`,
    ate: vencimentoDaCompetencia(competencia, 31),
  };
}

/**
 * O caixa de um mês: o que entrou e saiu DE VERDADE.
 *
 * Usa a data de PAGAMENTO, e não a de vencimento. Uma conta de outubro paga em
 * novembro saiu do caixa em novembro — é ali que o dinheiro se mexeu.
 */
async function caixaDoMes(competencia: string): Promise<MesDoPainel> {
  const { de, ate } = limitesDoMes(competencia);

  const linhas = await prisma.lancamento.findMany({
    where: { pagoEm: { gte: paraData(de), lte: paraData(ate) } },
    select: { valor: true, categoria: { select: { tipo: true } } },
  });

  let entradas = 0;
  let saidas = 0;

  for (const linha of linhas) {
    const centavos = centavosDe(comoTexto(linha.valor)) ?? 0;

    if (linha.categoria.tipo === TipoDeLancamento.ENTRADA) {
      entradas += centavos;
    } else {
      saidas += centavos;
    }
  }

  return {
    competencia,
    entradasCentavos: entradas,
    saidasCentavos: saidas,
    resultadoCentavos: entradas - saidas,
  };
}

/**
 * MONTA O PAINEL de um mês.
 *
 * "quantosMeses" é o tamanho da série de evolução, contando o mês escolhido
 * como o último. Seis é um semestre — o bastante para ver tendência sem fazer
 * seis consultas virarem sessenta.
 */
export async function montarPainelFinanceiro(entrada: {
  /** "2026-12". Padrão: o mês de hoje, no relógio de São Paulo. */
  competencia?: string;
  quantosMeses?: number;
  /** Quantos meses de projeção à frente. */
  mesesDeProjecao?: number;
  agora?: Date;
}): Promise<Resultado<PainelFinanceiro>> {
  const hoje = dataLocalDe(entrada.agora ?? new Date());
  const competencia = entrada.competencia ?? hoje.slice(0, 7);

  if (!COMPETENCIA.test(competencia)) {
    return {
      ok: false,
      falha: { motivo: "Informe o mês como 2026-12.", codigo: "COMPETENCIA_INVALIDA" },
    };
  }

  const quantosMeses = Math.min(Math.max(entrada.quantosMeses ?? 6, 1), 24);
  const mesesDeProjecao = Math.min(Math.max(entrada.mesesDeProjecao ?? 3, 0), 12);

  const competenciaAnterior = somarCompetencia(competencia, -1);

  /*
   * A SÉRIE INTEIRA É BUSCADA MÊS A MÊS, e não numa consulta agrupada.
   *
   * Agrupar no banco faria o agrupamento acontecer no fuso DELE: um pagamento
   * de 30/11 às 22h é, em UTC, 1º de dezembro — e cairia no mês errado,
   * discordando da lista de lançamentos que a equipe vê ao lado. É a mesma
   * razão pela qual o relatório de reservas agrupa no relógio de São Paulo.
   *
   * São poucas consultas, todas por índice (`lancamentos_pago_em_idx`).
   */
  const evolucao: MesDoPainel[] = [];

  for (let i = quantosMeses - 1; i >= 0; i -= 1) {
    evolucao.push(await caixaDoMes(somarCompetencia(competencia, -i)));
  }

  const doMes = evolucao[evolucao.length - 1]!;
  const anterior =
    evolucao.length > 1
      ? evolucao[evolucao.length - 2]!
      : await caixaDoMes(competenciaAnterior);

  // --- por categoria, no mês escolhido ---------------------------------------
  const { de, ate } = limitesDoMes(competencia);

  const doMesComCategoria = await prisma.lancamento.findMany({
    where: { pagoEm: { gte: paraData(de), lte: paraData(ate) } },
    select: {
      valor: true,
      categoria: { select: { nome: true, tipo: true } },
    },
  });

  const entradasPorCategoria = new Map<string, FatiaDoPainel>();
  const saidasPorCategoria = new Map<string, FatiaDoPainel>();

  for (const linha of doMesComCategoria) {
    const alvo =
      linha.categoria.tipo === TipoDeLancamento.ENTRADA
        ? entradasPorCategoria
        : saidasPorCategoria;

    const atual = alvo.get(linha.categoria.nome) ?? {
      categoria: linha.categoria.nome,
      centavos: 0,
      quantas: 0,
    };

    atual.centavos += centavosDe(comoTexto(linha.valor)) ?? 0;
    atual.quantas += 1;
    alvo.set(linha.categoria.nome, atual);
  }

  const porValor = (a: FatiaDoPainel, b: FatiaDoPainel): number =>
    b.centavos - a.centavos;

  /*
   * A INADIMPLÊNCIA OLHA TODO O PASSADO, não só o mês escolhido.
   *
   * Uma conta de agosto que ninguém pagou continua em atraso em dezembro, e
   * limitá-la ao mês faria a dívida "desaparecer" sozinha com o tempo — o
   * número mais perigoso de se errar nesta tela.
   */
  const atrasadas = await prisma.lancamento.findMany({
    where: { pagoEm: null, vencimento: { lt: paraData(hoje) } },
    select: { valor: true, categoria: { select: { tipo: true } } },
  });

  let atrasadoAReceber = 0;
  let atrasadoAPagar = 0;
  let quantasAReceber = 0;
  let quantasAPagar = 0;

  for (const linha of atrasadas) {
    const centavos = centavosDe(comoTexto(linha.valor)) ?? 0;

    if (linha.categoria.tipo === TipoDeLancamento.ENTRADA) {
      atrasadoAReceber += centavos;
      quantasAReceber += 1;
    } else {
      atrasadoAPagar += centavos;
      quantasAPagar += 1;
    }
  }

  // --- a projeção: o que VENCE à frente e não foi pago -----------------------
  const projecao: PainelFinanceiro["projecao"] = [];

  for (let i = 1; i <= mesesDeProjecao; i += 1) {
    const mes = somarCompetencia(competencia, i);
    const limites = limitesDoMes(mes);

    const pendentes = await prisma.lancamento.findMany({
      where: {
        pagoEm: null,
        vencimento: { gte: paraData(limites.de), lte: paraData(limites.ate) },
      },
      select: { valor: true, categoria: { select: { tipo: true } } },
    });

    let aReceber = 0;
    let aPagar = 0;

    for (const linha of pendentes) {
      const centavos = centavosDe(comoTexto(linha.valor)) ?? 0;

      if (linha.categoria.tipo === TipoDeLancamento.ENTRADA) {
        aReceber += centavos;
      } else {
        aPagar += centavos;
      }
    }

    projecao.push({ competencia: mes, aReceberCentavos: aReceber, aPagarCentavos: aPagar });
  }

  return {
    ok: true,
    dados: {
      competencia,
      competenciaAnterior,
      entradasCentavos: doMes.entradasCentavos,
      saidasCentavos: doMes.saidasCentavos,
      resultadoCentavos: doMes.resultadoCentavos,
      /*
       * A MARGEM É NULA quando não entrou nada, e não zero.
       *
       * "Margem de 0%" é uma informação diferente de "não há o que dividir", e
       * dividir por zero daria Infinity na tela. Arredondada a uma casa: a
       * terceira casa de uma porcentagem não ajuda ninguém a decidir nada.
       */
      margem:
        doMes.entradasCentavos > 0
          ? Math.round((doMes.resultadoCentavos / doMes.entradasCentavos) * 1000) / 10
          : null,
      anterior: {
        entradasCentavos: anterior.entradasCentavos,
        saidasCentavos: anterior.saidasCentavos,
        resultadoCentavos: anterior.resultadoCentavos,
      },
      atrasadoAReceberCentavos: atrasadoAReceber,
      atrasadoAPagarCentavos: atrasadoAPagar,
      quantasAtrasadasAReceber: quantasAReceber,
      quantasAtrasadasAPagar: quantasAPagar,
      entradasPorCategoria: [...entradasPorCategoria.values()].sort(porValor),
      saidasPorCategoria: [...saidasPorCategoria.values()].sort(porValor),
      evolucao,
      projecao,
    },
  };
}
