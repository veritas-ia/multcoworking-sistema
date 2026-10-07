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
import { estaNaPaleta } from "@/lib/cores-de-sala";
import { prisma } from "@/lib/prisma";

export type SalaDoPainel = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  capacidade: number | null;
  /** Preco de DIA para grupo pequeno, em reais com centavos: "40.00". */
  precoPorHora: string;
  /** Preco de DIA para grupo grande. Nulo = o tamanho nao muda o preco de dia. */
  precoPorHoraGrupo: string | null;
  /** Preco depois do inicio da faixa noturna, para grupo pequeno. */
  precoPorHoraNoturno: string;
  /** Preco noturno para grupo grande. Nulo = esta sala nao cobra diferente. */
  precoPorHoraNoturnoGrupo: string | null;
  /** ACIMA de quantas pessoas vale o preco de grupo POR HORA (dia e noite). */
  pessoasParaGrupo: number | null;
  /** Esta sala aceita reserva de dia inteiro? */
  aceitaDiaria: boolean;
  /** Preco fechado da diaria, para grupo pequeno. */
  precoDiaria: string | null;
  /** Preco fechado da diaria para grupo grande. */
  precoDiariaGrupo: string | null;
  /** ACIMA de quantas pessoas vale a diaria de grupo. Corte PROPRIO. */
  pessoasParaGrupoDiaria: number | null;
  /** Cor da sala na agenda, "#RRGGBB". */
  cor: string;
  /** Nulo = pode ir ate o fechamento do dia. */
  duracaoMaximaMinutos: number | null;
  ordem: number;
  /** Quantas reservas ativas ainda estao por vir nesta sala. */
  reservasFuturas: number;
  /** As fotos do carrossel, na ordem. */
  fotos: { id: string; url: string; ordem: number }[];
};

export type FalhaDeSala = {
  codigo: "REGRA" | "NAO_ENCONTRADA" | "NOME_REPETIDO";
  motivo: string;
};

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeSala };

