/**
 * ROTA DE SAUDE (Fase 13).
 *
 * O que estes testes protegem:
 *  1. a rota responde "ok" quando o banco responde. E dela que o EasyPanel
 *     depende para saber se reinicia o container;
 *  2. quando o banco cai, ela devolve ERRO — e nao "ok". Um site que responde
 *     a pagina mas perdeu o banco esta quebrado para o cliente, e sem esta
 *     conferencia o painel do servidor diria "tudo certo" o tempo todo;
 *  3. a resposta nao conta nada sobre o sistema por dentro.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getSaude } from "@/app/api/saude/route";
import { prisma } from "@/lib/prisma";

afterEach(() => {
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------

describe("com o banco no ar", () => {
  it("responde ok", async () => {
    const resposta = await getSaude();

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ estado: "ok", banco: "ok" });
  });
});

describe("com o banco fora do ar", () => {
  it("devolve erro, e nao ok", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(
      new Error("conexao recusada"),
    );

    const resposta = await getSaude();

    expect(resposta.status).toBe(503);
    expect((await resposta.json()).estado).toBe("erro");
  });

  it("nao repassa a mensagem de erro do banco", async () => {
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(
      new Error("senha do usuario coworking incorreta em 10.0.0.5:5432"),
    );

    const corpo = JSON.stringify(await (await getSaude()).json());

    // Endereco publico nao e lugar de dar pista para quem procura alvo.
    expect(corpo).not.toContain("senha");
    expect(corpo).not.toContain("10.0.0.5");
  });
});
