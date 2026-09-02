/**
 * AUTENTICACAO DO PAINEL (Fase 7).
 *
 * O que estes testes protegem:
 *  1. /admin sem sessao manda para o login; /api/admin sem sessao devolve 401;
 *  2. senha errada nao entra, senha certa entra;
 *  3. a sessao de CLIENTE nao abre o painel — e a de ADMIN nao vale na area
 *     publica. Sao dois mundos separados, e isso precisa continuar verdade;
 *  4. forca bruta trava depois de 5 erros.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getEu } from "@/app/api/admin/eu/route";
import {
  DELETE as deleteSessaoAdmin,
  POST as postSessaoAdmin,
} from "@/app/api/admin/sessao/route";
import { GET as getMinhasReservas } from "@/app/api/publico/minhas-reservas/route";
import { middleware } from "@/middleware";
import { adminDoToken, autenticar, MAXIMO_DE_TENTATIVAS } from "@/lib/admin";
import { COOKIE_SESSAO, criarSessao, telefoneDaSessao } from "@/lib/sessao-cliente";
import { assinarToken, COOKIE_ADMIN, lerToken } from "@/lib/sessao-admin";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

const USUARIO = "teste.fase7";
const SENHA = "senha-boa-12345";
const TELEFONE = "+5511900000020";

let usuarioId: string;

// -----------------------------------------------------------------------------

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  await bancoDeTeste.tentativaLogin.deleteMany({
    where: { usuario: { in: [USUARIO, "nao.existe"] } },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  await bancoDeTeste.sessaoCliente.deleteMany({ where: { telefone: TELEFONE } });
}

beforeEach(async () => {
  await limpar();
  const criado = await bancoDeTeste.usuario.create({
    data: {
      nome: "Fulano de Teste",
      usuario: USUARIO,
      senhaHash: await bcrypt.hash(SENHA, 10),
    },
    select: { id: true },
  });
  usuarioId = criado.id;
});

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** Monta um pedido para o middleware, opcionalmente com cookies. */
function pedidoDeNavegacao(caminho: string, cookie?: string) {
  return pedidoGet(caminho, {}, cookie ? { cookie } : {});
}

async function cookieDeAdmin(id = usuarioId): Promise<string> {
  return `${COOKIE_ADMIN}=${await assinarToken(id)}`;
}

// =============================================================================
// 1. O porteiro
// =============================================================================

describe("middleware protege o painel", () => {
  it("/admin sem sessao redireciona para o login", async () => {
    const resposta = await middleware(pedidoDeNavegacao("/admin"));

    expect(resposta.status).toBe(307);
    expect(resposta.headers.get("location")).toContain("/admin/login");
  });

  it("uma pagina fundo do painel guarda para onde a pessoa queria ir", async () => {
    const resposta = await middleware(pedidoDeNavegacao("/admin/agenda/hoje"));

    const destino = new URL(resposta.headers.get("location") ?? "");
    expect(destino.pathname).toBe("/admin/login");
    expect(destino.searchParams.get("voltarPara")).toBe("/admin/agenda/hoje");
  });

  it("/api/admin sem sessao devolve 401, sem redirecionar", async () => {
    const resposta = await middleware(pedidoDeNavegacao("/api/admin/eu"));

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get("location")).toBeNull();
    await expect(resposta.json()).resolves.toMatchObject({
      codigo: "SEM_SESSAO_ADMIN",
    });
  });

  it("qualquer rota NOVA sob /api/admin ja nasce protegida", async () => {
    const resposta = await middleware(
      pedidoDeNavegacao("/api/admin/uma-rota-que-nem-existe-ainda"),
    );
    expect(resposta.status).toBe(401);
  });

  it("com sessao de admin valida, deixa passar", async () => {
    const resposta = await middleware(
      pedidoDeNavegacao("/admin", await cookieDeAdmin()),
    );

    expect(resposta.status).toBe(200);
    expect(resposta.headers.get("location")).toBeNull();
  });

  it("a tela de login e a rota de entrar ficam abertas", async () => {
    for (const caminho of ["/admin/login", "/api/admin/sessao"]) {
      const resposta = await middleware(pedidoDeNavegacao(caminho));
      expect(resposta.status, `${caminho} deveria estar aberta`).toBe(200);
    }
  });

  it("cookie de admin adulterado nao passa", async () => {
    const bom = await assinarToken(usuarioId);
    const adulterado = `${bom.slice(0, -3)}xyz`;

    const resposta = await middleware(
      pedidoDeNavegacao("/admin", `${COOKIE_ADMIN}=${adulterado}`),
    );

    expect(resposta.status).toBe(307);
  });
});

// =============================================================================
// 2. Usuario e senha
// =============================================================================

