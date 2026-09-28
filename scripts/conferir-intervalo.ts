/**
 * CONFERE se o intervalo entre reservas ficou mesmo em zero apos a publicacao.
 *
 * Uso (no terminal do servico "sistema", depois do deploy):
 *   npm run conferir-intervalo
 *
 * SO LE. Nao grava, nao apaga e nao altera nenhuma reserva — pode rodar em
 * producao a qualquer hora, quantas vezes quiser.
 *
 * O item 3 e o que realmente importa. O periodo "esticado" de cada reserva e
 * calculado pelo banco NA HORA DE GRAVAR e fica congelado na linha. Se a
 * migracao nao tivesse recalculado as reservas ja marcadas, elas continuariam
 * carregando a folga antiga de 30 min — e a mudanca valeria so para reserva
 * nova, deixando duas regras na mesma agenda.
 *
 * Quando o esticado e igual ao periodo normal em TODAS as reservas, a trava de
 * intervalo passa a ser uma copia da trava de sobreposicao: reserva colada
 * entra, reserva por cima nao. E a prova sem precisar gravar nada.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const conexao = process.env.DATABASE_URL;

if (!conexao) {
  throw new Error("DATABASE_URL nao configurada. Confira as variaveis do servico.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

type Linha = Record<string, unknown>;

function mostrar(numero: number, rotulo: string, valor: string, certo: boolean): boolean {
  const pontos = ".".repeat(Math.max(3, 42 - rotulo.length));
  console.log(`${numero}. ${rotulo} ${pontos} ${valor.padEnd(14)} ${certo ? "OK" : "PROBLEMA"}`);
  return certo;
}

async function main(): Promise<void> {
  console.log("\nCONFERENCIA DO INTERVALO ENTRE RESERVAS\n");

  const [config] = await prisma.$queryRawUnsafe<Linha[]>(
    "SELECT valor FROM configuracoes WHERE chave = 'intervaloMinutos'",
  );
  const [funcao] = await prisma.$queryRawUnsafe<Linha[]>(
    "SELECT intervalo_entre_reservas()::text AS folga",
  );
  const [reservas] = await prisma.$queryRawUnsafe<Linha[]>(
    `SELECT count(*) FILTER (WHERE periodo_com_intervalo <> periodo) AS com_folga_antiga,
            count(*)                                                AS total
       FROM ocupacao_salas WHERE tipo = 'RESERVA'`,
  );
  const travas = await prisma.$queryRawUnsafe<Linha[]>(
    `SELECT conname FROM pg_constraint
      WHERE conname IN ('ocupacao_sem_sobreposicao', 'ocupacao_intervalo_entre_reservas')`,
  );

  const nomes = travas.map((t) => String(t.conname));
  const antigas = Number(reservas?.com_folga_antiga ?? -1);
  const total = Number(reservas?.total ?? 0);

  const tudoCerto = [
    mostrar(1, "Parametro no banco", `${config?.valor ?? "?"} min`, String(config?.valor) === "0"),
    mostrar(2, "Folga que a trava usa", String(funcao?.folga ?? "?"), String(funcao?.folga) === "00:00:00"),
    mostrar(3, "Reservas com a folga antiga", `${antigas} de ${total}`, antigas === 0),
    mostrar(4, "Trava de SOBREPOSICAO", "presente", nomes.includes("ocupacao_sem_sobreposicao")),
    mostrar(5, "Trava de intervalo", "presente", nomes.includes("ocupacao_intervalo_entre_reservas")),
  ].every(Boolean);

  console.log(
    tudoCerto
      ? "\nTUDO CERTO. Reserva colada e permitida e sobreposicao continua barrada pelo banco.\n"
      : "\nALGO NAO CONFERE. Nao mexa no banco: mostre esta tela para quem cuida do sistema.\n",
  );

  process.exitCode = tudoCerto ? 0 : 1;
}

main()
  .catch((erro: unknown) => {
    console.log(`\n  ${erro instanceof Error ? erro.message : String(erro)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
