/**
 * O DEMONSTRATIVO MENSAL DO CLIENTE.
 *
 * POR QUE ISTO EXISTE
 *
 * A gestao montava este documento numa planilha, a mao. A planilha de
 * setembro da Toca Imobiliaria nao tinha UMA formula sequer: o "52 horas" e o
 * "VALOR TOTAL : R$ 3.033,66" eram texto digitado. E os dois estavam errados
 * — somando as linhas da planilha davam 50 horas e R$ 3.023,66. Foram R$ 70
 * cobrados a mais de um cliente, num documento que ja tinha sido enviado, e
 * ninguem tinha como perceber.
 *
 * Aqui NENHUM total e digitado: o sistema soma. O unico numero que a gestao
 * pode escrever e o total ajustado, quando houve renegociacao — e ele aparece
 * destacado na tela justamente para ninguem usar por engano.
 *
 * TUDO FICA CONGELADO NA EMISSAO. A tabela de horas e copiada das reservas no
 * momento em que o demonstrativo e salvo. Se alguem remarcar uma reserva
 * depois, o documento que o cliente recebeu continua batendo com o que foi
 * enviado — mesma regra do valor congelado na reserva.
 */
import { StatusReserva } from "@/generated/prisma/enums";

import { prisma } from "./prisma";
import { somarDias } from "./relatorios";
import { dataLocalDe, horaLocalDe, instanteDe, type DataLocal } from "./tempo";

/** Uma linha da tabela de horas: um dia, uma sala, as horas daquela reserva. */
export type ItemDoDemonstrativo = {
  /** "AAAA-MM-DD", no relogio de Sao Paulo. */
  dia: string;
  sala: string;
  inicio: string;
  fim: string;
  horas: number;
};

/** Uma linha escrita pela gestao: posicoes, emporio, impressoes. */
export type LinhaExtra = {
  descricao: string;
  /** Em reais, com duas casas: "940.00". */
  valor: string;
};

export type Demonstrativo = {
  id: string | null;
  clienteId: string;
  clienteNome: string;
  de: DataLocal;
  ate: DataLocal;
  valorHora: string;
  itens: ItemDoDemonstrativo[];
  /** Quanto cada sala somou no periodo — o cliente pediu para ver separado. */
  porSala: { sala: string; horas: number }[];
  horas: number;
  linhasExtras: LinhaExtra[];
  /** horas x valorHora, em centavos. */
  valorDasHorasCentavos: number;
  /** A soma das linhas extras, em centavos. */
  valorDasLinhasCentavos: number;
  /** O que o sistema calculou, em centavos. */
  totalCalculadoCentavos: number;
  /** Escrito a mao, quando houve renegociacao. Nulo = vale o calculado. */
  totalAjustado: string | null;
  /** O que vale de verdade: o ajustado quando existe, senao o calculado. */
  totalCentavos: number;
  enviadoEm: Date | null;
};

export type Falha = { motivo: string; codigo: string };
export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha };

/** "40.00" -> 4000. Em centavos, porque somar reais acumula diferenca. */
export function emCentavos(valor: string | number): number {
  return Math.round(Number(valor) * 100);
}

