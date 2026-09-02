import { describe, expect, it } from "vitest";

// Teste de fumaca da Fase 1: garante que o Vitest roda e que o fuso
// horario dos testes e o mesmo de producao (America/Sao_Paulo).
describe("ambiente de testes", () => {
  it("roda o Vitest", () => {
    expect(1 + 1).toBe(2);
  });

  it("usa o fuso America/Sao_Paulo", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      "America/Sao_Paulo",
    );
  });
});
