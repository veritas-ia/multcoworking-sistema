/**
 * AS AREAS DE ATUACAO.
 *
 * Perguntadas na reserva e usadas so no relatorio do painel — com UMA
 * excecao: a profissao bloqueada nao pode reservar.
 *
 * ATE 27/10/2026 ESTA LISTA MORAVA AQUI, escrita no codigo, e o Juridico
 * estava bloqueado por uma constante. O dono pediu para a equipe poder
 * acrescentar e tirar profissoes sozinha, entao ela virou TABELA. O que
 * sobrou neste arquivo e o pouco que continua sendo decisao de codigo: o
 * texto generico de recusa e o nome que o relatorio da as reservas antigas.
 */
import { prisma } from "@/lib/prisma";

/** Como o relatorio chama as reservas anteriores a este campo. */
export const NAO_INFORMADO = "Não informado";

/**
 * O aviso usado quando a profissao esta bloqueada e nao tem texto proprio.
 *
 * Cada profissao pode trazer o aviso dela, editavel no painel. Este e so a
 * rede de seguranca: bloquear sem explicar nada deixaria o cliente sem saber
 * o que fazer.
 */
export const AVISO_BLOQUEIO_GENERICO =
  "No momento não realizamos reservas para esta área de atuação. Para mais informações, entre em contato com a recepção.";

/** Uma profissao do jeito que as telas precisam dela. */
export type OpcaoDeProfissao = {
  id: string;
  nome: string;
  bloqueada: boolean;
  /** Ja resolvido: o texto proprio dela, ou o generico. */
  avisoBloqueio: string;
};

export type ProfissaoDoPainel = OpcaoDeProfissao & {
  slug: string;
  ativa: boolean;
  ordem: number;
  /** Quantas reservas ja usaram esta profissao. Ela nunca se apaga. */
  reservas: number;
};

function comAviso(linha: {
  id: string;
  nome: string;
  bloqueada: boolean;
  avisoBloqueio: string | null;
}): OpcaoDeProfissao {
  return {
    id: linha.id,
    nome: linha.nome,
    bloqueada: linha.bloqueada,
    avisoBloqueio: linha.avisoBloqueio ?? AVISO_BLOQUEIO_GENERICO,
  };
}

// -----------------------------------------------------------------------------
// Leitura
// -----------------------------------------------------------------------------

/**
 * As profissoes que aparecem para escolher: so as ATIVAS.
 *
 * A bloqueada CONTINUA na lista, de proposito. Esconder faria o cliente da
 * area juridica procurar a opcao dele, nao achar e escolher "Outros" — e a
 * reserva passaria. Aparecendo, a recusa explica o motivo.
 */
export async function listarProfissoesParaEscolher(): Promise<OpcaoDeProfissao[]> {
  const linhas = await prisma.profissao.findMany({
    where: { ativa: true },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, bloqueada: true, avisoBloqueio: true },
  });

  return linhas.map(comAviso);
}

/** Todas, inclusive as desligadas, para a tela de configuracoes. */
export async function listarProfissoesDoPainel(): Promise<ProfissaoDoPainel[]> {
  const linhas = await prisma.profissao.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    include: { _count: { select: { reservas: true } } },
  });

  return linhas.map((linha) => ({
    ...comAviso(linha),
    slug: linha.slug,
    ativa: linha.ativa,
    ordem: linha.ordem,
    reservas: linha._count.reservas,
  }));
}

// -----------------------------------------------------------------------------
// A trava: quem nao pode reservar
// -----------------------------------------------------------------------------

export type RecusaDeProfissao = { motivo: string };

