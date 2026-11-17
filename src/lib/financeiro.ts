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
  origem: "MANUAL" | "RESERVA" | "EMPORIO";
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
    select: { id: true, reservaId: true, emporioDia: true },
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

  if (!alvo.reservaId) {
    return {
      ok: false,
      falha: {
        motivo: "Este lançamento já é manual.",
        codigo: "JA_MANUAL",
      },
    };
  }

  const salvo = await prisma.lancamento.update({
    where: { id },
    data: { reservaId: null },
    include: COM_OS_LIGADOS,
  });

  return { ok: true, dados: paraTela(salvo, dataLocalDe(agora ?? new Date())) };
}
