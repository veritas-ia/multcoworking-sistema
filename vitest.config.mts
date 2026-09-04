import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Faz o "@/..." dos imports funcionar tambem nos testes.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Estes testes falam com um Postgres de verdade dentro do Docker.
    // Os 5s padrao do Vitest sao curtos para a primeira conexao.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    env: {
      // Todo teste roda no fuso de Sao Paulo, igual a producao.
      TZ: "America/Sao_Paulo",

      // BANCO SEPARADO PARA OS TESTES.
      //
      // Antes a suite usava o mesmo banco do "npm run dev". Bastava a equipe
      // criar uma reserva na tela para os testes comecarem a falhar por
      // sobreposicao de horario — e o contrario tambem: um teste podia apagar
      // dado de quem estava conferindo o sistema.
      //
      // O banco de teste vive no mesmo Postgres, com outro nome. Para
      // (re)criar: npm run db:teste
      DATABASE_URL:
        process.env.DATABASE_URL_TESTE ??
        "postgresql://coworking:coworking_dev@localhost:5434/coworking_teste?schema=public",
    },
    // Os testes de banco compartilham as mesmas salas: rodar um de cada vez.
    fileParallelism: false,
  },
});
