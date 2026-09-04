/**
 * PARAMETROS AJUSTAVEIS DO PAINEL (Fase 11).
 *
 * Os numeros que a equipe pode mudar sozinha vivem na tabela Configuracao.
 * Este arquivo e o unico lugar que sabe QUAIS sao esses numeros, que valores
 * fazem sentido para cada um e por que.
 *
 * Duas coisas de proposito NAO estao aqui como editaveis:
 *
 *   intervalo de 30 min entre reservas — e integridade da agenda, garantida
 *     por uma trava do proprio Postgres. O banco le esse numero no momento em
 *     que grava cada reserva; mudar depois deixaria as reservas antigas com a
 *     folga velha e as novas com a folga nova, duas regras convivendo na mesma
 *     agenda. Decisao do dono do projeto na Fase 11: fica em 30, so leitura.
 *
 *   limites de envio do codigo de WhatsApp — sao freios contra abuso, nao
 *     preferencia comercial. Ficam no codigo (verificacao.ts) e aparecem no
 *     painel apenas para a equipe consultar.
 */
import { prisma } from "@/lib/prisma";

export type ChaveParametro =
  | "duracaoMinimaMinutos"
  | "janelaCancelamentoHoras"
  | "antecedenciaMinimaMinutos"
  | "antecedenciaMaximaDias";

export type DefinicaoParametro = {
  chave: ChaveParametro;
  rotulo: string;
  /** Explicacao em portugues simples, mostrada embaixo do campo. */
  ajuda: string;
  unidade: string;
  minimo: number;
  maximo: number;
  /** Quando existe, o valor precisa ser multiplo deste numero. */
  multiploDe?: number;
};

/**
 * A grade da agenda e de 30 minutos e isso nao muda (CLAUDE.md). Por isso a
 * duracao minima so pode ser multipla de 30: um minimo de 45 min ofereceria ao
 * cliente um horario que o banco recusaria na hora de gravar.
 */
export const PARAMETROS: readonly DefinicaoParametro[] = [
  {
    chave: "duracaoMinimaMinutos",
    rotulo: "Duração mínima da reserva",
    ajuda:
      "O menor tempo que um cliente pode reservar pelo site. Precisa ser múltiplo de 30 minutos, porque a agenda inteira é feita de blocos de meia hora. A recepção continua podendo lançar qualquer duração.",
    unidade: "minutos",
    minimo: 30,
    maximo: 600,
    multiploDe: 30,
  },
  {
    chave: "janelaCancelamentoHoras",
    rotulo: "Prazo para o cliente cancelar ou remarcar",
    ajuda:
      "Com quantas horas de antecedência, no mínimo, o cliente ainda pode cancelar ou remarcar sozinho pelo site. Passado esse prazo, só a equipe resolve. A recepção nunca fica presa a esse prazo.",
    unidade: "horas",
    minimo: 0,
    maximo: 168,
  },
  {
    chave: "antecedenciaMinimaMinutos",
    rotulo: "Antecedência mínima para reservar",
    ajuda:
      "Quanto tempo antes do início o cliente ainda consegue fechar a reserva pelo site. Serve para a equipe não ser pega de surpresa por uma reserva que começa em cinco minutos.",
    unidade: "minutos",
    minimo: 0,
    maximo: 10_080,
  },
  {
    chave: "antecedenciaMaximaDias",
    rotulo: "Até quantos dias à frente dá para reservar",
    ajuda:
      "O quanto o calendário do site abre para o futuro. Um número muito alto enche a agenda de compromissos distantes que costumam ser desmarcados.",
    unidade: "dias",
    minimo: 1,
    maximo: 365,
  },
] as const;

export type ValoresDeParametros = Record<ChaveParametro, number>;

export type FalhaDeConfiguracao = { codigo: "REGRA"; motivo: string };

export type Resultado<T> =
  | { ok: true; dados: T }
  | { ok: false; falha: FalhaDeConfiguracao };

/** O que o painel mostra na aba: valor atual + como o campo se comporta. */
export type ParametroNaTela = DefinicaoParametro & { valor: number };

