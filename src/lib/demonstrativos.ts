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
import { Prisma } from "@/generated/prisma/client";
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

/**
 * O consumo do emporio no periodo, somado pelo sistema.
 *
 * POR QUE ISTO EXISTE: ate aqui a recepcionista lia a ficha fisica, somava de
 * cabeca e digitava uma linha de texto com o total — "EMPORIO 12 aguas sem
 * gas/10 aguas com gas/... R$ 201,50". E o mesmo tipo de numero digitado sem
 * conferencia que gerou os R$ 70 cobrados a mais na planilha da Toca.
 */
export type LinhaDoEmporio = {
  /** "12 Água sem gás · 7 Barrinha Proteína" — montado dos lançamentos. */
  descricao: string;
  /** Quantidade por produto, para o cliente conferir item a item. */
  itens: { produto: string; quantidade: number; valor: string }[];
  valorCentavos: number;
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
  /**
   * HORAS INCLUSAS NA MENSALIDADE (Fase 16, Parte D).
   *
   * NULO = sem cota, toda hora e cobrada. E o caso de quem nao e mensalista.
   */
  cotaHoras: number | null;
  /** Quantas horas do periodo couberam na cota — ja pagas na mensalidade. */
  horasNaCota: number;
  /** Quantas horas sobraram para cobrar. Sem cota, e igual ao total. */
  horasCobradas: number;
  itens: ItemDoDemonstrativo[];
  /** Quanto cada sala somou no periodo — o cliente pediu para ver separado. */
  porSala: { sala: string; horas: number }[];
  horas: number;
  /**
   * O EMPORIO, montado pelo sistema a partir dos consumos lancados.
   *
   * Separado de "linhasExtras" de proposito: estas a gestao digita; esta
   * aqui o sistema SOMA. Misturar as duas deixaria a equipe editar por cima
   * de um numero calculado, e ninguem saberia mais qual dos dois valia.
   *
   * Nulo quando nao ha consumo no periodo — nesse caso a linha nem aparece.
   */
  emporio: LinhaDoEmporio | null;
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
  /**
   * HORAS INCLUSAS NA MENSALIDADE. Mesma mecanica de tres estados do
   * "valorHora": ausente = vale a cota do CONTRATO vigente; nula ou zero = a
   * gestao apagou de proposito e tudo e cobrado; um numero = manda ele.
   */
  cotaHoras?: number | null;
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

  /*
   * A COTA SEGUE A MESMA MECANICA DE TRES ESTADOS, e pela mesma razao: juntar
   * "nao veio" com "veio vazio" tiraria da gestao a possibilidade de emitir um
   * documento SEM desconto — o campo se preencheria de novo sozinho a cada vez
   * que ela o apagasse.
   *
   * O caso de apagar e real: um periodo de tres meses tem UMA cota aplicada
   * (ver "cotaDoContrato"), e aí a gestao pode preferir cobrar tudo e acertar
   * à parte.
   */
  const cotaHoras =
    entrada.cotaHoras === undefined
      ? await cotaDoContrato(alvo)
      : entrada.cotaHoras && entrada.cotaHoras > 0
        ? entrada.cotaHoras
        : null;

  const emporio = await emporioDoPeriodo(alvo, entrada.de, entrada.ate);

  return {
    ok: true,
    dados: montar({
      id: null,
      clienteId: alvo.clienteId,
      empresaId: alvo.empresaId,
      clienteNome: alvo.nome,
      cotaHoras,
      de: entrada.de,
      ate: entrada.ate,
      valorHora,
      itens,
      emporio,
      linhasExtras: entrada.linhasExtras ?? [],
      totalAjustado: entrada.totalAjustado ?? null,
      enviadoEm: null,
    }),
  };
}

/**
 * O CONSUMO DO EMPORIO que entra na cobranca.
 *
 * SO O "NA_MENSALIDADE". O que foi pago na hora ja foi pago — cobrar de novo
 * no fim do mes seria cobrar duas vezes pela mesma barrinha, e o cliente nao
 * teria como perceber olhando o documento.
 *
 * Numa EMPRESA, entram os consumos de todos os clientes ligados a ela, mesma
 * regra das reservas: e a empresa que paga a conta.
 *
 * SOMADO EM CENTAVOS. Somar reais em ponto flutuante acumula diferenca, e
 * aqui sao dezenas de linhas de R$ 3,50 e R$ 7,50 por mes.
 */