/** 4000 -> "40.00". */
export function emReais(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/** 1234567 -> "R$ 12.345,67". */
export function comoDinheiro(centavos: number): string {
  const texto = Math.abs(centavos / 100)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${centavos < 0 ? "-" : ""}R$ ${texto}`;
}

/** 2.5 -> "2,5 h"; 3 -> "3 h". */
export function horasPorExtenso(horas: number): string {
  const texto = Number.isInteger(horas)
    ? String(horas)
    : horas.toFixed(2).replace(/0$/, "").replace(".", ",");
  return `${texto} h`;
}

const UMA_CASA = (n: number): number => Math.round(n * 100) / 100;

// -----------------------------------------------------------------------------
// Montar a partir das reservas
// -----------------------------------------------------------------------------

/**
 * As reservas do cliente no periodo, viradas em tabela de horas.
 *
 * CANCELADA NAO ENTRA — hora desmarcada nao e hora usada, e cobra-la seria
 * cobrar o cliente por nada. Mesma regra do relatorio.
 *
 * Agrupado pelo CADASTRO do cliente, e nao pelo telefone: a Toca reserva de
 * varios numeros, e o demonstrativo e um so.
 */
export async function montarDoPeriodo(entrada: {
  clienteId: string;
  de: DataLocal;
  ate: DataLocal;
  /** Sobrepoe o preco combinado, quando a gestao digita outro. */
  valorHora?: string | null;
  linhasExtras?: LinhaExtra[];
  totalAjustado?: string | null;
}): Promise<Resultado<Demonstrativo>> {
  if (entrada.ate < entrada.de) {
    return {
      ok: false,
      falha: {
        motivo: "A data final precisa ser igual ou depois da inicial.",
        codigo: "PERIODO_INVERTIDO",
      },
    };
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: entrada.clienteId },
    select: { id: true, nome: true, precoHoraAcordado: true },
  });

  if (!cliente) {
    return {
      ok: false,
      falha: { motivo: "Cliente não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  const reservas = await prisma.reserva.findMany({
    where: {
      clienteId: cliente.id,
      status: { not: StatusReserva.CANCELADA },
      inicio: {
        gte: instanteDe(entrada.de, "00:00"),
        lt: instanteDe(somarDias(entrada.ate, 1), "00:00"),
      },
    },
    select: {
      inicio: true,
      fim: true,
      duracaoMinutos: true,
      sala: { select: { nome: true } },
    },
    orderBy: { inicio: "asc" },
  });

  const itens: ItemDoDemonstrativo[] = reservas.map((reserva) => ({
    dia: dataLocalDe(reserva.inicio),
    sala: reserva.sala.nome,
    inicio: horaLocalDe(reserva.inicio),
    fim: horaLocalDe(reserva.fim),
    horas: UMA_CASA(reserva.duracaoMinutos / 60),
  }));

  const valorHora =
    entrada.valorHora ?? cliente.precoHoraAcordado?.toFixed(2) ?? "0.00";

  return {
    ok: true,
    dados: montar({
      id: null,
      clienteId: cliente.id,
      clienteNome: cliente.nome,
      de: entrada.de,
      ate: entrada.ate,
      valorHora,
      itens,
      linhasExtras: entrada.linhasExtras ?? [],
      totalAjustado: entrada.totalAjustado ?? null,
      enviadoEm: null,
    }),
  };
}

/**
 * Faz TODAS as contas. E aqui que o erro da planilha morre.
 *
 * Nenhum total e digitado em lugar nenhum: as horas saem da soma dos itens, o
 * valor das horas e horas x preco, e o total e a soma de tudo — tudo em
 * centavos, porque somar reais em ponto flutuante acumula diferenca de um
 * centavo ao longo de muitas linhas.
 */
function montar(bruto: {
  id: string | null;
  clienteId: string;
  clienteNome: string;
  de: DataLocal;
  ate: DataLocal;
  valorHora: string;
  itens: ItemDoDemonstrativo[];
  linhasExtras: LinhaExtra[];
  totalAjustado: string | null;
  enviadoEm: Date | null;
}): Demonstrativo {
  const horas = UMA_CASA(bruto.itens.reduce((soma, item) => soma + item.horas, 0));

  // O preco por hora em centavos, multiplicado pelas horas. Arredonda uma vez
  // so, no fim: R$ 30,00 x 2,5 h da 7500 centavos exatos.
  const valorDasHorasCentavos = Math.round(emCentavos(bruto.valorHora) * horas);

  const valorDasLinhasCentavos = bruto.linhasExtras.reduce(
    (soma, linha) => soma + emCentavos(linha.valor || "0"),
    0,
  );

  const totalCalculadoCentavos = valorDasHorasCentavos + valorDasLinhasCentavos;

  const porSala = [
    ...bruto.itens
      .reduce((mapa, item) => {
        mapa.set(item.sala, UMA_CASA((mapa.get(item.sala) ?? 0) + item.horas));
        return mapa;
      }, new Map<string, number>())
      .entries(),
  ]
    .map(([sala, h]) => ({ sala, horas: h }))
    .sort((a, b) => b.horas - a.horas);

  return {
    ...bruto,
    horas,
    porSala,
    valorDasHorasCentavos,
    valorDasLinhasCentavos,
    totalCalculadoCentavos,
    totalCentavos:
      bruto.totalAjustado !== null && bruto.totalAjustado !== ""
        ? emCentavos(bruto.totalAjustado)
        : totalCalculadoCentavos,
  };
}

// -----------------------------------------------------------------------------
// Guardar e ler
// -----------------------------------------------------------------------------

/**
 * Salva o demonstrativo, CONGELANDO a tabela de horas como ela esta agora.
 *
 * Guardar importa por dois motivos: a gestao digita as posicoes e o emporio
 * uma vez so, e o documento que o cliente recebeu nao muda se uma reserva for
 * remarcada depois.
 */
export async function salvar(entrada: {
  id?: string | null;
  clienteId: string;
  de: DataLocal;
  ate: DataLocal;
  valorHora: string;
  linhasExtras: LinhaExtra[];
  totalAjustado: string | null;
  /** Guarda este preco como o padrao do cliente para a proxima vez. */
  lembrarPreco: boolean;
}): Promise<Resultado<Demonstrativo>> {
  const montado = await montarDoPeriodo(entrada);

  if (!montado.ok) {
    return montado;
  }

  const dados = montado.dados;

  const gravado = await prisma.$transaction(async (tx) => {
    const comum = {
      clienteId: dados.clienteId,
      de: new Date(`${dados.de}T00:00:00.000Z`),
      ate: new Date(`${dados.ate}T00:00:00.000Z`),
      valorHora: dados.valorHora,
      horas: String(dados.horas),
      itens: dados.itens,
      linhasExtras: dados.linhasExtras,
      totalAjustado: dados.totalAjustado || null,
    };

    const linha = entrada.id
      ? await tx.demonstrativo.update({ where: { id: entrada.id }, data: comum })
      : await tx.demonstrativo.create({ data: comum });

    if (entrada.lembrarPreco) {
      await tx.cliente.update({
        where: { id: dados.clienteId },
        data: { precoHoraAcordado: dados.valorHora },
      });
    }

    return linha;
  });

  return { ok: true, dados: { ...dados, id: gravado.id, enviadoEm: gravado.enviadoEm } };
}

/** Um demonstrativo salvo, com as contas refeitas a partir do que foi congelado. */
export async function buscar(id: string): Promise<Demonstrativo | null> {
  const linha = await prisma.demonstrativo.findUnique({
    where: { id },
    include: { cliente: { select: { nome: true } } },
  });

  if (!linha) {
    return null;
  }

  return montar({
    id: linha.id,
    clienteId: linha.clienteId,
    clienteNome: linha.cliente.nome,
    de: linha.de.toISOString().slice(0, 10) as DataLocal,
    ate: linha.ate.toISOString().slice(0, 10) as DataLocal,
    valorHora: linha.valorHora.toFixed(2),
    itens: linha.itens as unknown as ItemDoDemonstrativo[],
    linhasExtras: linha.linhasExtras as unknown as LinhaExtra[],
    totalAjustado: linha.totalAjustado?.toFixed(2) ?? null,
    enviadoEm: linha.enviadoEm,
  });
}

export type DemonstrativoNaLista = {
  id: string;
  clienteNome: string;
  de: string;
  ate: string;
  horas: number;
  totalCentavos: number;
  enviadoEm: Date | null;
};

/** Os demonstrativos ja emitidos, do mais novo para o mais antigo. */
export async function listar(clienteId?: string): Promise<DemonstrativoNaLista[]> {
  const linhas = await prisma.demonstrativo.findMany({
    where: clienteId ? { clienteId } : {},
    include: { cliente: { select: { nome: true } } },
    orderBy: [{ de: "desc" }, { criadoEm: "desc" }],
    take: 60,
  });

  return linhas.map((linha) => {
    const extras = linha.linhasExtras as unknown as LinhaExtra[];
    const calculado =
      Math.round(emCentavos(linha.valorHora.toFixed(2)) * Number(linha.horas)) +
      extras.reduce((soma, extra) => soma + emCentavos(extra.valor || "0"), 0);

    return {
      id: linha.id,
      clienteNome: linha.cliente.nome,
      de: linha.de.toISOString().slice(0, 10),
      ate: linha.ate.toISOString().slice(0, 10),
      horas: Number(linha.horas),
      totalCentavos: linha.totalAjustado
        ? emCentavos(linha.totalAjustado.toFixed(2))
        : calculado,
      enviadoEm: linha.enviadoEm,
    };
  });
}

/** Marca que o documento foi para o WhatsApp do cliente. */
export async function marcarEnviado(id: string): Promise<void> {
  await prisma.demonstrativo.update({
    where: { id },
    data: { enviadoEm: new Date() },
  });
}
