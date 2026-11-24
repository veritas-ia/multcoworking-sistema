/**
 * Cria um admin temporario no banco usado para tirar os prints do PDF.
 *
 * NAO toca em producao nem na previa: ele roda contra o DATABASE_URL que a
 * chamada passa, que e uma copia local.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

async function principal(): Promise<void> {
  const adaptador = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: adaptador });

  const senhaHash = await bcrypt.hash("prints-para-o-pdf-2026", 12);

  await prisma.usuario.upsert({
    where: { usuario: "prints" },
    create: { nome: "Equipe Mult", usuario: "prints", senhaHash, acessoFinanceiro: true },
    update: { senhaHash, ativo: true, acessoFinanceiro: true },
  });

  process.stdout.write("admin dos prints pronto\n");
  await prisma.$disconnect();
}

void principal();
