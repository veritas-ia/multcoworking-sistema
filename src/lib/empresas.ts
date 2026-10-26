/**
 * EMPRESAS: varias pessoas da mesma empresa num total so.
 *
 * O problema real: tem salas alugadas por mes a empresas, e varios
 * funcionarios da MESMA empresa reservam, cada um do seu telefone. No
 * relatorio isso virava varios clientes separados, e as vezes quem paga a
 * conta do mes e a empresa, e nao a pessoa.
 *
 * O VINCULO E DO TELEFONE, NUNCA DA RESERVA. O relatorio descobre a empresa
 * pelo telefone na hora de montar, entao marcar um numero junta as reservas
 * passadas dele na mesma hora — e desvincular tira. Foi o combinado com o
 * dono: o relatorio reflete quem e cliente HOJE.
 */
import { prisma } from "@/lib/prisma";
import { normalizarTelefone } from "@/lib/telefone";

export type Empresa = {
  id: string;
  nome: string;
  ativa: boolean;
  /** Quantos telefones estao marcados como desta empresa. */
  telefones: number;
};

/** Um telefone da base, com tudo que ajuda a equipe a reconhecer quem e. */
export type ClienteConhecido = {
  telefone: string;
  /** TODOS os nomes que este numero ja usou, do mais recente para o mais antigo. */
  nomes: string[];
  reservas: number;
  /** A empresa a que ele pertence hoje. Nulo = nenhuma. */
  empresaId: string | null;
};

export type FalhaDeEmpresa = {
  codigo: "REGRA" | "NOME_REPETIDO" | "NAO_ENCONTRADA";
  motivo: string;
};

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; falha: FalhaDeEmpresa };

const MAXIMO_DO_NOME = 80;

// -----------------------------------------------------------------------------
// Leitura
// -----------------------------------------------------------------------------

export async function listarEmpresas(): Promise<Empresa[]> {
  const empresas = await prisma.empresa.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { telefones: true } } },
  });

  return empresas.map((empresa) => ({
    id: empresa.id,
    nome: empresa.nome,
    ativa: empresa.ativa,
    telefones: empresa._count.telefones,
  }));
}

/**
 * Todos os telefones que ja reservaram, com os nomes que usaram.
 *
 * E a lista que a equipe percorre para marcar quem e de qual empresa. Os
 * nomes vem TODOS, e nao so o mais recente, porque e justamente a variacao
 * ("Prestare", "Prestare Karen", "Prestare - Karen") que faz a equipe
 * reconhecer a empresa.
 */
export async function listarClientesConhecidos(): Promise<ClienteConhecido[]> {
  const [reservas, vinculos] = await Promise.all([
    prisma.reserva.findMany({
      select: { telefone: true, nomeCliente: true },
      orderBy: { criadoEm: "desc" },
    }),
    prisma.telefoneDaEmpresa.findMany(),
  ]);

  const empresaDo = new Map(vinculos.map((v) => [v.telefone, v.empresaId]));
  const porTelefone = new Map<string, { nomes: string[]; reservas: number }>();

  for (const reserva of reservas) {
    const atual = porTelefone.get(reserva.telefone) ?? { nomes: [], reservas: 0 };

    if (!atual.nomes.includes(reserva.nomeCliente)) {
      atual.nomes.push(reserva.nomeCliente);
    }

    atual.reservas += 1;
    porTelefone.set(reserva.telefone, atual);
  }

  return [...porTelefone.entries()]
    .map(([telefone, dados]) => ({
      telefone,
      nomes: dados.nomes,
      reservas: dados.reservas,
      empresaId: empresaDo.get(telefone) ?? null,
    }))
    .sort((a, b) => b.reservas - a.reservas);
}

// -----------------------------------------------------------------------------
// Sugestao: quais telefones parecem ser da mesma empresa
// -----------------------------------------------------------------------------

export type Sugestao = {
  /** A palavra que os nomes tem em comum: "prestare", "toca". */
  palavra: string;
  telefones: string[];
  /** Um exemplo de nome de cada telefone, para a equipe conferir. */
  exemplos: string[];
};

/** Palavras curtas e genericas demais para indicar empresa nenhuma. */
const IGNORADAS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "em", "para", "com",
  "cliente", "teste", "sala", "reserva", "sr", "sra",
]);

function palavrasDe(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length >= 4 && !IGNORADAS.has(palavra));
}

/**
 * Telefones DIFERENTES cujos nomes compartilham uma palavra.
 *
 * Serve so para a equipe nao ter que ler a lista inteira na mao: ela confirma
 * ou ignora. O sistema NUNCA junta nada sozinho — um palpite errado viraria
 * faturamento somado na empresa errada, e ninguem desconfiaria do numero.
 *
 * So entram telefones AINDA SEM empresa: sugerir o que ja foi decidido seria
 * ruido.
 */
