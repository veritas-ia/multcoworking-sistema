/**
 * O PAINEL DE CLIENTES (Fase 14, parte B).
 *
 * A parte A criou o cadastro e religou o que existia, com uma regra simples:
 * um cliente por telefone. Ela acerta os 44 nomes para 25 telefones, mas nao
 * tem como saber que o "Rafael dos Passos" de um numero e o "Rafael Passos"
 * de OUTRO numero sao a mesma pessoa. Ninguem tem — so a equipe.
 *
 * E isto aqui: a tela onde a equipe junta, renomeia e arruma. Trabalho de uma
 * sentada, uma vez so; depois o caminho normal e o cadastro aparecendo
 * sozinho a cada reserva.
 *
 * O SISTEMA SUGERE E NUNCA JUNTA SOZINHO. Um palpite errado viraria
 * faturamento somado na pessoa errada, e ninguem reclamaria — o numero
 * continuaria parecendo certo. Mesma regra da tela de empresas.
 */
import { prisma } from "./prisma";
import { normalizarTelefone, telefoneVisivel } from "./telefone";

export type Falha = { motivo: string; codigo: string };
export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

export type ClienteDoPainel = {
  id: string;
  nome: string;
  ativo: boolean;
  /** Telefones ligados a este cadastro, prontos para a tela. */
  telefones: string[];
  /** Todos os nomes que as reservas dele ja usaram. */
  nomesNasReservas: string[];
  reservas: number;
  /** Horas usadas. Cancelada nao conta, mesma regra do relatorio. */
  horas: number;
  /** "AAAA-MM-DD" da reserva mais recente, ou null para cadastro sem reserva. */
  ultimaReserva: string | null;
};

export type Sugestao = {
  /** A palavra que os nomes tem em comum: "rafael", "prestare". */
  palavra: string;
  clientes: { id: string; nome: string; reservas: number }[];
};

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// -----------------------------------------------------------------------------
// Leitura
// -----------------------------------------------------------------------------

export async function listarClientes(): Promise<ClienteDoPainel[]> {
  const [clientes, reservas] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        ativo: true,
        telefones: { select: { telefone: true }, orderBy: { criadoEm: "asc" } },
      },
    }),
    prisma.reserva.findMany({
      where: { clienteId: { not: null } },
      select: {
        clienteId: true,
        nomeCliente: true,
        duracaoMinutos: true,
        status: true,
        inicio: true,
      },
      orderBy: { inicio: "asc" },
    }),
  ]);

  const porCliente = new Map<
    string,
    { nomes: Set<string>; reservas: number; minutos: number; ultima: Date }
  >();

  for (const reserva of reservas) {
    const atual = porCliente.get(reserva.clienteId!);

    porCliente.set(reserva.clienteId!, {
      nomes: (atual?.nomes ?? new Set<string>()).add(reserva.nomeCliente),
      reservas: (atual?.reservas ?? 0) + 1,
      // Cancelada nao soma hora — hora desmarcada nao e hora usada, e o
      // relatorio ja segue essa regra. Dois numeros que discordam na mesma
      // tela destroem a confianca no painel inteiro.
      minutos:
        (atual?.minutos ?? 0) +
        (reserva.status === "CANCELADA" ? 0 : reserva.duracaoMinutos),
      // A lista vem ordenada por inicio: a ultima vista e a mais recente.
      ultima: reserva.inicio,
    });
  }

  return clientes.map((cliente) => {
    const dados = porCliente.get(cliente.id);

    return {
      id: cliente.id,
      nome: cliente.nome,
      ativo: cliente.ativo,
      telefones: cliente.telefones.map((ligado) => telefoneVisivel(ligado.telefone)),
      nomesNasReservas: [...(dados?.nomes ?? [])],
      reservas: dados?.reservas ?? 0,
      horas: Math.round(((dados?.minutos ?? 0) / 60) * 10) / 10,
      ultimaReserva: dados?.ultima.toISOString().slice(0, 10) ?? null,
    };
  });
}