/**
 * Confere, no SERVIDOR, a profissao escolhida. Devolve a recusa ou nulo.
 *
 * Tres respostas diferentes, de proposito:
 *  - nao existe ou esta desligada: pedido invalido, provavelmente tela velha
 *    aberta num celular que ficou dias sem recarregar;
 *  - bloqueada: a recusa combinada, com o texto da propria profissao;
 *  - tudo certo: nulo.
 *
 * E AQUI que a regra vale. A tela tambem bloqueia, mas so para a pessoa nao
 * preencher o resto a toa — esconder o botao nao para quem manda o pedido
 * direto.
 */
export async function recusaDaProfissao(
  profissaoId: string,
): Promise<RecusaDeProfissao | null> {
  const profissao = await prisma.profissao.findUnique({
    where: { id: profissaoId },
    select: { ativa: true, bloqueada: true, avisoBloqueio: true },
  });

  if (!profissao || !profissao.ativa) {
    return { motivo: "Escolha uma área de atuação da lista." };
  }

  if (profissao.bloqueada) {
    return { motivo: profissao.avisoBloqueio ?? AVISO_BLOQUEIO_GENERICO };
  }

  return null;
}

/** O nome de tela de uma profissao ja carregada. Nulo vira "Nao informado". */
export function rotuloDaProfissao(profissao: { nome: string } | null): string {
  return profissao?.nome ?? NAO_INFORMADO;
}

// -----------------------------------------------------------------------------
// Escrita (painel)
// -----------------------------------------------------------------------------

export type FalhaDeProfissao = {
  codigo: "REGRA" | "NOME_REPETIDO" | "NAO_ENCONTRADA" | "ULTIMA_ATIVA";
  motivo: string;
};

export type ResultadoDeProfissao<T> =
  | { ok: true; dados: T }
  | { ok: false; falha: FalhaDeProfissao };

const MAXIMO_DO_NOME = 60;

function validarNome(nome: string): string | null {
  const limpo = nome.trim();

  if (limpo.length < 2) {
    return "O nome da área precisa ter pelo menos 2 letras.";
  }

  if (limpo.length > MAXIMO_DO_NOME) {
    return `O nome da área passa de ${MAXIMO_DO_NOME} caracteres.`;
  }

  return null;
}

/**
 * O nome interno, tirado do nome de tela.
 *
 * NUNCA muda depois de criado: renomear mexe so em "nome". E ele que amarra a
 * profissao ao que ja esta gravado — se mudasse, um relatorio antigo deixaria
 * de bater com a lista.
 */
