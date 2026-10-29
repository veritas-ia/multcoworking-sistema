/**
 * Telefones que NAO sao de um cliente.
 *
 * O PROBLEMA, medido em producao: o relatorio agrupa cliente pelo TELEFONE, e
 * para 24 dos 25 numeros isso esta certo — a mesma pessoa escreve o nome de
 * varios jeitos, e o telefone e quem a identifica. O do atendimento comercial
 * do coworking, nao: a recepcao lanca nele a reserva de quem nao deixou o
 * proprio numero, e ele acumulou 14 reservas de QUATRO clientes diferentes
 * (Toca, Prestare, Matheus Toca e Rafael Passos). No painel aquilo virava um
 * "cliente" so, com 28 horas, levando o nome de um deles.
 *
 * A SOLUCAO: a equipe MARCA o numero. Marcado, o relatorio passa a agrupar as
 * reservas dele pelo NOME de cada uma — e ai Toca aparece com as horas da
 * Toca, Prestare com as da Prestare, e assim por diante.
 *
 * POR QUE A EQUIPE MARCA E O SISTEMA NAO ADIVINHA. O sinal mais forte que
 * existe no banco — duas reservas ao mesmo tempo em salas diferentes — NAO
 * basta: uma pessoa pode reservar duas salas de uma vez, e em producao o
 * Matheus e o Rafael fazem exatamente isso. Adivinhar errado quebraria um
 * cliente de verdade em varias linhas, e ninguem desconfiaria, porque cada
 * linha continuaria parecendo certa.
 *
 * O QUE MARCAR NAO FAZ: nao toca em reserva nenhuma. Nem ao marcar, nem ao
 * desmarcar. E uma lente na hora de montar o relatorio, e desmarcar devolve
 * tudo exatamente como era.
 */
import { prisma } from "./prisma";
import { normalizarTelefone } from "./telefone";

export type TelefoneDeBalcao = {
  telefone: string;
  motivo: string;
  /** Nome de quem marcou, ou null quando o usuario foi desligado depois. */
  marcadoPor: string | null;
  /** Quantas reservas esse numero carrega hoje. */
  reservas: number;
  /** Os nomes diferentes que ele ja usou — a cara de um telefone de balcao. */
  nomes: string[];
};

export type Falha = { motivo: string; codigo: string };
export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

/**
 * Os numeros marcados, para o relatorio consultar.
 *
 * Devolve um conjunto porque e isso que o agrupamento precisa perguntar, uma
 * vez por reserva. A lista e curtissima — um ou dois numeros.
 */
export async function telefonesDeBalcao(): Promise<Set<string>> {
  const marcados = await prisma.telefoneDeBalcao.findMany({
    select: { telefone: true },
  });

  return new Set(marcados.map((marcado) => marcado.telefone));
}

/** A lista completa para o painel, com quem marcou e os nomes do numero. */
export async function listarTelefonesDeBalcao(): Promise<TelefoneDeBalcao[]> {
  const marcados = await prisma.telefoneDeBalcao.findMany({
    orderBy: { criadoEm: "asc" },
    select: {
      telefone: true,
      motivo: true,
      criadoPor: { select: { nome: true } },
    },
  });

  if (marcados.length === 0) {
    return [];
  }

  const pares = await prisma.reserva.groupBy({
    by: ["telefone", "nomeCliente"],
    where: { telefone: { in: marcados.map((marcado) => marcado.telefone) } },
    _count: { _all: true },
  });

  return marcados.map((marcado) => {
    const doNumero = pares.filter((par) => par.telefone === marcado.telefone);

    return {
      telefone: marcado.telefone,
      motivo: marcado.motivo,
      marcadoPor: marcado.criadoPor?.nome ?? null,
      reservas: doNumero.reduce((soma, par) => soma + par._count._all, 0),
      nomes: doNumero.map((par) => par.nomeCliente),
    };
  });
}

/**
 * Marca um numero como de balcao.
 *
 * Telefone torto e recusado: gravado em outro formato, ele nunca casaria com
 * as reservas e a marcacao nao faria efeito nenhum — sem erro aparecer. E a
 * mesma recusa do vinculo de empresa, pelo mesmo motivo.
 */
export async function marcarTelefoneDeBalcao(
  telefoneBruto: string,
  motivo: string,
  usuarioId: string | null,
): Promise<Resultado<TelefoneDeBalcao>> {
  const telefone = normalizarTelefone(telefoneBruto);

  if (!telefone) {
    return {
      ok: false,
      falha: {
        motivo: "Telefone inválido. Use DDD + celular, como (14) 99604-0233.",
        codigo: "TELEFONE_INVALIDO",
      },
    };
  }

  const texto = motivo.trim();

  // O motivo e obrigatorio de proposito: daqui a seis meses ninguem lembra
  // por que aquele numero foi marcado, e sem explicacao a proxima pessoa
  // desmarca "para testar" e o relatorio volta a mentir.
  if (texto.length < 3) {
    return {
      ok: false,
      falha: {
        motivo: "Escreva por que este número não é de um cliente.",
        codigo: "MOTIVO_VAZIO",
      },
    };
  }

  const jaMarcado = await prisma.telefoneDeBalcao.findUnique({
    where: { telefone },
    select: { telefone: true },
  });

  if (jaMarcado) {
    return {
      ok: false,
      falha: { motivo: "Este número já está marcado.", codigo: "JA_MARCADO" },
    };
  }

  await prisma.telefoneDeBalcao.create({
    data: { telefone, motivo: texto, criadoPorId: usuarioId },
  });

  const lista = await listarTelefonesDeBalcao();
  return {
    ok: true,
    dados: lista.find((item) => item.telefone === telefone)!,
  };
}

/**
 * Desfaz a marcacao.
 *
 * Volta tudo como era: as reservas daquele numero tornam a ser somadas num
 * cliente so. Nenhuma reserva e tocada aqui — nem foi na marcacao.
 */
export async function desmarcarTelefoneDeBalcao(
  telefoneBruto: string,
): Promise<Resultado<null>> {
  const telefone = normalizarTelefone(telefoneBruto) ?? telefoneBruto;

  const apagados = await prisma.telefoneDeBalcao.deleteMany({ where: { telefone } });

  if (apagados.count === 0) {
    return {
      ok: false,
      falha: { motivo: "Este número não estava marcado.", codigo: "NAO_MARCADO" },
    };
  }

  return { ok: true, dados: null };
}
