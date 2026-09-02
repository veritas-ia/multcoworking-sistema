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
    // Todo teste roda no fuso de Sao Paulo, igual a producao.
    env: {
      TZ: "America/Sao_Paulo",
    },
    // Os testes de banco compartilham as mesmas salas: rodar um de cada vez.
    fileParallelism: false,
  },
});
