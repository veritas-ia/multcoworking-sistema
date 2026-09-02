/**
 * SESSAO DO CLIENTE
 *
 * O cliente prova o telefone uma vez por WhatsApp e recebe um cookie que
 * vale 30 dias. O cookie serve para VER as proprias reservas e para RESERVAR.
 * Para CANCELAR ou REAGENDAR o CLAUDE.md exige codigo novo — isso e a Fase 6.
 *
 * O valor do cookie e sorteado ao acaso e so existe no navegador do cliente.
 * O banco guarda apenas o embaralhado (SHA-256), como um cadeado sem copia
 * da chave.
 */
import { createHash, randomBytes } from "node:crypto";

import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const COOKIE_SESSAO = "sessao_cliente";
export const DIAS_DE_VALIDADE = 30;

const SEGUNDOS_DE_VALIDADE = DIAS_DE_VALIDADE * 24 * 60 * 60;

export function embaralhar(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export type SessaoCriada = {
  /** Valor que vai no cookie. So aparece aqui, uma unica vez. */
  token: string;
  expiraEm: Date;
};

/** Cria a sessao e devolve o valor que deve ir para o cookie. */
export async function criarSessao(telefone: string): Promise<SessaoCriada> {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + SEGUNDOS_DE_VALIDADE * 1_000);

  await prisma.sessaoCliente.create({
    data: { telefone, tokenHash: embaralhar(token), expiraEm },
  });

  return { token, expiraEm };
}

/**
 * Descobre o telefone ja verificado a partir do cookie.
 * Devolve null quando nao ha cookie, quando ele nao existe no banco
 * ou quando ja venceu.
 */
export async function telefoneDaSessao(
  requisicao: NextRequest,
): Promise<string | null> {
  const token = requisicao.cookies.get(COOKIE_SESSAO)?.value;

  if (!token) {
    return null;
  }

  const sessao = await prisma.sessaoCliente.findUnique({
    where: { tokenHash: embaralhar(token) },
    select: { telefone: true, expiraEm: true },
  });

  if (!sessao || sessao.expiraEm <= new Date()) {
    return null;
  }

  return sessao.telefone;
}

/** Opcoes do cookie httpOnly. */
export function opcoesDoCookie(expiraEm: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiraEm,
    maxAge: SEGUNDOS_DE_VALIDADE,
  };
}
