/**
 * CADASTRO DE SALAS (Fase 11).
 *
 * A equipe edita nome, capacidade, preco, duracao maxima e ordem, liga e
 * desliga salas e cadastra salas novas. Excluir NAO existe de proposito
 * (decisao do dono do projeto): uma sala apagada levaria junto o sentido das
 * reservas antigas ligadas a ela.
 *
 * Dois cuidados que nao sao obvios:
 *
 *   O ENDERECO DA SALA (slug) NASCE COM ELA E NUNCA MUDA. Ele aparece nos
 *   links de QR code impressos ("?sala=sala-ci"). Se renomear a sala trocasse
 *   o endereco, todo cartaz ja impresso pararia de funcionar.
 *
 *   NAO DA PARA DESLIGAR A ULTIMA SALA ATIVA. Sem nenhuma sala no ar, o site
 *   publico nao teria o que oferecer e a tela ficaria vazia sem explicacao.
 */
import { Prisma } from "@/generated/prisma/client";
import { StatusReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type SalaDoPainel = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  capacidade: number | null;
  /** Em reais, com centavos: "80.00". */
  precoPorHora: string;
  /** Nulo = pode ir ate o fechamento do dia. */
  duracaoMaximaMinutos: number | null;
  ordem: number;
  /** Quantas reservas ativas ainda estao por vir nesta sala. */
  reservasFuturas: number;
};

export type FalhaDeSala = {
  codigo: "REGRA" | "NAO_ENCONTRADA" | "NOME_REPETIDO";
  motivo: string;
};

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeSala };

export type DadosDeSala = {
  nome: string;
  capacidade: number | null;
  /** Em reais: 80 ou 80.5. */
  precoPorHora: number;
  duracaoMaximaMinutos: number | null;
  ordem: number;
};

const MAXIMO_DE_MINUTOS_NO_DIA = 24 * 60;

// -----------------------------------------------------------------------------
// Endereco da sala
// -----------------------------------------------------------------------------

/** "Sala de Reunião" vira "sala-de-reuniao". */
export function enderecoDe(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Acrescenta -2, -3... ate achar um endereco que ninguem esteja usando. */
async function enderecoLivre(base: string): Promise<string> {
  const raiz = base || "sala";

  for (let sufixo = 1; sufixo < 100; sufixo += 1) {
    const tentativa = sufixo === 1 ? raiz : `${raiz}-${sufixo}`;

    if (!(await prisma.sala.findUnique({ where: { slug: tentativa } }))) {
      return tentativa;
    }
  }

  throw new Error(`Nao foi possivel gerar um endereco livre para "${base}".`);
}

// -----------------------------------------------------------------------------
// Conferencias
// -----------------------------------------------------------------------------

async function duracaoMinimaAtual(): Promise<number> {
  const linha = await prisma.configuracao.findUnique({
    where: { chave: "duracaoMinimaMinutos" },
  });

  return linha ? Number(linha.valor) : 60;
}

async function validar(dados: DadosDeSala): Promise<string | null> {
  const nome = dados.nome.trim();

  if (nome.length < 2 || nome.length > 60) {
    return "O nome da sala precisa ter de 2 a 60 caracteres.";
  }

  if (enderecoDe(nome) === "") {
    return "O nome da sala precisa ter pelo menos uma letra ou número.";
  }

  if (!Number.isFinite(dados.precoPorHora) || dados.precoPorHora < 0) {
    return "O preço por hora não pode ser negativo.";
  }

  if (dados.precoPorHora > 99_999) {
    return "O preço por hora está alto demais. Confira se não sobrou um zero.";
  }

  if (Math.round(dados.precoPorHora * 100) !== dados.precoPorHora * 100) {
    return "O preço por hora aceita no máximo dois números depois da vírgula.";
  }

  if (dados.capacidade !== null) {
    if (!Number.isInteger(dados.capacidade) || dados.capacidade < 1 || dados.capacidade > 500) {
      return "A capacidade precisa ser um número inteiro de 1 a 500 pessoas.";
    }
  }

  if (!Number.isInteger(dados.ordem) || dados.ordem < 1 || dados.ordem > 99) {
    return "A ordem precisa ser um número inteiro de 1 a 99.";
  }

  if (dados.duracaoMaximaMinutos !== null) {
    const maxima = dados.duracaoMaximaMinutos;

    if (!Number.isInteger(maxima) || maxima % 30 !== 0) {
      return "A duração máxima precisa ser múltipla de 30 minutos, porque a agenda é feita de blocos de meia hora.";
    }

    if (maxima > MAXIMO_DE_MINUTOS_NO_DIA) {
      return "A duração máxima não pode passar de 24 horas. Deixe em branco para liberar até o fechamento do dia.";
    }

    const minima = await duracaoMinimaAtual();

    if (maxima < minima) {
      return `A duração máxima (${maxima} min) ficou menor que a duração mínima de reserva (${minima} min). Nenhum cliente conseguiria reservar esta sala.`;
    }
  }

  return null;
}

/** O nome ja existe em OUTRA sala? A trava de verdade e o indice unico do banco. */
async function nomeJaUsado(nome: string, exceto?: string): Promise<boolean> {
  const encontrada = await prisma.sala.findFirst({
    where: {
      nome: { equals: nome, mode: "insensitive" },
      ...(exceto ? { id: { not: exceto } } : {}),
    },
    select: { id: true },
  });

  return encontrada !== null;
}

function ehNomeRepetido(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  );
}