/** Palavras curtas e genericas demais para indicar pessoa nenhuma. */
const IGNORADAS = new Set([
  "de", "da", "do", "das", "dos", "e", "a", "o", "em", "para", "com",
  "cliente", "teste", "sala", "reserva", "sr", "sra", "dra",
]);

function palavrasDe(nome: string): string[] {
  return semAcento(nome)
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length >= 4 && !IGNORADAS.has(palavra));
}

/**
 * Cadastros DIFERENTES cujos nomes compartilham uma palavra.
 *
 * Serve so para a equipe nao ter que ler a lista inteira na mao. Ela confirma
 * ou ignora — o sistema nunca junta sozinho.
 *
 * Olha tambem os nomes escritos NAS RESERVAS, e nao so o nome oficial: e
 * assim que o cadastro "Rafael dos Passos" encontra o "Rafael Passos", que
 * pode nem estar no rotulo de nenhum dos dois.
 */
export async function sugerirJuncoes(): Promise<Sugestao[]> {
  const clientes = await listarClientes();
  const porPalavra = new Map<string, Map<string, { nome: string; reservas: number }>>();

  for (const cliente of clientes) {
    const todosOsNomes = [cliente.nome, ...cliente.nomesNasReservas];
    const palavras = new Set(todosOsNomes.flatMap(palavrasDe));

    for (const palavra of palavras) {
      const achados = porPalavra.get(palavra) ?? new Map();
      achados.set(cliente.id, { nome: cliente.nome, reservas: cliente.reservas });
      porPalavra.set(palavra, achados);
    }
  }

  return [...porPalavra.entries()]
    .filter(([, achados]) => achados.size >= 2)
    .map(([palavra, achados]) => ({
      palavra,
      clientes: [...achados.entries()].map(([id, dados]) => ({ id, ...dados })),
    }))
    .sort(
      (a, b) =>
        b.clientes.length - a.clientes.length || a.palavra.localeCompare(b.palavra),
    );
}

// -----------------------------------------------------------------------------
// Escrita
// -----------------------------------------------------------------------------

