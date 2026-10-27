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

/**
 * O identificador de uma area de atuacao, pelo nome interno dela.
 *
 * As profissoes deixaram de ser um tipo fixo do banco em 27/10/2026 e viraram
 * tabela, para a equipe editar a lista no painel. Os testes guardavam o texto
 * ("OUTROS", "MARKETING"); agora precisam do identificador da linha.
 *
 * O resultado fica guardado em memoria porque os nomes internos nunca mudam —
 * sem isso cada reserva de teste faria uma consulta a mais.
 */
const idsDeProfissao = new Map<string, string>();

export async function idDaProfissao(slug = "OUTROS"): Promise<string> {
  const guardado = idsDeProfissao.get(slug);

  if (guardado) {
    return guardado;
  }

  const profissao = await bancoDeTeste.profissao.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });

  idsDeProfissao.set(slug, profissao.id);
  return profissao.id;
}