export type DadosDeSala = {
  nome: string;
  capacidade: number | null;
  /** Preco de DIA para grupo pequeno, em reais: 40 ou 40.5. */
  precoPorHora: number;
  /** Preco de DIA para grupo grande. Nulo = o tamanho nao muda o preco de dia. */
  precoPorHoraGrupo: number | null;
  /** Preco depois do inicio da faixa noturna, para grupo pequeno. */
  precoPorHoraNoturno: number;
  /** Nulo quando a sala nao cobra diferente por tamanho de grupo. */
  precoPorHoraNoturnoGrupo: number | null;
  /** Anda junto com os precos de grupo POR HORA: um sem o outro e meia regra. */
  pessoasParaGrupo: number | null;
  aceitaDiaria: boolean;
  /** Obrigatorio quando a sala aceita diaria. */
  precoDiaria: number | null;
  /** Diaria para grupo grande. Anda junto com o corte abaixo. */
  precoDiariaGrupo: number | null;
  /**
   * ACIMA de quantas pessoas vale a diaria de grupo.
   *
   * E um corte PROPRIO, separado de "pessoasParaGrupo": na Sala de Reuniao a
   * hora pula entre 4 e 5 pessoas, e a diaria entre 5 e 6.
   */
  pessoasParaGrupoDiaria: number | null;
  /** Cor da sala na agenda. Precisa estar na paleta do painel. */
  cor: string;
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

  const precos: [string, number | null][] = [
    ["O preço por hora (dia)", dados.precoPorHora],
    ["O preço por hora de dia para grupo", dados.precoPorHoraGrupo],
    ["O preço por hora à noite", dados.precoPorHoraNoturno],
    ["O preço por hora à noite para grupo", dados.precoPorHoraNoturnoGrupo],
    ["O preço da diária", dados.precoDiaria],
    ["O preço da diária para grupo", dados.precoDiariaGrupo],
  ];

  for (const [rotulo, valor] of precos) {
    if (valor === null) {
      continue;
    }

    if (!Number.isFinite(valor) || valor < 0) {
      return `${rotulo} não pode ser negativo.`;
    }

    if (valor > 99_999) {
      return `${rotulo} está alto demais. Confira se não sobrou um zero.`;
    }

    if (Math.round(valor * 100) !== valor * 100) {
      return `${rotulo} aceita no máximo dois números depois da vírgula.`;
    }
  }

  // Preco de grupo e numero de pessoas andam JUNTOS. Um sem o outro seria uma
  // regra pela metade, que a tela nao saberia aplicar — e o banco recusa.
  // O corte POR HORA vale para o preco de dia e o de noite.
  const temPrecoDeGrupo =
    dados.precoPorHoraNoturnoGrupo !== null || dados.precoPorHoraGrupo !== null;
  const temLimiteDeGrupo = dados.pessoasParaGrupo !== null;

  if (temPrecoDeGrupo !== temLimiteDeGrupo) {
    return "Para cobrar diferente por grupo, preencha o preço de grupo (de dia, de noite ou os dois) e a partir de quantas pessoas. Deixe tudo em branco para não cobrar diferente.";
  }

  // Os DOIS cortes (por hora e da diaria) ficam na mesma faixa de 1 a 10:
  // sao numeros de pessoas numa sala, e nao de um auditorio. Um corte acima
  // de 10 nunca seria alcancado nas salas que existem — viraria preco de
  // grupo que nao pega nunca, sem ninguem entender por que.
  if (
    dados.pessoasParaGrupo !== null &&
    (!Number.isInteger(dados.pessoasParaGrupo) ||
      dados.pessoasParaGrupo < 1 ||
      dados.pessoasParaGrupo > 10)
  ) {
    return "O número de pessoas do grupo precisa ser um inteiro de 1 a 10.";
  }

  // Preco de grupo MENOR que o base seria cobrar menos de quem usa mais a
  // sala. Quase sempre e um numero digitado no campo errado.
  if (
    dados.precoPorHoraGrupo !== null &&
    dados.precoPorHoraGrupo < dados.precoPorHora
  ) {
    return "O preço de dia para grupo não pode ser menor que o preço de dia normal. Confira se os dois não trocaram de lugar.";
  }

  if (
    dados.precoPorHoraNoturnoGrupo !== null &&
    dados.precoPorHoraNoturnoGrupo < dados.precoPorHoraNoturno
  ) {
    return "O preço da noite para grupo não pode ser menor que o preço da noite normal. Confira se os dois não trocaram de lugar.";
  }

  if (dados.aceitaDiaria && dados.precoDiaria === null) {
    return "Sala que aceita diária precisa ter o preço da diária preenchido.";
  }

  // --- a diaria de grupo, com o CORTE DELA -----------------------------------
  //
  // O corte da diaria e separado do corte por hora de proposito: na Sala de
  // Reuniao a hora pula entre 4 e 5 pessoas, e a diaria entre 5 e 6. Unificar
  // faria a diaria de 5 pessoas sair pelo preco de grupo.
  const temDiariaDeGrupo = dados.precoDiariaGrupo !== null;
  const temCorteDaDiaria = dados.pessoasParaGrupoDiaria !== null;

  if (temDiariaDeGrupo !== temCorteDaDiaria) {
    return "Para cobrar a diária diferente por grupo, preencha os dois campos: o preço da diária para grupo e a partir de quantas pessoas. Deixe os dois em branco para cobrar um preço só.";
  }

  if (temDiariaDeGrupo && dados.precoDiaria === null) {
    return "A diária para grupo precisa do preço da diária normal preenchido.";
  }

  if (
    dados.pessoasParaGrupoDiaria !== null &&
    (!Number.isInteger(dados.pessoasParaGrupoDiaria) ||
      dados.pessoasParaGrupoDiaria < 1 ||
      dados.pessoasParaGrupoDiaria > 10)
  ) {
    return "O número de pessoas do grupo na diária precisa ser um inteiro de 1 a 10.";
  }

  if (
    dados.precoDiariaGrupo !== null &&
    dados.precoDiaria !== null &&
    dados.precoDiariaGrupo < dados.precoDiaria
  ) {
    return "A diária para grupo não pode custar menos que a diária normal. Confira se os dois não trocaram de lugar.";
  }

  // Paleta fechada: cor livre acabaria em texto ilegivel na agenda.
  if (!estaNaPaleta(dados.cor)) {
    return "Escolha uma das cores oferecidas para a sala.";
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
      fotos: {
        orderBy: { ordem: "asc" },
        select: { id: true, url: true, ordem: true },
      },
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
    precoPorHoraGrupo: sala.precoPorHoraGrupo?.toFixed(2) ?? null,
    precoPorHoraNoturno: sala.precoPorHoraNoturno.toFixed(2),
    precoPorHoraNoturnoGrupo: sala.precoPorHoraNoturnoGrupo?.toFixed(2) ?? null,
    pessoasParaGrupo: sala.pessoasParaGrupo,
    aceitaDiaria: sala.aceitaDiaria,
    precoDiaria: sala.precoDiaria?.toFixed(2) ?? null,
    precoDiariaGrupo: sala.precoDiariaGrupo?.toFixed(2) ?? null,
    pessoasParaGrupoDiaria: sala.pessoasParaGrupoDiaria,
    cor: sala.cor,
    duracaoMaximaMinutos: sala.duracaoMaximaMinutos,
    ordem: sala.ordem,
    reservasFuturas: sala._count.reservas,
    fotos: sala.fotos,
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
        precoPorHoraGrupo: dados.precoPorHoraGrupo?.toFixed(2) ?? null,
        precoPorHoraNoturno: dados.precoPorHoraNoturno.toFixed(2),
        precoPorHoraNoturnoGrupo: dados.precoPorHoraNoturnoGrupo?.toFixed(2) ?? null,
        pessoasParaGrupo: dados.pessoasParaGrupo,
        aceitaDiaria: dados.aceitaDiaria,
        precoDiaria: dados.precoDiaria?.toFixed(2) ?? null,
        precoDiariaGrupo: dados.precoDiariaGrupo?.toFixed(2) ?? null,
        pessoasParaGrupoDiaria: dados.pessoasParaGrupoDiaria,
        cor: dados.cor,
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
        precoPorHoraGrupo: dados.precoPorHoraGrupo?.toFixed(2) ?? null,
        precoPorHoraNoturno: dados.precoPorHoraNoturno.toFixed(2),
        precoPorHoraNoturnoGrupo: dados.precoPorHoraNoturnoGrupo?.toFixed(2) ?? null,
        pessoasParaGrupo: dados.pessoasParaGrupo,
        aceitaDiaria: dados.aceitaDiaria,
        precoDiaria: dados.precoDiaria?.toFixed(2) ?? null,
        precoDiariaGrupo: dados.precoDiariaGrupo?.toFixed(2) ?? null,
        pessoasParaGrupoDiaria: dados.pessoasParaGrupoDiaria,
        cor: dados.cor,
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
