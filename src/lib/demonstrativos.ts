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
  /** Quem reservou. Num documento de empresa, e de quem sao aquelas horas. */
  pessoa: string;
  inicio: string;
  fim: string;
  horas: number;
  /**
   * O VALOR JA CONGELADO NA RESERVA, em centavos.
   *
   * E o que o cliente foi cobrado no dia, pela tabela da sala que valia
   * naquele momento — nunca um recalculo. E o que o documento usa quando a
   * gestao NAO tem preco combinado com este cliente.
   */
  valorCentavos: number;
};

/** Uma linha escrita pela gestao: posicoes, emporio, impressoes. */
export type LinhaExtra = {
  descricao: string;
  /** Em reais, com duas casas: "940.00". */
  valor: string;
};

export type Demonstrativo = {
  id: string | null;
  /** Preenchido quando o documento e de UMA PESSOA. */
  clienteId: string | null;
  /** Preenchido quando o documento e de uma EMPRESA inteira. */
  empresaId: string | null;
  /** O nome que vai no "Para" do documento. */
  clienteNome: string;
  /** Quem reservou, quando o documento e de uma empresa. */
  porPessoa: { nome: string; horas: number }[];
  de: DataLocal;
  ate: DataLocal;
  /**
   * O preco por hora COMBINADO com este cliente. NULO e o normal: sem preco
   * negociado, cada reserva vale o que ela custou no dia.
   */
  valorHora: string | null;
  itens: ItemDoDemonstrativo[];
  /** Quanto cada sala somou no periodo — o cliente pediu para ver separado. */
  porSala: { sala: string; horas: number }[];
  horas: number;
  linhasExtras: LinhaExtra[];
  /**
   * O valor das horas, em centavos. Com preco combinado, e horas x preco;
   * sem ele, e a SOMA do valor congelado em cada reserva.
   */
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
  /** UM dos dois: o documento e de uma pessoa ou de uma empresa inteira. */
  clienteId?: string | null;
  empresaId?: string | null;
  de: DataLocal;
  ate: DataLocal;
  /**
   * O preco por hora combinado com o cliente. OPCIONAL: em branco, cada
   * reserva vale o valor que ela ja tem gravado.
   */
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

  // DE QUEM E O DOCUMENTO: de uma pessoa, ou de uma EMPRESA inteira.
  //
  // A empresa e o caso do mensalista: o demonstrativo da Toca cobre o
  // Matheus, o Vinicius e todo mundo que reservou no nome dela. Fazer um
  // documento por pessoa obrigaria a gestao a somar quatro a mao — que e
  // exatamente o trabalho que esta tela veio tirar.
  const alvo = await alvoDoDemonstrativo(entrada);

  if (!alvo) {
    return {
      ok: false,
      falha: { motivo: "Cliente ou empresa não encontrado.", codigo: "NAO_ENCONTRADO" },
    };
  }

  const reservas = await prisma.reserva.findMany({
    where: {
      ...alvo.filtro,
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
      // O valor congelado na reserva: o que o cliente pagou naquele dia.
      valor: true,
      sala: { select: { nome: true } },
      cliente: { select: { nome: true } },
    },
    orderBy: { inicio: "asc" },
  });

  const itens: ItemDoDemonstrativo[] = reservas.map((reserva) => ({
    dia: dataLocalDe(reserva.inicio),
    sala: reserva.sala.nome,
    pessoa: reserva.cliente.nome,
    inicio: horaLocalDe(reserva.inicio),
    fim: horaLocalDe(reserva.fim),
    horas: UMA_CASA(reserva.duracaoMinutos / 60),
    valorCentavos: emCentavos(reserva.valor.toFixed(2)),
  }));

  // O preco combinado e OPCIONAL, e aqui ha TRES situacoes diferentes:
  //
  //   nao veio nada (undefined) -> vale o preco cadastrado do cliente, que e
  //     como ele aparece preenchido na tela na primeira vez;
  //   veio vazio ou nulo        -> a gestao APAGOU o campo de proposito, e o
  //     documento passa a somar o valor de cada reserva;
  //   veio um numero            -> manda ele.
  //
  // Juntar os dois primeiros tiraria da equipe a possibilidade de voltar um
  // cliente para a tabela da sala: o campo se preencheria de novo sozinho a
  // cada vez que ela o apagasse.
  const valorHora =
    entrada.valorHora === undefined
      ? alvo.precoAcordado
      : entrada.valorHora?.trim() || null;

  return {
    ok: true,
    dados: montar({
      id: null,
      clienteId: alvo.clienteId,
      empresaId: alvo.empresaId,
      clienteNome: alvo.nome,
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
 * De quem e o documento: de uma PESSOA ou de uma EMPRESA inteira.
 *
 * Na empresa, entram as reservas de TODOS os clientes ligados a ela — e nao
 * so as que foram marcadas com a empresa na hora de reservar. Em producao
 * apenas 4 de 199 reservas tinham a empresa respondida; contar so essas
 * deixaria a fatura da Toca com um vinte-avos do que ela usou, e o numero
 * continuaria parecendo certo.
 */
async function alvoDoDemonstrativo(entrada: {
  clienteId?: string | null;
  empresaId?: string | null;
}): Promise<{
  clienteId: string | null;
  empresaId: string | null;
  nome: string;
  precoAcordado: string | null;
  filtro: { clienteId: string } | { cliente: { empresaId: string } };
} | null> {
  if (entrada.empresaId) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: entrada.empresaId },
      select: { id: true, nome: true },
    });

    if (!empresa) {
      return null;
    }

    // O preco combinado da empresa e o do cliente que ja tem um. Se dois
    // discordarem, vale o primeiro — e a gestao corrige na tela, que e onde
    // ela esta olhando o documento.
    const comPreco = await prisma.cliente.findFirst({
      where: { empresaId: empresa.id, precoHoraAcordado: { not: null } },
      select: { precoHoraAcordado: true },
      orderBy: { nome: "asc" },
    });

    return {
      clienteId: null,
      empresaId: empresa.id,
      nome: empresa.nome,
      precoAcordado: comPreco?.precoHoraAcordado?.toFixed(2) ?? null,
      filtro: { cliente: { empresaId: empresa.id } },
    };
  }

  if (!entrada.clienteId) {
    return null;
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: entrada.clienteId },
    select: { id: true, nome: true, precoHoraAcordado: true },
  });

  return cliente
    ? {
        clienteId: cliente.id,
        empresaId: null,
        nome: cliente.nome,
        precoAcordado: cliente.precoHoraAcordado?.toFixed(2) ?? null,
        filtro: { clienteId: cliente.id },
      }
    : null;
}

