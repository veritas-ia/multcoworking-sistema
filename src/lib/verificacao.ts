/**
 * VERIFICACAO DO TELEFONE POR CODIGO DE 6 DIGITOS
 *
 * Numeros vindos do CLAUDE.md ("Decisoes confirmadas"):
 *  - codigo vale 10 minutos, uso unico, no maximo 5 tentativas
 *  - envio: 1 por minuto e 5 por hora por numero; 20 por hora por IP
 *  - depois de 5 erros, o codigo morre e o numero fica 15 minutos parado
 *
 * O codigo nunca e guardado em texto puro, so embaralhado com bcrypt.
 */
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { enviarMensagem } from "@/lib/whatsapp";

export const MINUTOS_DE_VALIDADE = 10;
export const MAXIMO_DE_TENTATIVAS = 5;
export const MINUTOS_DE_BLOQUEIO = 15;

export const LIMITE_POR_MINUTO_POR_NUMERO = 1;
export const LIMITE_POR_HORA_POR_NUMERO = 5;
export const LIMITE_POR_HORA_POR_IP = 20;

export type MotivoRecusaEnvio =
  | "MUITO_RAPIDO"
  | "LIMITE_DO_NUMERO"
  | "LIMITE_DO_IP"
  | "NUMERO_BLOQUEADO";

export type ResultadoEnvioCodigo =
  | { permitido: true }
  | { permitido: false; codigo: MotivoRecusaEnvio; motivo: string };

export type MotivoRecusaConfirmacao =
  | "CODIGO_INVALIDO"
  | "NUMERO_BLOQUEADO";

export type ResultadoConfirmacao =
  | { confirmado: true }
  | { confirmado: false; codigo: MotivoRecusaConfirmacao; motivo: string };

function minutosAtras(minutos: number): Date {
  return new Date(Date.now() - minutos * 60_000);
}

/** O numero esta de castigo por ter errado 5 vezes? */
async function numeroBloqueado(telefone: string): Promise<boolean> {
  const castigo = await prisma.codigoVerificacao.count({
    where: {
      telefone,
      tentativas: { gte: MAXIMO_DE_TENTATIVAS },
      criadoEm: { gt: minutosAtras(MINUTOS_DE_BLOQUEIO) },
    },
  });
  return castigo > 0;
}

/** Confere os limites de envio antes de gastar uma mensagem. */
export async function podeEnviarCodigo(
  telefone: string,
  ip: string | null,
): Promise<ResultadoEnvioCodigo> {
  if (await numeroBloqueado(telefone)) {
    return {
      permitido: false,
      codigo: "NUMERO_BLOQUEADO",
      motivo: `Muitas tentativas erradas. Aguarde ${MINUTOS_DE_BLOQUEIO} minutos e tente de novo.`,
    };
  }

  const noUltimoMinuto = await prisma.codigoVerificacao.count({
    where: { telefone, criadoEm: { gt: minutosAtras(1) } },
  });

  if (noUltimoMinuto >= LIMITE_POR_MINUTO_POR_NUMERO) {
    return {
      permitido: false,
      codigo: "MUITO_RAPIDO",
      motivo: "Acabamos de enviar um código. Aguarde um minuto para pedir outro.",
    };
  }

  const naUltimaHora = await prisma.codigoVerificacao.count({
    where: { telefone, criadoEm: { gt: minutosAtras(60) } },
  });

  if (naUltimaHora >= LIMITE_POR_HORA_POR_NUMERO) {
    return {
      permitido: false,
      codigo: "LIMITE_DO_NUMERO",
      motivo: "Você pediu muitos códigos para este número. Tente novamente em uma hora.",
    };
  }

  if (ip) {
    const doMesmoIp = await prisma.codigoVerificacao.count({
      where: { ip, criadoEm: { gt: minutosAtras(60) } },
    });

    if (doMesmoIp >= LIMITE_POR_HORA_POR_IP) {
      return {
        permitido: false,
        codigo: "LIMITE_DO_IP",
        motivo: "Muitos pedidos de código a partir desta conexão. Tente novamente em uma hora.",
      };
    }
  }

  return { permitido: true };
}

/**
 * Sorteia o codigo, guarda o embaralhado e manda pelo WhatsApp.
 * O envio nunca derruba a operacao: se falhar, fica registrado em LogMensagem.
 */
export async function gerarEEnviarCodigo(
  telefone: string,
  ip: string | null,
): Promise<void> {
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await prisma.codigoVerificacao.create({
    data: {
      telefone,
      codigoHash: await bcrypt.hash(codigo, 10),
      expiraEm: new Date(Date.now() + MINUTOS_DE_VALIDADE * 60_000),
      ip,
    },
  });

  await enviarMensagem({
    chave: ChaveTemplate.codigo_verificacao,
    telefone,
    variaveis: { codigo },
  });
}

/**
 * Confere o codigo digitado.
 *
 * Cada erro soma uma tentativa. Na quinta, o codigo morre na hora e o
 * numero fica 15 minutos sem poder pedir outro.
 */
export async function confirmarCodigo(
  telefone: string,
  codigoDigitado: string,
): Promise<ResultadoConfirmacao> {
  if (await numeroBloqueado(telefone)) {
    return {
      confirmado: false,
      codigo: "NUMERO_BLOQUEADO",
      motivo: `Muitas tentativas erradas. Aguarde ${MINUTOS_DE_BLOQUEIO} minutos e tente de novo.`,
    };
  }

  const agora = new Date();

  const registro = await prisma.codigoVerificacao.findFirst({
    where: {
      telefone,
      usadoEm: null,
      expiraEm: { gt: agora },
      tentativas: { lt: MAXIMO_DE_TENTATIVAS },
    },
    orderBy: { criadoEm: "desc" },
  });

  const recusa: ResultadoConfirmacao = {
    confirmado: false,
    codigo: "CODIGO_INVALIDO",
    motivo: "Código inválido ou expirado.",
  };

  if (!registro) {
    return recusa;
  }

  const correto = await bcrypt.compare(codigoDigitado, registro.codigoHash);

  if (!correto) {
    const tentativas = registro.tentativas + 1;
    const estourou = tentativas >= MAXIMO_DE_TENTATIVAS;

    await prisma.codigoVerificacao.update({
      where: { id: registro.id },
      // Na quinta tentativa o codigo morre: vence na hora.
      data: { tentativas, ...(estourou ? { expiraEm: agora } : {}) },
    });

    return estourou
      ? {
          confirmado: false,
          codigo: "NUMERO_BLOQUEADO",
          motivo: `Muitas tentativas erradas. Aguarde ${MINUTOS_DE_BLOQUEIO} minutos e tente de novo.`,
        }
      : recusa;
  }

  // Uso unico: o codigo certo vale uma vez so.
  await prisma.codigoVerificacao.update({
    where: { id: registro.id },
    data: { usadoEm: agora },
  });

  return { confirmado: true };
}