describe("login por usuario e senha", () => {
  it("senha certa autentica", async () => {
    const resultado = await autenticar({ usuario: USUARIO, senha: SENHA, ip: null });

    expect(resultado.autenticado).toBe(true);
    if (resultado.autenticado) {
      expect(resultado.usuarioId).toBe(usuarioId);
      expect(resultado.nome).toBe("Fulano de Teste");
    }
  });

  it("senha errada NAO autentica", async () => {
    const resultado = await autenticar({
      usuario: USUARIO,
      senha: "senha-errada-9999",
      ip: null,
    });

    expect(resultado.autenticado).toBe(false);
  });

  it("usuario inexistente responde igualzinho a senha errada", async () => {
    const inexistente = await autenticar({
      usuario: "nao.existe",
      senha: "qualquer-coisa",
      ip: null,
    });
    const senhaErrada = await autenticar({
      usuario: USUARIO,
      senha: "senha-errada-9999",
      ip: null,
    });

    // Mesma resposta: nao da para descobrir quais usuarios existem.
    expect(inexistente).toEqual(senhaErrada);
  });

  it("nao se importa com maiusculas no nome de usuario", async () => {
    const resultado = await autenticar({
      usuario: "  TESTE.FASE7  ",
      senha: SENHA,
      ip: null,
    });

    expect(resultado.autenticado).toBe(true);
  });

  it("a rota de login entrega o cookie do painel", async () => {
    const resposta = await postSessaoAdmin(
      pedidoPost("/api/admin/sessao", { usuario: USUARIO, senha: SENHA }),
    );

    expect(resposta.status).toBe(200);

    const cookie = resposta.cookies.get(COOKIE_ADMIN);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);

    await expect(lerToken(cookie?.value)).resolves.toMatchObject({ sub: usuarioId });
  });

  it("a rota de login recusa senha errada com 401 e sem cookie", async () => {
    const resposta = await postSessaoAdmin(
      pedidoPost("/api/admin/sessao", { usuario: USUARIO, senha: "errada-errada" }),
    );

    expect(resposta.status).toBe(401);
    expect(resposta.cookies.get(COOKIE_ADMIN)?.value).toBeFalsy();
  });

  it("sair apaga o cookie do painel", () => {
    const resposta = deleteSessaoAdmin();
    const cookie = resposta.cookies.get(COOKIE_ADMIN);

    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });

  it("usuario apagado do banco perde o acesso mesmo com o cookie no prazo", async () => {
    const token = await assinarToken(usuarioId);
    await expect(adminDoToken(token)).resolves.toMatchObject({ usuario: USUARIO });

    await bancoDeTeste.usuario.delete({ where: { id: usuarioId } });

    // O cookie continua assinado e dentro do prazo...
    await expect(lerToken(token)).resolves.toMatchObject({ sub: usuarioId });
    // ...mas a conferencia contra o banco barra.
    await expect(adminDoToken(token)).resolves.toBeNull();
  });
});

// =============================================================================
// 3. As duas sessoes nao se misturam
// =============================================================================

describe("sessao de cliente e sessao de admin sao mundos separados", () => {
  it("a sessao de CLIENTE nao abre o painel", async () => {
    const sessao = await criarSessao(TELEFONE);

    const pagina = await middleware(
      pedidoDeNavegacao("/admin", `${COOKIE_SESSAO}=${sessao.token}`),
    );
    expect(pagina.status).toBe(307);
    expect(pagina.headers.get("location")).toContain("/admin/login");

    const api = await middleware(
      pedidoDeNavegacao("/api/admin/eu", `${COOKIE_SESSAO}=${sessao.token}`),
    );
    expect(api.status).toBe(401);

    // E a rota do painel tambem recusa por conta propria.
    const eu = await getEu(
      pedidoGet("/api/admin/eu", {}, { cookie: `${COOKIE_SESSAO}=${sessao.token}` }),
    );
    expect(eu.status).toBe(401);
  });

  it("a sessao de ADMIN nao vale na area publica do cliente", async () => {
    const cookie = await cookieDeAdmin();

    // O leitor da sessao de cliente nao enxerga o cookie do painel.
    await expect(
      telefoneDaSessao(pedidoGet("/qualquer", {}, { cookie })),
    ).resolves.toBeNull();

    // E a area "Minhas reservas" continua pedindo login de cliente.
    const resposta = await getMinhasReservas(
      pedidoGet("/api/publico/minhas-reservas", {}, { cookie }),
    );
    expect(resposta.status).toBe(401);
    await expect(resposta.json()).resolves.toMatchObject({ codigo: "SEM_SESSAO" });
  });

  it("os dois cookies tem nomes diferentes", () => {
    expect(COOKIE_ADMIN).not.toBe(COOKIE_SESSAO);
  });
});

// =============================================================================
// 4. Forca bruta
// =============================================================================

describe("limite de tentativas de login", () => {
  it(`trava depois de ${MAXIMO_DE_TENTATIVAS} erros e nao aceita nem a senha certa`, async () => {
    for (let tentativa = 0; tentativa < MAXIMO_DE_TENTATIVAS; tentativa += 1) {
      const erro = await autenticar({
        usuario: USUARIO,
        senha: `errada-${tentativa}`,
        ip: "203.0.113.50",
      });
      expect(erro.autenticado).toBe(false);
    }

    const bloqueado = await autenticar({
      usuario: USUARIO,
      senha: SENHA,
      ip: "203.0.113.50",
    });

    expect(bloqueado.autenticado).toBe(false);
    if (!bloqueado.autenticado) {
      expect(bloqueado.codigo).toBe("BLOQUEADO");
    }
  });

  it("um acerto antes do limite passa normalmente", async () => {
    for (let tentativa = 0; tentativa < MAXIMO_DE_TENTATIVAS - 1; tentativa += 1) {
      await autenticar({ usuario: USUARIO, senha: "errada", ip: "203.0.113.51" });
    }

    const resultado = await autenticar({
      usuario: USUARIO,
      senha: SENHA,
      ip: "203.0.113.51",
    });

    expect(resultado.autenticado).toBe(true);
  });
});