/**
 * Faz TODAS as contas. E aqui que o erro da planilha morre.
 *
 * Nenhum total e digitado em lugar nenhum: as horas saem da soma dos itens, o
 * valor das horas sai do preco combinado OU do valor congelado em cada
 * reserva, e o total e a soma de tudo — tudo em centavos, porque somar reais
 * em ponto flutuante acumula diferenca de um centavo ao longo de muitas
 * linhas.
 */
function montar(bruto: {
  id: string | null;
  clienteId: string | null;
  empresaId: string | null;
  clienteNome: string;
  de: DataLocal;
  ate: DataLocal;
  /**
   * O preco por hora COMBINADO com este cliente. NULO e o normal: sem preco
   * negociado, cada reserva vale o que ela custou no dia.
   */
  valorHora: string | null;
  itens: ItemDoDemonstrativo[];
  linhasExtras: LinhaExtra[];
  totalAjustado: string | null;
  enviadoEm: Date | null;
}): Demonstrativo {
  const horas = UMA_CASA(bruto.itens.reduce((soma, item) => soma + item.horas, 0));

  // DOIS CAMINHOS, e o normal e o segundo.
  //
  // COM preco combinado (a Toca paga R$ 30 numa sala de R$ 40), e o preco em
  // centavos x as horas, arredondando uma vez so no fim: R$ 30,00 x 2,5 h da
  // 7500 centavos exatos.
  //
  // SEM preco combinado, e a SOMA do valor congelado em cada reserva — o que
  // o cliente foi cobrado no dia. Nunca um recalculo pela tabela de hoje:
  // mudar o preco da sala no painel nao pode mexer num mes ja fechado.
  const valorDasHorasCentavos = bruto.valorHora
    ? Math.round(emCentavos(bruto.valorHora) * horas)
    : bruto.itens.reduce((soma, item) => soma + item.valorCentavos, 0);

  const valorDasLinhasCentavos = bruto.linhasExtras.reduce(
    (soma, linha) => soma + emCentavos(linha.valor || "0"),
    0,
  );

  const totalCalculadoCentavos = valorDasHorasCentavos + valorDasLinhasCentavos;

  // QUEM RESERVOU. Sai dos itens congelados, e nao de uma consulta nova:
  // assim o documento salvo e a pre-visualizacao contam a mesma coisa.
  const porPessoa = [
    ...bruto.itens
      .reduce((mapa, item) => {
        mapa.set(item.pessoa, UMA_CASA((mapa.get(item.pessoa) ?? 0) + item.horas));
        return mapa;
      }, new Map<string, number>())
      .entries(),
  ]
    .map(([nome, horas]) => ({ nome, horas }))
    .sort((a, b) => b.horas - a.horas);

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
    porPessoa,
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
  clienteId?: string | null;
  empresaId?: string | null;
  de: DataLocal;
  ate: DataLocal;
  /** O preco combinado. Nulo = vale o valor de cada reserva. */
  valorHora?: string | null;
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
      empresaId: dados.empresaId,
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

    // Guarda o preco no CLIENTE, ou em todos os clientes da empresa: no mes
    // seguinte ele ja vem preenchido, venha o documento de quem vier.
    // So guarda quando HA preco combinado: gravar nulo aqui apagaria, sem
    // aviso, o preco negociado que a equipe cadastrou antes.
    if (entrada.lembrarPreco && dados.valorHora) {
      await tx.cliente.updateMany({
        where: dados.clienteId
          ? { id: dados.clienteId }
          : { empresaId: dados.empresaId! },
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
    include: {
      cliente: { select: { nome: true } },
      empresa: { select: { nome: true } },
    },
  });

  if (!linha) {
    return null;
  }

  return montar({
    id: linha.id,
    clienteId: linha.clienteId,
    empresaId: linha.empresaId,
    clienteNome: linha.cliente?.nome ?? linha.empresa?.nome ?? "(sem dono)",
    de: linha.de.toISOString().slice(0, 10) as DataLocal,
    ate: linha.ate.toISOString().slice(0, 10) as DataLocal,
    valorHora: linha.valorHora?.toFixed(2) ?? null,
    // Os demonstrativos emitidos antes de o valor por hora virar opcional
    // nao guardam o valor de cada reserva. Eles sempre tem preco combinado,
    // entao o zero aqui nunca e somado — esta so para o tipo fechar.
    itens: (linha.itens as unknown as ItemDoDemonstrativo[]).map((item) => ({
      ...item,
      valorCentavos: item.valorCentavos ?? 0,
    })),
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
export async function listar(dono?: {
  clienteId?: string | null;
  empresaId?: string | null;
}): Promise<DemonstrativoNaLista[]> {
  const linhas = await prisma.demonstrativo.findMany({
    where: dono?.clienteId
      ? { clienteId: dono.clienteId }
      : dono?.empresaId
        ? { empresaId: dono.empresaId }
        : {},
    include: {
      cliente: { select: { nome: true } },
      empresa: { select: { nome: true } },
    },
    orderBy: [{ de: "desc" }, { criadoEm: "desc" }],
    take: 60,
  });

  return linhas.map((linha) => {
    const extras = linha.linhasExtras as unknown as LinhaExtra[];
    const itens = linha.itens as unknown as ItemDoDemonstrativo[];

    // Os mesmos dois caminhos do "montar": preco combinado x horas, ou a
    // soma do valor congelado em cada reserva.
    const valorDasHoras = linha.valorHora
      ? Math.round(emCentavos(linha.valorHora.toFixed(2)) * Number(linha.horas))
      : itens.reduce((soma, item) => soma + (item.valorCentavos ?? 0), 0);

    const calculado =
      valorDasHoras +
      extras.reduce((soma, extra) => soma + emCentavos(extra.valor || "0"), 0);

    return {
      id: linha.id,
      clienteNome: linha.cliente?.nome ?? linha.empresa?.nome ?? "(sem dono)",
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
