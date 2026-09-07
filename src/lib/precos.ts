/**
 * QUANTO CUSTA UMA RESERVA.
 *
 * Modulo PURO: nao fala com o banco nem com a tela. Recebe as tarifas da sala
 * e devolve o valor. Existe assim de proposito, por dois motivos:
 *
 *   1. o mesmo codigo roda no SERVIDOR (que decide o valor de verdade) e no
 *      NAVEGADOR (que mostra a estimativa antes de confirmar). Antes a conta
 *      estava escrita duas vezes, em lugares diferentes; bastava uma delas
 *      mudar para o cliente ver um preco na tela e receber outro no WhatsApp;
 *   2. sem banco, da para testar todas as combinacoes de horario em segundos.
 *
 * A REGRA, em portugues simples: a reserva e dividida em blocos de 30 minutos,
 * e cada bloco e cobrado pela faixa em que ele COMECA. Uma reserva das 17h as
 * 20h numa sala de R$40 (dia) e R$75 (noite) paga 40 + 75 + 75 = R$190. Uma
 * das 17:30 as 18:30 paga meia hora de cada faixa.
 *
 * O valor calculado aqui fica CONGELADO na reserva no momento da criacao
 * (regra do CLAUDE.md): aumento de preco depois nao mexe em reserva antiga.
 */
import type { HoraLocal } from "@/lib/tempo";

/**
 * Tamanho do bloco da grade, em minutos.
 *
 * Mora aqui, e nao no motor de disponibilidade, porque este arquivo e o unico
 * que o navegador tambem carrega — o motor fala com o banco e nao pode ir
 * junto para o lado do cliente.
 */
export const BLOCO_MINUTOS = 30;

/** Como a reserva foi vendida. */
export type CategoriaReserva = "HORA" | "DIARIA";

/** Os precos da sala, como vem do banco (texto, para nao perder centavos). */
export type TarifasDaSala = {
  /** Preco por hora ate o inicio da faixa noturna. */
  precoPorHora: string;
  /** Preco por hora depois do inicio da faixa noturna. */
  precoPorHoraNoturno: string;
  /** Preco noturno para grupo grande. Nulo = esta sala nao cobra diferente. */
  precoPorHoraNoturnoGrupo: string | null;
  /** ACIMA de quantas pessoas vale o preco de grupo. Nulo junto com ele. */
  pessoasParaGrupo: number | null;
  /** Preco fechado do dia inteiro. Nulo quando a sala nao aceita diaria. */
  precoDiaria: string | null;
};

export type PedidoDePreco = {
  /** "09:00" no relogio de Sao Paulo. */
  inicio: HoraLocal;
  /** "11:00". Precisa ser depois do inicio, no mesmo dia. */
  fim: HoraLocal;
  tarifas: TarifasDaSala;
  categoria: CategoriaReserva;
  /** Quantas pessoas. Nulo quando a sala nao pergunta isso. */
  pessoas: number | null;
  /** A partir de que hora vale o preco noturno. Vem da configuracao. */
  horaInicioNoturno: HoraLocal;
};

/** "18:30" -> 1110 minutos desde a meia-noite. */
export function emMinutos(hora: HoraLocal): number {
  const [h, m] = hora.split(":");
  const horas = Number(h);
  const minutos = Number(m);

  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) {
    throw new Error(`Hora invalida: "${hora}".`);
  }

  return horas * 60 + minutos;
}

/** "40.00" -> 4000 centavos. Em centavos porque centavo nao tem fracao. */
function emCentavos(preco: string): number {
  const numero = Number(preco);

  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`Preco invalido: "${preco}".`);
  }

  return Math.round(numero * 100);
}

/**
 * O preco da hora que vale para um bloco que comeca neste minuto do dia.
 *
 * A decisao olha para o COMECO do bloco. Um bloco 17:30-18:00 e de dia
 * inteiro; o 18:00-18:30 ja e noturno. Sem essa regra, faltaria dizer o que
 * fazer com o bloco que atravessa a fronteira — e a resposta mudaria conforme
 * quem lesse.
 */
function precoDaHoraNoBloco(
  minutoDoBloco: number,
  pedido: PedidoDePreco,
): number {
  const ehNoite = minutoDoBloco >= emMinutos(pedido.horaInicioNoturno);

  if (!ehNoite) {
    return emCentavos(pedido.tarifas.precoPorHora);
  }

  const { precoPorHoraNoturnoGrupo, pessoasParaGrupo } = pedido.tarifas;

  const ehGrupoGrande =
    precoPorHoraNoturnoGrupo !== null &&
    pessoasParaGrupo !== null &&
    pedido.pessoas !== null &&
    pedido.pessoas > pessoasParaGrupo;

  return emCentavos(
    ehGrupoGrande ? precoPorHoraNoturnoGrupo : pedido.tarifas.precoPorHoraNoturno,
  );
}

/**
 * Quanto custa, em centavos.
 *
 * A soma junta primeiro os MINUTOS de cada preco e so depois converte em
 * dinheiro. Arredondar bloco a bloco faria uma reserva de tres horas custar
 * alguns centavos a mais ou a menos que a mesma reserva calculada de uma vez —
 * diferenca pequena, mas que aparece na hora de conferir o caixa.
 */
export function valorEmCentavos(pedido: PedidoDePreco): number {
  if (pedido.categoria === "DIARIA") {
    if (pedido.tarifas.precoDiaria === null) {
      throw new Error("Esta sala nao tem preco de diaria cadastrado.");
    }
    return emCentavos(pedido.tarifas.precoDiaria);
  }

  const inicio = emMinutos(pedido.inicio);
  const fim = emMinutos(pedido.fim);

  if (fim <= inicio) {
    throw new Error("O horario de termino precisa ser depois do de inicio.");
  }

  /** Minutos acumulados por preco de hora. */
  const minutosPorPreco = new Map<number, number>();

  for (let minuto = inicio; minuto < fim; minuto += BLOCO_MINUTOS) {
    const preco = precoDaHoraNoBloco(minuto, pedido);
    // O ultimo bloco pode ser menor, se a reserva nao fechar em meia hora.
    const duracao = Math.min(BLOCO_MINUTOS, fim - minuto);
    minutosPorPreco.set(preco, (minutosPorPreco.get(preco) ?? 0) + duracao);
  }

  let total = 0;

  for (const [precoDaHora, minutos] of minutosPorPreco) {
    total += Math.round((precoDaHora * minutos) / 60);
  }

  return total;
}

/** O mesmo valor, em reais com duas casas: "190.00". */
export function valorEmReais(pedido: PedidoDePreco): string {
  return (valorEmCentavos(pedido) / 100).toFixed(2);
}

/** Centavos -> "R$ 190,00", para mostrar na tela. */
export function comoDinheiro(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
