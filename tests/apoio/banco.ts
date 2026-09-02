import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL nao configurada. Copie .env.example para .env antes de rodar os testes.",
  );
}

export const bancoDeTeste = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Um instante fixo, para os testes nao dependerem do relogio. */
export function emUtc(texto: string): Date {
  return new Date(texto);
}

/** Soma minutos a um instante. */
export function maisMinutos(base: Date, minutos: number): Date {
  return new Date(base.getTime() + minutos * 60_000);
}

/**
 * Abre a conexao antes dos testes comecarem.
 *
 * Sem isto, o PRIMEIRO teste do arquivo paga o custo de abrir a conexao com
 * o Postgres do Docker e, de vez em quando, estoura o limite de tempo —
 * uma falha que nao tem nada a ver com a regra sendo testada.
 */
export async function aquecerConexao(): Promise<void> {
  await bancoDeTeste.$queryRaw`SELECT 1`;
}