function slugDe(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function criarProfissao(
  nome: string,
): Promise<ResultadoDeProfissao<ProfissaoDoPainel>> {
  const erro = validarNome(nome);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  const limpo = nome.trim();
  const slug = slugDe(limpo);

  if (slug === "") {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "Escreva o nome da área com letras ou números." },
    };
  }

  if (await prisma.profissao.findFirst({ where: { OR: [{ nome: limpo }, { slug }] } })) {
    return {
      ok: false,
      falha: { codigo: "NOME_REPETIDO", motivo: `Já existe uma área chamada "${limpo}".` },
    };
  }

  // Entra no fim da lista: ordem alta e depois a equipe reordena se quiser.
  const ultima = await prisma.profissao.findFirst({
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const criada = await prisma.profissao.create({
    data: { nome: limpo, slug, ordem: (ultima?.ordem ?? 0) + 1 },
    include: { _count: { select: { reservas: true } } },
  });

  return {
    ok: true,
    dados: {
      ...comAviso(criada),
      slug: criada.slug,
      ativa: criada.ativa,
      ordem: criada.ordem,
      reservas: criada._count.reservas,
    },
  };
}

/**
 * Edita uma profissao: nome, ligada/desligada, bloqueada e o aviso dela.
 *
 * NAO EXISTE EXCLUIR, mesma regra das salas e das empresas: as reservas
 * antigas apontam para ela, e apagar deixaria o relatorio sem explicacao.
 * Desligar tira das telas de reserva e mantem o historico.
 */
export async function editarProfissao(
  id: string,
  dados: {
    nome?: string;
    ativa?: boolean;
    bloqueada?: boolean;
    /** Texto vazio volta ao aviso generico. */
    avisoBloqueio?: string | null;
  },
): Promise<ResultadoDeProfissao<ProfissaoDoPainel>> {
  const existente = await prisma.profissao.findUnique({ where: { id } });

  if (!existente) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Área não encontrada." } };
  }

  if (dados.nome !== undefined) {
    const erro = validarNome(dados.nome);

    if (erro) {
      return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
    }

    const repetida = await prisma.profissao.findUnique({
      where: { nome: dados.nome.trim() },
    });

    if (repetida && repetida.id !== id) {
      return {
        ok: false,
        falha: {
          codigo: "NOME_REPETIDO",
          motivo: `Já existe uma área chamada "${dados.nome.trim()}".`,
        },
      };
    }
  }

  // A ULTIMA ATIVA NAO SE DESLIGA, e nem todas podem ficar bloqueadas: sem
  // nenhuma area escolhivel, o formulario de reserva nao fecha e NINGUEM
  // consegue reservar — nem no site, nem no balcao. O erro apareceria como
  // "escolha a area" numa lista vazia, e ninguem ligaria uma coisa a outra.
  const vaiDesligar = dados.ativa === false && existente.ativa;
  const vaiBloquear = dados.bloqueada === true && !existente.bloqueada;

  if (vaiDesligar || vaiBloquear) {
    const sobrando = await prisma.profissao.count({
      where: { id: { not: id }, ativa: true, bloqueada: false },
    });

    if (sobrando === 0) {
      return {
        ok: false,
        falha: {
          codigo: "ULTIMA_ATIVA",
          motivo:
            "Esta é a última área que pode reservar. Ligue ou desbloqueie outra antes, senão ninguém consegue marcar nada.",
        },
      };
    }
  }

  const atualizada = await prisma.profissao.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
      ...(dados.ativa !== undefined ? { ativa: dados.ativa } : {}),
      ...(dados.bloqueada !== undefined ? { bloqueada: dados.bloqueada } : {}),
      ...(dados.avisoBloqueio !== undefined
        ? { avisoBloqueio: dados.avisoBloqueio?.trim() || null }
        : {}),
    },
    include: { _count: { select: { reservas: true } } },
  });

  return {
    ok: true,
    dados: {
      ...comAviso(atualizada),
      slug: atualizada.slug,
      ativa: atualizada.ativa,
      ordem: atualizada.ordem,
      reservas: atualizada._count.reservas,
    },
  };
}

/**
 * Move uma profissao uma posicao para cima ou para baixo.
 *
 * Por botao, e nao arrastando: a recepcao mexe no tablet, onde arrastar e
 * ruim, e arrastar nao funciona pelo teclado. Mesma escolha das fotos de sala.
 */
export async function moverProfissao(
  id: string,
  direcao: "SUBIR" | "DESCER",
): Promise<ResultadoDeProfissao<ProfissaoDoPainel[]>> {
  const todas = await prisma.profissao.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true },
  });

  const posicao = todas.findIndex((linha) => linha.id === id);

  if (posicao === -1) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Área não encontrada." } };
  }

  const destino = direcao === "SUBIR" ? posicao - 1 : posicao + 1;

  // Nas pontas nao ha o que fazer, e nao e erro: o botao so nao faz nada.
  if (destino >= 0 && destino < todas.length) {
    const reordenada = [...todas];
    const [movida] = reordenada.splice(posicao, 1);
    reordenada.splice(destino, 0, movida!);

    // Regrava a ordem de TODAS, em bloco: assim a lista nunca fica com dois
    // numeros iguais, que deixariam a ordem no ar.
    await prisma.$transaction(
      reordenada.map((linha, indice) =>
        prisma.profissao.update({ where: { id: linha.id }, data: { ordem: indice + 1 } }),
      ),
    );
  }

  return { ok: true, dados: await listarProfissoesDoPainel() };
}
