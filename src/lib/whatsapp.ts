/**
 * ENVIO DE WHATSAPP pela Evolution API.
 *
 * Duas garantias deste modulo:
 *  1. Ele NUNCA lanca erro. Uma falha de WhatsApp jamais pode derrubar uma
 *     reserva que ja foi gravada.
 *  2. Tudo fica registrado em LogMensagem: enviada ou falhou, com o erro
 *     e quantas tentativas foram feitas.
 *
 * MODO SIMULADO: se EVOLUTION_URL estiver vazia, nada e enviado de verdade;
 * a mensagem aparece no terminal. E o modo de desenvolvimento.
 */
import type { ChaveTemplate } from "@/generated/prisma/enums";
import { StatusMensagem } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { apenasDigitos } from "@/lib/telefone";

/** As unicas variaveis que os textos do painel podem usar (CLAUDE.md). */
export type VariaveisMensagem = {
  nome?: string;
  sala?: string;
  data?: string;
  inicio?: string;
  fim?: string;
  valor?: string;
  codigo?: string;
};

export type ResultadoEnvio = {
  enviada: boolean;
  simulada: boolean;
  tentativas: number;
  erro: string | null;
};

const MAXIMO_DE_TENTATIVAS = 3;
/** Espera antes de cada nova tentativa: 1s, depois 3s. */
const ESPERA_ENTRE_TENTATIVAS_MS = [1_000, 3_000];
const TEMPO_LIMITE_MS = 10_000;

/** Troca {{nome}}, {{sala}}... pelos valores. */
export function renderizarTemplate(
  texto: string,
  variaveis: VariaveisMensagem,
): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (original, chave: string) => {
    const valor = variaveis[chave as keyof VariaveisMensagem];
    // Variavel desconhecida fica visivel, para a equipe perceber o erro de digitacao.
    return valor ?? original;
  });
}

/** Estamos no modo simulado (sem enviar nada de verdade)? */
export function modoSimulado(): boolean {
  return !process.env.EVOLUTION_URL?.trim();
}

/**
 * Nomes parecidos que ja apareceram escritos no .env no lugar de EVOLUTION_URL.
 *
 * Isto e uma armadilha silenciosa: com o nome errado, EVOLUTION_URL fica vazia,
 * o modo simulado continua ligado para sempre e NENHUMA mensagem sai de verdade
 * — sem erro nenhum na tela. Quem configurou jura que ligou o WhatsApp.
 */
const NOMES_PARECIDOS = [
  "EVOLUTION_API_URL",
  "EVOLUTION_BASE_URL",
  "EVOLUTION_HOST",
  "EVOLUTION_URL_API",
];

/** Algum nome parecido esta preenchido? Devolve qual, ou nulo. */
export function variavelParecidaPreenchida(
  ambiente: Record<string, string | undefined> = process.env,
): string | null {
  if (ambiente.EVOLUTION_URL?.trim()) {
    return null;
  }
  return NOMES_PARECIDOS.find((nome) => ambiente[nome]?.trim()) ?? null;
}

/** O aviso e dado uma vez por processo, para nao virar barulho. */
let avisoDeNomeJaDado = false;