// -----------------------------------------------------------------------------
// Leitura
// -----------------------------------------------------------------------------

export async function listarSalas(): Promise<SalaDoPainel[]> {
  const agora = new Date();

  const salas = await prisma.sala.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    include: {
      _count: {
        select: {
          reservas: {
            where: {
              inicio: { gte: agora },
              status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
            },
          },
        },
      },
    },
  });

  return salas.map((sala) => ({
    id: sala.id,
    nome: sala.nome,
    slug: sala.slug,
    ativa: sala.ativa,
    capacidade: sala.capacidade,
    precoPorHora: sala.precoPorHora.toFixed(2),
    duracaoMaximaMinutos: sala.duracaoMaximaMinutos,
    ordem: sala.ordem,
    reservasFuturas: sala._count.reservas,
  }));
}

// -----------------------------------------------------------------------------
// Escrita
// -----------------------------------------------------------------------------

export async function criarSala(dados: DadosDeSala): Promise<Resultado<SalaDoPainel>> {
  const erro = await validar(dados);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  const nome = dados.nome.trim();

  if (await nomeJaUsado(nome)) {
    return {
      ok: false,
      falha: { codigo: "NOME_REPETIDO", motivo: `Já existe uma sala chamada "${nome}".` },
    };
  }

  try {
    const criada = await prisma.sala.create({
      data: {
        nome,
        slug: await enderecoLivre(enderecoDe(nome)),
        capacidade: dados.capacidade,
        precoPorHora: dados.precoPorHora.toFixed(2),
        duracaoMaximaMinutos: dados.duracaoMaximaMinutos,
        ordem: dados.ordem,
        ativa: true,
      },
      select: { id: true },
    });

    const lista = await listarSalas();
    const nova = lista.find((sala) => sala.id === criada.id);

    return nova
      ? { ok: true, dados: nova }
      : { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Sala não encontrada." } };
  } catch (falha) {
    if (ehNomeRepetido(falha)) {
      return {
        ok: false,
        falha: { codigo: "NOME_REPETIDO", motivo: `Já existe uma sala chamada "${nome}".` },
      };
    }
    throw falha;
  }
}

/**
 * Edita uma sala.
 *
 * O endereco (slug) fica como esta, mesmo quando o nome muda — ver o
 * comentario do topo deste arquivo.
 */
export async function atualizarSala(
  id: string,
  dados: DadosDeSala,
): Promise<Resultado<SalaDoPainel>> {
  const existente = await prisma.sala.findUnique({ where: { id }, select: { id: true } });

  if (!existente) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Sala não encontrada." } };
  }

  const erro = await validar(dados);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  const nome = dados.nome.trim();

  if (await nomeJaUsado(nome, id)) {
    return {
      ok: false,
      falha: { codigo: "NOME_REPETIDO", motivo: `Já existe uma sala chamada "${nome}".` },
    };
  }

  try {
    await prisma.sala.update({
      where: { id },
      data: {
        nome,
        capacidade: dados.capacidade,
        precoPorHora: dados.precoPorHora.toFixed(2),
        duracaoMaximaMinutos: dados.duracaoMaximaMinutos,
        ordem: dados.ordem,
      },
    });
  } catch (falha) {
    if (ehNomeRepetido(falha)) {
      return {
        ok: false,
        falha: { codigo: "NOME_REPETIDO", motivo: `Já existe uma sala chamada "${nome}".` },
      };
    }
    throw falha;
  }

  const lista = await listarSalas();
  const atualizada = lista.find((sala) => sala.id === id);

  return atualizada
    ? { ok: true, dados: atualizada }
    : { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Sala não encontrada." } };
}

/**
 * Liga ou desliga a sala.
 *
 * Desligar NAO mexe nas reservas ja marcadas: elas continuam de pe e a equipe
 * decide o que fazer com cada uma. A sala apenas some do site.
 */
export async function ligarOuDesligarSala(
  id: string,
  ativa: boolean,
): Promise<Resultado<SalaDoPainel>> {
  const sala = await prisma.sala.findUnique({ where: { id }, select: { id: true, ativa: true } });

  if (!sala) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Sala não encontrada." } };
  }

  if (!ativa && sala.ativa) {
    const outrasAtivas = await prisma.sala.count({
      where: { ativa: true, id: { not: id } },
    });

    if (outrasAtivas === 0) {
      return {
        ok: false,
        falha: {
          codigo: "REGRA",
          motivo:
            "Esta é a última sala ativa. Desligar todas deixaria o site sem nada para oferecer.",
        },
      };
    }
  }

  await prisma.sala.update({ where: { id }, data: { ativa } });

  const lista = await listarSalas();
  const atualizada = lista.find((item) => item.id === id);

  return atualizada
    ? { ok: true, dados: atualizada }
    : { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Sala não encontrada." } };
}
