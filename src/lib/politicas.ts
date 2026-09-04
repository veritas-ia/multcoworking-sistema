/**
 * TEXTOS DE POLITICA MOSTRADOS AO CLIENTE (Fase 11).
 *
 * Sao as frases curtas que o cliente le na hora de fechar a reserva: a regra
 * de cancelamento e o aviso sobre o valor. Ficam editaveis porque quem
 * responde o WhatsApp do coworking sabe melhor do que ninguem qual frase
 * evita a duvida que mais aparece.
 *
 * O texto pode usar {{horas}}, que e trocado pelo prazo de cancelamento
 * configurado nos parametros. Assim mudar o prazo de 12 para 24 horas nao
 * deixa o texto do site mentindo.
 *
 * Se a linha nao existir no banco (por exemplo, um servidor onde o seed novo
 * ainda nao rodou), vale o texto padrao daqui — a area publica NUNCA pode
 * ficar sem a politica de cancelamento na tela.
 */
import { prisma } from "@/lib/prisma";

export type ChavePolitica = "politicaCancelamento" | "avisoDoValor";

export type DefinicaoPolitica = {
  chave: ChavePolitica;
  rotulo: string;
  ajuda: string;
  /** Variaveis que este texto aceita. */
  variaveis: readonly string[];
  padrao: string;
  maximo: number;
};

export const POLITICAS: readonly DefinicaoPolitica[] = [
  {
    chave: "politicaCancelamento",
    rotulo: "Política de cancelamento",
    ajuda:
      'Aparece antes de o cliente confirmar a reserva e na área "Minhas reservas". Use {{horas}} para o prazo — assim, se você mudar o prazo nos parâmetros, o texto acompanha sozinho.',
    variaveis: ["{{horas}}"],
    padrao:
      "Você pode cancelar ou remarcar sozinho até {{horas}} horas antes do início da reserva. Depois disso, é só falar com a equipe pelo WhatsApp. O pagamento é feito no local — não há cobrança online.",
    maximo: 600,
  },
  {
    chave: "avisoDoValor",
    rotulo: "Aviso sobre o valor",
    ajuda:
      "Frase curta mostrada logo abaixo do valor estimado, no resumo da reserva.",
    variaveis: [],
    padrao: "Valor estimado. O pagamento é feito no local, direto com a equipe.",
    maximo: 200,
  },
] as const;

export type TextosDePolitica = Record<ChavePolitica, string>;

export type FalhaDePolitica = { codigo: "REGRA"; motivo: string };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDePolitica };

/** Toda ocorrencia de {{alguma-coisa}} dentro do texto. */
function variaveisUsadas(texto: string): string[] {
  return texto.match(/\{\{\s*[^}]*\}\}/g)?.map((achado) => achado.replace(/\s/g, "")) ?? [];
}

export function validarPolitica(definicao: DefinicaoPolitica, texto: string): string | null {
  const limpo = texto.trim();

  if (limpo === "") {
    return `${definicao.rotulo}: o texto não pode ficar vazio.`;
  }

  if (limpo.length > definicao.maximo) {
    return `${definicao.rotulo}: o texto passou de ${definicao.maximo} caracteres.`;
  }

  for (const variavel of variaveisUsadas(limpo)) {
    if (!definicao.variaveis.includes(variavel)) {
      const permitidas =
        definicao.variaveis.length > 0
          ? `Aqui só vale ${definicao.variaveis.join(", ")}.`
          : "Este texto não aceita variáveis.";

      return `${definicao.rotulo}: a variável ${variavel} não existe. ${permitidas}`;
    }
  }

  return null;
}

/** Os textos como estao guardados, ainda com {{horas}} no lugar. */
export async function lerPoliticas(): Promise<TextosDePolitica> {
  const linhas = await prisma.configuracao.findMany({
    where: { chave: { in: POLITICAS.map((politica) => politica.chave) } },
  });

  const guardados = new Map(linhas.map((linha) => [linha.chave, linha.valor]));

  return Object.fromEntries(
    POLITICAS.map((politica) => [
      politica.chave,
      guardados.get(politica.chave)?.trim() || politica.padrao,
    ]),
  ) as TextosDePolitica;
}

/**
 * Os textos prontos para a tela, com as variaveis ja trocadas.
 *
 * A troca acontece no servidor de proposito: assim a area publica recebe a
 * frase pronta e nao precisa saber que existe {{horas}}.
 */
export async function textosParaOSite(
  janelaCancelamentoHoras: number,
): Promise<TextosDePolitica> {
  const guardados = await lerPoliticas();

  return Object.fromEntries(
    Object.entries(guardados).map(([chave, texto]) => [
      chave,
      texto.replace(/\{\{\s*horas\s*\}\}/g, String(janelaCancelamentoHoras)),
    ]),
  ) as TextosDePolitica;
}

export async function salvarPoliticas(
  entrada: TextosDePolitica,
): Promise<Resultado<TextosDePolitica>> {
  for (const politica of POLITICAS) {
    const erro = validarPolitica(politica, entrada[politica.chave]);

    if (erro) {
      return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
    }
  }

  await prisma.$transaction(
    POLITICAS.map((politica) =>
      prisma.configuracao.upsert({
        where: { chave: politica.chave },
        create: {
          chave: politica.chave,
          valor: entrada[politica.chave].trim(),
          descricao: politica.rotulo,
        },
        update: { valor: entrada[politica.chave].trim() },
      }),
    ),
  );

  return { ok: true, dados: await lerPoliticas() };
}
