/**
 * EMPRESAS: varias pessoas da mesma empresa num total so.
 *
 * O problema real: tem salas alugadas por mes a empresas, e varios
 * funcionarios da MESMA empresa reservam, cada um do seu telefone. No
 * relatorio isso virava varios clientes separados, e as vezes quem paga a
 * conta do mes e a empresa, e nao a pessoa.
 *
 * QUEM RESPONDE E O CLIENTE, na hora de reservar, escolhendo de uma lista que
 * so a equipe cadastra aqui — digitar livre devolveria a bagunca de nomes
 * ("Prestare", "Prestarre", "Prestare Advocacia") por outra porta.
 *
 * A resposta fica GRAVADA NA RESERVA (campo "empresaId"), porque e a verdade
 * daquele dia: reserva antiga nao muda de dono porque a pessoa trocou de
 * empresa depois.
 *
 * O VINCULO DO TELEFONE, aqui embaixo, continua existindo com dois papeis
 * menores: atribuir as reservas ANTIGAS, que nunca foram perguntadas, e ja
 * vir escolhido na proxima reserva do mesmo numero. Ele e o padrao, nao a
 * fonte da verdade.
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

// -----------------------------------------------------------------------------
// O que o cliente ve e responde
// -----------------------------------------------------------------------------

/** O minimo para a pessoa escolher: nome e identificador, nada mais. */
export type EmpresaParaEscolher = { id: string; nome: string };

/**
 * As empresas que o CLIENTE pode escolher no site.
 *
 * So as ativas, e so nome e id — nem telefone, nem quantidade de reservas,
 * nem nada que diga quanto a empresa usa o espaco.
 *
 * ESTA LISTA E PUBLICA, por decisao do dono, e vale entender o porque: um
 * funcionario novo de uma empresa mensalista reserva pela primeira vez e o
 * sistema nao tem como saber que ele e de la. Sem a lista aberta, ele
 * dependeria de a recepcao marcar o numero dele depois — exatamente o
 * trabalho manual que esta mudanca veio tirar do caminho.
 *
 * O que isso custa, e o dono aceitou: quem abrir o site ve quais empresas sao
 * mensalistas, e nada impede alguem de se dizer de uma delas. Como a empresa
 * so muda o RELATORIO — nao muda preco, nem sala, nem libera horario — o
 * estrago possivel e uma reserva somada na empresa errada, que a equipe
 * corrige no painel.
 */
export async function listarEmpresasParaEscolher(): Promise<EmpresaParaEscolher[]> {
  return prisma.empresa.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });
}

/**
 * A empresa que ja esta ligada a este telefone, para o campo nascer escolhido.
 *
 * Primeiro procura a ULTIMA RESERVA deste numero que tinha empresa: e a
 * resposta mais recente da propria pessoa. So depois cai no vinculo do
 * telefone, que e o que a equipe marcou na mao.
 */
export async function empresaConhecidaDoTelefone(
  telefone: string,
): Promise<EmpresaParaEscolher | null> {
  const ultima = await prisma.reserva.findFirst({
    where: { telefone, empresaId: { not: null }, empresa: { ativa: true } },
    orderBy: { criadoEm: "desc" },
    select: { empresa: { select: { id: true, nome: true } } },
  });

  if (ultima?.empresa) {
    return ultima.empresa;
  }

  const vinculo = await prisma.telefoneDaEmpresa.findUnique({
    where: { telefone },
    select: { empresa: { select: { id: true, nome: true, ativa: true } } },
  });

  if (!vinculo?.empresa.ativa) {
    return null;
  }

  return { id: vinculo.empresa.id, nome: vinculo.empresa.nome };
}

/**
 * Confere, no SERVIDOR, que a empresa escolhida existe e esta ativa.
 *
 * Nulo na entrada e resposta valida: e quem nao e de empresa. O que nao pode
 * passar e um identificador inventado ou de empresa desligada — a tela manda
 * o id, e ninguem precisa acreditar na tela.
 */
export async function empresaEscolhidaEhValida(
  empresaId: string | null | undefined,
): Promise<boolean> {
  if (!empresaId) {
    return true;
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { ativa: true },
  });

  return empresa?.ativa === true;
}

/**
 * Guarda, em silencio, que este telefone e desta empresa.
 *
 * Serve so para a PROXIMA reserva do mesmo numero ja vir com a empresa
 * escolhida. Nao e o que o relatorio soma — quem manda ali e o campo da
 * propria reserva.
 *
 * Nunca derruba a reserva: se falhar, a pessoa so vai escolher de novo na
 * proxima vez. Reserva confirmada nao se perde por causa de uma conveniencia.
 */
export async function lembrarEmpresaDoTelefone(
  telefone: string,
  empresaId: string,
): Promise<void> {
  try {
    await prisma.telefoneDaEmpresa.upsert({
      where: { telefone },
      create: { telefone, empresaId },
      update: { empresaId },
    });
  } catch {
    // De proposito sem barulho: ver o comentario acima.
  }
}