export async function renomearCliente(
  id: string,
  nome: string,
): Promise<Resultado<null>> {
  const limpo = nome.trim();

  if (limpo.length < 2) {
    return {
      ok: false,
      falha: { motivo: "O nome precisa ter pelo menos 2 letras.", codigo: "NOME_CURTO" },
    };
  }

  const existe = await prisma.cliente.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existe) {
    return {
      ok: false,
      falha: { motivo: "Cliente não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  // RENOMEAR NAO TOCA EM RESERVA NENHUMA. O nome escrito em cada reserva e a
  // verdade daquele dia e continua la; o que muda e o rotulo do cadastro, que
  // e o mostrado no relatorio. Cliente que mudou de nome nao vira dois.
  await prisma.cliente.update({ where: { id }, data: { nome: limpo } });

  return { ok: true, dados: null };
}

export async function ligarOuDesligarCliente(
  id: string,
  ativo: boolean,
): Promise<Resultado<null>> {
  const existe = await prisma.cliente.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existe) {
    return {
      ok: false,
      falha: { motivo: "Cliente não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  // Desligar e decisao sobre o FUTURO: o historico fica inteiro e o cliente
  // continua no relatorio. Mesma regra das salas, das empresas e das areas.
  // Excluir nao existe.
  await prisma.cliente.update({ where: { id }, data: { ativo } });

  return { ok: true, dados: null };
}

export type ResumoDaJuncao = {
  /** Quantas reservas mudaram de dono. */
  reservas: number;
  /** Telefones que passaram para o cadastro principal. */
  telefones: string[];
  nomePrincipal: string;
  nomeAbsorvido: string;
};

/**
 * Junta dois cadastros num so. E o caso do Rafael com dois telefones.
 *
 * O PRINCIPAL fica, com o nome dele. O ABSORVIDO entrega as reservas e os
 * telefones e deixa de existir.
 *
 * POR QUE APAGAR O ABSORVIDO NAO FERE A REGRA DE "NUNCA EXCLUIR": depois da
 * juncao ele nao guarda historico nenhum — reserva e telefone ja mudaram de
 * dono. O que a regra protege e o historico, e ele continua inteiro, so que
 * embaixo do outro cadastro.
 *
 * E DA PARA DESFAZER, porque a reserva continua guardando o TELEFONE dela:
 * "separarTelefone" devolve um numero e as reservas dele para um cadastro
 * proprio. Por isso a juncao errada nao e um caminho sem volta — mas a tela
 * mostra o que vai mudar ANTES de fazer, porque desfazer da trabalho.
 */
export async function juntarClientes(
  principalId: string,
  absorvidoId: string,
): Promise<Resultado<ResumoDaJuncao>> {
  if (principalId === absorvidoId) {
    return {
      ok: false,
      falha: { motivo: "Escolha dois cadastros diferentes.", codigo: "MESMO_CLIENTE" },
    };
  }

  const [principal, absorvido] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: principalId },
      select: { id: true, nome: true },
    }),
    prisma.cliente.findUnique({
      where: { id: absorvidoId },
      select: { id: true, nome: true, telefones: { select: { telefone: true } } },
    }),
  ]);

  if (!principal || !absorvido) {
    return {
      ok: false,
      falha: { motivo: "Cliente não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  const resumo = await prisma.$transaction(async (tx) => {
    const movidas = await tx.reserva.updateMany({
      where: { clienteId: absorvidoId },
      data: { clienteId: principalId },
    });

    // O telefone e CHAVE PRIMARIA, entao ele so troca de dono — nao ha como
    // o mesmo numero acabar nos dois cadastros.
    await tx.telefoneDoCliente.updateMany({
      where: { clienteId: absorvidoId },
      data: { clienteId: principalId },
    });

    await tx.cliente.delete({ where: { id: absorvidoId } });

    return {
      reservas: movidas.count,
      telefones: absorvido.telefones.map((ligado) => telefoneVisivel(ligado.telefone)),
      nomePrincipal: principal.nome,
      nomeAbsorvido: absorvido.nome,
    };
  });

  return { ok: true, dados: resumo };
}

/**
 * Tira um telefone de um cadastro e devolve a ele um cadastro proprio.
 *
 * E o DESFAZER da juncao, e tambem o conserto de quem foi ligado errado. So
 * funciona porque a reserva continua guardando o telefone dela: as reservas
 * daquele numero viajam junto.
 */
export async function separarTelefone(
  telefoneBruto: string,
  nome: string,
): Promise<Resultado<{ clienteId: string; reservas: number }>> {
  const telefone = normalizarTelefone(telefoneBruto);

  if (!telefone) {
    return {
      ok: false,
      falha: { motivo: "Telefone inválido.", codigo: "TELEFONE_INVALIDO" },
    };
  }

  const ligado = await prisma.telefoneDoCliente.findUnique({
    where: { telefone },
    select: { clienteId: true },
  });

  if (!ligado) {
    return {
      ok: false,
      falha: {
        motivo: "Este telefone não está ligado a nenhum cadastro.",
        codigo: "SEM_VINCULO",
      },
    };
  }

  const limpo = nome.trim();

  if (limpo.length < 2) {
    return {
      ok: false,
      falha: { motivo: "O nome precisa ter pelo menos 2 letras.", codigo: "NOME_CURTO" },
    };
  }

  return prisma.$transaction(async (tx) => {
    const novo = await tx.cliente.create({
      data: { nome: limpo },
      select: { id: true },
    });

    await tx.telefoneDoCliente.update({
      where: { telefone },
      data: { clienteId: novo.id },
    });

    const movidas = await tx.reserva.updateMany({
      where: { telefone, clienteId: ligado.clienteId },
      data: { clienteId: novo.id },
    });

    return {
      ok: true as const,
      dados: { clienteId: novo.id, reservas: movidas.count },
    };
  });
}