function avisarSeONomeEstiverErrado(): void {
  if (avisoDeNomeJaDado) {
    return;
  }

  const parecido = variavelParecidaPreenchida();

  if (!parecido) {
    return;
  }

  avisoDeNomeJaDado = true;
  process.stdout.write(
    `\n  ATENÇÃO: o .env tem "${parecido}" preenchida, mas o sistema lê ` +
      `"EVOLUTION_URL".\n` +
      `  Enquanto os dois nomes não forem o mesmo, o modo simulado fica ligado ` +
      `e nenhuma\n  mensagem sai de verdade. Renomeie no .env quando quiser ` +
      `ligar o WhatsApp real.\n`,
  );
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function chamarEvolution(telefone: string, texto: string): Promise<void> {
  const url = process.env.EVOLUTION_URL?.trim();
  const chave = process.env.EVOLUTION_API_KEY?.trim();
  const instancia = process.env.EVOLUTION_INSTANCE?.trim();

  if (!url || !chave || !instancia) {
    throw new Error(
      "Evolution API mal configurada: preencha EVOLUTION_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE.",
    );
  }

  const controle = new AbortController();
  const relogio = setTimeout(() => {
    controle.abort();
  }, TEMPO_LIMITE_MS);

  try {
    const resposta = await fetch(
      `${url.replace(/\/+$/, "")}/message/sendText/${encodeURIComponent(instancia)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: chave },
        body: JSON.stringify({ number: apenasDigitos(telefone), text: texto }),
        signal: controle.signal,
      },
    );

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => "");
      throw new Error(`Evolution respondeu ${resposta.status}: ${corpo.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(relogio);
  }
}

function imprimirNoTerminal(
  chave: ChaveTemplate,
  telefone: string,
  texto: string,
): void {
  // Durante os testes nao imprime: dezenas de blocos grandes na saida
  // padrao, interceptados pelo Vitest, chegam a travar a suite.
  if (process.env.VITEST) {
    return;
  }

  avisarSeONomeEstiverErrado();

  const moldura = "─".repeat(64);
  process.stdout.write(
    `\n┌${moldura}┐\n` +
      `  WHATSAPP (MODO SIMULADO — nada foi enviado de verdade)\n` +
      `  Para: ${telefone}\n` +
      `  Modelo: ${chave}\n` +
      `└${moldura}┘\n` +
      `${texto}\n` +
      `${"─".repeat(66)}\n\n`,
  );
}

/**
 * Envia uma mensagem usando o texto cadastrado no painel.
 * Nunca lanca erro: devolve o que aconteceu e registra em LogMensagem.
 */
export async function enviarMensagem(entrada: {
  chave: ChaveTemplate;
  telefone: string;
  variaveis: VariaveisMensagem;
  reservaId?: string | null;
}): Promise<ResultadoEnvio> {
  let tentativas = 0;
  let ultimoErro: string | null = null;
  let simulada = false;

  try {
    const template = await prisma.templateMensagem.findUnique({
      where: { chave: entrada.chave },
    });

    if (!template) {
      throw new Error(
        `Modelo de mensagem "${entrada.chave}" nao existe. Rode "npm run db:seed".`,
      );
    }

    const texto = renderizarTemplate(template.texto, entrada.variaveis);

    if (modoSimulado()) {
      simulada = true;
      tentativas = 1;
      imprimirNoTerminal(entrada.chave, entrada.telefone, texto);
    } else {
      for (let numero = 1; numero <= MAXIMO_DE_TENTATIVAS; numero += 1) {
        tentativas = numero;
        try {
          await chamarEvolution(entrada.telefone, texto);
          ultimoErro = null;
          break;
        } catch (erro: unknown) {
          ultimoErro = erro instanceof Error ? erro.message : String(erro);
          const espera = ESPERA_ENTRE_TENTATIVAS_MS[numero - 1];
          if (numero < MAXIMO_DE_TENTATIVAS && espera !== undefined) {
            await esperar(espera);
          }
        }
      }
    }
  } catch (erro: unknown) {
    ultimoErro = erro instanceof Error ? erro.message : String(erro);
    tentativas = Math.max(tentativas, 1);
  }

  const enviada = ultimoErro === null;

  // O registro tambem nao pode derrubar nada.
  try {
    await prisma.logMensagem.create({
      data: {
        reservaId: entrada.reservaId ?? null,
        telefone: entrada.telefone,
        tipo: entrada.chave,
        status: enviada ? StatusMensagem.ENVIADA : StatusMensagem.FALHOU,
        erro: ultimoErro,
        tentativas,
      },
    });
  } catch {
    // Silencio proposital: sem registro, mas a operacao principal segue.
  }

  return { enviada, simulada, tentativas, erro: ultimoErro };
}

/** Envios ainda no ar, disparados sem espera. */
const enviosEmAndamento = new Set<Promise<ResultadoEnvio>>();

/**
 * Dispara a mensagem sem esperar a resposta.
 * Use quando a operacao principal ja terminou (ex.: reserva ja gravada):
 * o cliente recebe a confirmacao na tela na hora, e o WhatsApp sai atras.
 */
export function dispararMensagem(entrada: {
  chave: ChaveTemplate;
  telefone: string;
  variaveis: VariaveisMensagem;
  reservaId?: string | null;
}): void {
  const envio = enviarMensagem(entrada);
  enviosEmAndamento.add(envio);
  void envio.finally(() => {
    enviosEmAndamento.delete(envio);
  });
}

/**
 * Espera terminarem os envios disparados sem espera.
 *
 * Serve aos testes (que precisam de resultado previsivel) e ao desligamento
 * ordenado do servidor, para nao cortar uma mensagem no meio.
 */
export async function aguardarEnviosPendentes(): Promise<void> {
  while (enviosEmAndamento.size > 0) {
    await Promise.allSettled([...enviosEmAndamento]);
  }
}