export function sugerirAgrupamentos(clientes: ClienteConhecido[]): Sugestao[] {
  const porPalavra = new Map<string, Map<string, string>>();

  for (const cliente of clientes) {
    if (cliente.empresaId !== null) {
      continue;
    }

    for (const nome of cliente.nomes) {
      for (const palavra of palavrasDe(nome)) {
        const telefones = porPalavra.get(palavra) ?? new Map<string, string>();
        // Guarda um exemplo de nome por telefone.
        if (!telefones.has(cliente.telefone)) {
          telefones.set(cliente.telefone, nome);
        }
        porPalavra.set(palavra, telefones);
      }
    }
  }

  return [...porPalavra.entries()]
    .filter(([, telefones]) => telefones.size >= 2)
    .map(([palavra, telefones]) => ({
      palavra,
      telefones: [...telefones.keys()],
      exemplos: [...telefones.values()],
    }))
    .sort((a, b) => b.telefones.length - a.telefones.length || a.palavra.localeCompare(b.palavra));
}

// -----------------------------------------------------------------------------
// Escrita
// -----------------------------------------------------------------------------

function validarNome(nome: string): string | null {
  const limpo = nome.trim();

  if (limpo.length < 2) {
    return "O nome da empresa precisa ter pelo menos duas letras.";
  }

  if (limpo.length > MAXIMO_DO_NOME) {
    return `O nome da empresa pode ter no máximo ${MAXIMO_DO_NOME} caracteres.`;
  }

  return null;
}

export async function criarEmpresa(nome: string): Promise<Resultado<Empresa>> {
  const erro = validarNome(nome);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  const limpo = nome.trim();

  if (await prisma.empresa.findUnique({ where: { nome: limpo } })) {
    return {
      ok: false,
      falha: { codigo: "NOME_REPETIDO", motivo: `Já existe uma empresa chamada "${limpo}".` },
    };
  }

  const criada = await prisma.empresa.create({
    data: { nome: limpo },
    include: { _count: { select: { telefones: true } } },
  });

  return {
    ok: true,
    dados: {
      id: criada.id,
      nome: criada.nome,
      ativa: criada.ativa,
      telefones: criada._count.telefones,
    },
  };
}

export async function editarEmpresa(
  id: string,
  dados: { nome?: string; ativa?: boolean },
): Promise<Resultado<Empresa>> {
  const existente = await prisma.empresa.findUnique({ where: { id } });

  if (!existente) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Empresa não encontrada." } };
  }

  if (dados.nome !== undefined) {
    const erro = validarNome(dados.nome);

    if (erro) {
      return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
    }

    const repetida = await prisma.empresa.findUnique({ where: { nome: dados.nome.trim() } });

    if (repetida && repetida.id !== id) {
      return {
        ok: false,
        falha: {
          codigo: "NOME_REPETIDO",
          motivo: `Já existe uma empresa chamada "${dados.nome.trim()}".`,
        },
      };
    }
  }

  const atualizada = await prisma.empresa.update({
    where: { id },
    data: {
      ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
      ...(dados.ativa !== undefined ? { ativa: dados.ativa } : {}),
    },
    include: { _count: { select: { telefones: true } } },
  });

  return {
    ok: true,
    dados: {
      id: atualizada.id,
      nome: atualizada.nome,
      ativa: atualizada.ativa,
      telefones: atualizada._count.telefones,
    },
  };
}

/**
 * Marca (ou desmarca) um telefone como pertencente a uma empresa.
 *
 * "empresaId" nulo DESVINCULA. Isso tira o historico daquele numero do total
 * da empresa na hora — combinado com o dono: o relatorio reflete quem e
 * cliente hoje, e nao quem ja foi.
 */
export async function vincularTelefone(
  telefoneBruto: string,
  empresaId: string | null,
): Promise<Resultado<{ telefone: string; empresaId: string | null }>> {
  const telefone = normalizarTelefone(telefoneBruto);

  if (!telefone) {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "Telefone inválido. Use DDD + celular de 9 dígitos." },
    };
  }

  if (empresaId === null) {
    await prisma.telefoneDaEmpresa.deleteMany({ where: { telefone } });
    return { ok: true, dados: { telefone, empresaId: null } };
  }

  if (!(await prisma.empresa.findUnique({ where: { id: empresaId } }))) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Empresa não encontrada." } };
  }

  await prisma.telefoneDaEmpresa.upsert({
    where: { telefone },
    create: { telefone, empresaId },
    update: { empresaId },
  });

  return { ok: true, dados: { telefone, empresaId } };
}