/**
 * Le os parametros editaveis.
 *
 * Se algum sumiu da tabela, avisa com um erro claro em vez de assumir um
 * numero por conta propria: um padrao inventado aqui viraria regra de negocio
 * escondida, e o CLAUDE.md e explicito em nao inventar regra.
 */
export async function lerParametros(): Promise<ParametroNaTela[]> {
  const linhas = await prisma.configuracao.findMany({
    where: { chave: { in: PARAMETROS.map((parametro) => parametro.chave) } },
  });

  const valores = new Map(linhas.map((linha) => [linha.chave, linha.valor]));

  return PARAMETROS.map((parametro) => {
    const bruto = valores.get(parametro.chave);

    if (bruto === undefined) {
      throw new Error(
        `Parametro "${parametro.chave}" nao existe na tabela Configuracao. Rode "npm run db:seed".`,
      );
    }

    return { ...parametro, valor: Number(bruto) };
  });
}

/** O intervalo entre reservas, que a tela mostra sem deixar editar. */
export async function lerIntervaloEntreReservas(): Promise<number> {
  const linha = await prisma.configuracao.findUnique({
    where: { chave: "intervaloMinutos" },
  });

  return linha ? Number(linha.valor) : 30;
}

function validarUm(
  definicao: DefinicaoParametro,
  valor: number,
): string | null {
  if (!Number.isInteger(valor)) {
    return `${definicao.rotulo}: use um número inteiro.`;
  }

  if (valor < definicao.minimo || valor > definicao.maximo) {
    return `${definicao.rotulo}: use um valor entre ${definicao.minimo} e ${definicao.maximo} ${definicao.unidade}.`;
  }

  if (definicao.multiploDe && valor % definicao.multiploDe !== 0) {
    return `${definicao.rotulo}: use um múltiplo de ${definicao.multiploDe} ${definicao.unidade}.`;
  }

  return null;
}

/**
 * Confere o conjunto inteiro, e nao so cada campo isolado.
 *
 * Dois numeros validos sozinhos podem ser impossiveis juntos — e o resultado
 * seria uma agenda que nunca oferece horario nenhum, sem nenhuma mensagem de
 * erro para explicar por que.
 */
async function validarConjunto(valores: ValoresDeParametros): Promise<string | null> {
  const antecedenciaMaximaEmMinutos = valores.antecedenciaMaximaDias * 24 * 60;

  if (valores.antecedenciaMinimaMinutos >= antecedenciaMaximaEmMinutos) {
    return "A antecedência mínima ficou maior que a máxima: assim nenhuma data do calendário poderia ser reservada.";
  }

  // Uma sala com duracao maxima MENOR que a duracao minima nunca aceitaria
  // reserva nenhuma pelo site.
  const apertadas = await prisma.sala.findMany({
    where: {
      ativa: true,
      duracaoMaximaMinutos: { not: null, lt: valores.duracaoMinimaMinutos },
    },
    select: { nome: true, duracaoMaximaMinutos: true },
    orderBy: { ordem: "asc" },
  });

  const primeira = apertadas[0];

  if (primeira) {
    return `A duração mínima (${valores.duracaoMinimaMinutos} min) ficou maior que a duração máxima da ${primeira.nome} (${primeira.duracaoMaximaMinutos} min). Nenhum cliente conseguiria reservar essa sala.`;
  }

  return null;
}

/**
 * Grava os parametros.
 *
 * E tudo ou nada: ou os quatro valem, ou nenhum e gravado. Salvar metade
 * deixaria a agenda numa combinacao que a equipe nao escolheu.
 */
export async function salvarParametros(
  entrada: ValoresDeParametros,
): Promise<Resultado<ParametroNaTela[]>> {
  for (const parametro of PARAMETROS) {
    const erro = validarUm(parametro, entrada[parametro.chave]);

    if (erro) {
      return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
    }
  }

  const erroDoConjunto = await validarConjunto(entrada);

  if (erroDoConjunto) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erroDoConjunto } };
  }

  await prisma.$transaction(
    PARAMETROS.map((parametro) =>
      prisma.configuracao.update({
        where: { chave: parametro.chave },
        data: { valor: String(entrada[parametro.chave]) },
      }),
    ),
  );

  return { ok: true, dados: await lerParametros() };
}