async function emporioDoPeriodo(
  alvo: { clienteId: string | null; empresaId: string | null },
  de: DataLocal,
  ate: DataLocal,
): Promise<LinhaDoEmporio | null> {
  const consumos = await prisma.consumoDoEmporio.findMany({
    where: {
      momento: "NA_MENSALIDADE",
      ...(alvo.clienteId
        ? { clienteId: alvo.clienteId }
        : { cliente: { empresaId: alvo.empresaId! } }),
      consumidoEm: {
        gte: instanteDe(de, "00:00"),
        lt: instanteDe(somarDias(ate, 1), "00:00"),
      },
    },
    select: {
      quantidade: true,
      valor: true,
      produto: { select: { nome: true } },
    },
    orderBy: { consumidoEm: "asc" },
  });

  if (consumos.length === 0) {
    return null;
  }

  // Agrupado POR PRODUTO, e nao linha a linha: a ficha do cliente diz
  // "12 aguas sem gas", e nao doze linhas de uma agua. Ler doze linhas iguais
  // num documento de cobranca so atrapalha a conferencia.
  const porProduto = new Map<string, { quantidade: number; centavos: number }>();

  for (const consumo of consumos) {
    const atual = porProduto.get(consumo.produto.nome) ?? {
      quantidade: 0,
      centavos: 0,
    };

    porProduto.set(consumo.produto.nome, {
      quantidade: atual.quantidade + consumo.quantidade,
      centavos: atual.centavos + emCentavos(consumo.valor.toFixed(2)),
    });
  }

  const itens = [...porProduto.entries()]
    .map(([produto, soma]) => ({
      produto,
      quantidade: soma.quantidade,
      valor: emReais(soma.centavos),
      centavos: soma.centavos,
    }))
    .sort((a, b) => b.centavos - a.centavos);

  return {
    descricao: itens
      .map((item) => `${item.quantidade} ${item.produto}`)
      .join(" · "),
    itens: itens.map(({ produto, quantidade, valor }) => ({
      produto,
      quantidade,
      valor,
    })),
    valorCentavos: itens.reduce((soma, item) => soma + item.centavos, 0),
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
/**
 * DESCONTA A COTA DE HORAS DA MENSALIDADE.
 *
 * O QUE ELA RESOLVE: o mensalista tem horas de sala JA PAGAS na mensalidade
 * (10, 15). Até 17/11/2026 o demonstrativo cobrava todas as horas do periodo,
 * e a gestao descontava de cabeca — exatamente o tipo de conta manual que
 * gerou os R$ 70 cobrados a mais na planilha da Toca.
 *
 * AS HORAS DA COTA SAO AS PRIMEIRAS, EM ORDEM CRONOLOGICA, e esta escolha
 * precisa de justificativa porque as outras seriam arbitrarias:
 *
 *  - pelas mais CARAS, o cliente pagaria menos e o coworking decidiria sozinho
 *    presentea-lo com as horas de pico;
 *  - pelas mais BARATAS, o cliente pagaria mais e acharia (com razao) que o
 *    sistema escolheu contra ele;
 *  - cronologica e a unica que se EXPLICA numa frase: "suas 15 horas inclusas
 *    foram as de 05/10 a 12/10; a partir dali e extra". E e assim que a pessoa
 *    usa o espaco — ela nao sabe, em marco, quais horas serao as caras.
 *
 * UMA RESERVA PODE SER PARTIDA. Se restam 1 h de cota e a reserva tem 2 h, uma
 * entra na cota e a outra e cobrada. Sem partir, ou a hora extra sairia de
 * graca ou a cota seria perdida — as duas injustas, e nenhuma explicavel.
 */
function descontarACota(
  itens: ItemDoDemonstrativo[],
  cotaHoras: number | null,
  valorHora: string | null,
): { horasNaCota: number; horasCobradas: number; valorCentavos: number } {
  const total = UMA_CASA(itens.reduce((soma, item) => soma + item.horas, 0));

  /*
   * SEM COTA, O CAMINHO E O DE ANTES, byte por byte.
   *
   * Isto importa: todo demonstrativo ja emitido tem cota NULA, e qualquer
   * desvio aqui mudaria um documento que o cliente recebeu. A conta com preco
   * combinado arredonda UMA vez no fim (R$ 30,00 x 2,5 h = 7500 centavos
   * exatos), e a sem preco soma o valor congelado de cada reserva.
   */
  if (cotaHoras === null || cotaHoras <= 0) {
    return {
      horasNaCota: 0,
      horasCobradas: total,
      valorCentavos: valorHora
        ? Math.round(emCentavos(valorHora) * total)
        : itens.reduce((soma, item) => soma + item.valorCentavos, 0),
    };
  }

  let restante = cotaHoras;
  let naCota = 0;
  let cobradas = 0;
  let valorSemPrecoCombinado = 0;

  // OS ITENS JA VEM EM ORDEM CRONOLOGICA ("orderBy: { inicio: 'asc' }" na
  // consulta, e congelados nessa ordem no documento salvo). Reordenar aqui
  // faria o documento guardado contar uma historia diferente da previa.
  for (const item of itens) {
    const dentro = Math.min(item.horas, restante);
    const fora = UMA_CASA(item.horas - dentro);

    restante = UMA_CASA(restante - dentro);
    naCota = UMA_CASA(naCota + dentro);
    cobradas = UMA_CASA(cobradas + fora);

    if (valorHora) {
      // Com preco combinado o valor sai das horas cobradas, somadas e
      // arredondadas uma vez so no fim — nada a fazer por item.
      continue;
    }

    /*
     * SEM PRECO COMBINADO, o valor de cada reserva e o congelado nela, e a
     * parte cobrada sai PROPORCIONAL as horas.
     *
     * Os dois extremos sao tratados a parte, de proposito: quando a reserva e
     * cobrada INTEIRA, vale exatamente o valor gravado — a multiplicacao
     * proporcional daria o mesmo numero quase sempre, mas "quase" num valor
     * congelado e o comeco de um centavo de diferenca que ninguem explica.
     */
    if (fora === 0) {
      continue;
    }

    valorSemPrecoCombinado +=
      fora === item.horas
        ? item.valorCentavos
        : Math.round((item.valorCentavos * fora) / item.horas);
  }

  return {
    horasNaCota: naCota,
    horasCobradas: cobradas,
    valorCentavos: valorHora
      ? Math.round(emCentavos(valorHora) * cobradas)
      : valorSemPrecoCombinado,
  };
}

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
  /** NULO = sem cota, toda hora e cobrada. */
  cotaHoras: number | null;
  itens: ItemDoDemonstrativo[];
  emporio: LinhaDoEmporio | null;
  linhasExtras: LinhaExtra[];
  totalAjustado: string | null;
  enviadoEm: Date | null;
}): Demonstrativo {
  const horas = UMA_CASA(bruto.itens.reduce((soma, item) => soma + item.horas, 0));

  const quebra = descontarACota(bruto.itens, bruto.cotaHoras, bruto.valorHora);

  // DOIS CAMINHOS, e o normal e o segundo.
  //
  // COM preco combinado (a Toca paga R$ 30 numa sala de R$ 40), e o preco em
  // centavos x as horas, arredondando uma vez so no fim: R$ 30,00 x 2,5 h da
  // 7500 centavos exatos.
  //
  // SEM preco combinado, e a SOMA do valor congelado em cada reserva — o que
  // o cliente foi cobrado no dia. Nunca um recalculo pela tabela de hoje:
  // mudar o preco da sala no painel nao pode mexer num mes ja fechado.
  // QUEM FAZ ESTA CONTA E "descontarACota", acima: com cota, ela cobra so as
  // horas que sobraram; sem cota, cobra todas e o resultado e identico ao que
  // era antes da Parte D existir.
  const valorDasHorasCentavos = quebra.valorCentavos;

  const valorDasLinhasCentavos = bruto.linhasExtras.reduce(
    (soma, linha) => soma + emCentavos(linha.valor || "0"),
    0,
  );

  const totalCalculadoCentavos =
    valorDasHorasCentavos +
    valorDasLinhasCentavos +
    (bruto.emporio?.valorCentavos ?? 0);

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
    horasNaCota: quebra.horasNaCota,
    horasCobradas: quebra.horasCobradas,
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
  /** As horas inclusas. Ausente = vale a cota do contrato; nula = tudo cobrado. */
  cotaHoras?: number | null;
  linhasExtras: LinhaExtra[];
  totalAjustado: string | null;
  /** Guarda este preco como o padrao do cliente para a proxima vez. */
  lembrarPreco: boolean;
}): Promise<Resultado<Demonstrativo>> {
  // DOCUMENTO JA ENVIADO NAO SE REESCREVE.
  //
  // Nao existe rota que APAGUE um demonstrativo, de proposito. Mas regravar
  // em cima de um que o cliente ja recebeu faz o mesmo estrago com outro
  // nome: o que esta guardado aqui deixa de bater com o que ele tem na mao, e
  // ninguem percebe — e a nota de cobranca perde a serventia de ser prova.
  //
  // Para corrigir, emite-se um documento NOVO. O antigo fica como registro do
  // que foi enviado, mesma regra de "nunca excluir" das salas e das empresas.
  if (entrada.id) {
    const jaExiste = await prisma.demonstrativo.findUnique({
      where: { id: entrada.id },
      select: { enviadoEm: true },
    });

    if (jaExiste?.enviadoEm) {
      return {
        ok: false,
        falha: {
          motivo:
            "Este documento já foi enviado ao cliente e não pode mais ser alterado. Emita um novo para o mesmo período.",
          codigo: "JA_ENVIADO",
        },
      };
    }
  }

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
      // CONGELA A COTA junto com a tabela de horas: reajustar o contrato
      // depois nao pode mudar o documento que o cliente recebeu. O desconto
      // em si e recalculado na leitura, a partir desta cota e dos itens.
      cotaHoras: dados.cotaHoras,
      horas: String(dados.horas),
      itens: dados.itens,
      // CONGELA o empório junto com a tabela de horas: um lançamento feito
      // depois não pode mudar o documento que o cliente recebeu.
      emporio: dados.emporio ?? Prisma.DbNull,
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
    // CONGELADA na emissao. O desconto em si e recalculado aqui a partir dela
    // e dos itens congelados: guardar a quebra tambem criaria duas fontes do
    // mesmo numero, e um dia as duas discordariam.
    cotaHoras: linha.cotaHoras,
    // Os demonstrativos emitidos antes de o valor por hora virar opcional
    // nao guardam o valor de cada reserva. Eles sempre tem preco combinado,
    // entao o zero aqui nunca e somado — esta so para o tipo fechar.
    emporio: (linha.emporio as unknown as LinhaDoEmporio | null) ?? null,
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

    const emporio = linha.emporio as unknown as LinhaDoEmporio | null;

    const calculado =
      valorDasHoras +
      extras.reduce((soma, extra) => soma + emCentavos(extra.valor || "0"), 0) +
      (emporio?.valorCentavos ?? 0);

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

/**
 * A COTA DE HORAS do contrato de mensalidade vigente deste cliente/empresa.
 *
 * É ela que vem preenchida na tela, na primeira vez. Nula quando não há
 * contrato, ou quando o contrato não tem horas inclusas.
 *
 * A COTA É APLICADA UMA VEZ POR DOCUMENTO, e isto precisa ficar dito: ela é
 * mensal, e o período do demonstrativo é LIVRE (o ciclo da Toca vai de 10/09 a
 * 10/10). Para o uso normal — um documento por ciclo — uma vez é exatamente
 * certo. Num período de três meses seria uma cota só, e a gestão corrige o
 * número na tela, que é onde ela está olhando o documento. Multiplicar por
 * "meses do período" exigiria decidir se 10/09–10/10 são um mês ou dois, e
 * qualquer resposta estaria errada metade das vezes.
 *
 * VIGENTE é "valia no FIM do período cobrado", e não hoje: emitir em dezembro
 * o documento de outubro tem de usar a cota que valia em outubro.
 */
async function cotaDoContrato(alvo: {
  clienteId: string | null;
  empresaId: string | null;
}): Promise<number | null> {
  const contrato = await prisma.contratoMensal.findFirst({
    where: {
      ativo: true,
      cotaHoras: { not: null },
      ...(alvo.empresaId
        ? {
            OR: [
              { empresaId: alvo.empresaId },
              // A empresa pode ter o contrato no nome de um funcionário —
              // ignorar isso faria a cota da Toca desaparecer do documento
              // dela sem ninguém entender por quê.
              { cliente: { empresaId: alvo.empresaId } },
            ],
          }
        : { clienteId: alvo.clienteId }),
    },
    orderBy: { inicio: "desc" },
    select: { cotaHoras: true },
  });

  return contrato?.cotaHoras ?? null;
}
