/**
 * MODELOS DE MENSAGEM DO WHATSAPP (Fase 11).
 *
 * Sao os sete textos que o cliente recebe. A equipe edita no painel; o sistema
 * troca as variaveis na hora de enviar.
 *
 * A LISTA DE VARIAVEIS E POR MENSAGEM, e nao uma lista geral.
 *
 * O motivo e concreto: quem envia cada mensagem preenche um conjunto
 * diferente. A confirmacao sabe a data; o lembrete sabe o link da area
 * "Minhas reservas"; a mensagem de serie sabe quantas datas entraram. Se o
 * texto usar uma variavel que aquele envio nao preenche, o cliente recebe
 * "{{link}}" escrito no meio da frase — e ninguem do coworking ve isso antes
 * dele. Por isso a conferencia acontece na hora de SALVAR, e nao na hora de
 * enviar.
 *
 * As listas aqui espelham exatamente o que cada ponto de envio preenche
 * (ver as chamadas de dispararMensagem/enviarMensagem).
 */
import { ChaveTemplate } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { renderizarTemplate } from "@/lib/whatsapp";

export type DefinicaoDeTemplate = {
  chave: ChaveTemplate;
  /** Nome amigavel, para a equipe achar o texto certo. */
  rotulo: string;
  /** Variaveis que ESTA mensagem aceita. */
  variaveis: readonly string[];
};

/** Tamanho maximo de um modelo. Mensagem gigante no WhatsApp ninguem le. */
export const MAXIMO_DE_CARACTERES = 1_000;

export const TEMPLATES: readonly DefinicaoDeTemplate[] = [
  {
    chave: ChaveTemplate.codigo_verificacao,
    rotulo: "Código de verificação",
    variaveis: ["codigo"],
  },
  {
    chave: ChaveTemplate.reserva_confirmada,
    rotulo: "Reserva confirmada",
    variaveis: ["nome", "sala", "data", "inicio", "fim", "valor"],
  },
  {
    chave: ChaveTemplate.serie_confirmada,
    rotulo: "Série confirmada",
    variaveis: ["nome", "sala", "dias", "inicio", "fim", "periodo", "quantidade"],
  },
  {
    chave: ChaveTemplate.reserva_cancelada,
    rotulo: "Reserva cancelada",
    variaveis: ["nome", "sala", "data", "inicio", "fim"],
  },
  {
    chave: ChaveTemplate.reserva_reagendada,
    rotulo: "Reserva remarcada",
    variaveis: ["nome", "sala", "data", "inicio", "fim", "valor"],
  },
  {
    chave: ChaveTemplate.lembrete_13h,
    rotulo: "Lembrete de 13 horas antes",
    variaveis: ["nome", "sala", "data", "inicio", "fim", "link"],
  },
  {
    chave: ChaveTemplate.lembrete_3h,
    rotulo: "Lembrete de 3 horas antes",
    variaveis: ["nome", "sala", "data", "inicio", "fim", "link"],
  },
] as const;

/** Valores de mentira, so para a equipe ver como a mensagem vai ficar. */
const EXEMPLO: Record<string, string> = {
  nome: "Maria",
  sala: "Sala de Reunião",
  data: "2026-09-15",
  inicio: "09:00",
  fim: "11:00",
  valor: "R$ 160,00",
  codigo: "482913",
  dias: "terça e quarta",
  periodo: "15/09 a 30/11",
  quantidade: "17",
  link: "https://coworking.exemplo/minhas-reservas",
};

export type TemplateNaTela = {
  chave: ChaveTemplate;
  rotulo: string;
  descricao: string;
  texto: string;
  variaveis: string[];
  /** O mesmo texto com as variaveis trocadas por valores de exemplo. */
  previa: string;
};

export type FalhaDeTemplate = { codigo: "REGRA" | "NAO_ENCONTRADO"; motivo: string };

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeTemplate };

function definicaoDe(chave: ChaveTemplate): DefinicaoDeTemplate | undefined {
  return TEMPLATES.find((template) => template.chave === chave);
}

/** Prévia com valores de exemplo, para conferir antes de salvar. */
export function previaDe(texto: string): string {
  return renderizarTemplate(texto, EXEMPLO);
}

/**
 * Toda ocorrencia de {{alguma-coisa}}, exatamente como foi escrita.
 *
 * Sai com as chaves porque a forma importa: quem troca as variaveis no envio
 * so reconhece {{nome}} coladinho. "{{ nome }}", com espacos, passaria por
 * uma conferencia distraida e chegaria escrito assim no WhatsApp do cliente.
 */
function variaveisUsadas(texto: string): string[] {
  return texto.match(/\{\{[^{}]*\}\}/g) ?? [];
}

export function validarTemplate(
  definicao: DefinicaoDeTemplate,
  texto: string,
): string | null {
  const limpo = texto.trim();

  if (limpo === "") {
    return "A mensagem não pode ficar vazia.";
  }

  if (limpo.length > MAXIMO_DE_CARACTERES) {
    return `A mensagem passou de ${MAXIMO_DE_CARACTERES} caracteres.`;
  }

  const permitidas = definicao.variaveis.map((variavel) => `{{${variavel}}}`);

  for (const usada of variaveisUsadas(limpo)) {
    if (permitidas.includes(usada)) {
      continue;
    }

    const semEspacos = usada.replace(/\s/g, "");

    if (permitidas.includes(semEspacos)) {
      return `Escreva ${semEspacos} sem espaços dentro das chaves — do jeito que está, o cliente receberia "${usada}" escrito na mensagem.`;
    }

    return `A variável ${usada} não existe nesta mensagem. Aqui valem: ${permitidas.join(", ")}.`;
  }

  return null;
}

export async function listarTemplates(): Promise<TemplateNaTela[]> {
  const linhas = await prisma.templateMensagem.findMany();
  const guardados = new Map(linhas.map((linha) => [linha.chave, linha]));

  return TEMPLATES.map((definicao) => {
    const linha = guardados.get(definicao.chave);

    if (!linha) {
      throw new Error(
        `O modelo "${definicao.chave}" nao existe no banco. Rode "npm run db:seed".`,
      );
    }

    return {
      chave: definicao.chave,
      rotulo: definicao.rotulo,
      descricao: linha.descricao,
      texto: linha.texto,
      variaveis: [...definicao.variaveis],
      previa: previaDe(linha.texto),
    };
  });
}

export async function salvarTemplate(
  chave: string,
  texto: string,
): Promise<Resultado<TemplateNaTela>> {
  const definicao = definicaoDe(chave as ChaveTemplate);

  if (!definicao) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Mensagem não encontrada." } };
  }

  const erro = validarTemplate(definicao, texto);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  await prisma.templateMensagem.update({
    where: { chave: definicao.chave },
    data: { texto: texto.trim() },
  });

  const lista = await listarTemplates();
  const atualizado = lista.find((template) => template.chave === definicao.chave);

  return atualizado
    ? { ok: true, dados: atualizado }
    : { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Mensagem não encontrada." } };
}
