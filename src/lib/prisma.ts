import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Em desenvolvimento o Next recarrega o codigo a cada alteracao.
// Sem este cache, cada recarga abriria uma nova conexao com o banco
// ate estourar o limite. Em producao o processo e unico e isso nao acontece.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function criarClientePrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL nao configurada. Copie .env.example para .env e preencha.",
    );
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? criarClientePrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
