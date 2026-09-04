/**
 * USUARIOS DO PAINEL (Fase 11).
 *
 * O que estes testes protegem:
 *  1. so quem esta logado mexe nos acessos;
 *  2. desligar corta o acesso NA HORA, sem esperar o cookie vencer — e a
 *     pessoa continua existindo como autora do que ja criou;
 *  3. ninguem se desliga sozinho, para nao se trancar do lado de fora;
 *  4. trocar a propria senha exige a senha atual; redefinir a de outra pessoa
 *     nao exige — e exatamente o caso de quem esqueceu a dela (CLAUDE.md).
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getEu } from "@/app/api/admin/eu/route";
import { PATCH as patchMinhaSenha } from "@/app/api/admin/eu/senha/route";
import {
  GET as getUsuarios,
  POST as postUsuario,
} from "@/app/api/admin/usuarios/route";
import { PATCH as patchUsuario } from "@/app/api/admin/usuarios/[id]/route";
import { adminDoToken, autenticar } from "@/lib/admin";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { ligarOuDesligarUsuario } from "@/lib/usuarios-admin";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPatch, pedidoPost } from "./apoio/requisicao";

/** Tudo que este arquivo cria comeca assim. */
const PREFIXO = "zz.fase11";
const EU = `${PREFIXO}.eu`;
const COLEGA = `${PREFIXO}.colega`;
const SENHA = "senha-boa-12345";

let euId: string;
let colegaId: string;
let cookie: string;

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  await bancoDeTeste.tentativaLogin.deleteMany({
    where: { usuario: { startsWith: PREFIXO } },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: { startsWith: PREFIXO } } });
}

beforeEach(async () => {
  await limpar();

  const eu = await bancoDeTeste.usuario.create({
    data: { nome: "Eu Mesma", usuario: EU, senhaHash: await bcrypt.hash(SENHA, 10) },
    select: { id: true },
  });

  const colega = await bancoDeTeste.usuario.create({
    data: { nome: "Colega", usuario: COLEGA, senhaHash: await bcrypt.hash(SENHA, 10) },
    select: { id: true },
  });

  euId = eu.id;
  colegaId = colega.id;
  cookie = `${COOKIE_ADMIN}=${await assinarToken(euId)}`;
});

afterEach(limpar);

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

function contexto(id: string) {
  return { params: Promise.resolve({ id }) };
}

// -----------------------------------------------------------------------------

describe("quem pode mexer", () => {
  it("recusa listar sem sessao de admin", async () => {
    expect((await getUsuarios(pedidoGet("/api/admin/usuarios"))).status).toBe(401);
  });

  it("recusa criar acesso sem sessao de admin", async () => {
    const resposta = await postUsuario(
      pedidoPost("/api/admin/usuarios", {
        nome: "Invasor",
        usuario: `${PREFIXO}.invasor`,
        senha: SENHA,
      }),
    );

    expect(resposta.status).toBe(401);
    expect(
      await bancoDeTeste.usuario.count({ where: { usuario: `${PREFIXO}.invasor` } }),
    ).toBe(0);
  });
});

describe("lista", () => {
  it("marca qual da lista sou eu", async () => {
    const corpo = await (
      await getUsuarios(pedidoGet("/api/admin/usuarios", {}, { cookie }))
    ).json();

    const eu = corpo.usuarios.find((usuario: { id: string }) => usuario.id === euId);
    const colega = corpo.usuarios.find((usuario: { id: string }) => usuario.id === colegaId);

    expect(eu.souEu).toBe(true);
    expect(colega.souEu).toBe(false);
    // Nenhuma senha, nem embaralhada, sai daqui.
    expect(JSON.stringify(corpo)).not.toContain("senhaHash");
  });
});

describe("criar acesso", () => {
  it("cria e a pessoa ja consegue entrar", async () => {
    const resposta = await postUsuario(
      pedidoPost(
        "/api/admin/usuarios",
        { nome: "Recepção", usuario: `${PREFIXO}.recepcao`, senha: SENHA },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(201);

    const login = await autenticar({
      usuario: `${PREFIXO}.recepcao`,
      senha: SENHA,
      ip: null,
    });

    expect(login.autenticado).toBe(true);
  });

  it("recusa nome de usuario repetido", async () => {
    const resposta = await postUsuario(
      pedidoPost(
        "/api/admin/usuarios",
        { nome: "Outra", usuario: COLEGA, senha: SENHA },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(409);
  });

  it("recusa senha curta", async () => {
    const resposta = await postUsuario(
      pedidoPost(
        "/api/admin/usuarios",
        { nome: "Curta", usuario: `${PREFIXO}.curta`, senha: "1234" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("recusa nome de usuario com espaco ou acento", async () => {
    const resposta = await postUsuario(
      pedidoPost(
        "/api/admin/usuarios",
        { nome: "Espaço", usuario: "joão da recepção", senha: SENHA },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });
});

describe("desligar acesso", () => {
  it("corta o acesso na hora, sem esperar o cookie vencer", async () => {
    const cookieDaColega = `${COOKIE_ADMIN}=${await assinarToken(colegaId)}`;

    // Antes: o cookie da colega funciona.
    expect((await getEu(pedidoGet("/api/admin/eu", {}, { cookie: cookieDaColega }))).status).toBe(
      200,
    );

    const resposta = await patchUsuario(
      pedidoPatch(`/api/admin/usuarios/${colegaId}`, { ativo: false }, { cookie }),
      contexto(colegaId),
    );

    expect(resposta.status).toBe(200);

    // Depois: o MESMO cookie, ainda dentro do prazo, ja nao vale.
    expect((await getEu(pedidoGet("/api/admin/eu", {}, { cookie: cookieDaColega }))).status).toBe(
      401,
    );
    expect(await adminDoToken(await assinarToken(colegaId))).toBeNull();
  });

  it("quem foi desligado nao entra mais, e o aviso explica o porque", async () => {
    await patchUsuario(
      pedidoPatch(`/api/admin/usuarios/${colegaId}`, { ativo: false }, { cookie }),
      contexto(colegaId),
    );

    const login = await autenticar({ usuario: COLEGA, senha: SENHA, ip: null });

    expect(login.autenticado).toBe(false);
    if (!login.autenticado) {
      expect(login.codigo).toBe("DESLIGADO");
      expect(login.motivo).toMatch(/desligado/i);
    }
  });

  it("a pessoa desligada continua existindo, com o historico dela", async () => {
    await patchUsuario(
      pedidoPatch(`/api/admin/usuarios/${colegaId}`, { ativo: false }, { cookie }),
      contexto(colegaId),
    );

    const colega = await bancoDeTeste.usuario.findUnique({ where: { id: colegaId } });

    expect(colega).not.toBeNull();
    expect(colega?.ativo).toBe(false);
  });

  it("religar devolve o acesso", async () => {
    await patchUsuario(
      pedidoPatch(`/api/admin/usuarios/${colegaId}`, { ativo: false }, { cookie }),
      contexto(colegaId),
    );
    await patchUsuario(
      pedidoPatch(`/api/admin/usuarios/${colegaId}`, { ativo: true }, { cookie }),
      contexto(colegaId),
    );

    const login = await autenticar({ usuario: COLEGA, senha: SENHA, ip: null });
    expect(login.autenticado).toBe(true);
  });

  it("recusa desligar o proprio acesso", async () => {
    const resposta = await patchUsuario(
      pedidoPatch(`/api/admin/usuarios/${euId}`, { ativo: false }, { cookie }),
      contexto(euId),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/próprio acesso/i);

    const eu = await bancoDeTeste.usuario.findUniqueOrThrow({ where: { id: euId } });
    expect(eu.ativo).toBe(true);
  });

  it("recusa desligar o ultimo acesso ativo (segunda linha de defesa)", async () => {
    // Pelo painel isto nao acontece, porque quem pede sempre esta ativo e nao
    // e o alvo. A trava existe para o caso de a funcao ser chamada de outro
    // lugar um dia — entao o teste chama a funcao direto.
    await bancoDeTeste.usuario.updateMany({
      where: { id: { not: colegaId } },
      data: { ativo: false },
    });

    const resultado = await ligarOuDesligarUsuario({
      alvoId: colegaId,
      euId,
      ativo: false,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toMatch(/último acesso ativo/i);
    }

    await bancoDeTeste.usuario.updateMany({ data: { ativo: true } });
  });
});

describe("senhas", () => {
  it("troca a propria senha quando a atual confere", async () => {
    const resposta = await patchMinhaSenha(
      pedidoPatch(
        "/api/admin/eu/senha",
        { senhaAtual: SENHA, novaSenha: "outra-senha-boa-99" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(200);

    const comANova = await autenticar({
      usuario: EU,
      senha: "outra-senha-boa-99",
      ip: null,
    });
    const comAVelha = await autenticar({ usuario: EU, senha: SENHA, ip: null });

    expect(comANova.autenticado).toBe(true);
    expect(comAVelha.autenticado).toBe(false);
  });

  it("recusa trocar a propria senha com a atual errada", async () => {
    const resposta = await patchMinhaSenha(
      pedidoPatch(
        "/api/admin/eu/senha",
        { senhaAtual: "chute-errado", novaSenha: "outra-senha-boa-99" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/não confere/i);

    // A senha antiga continua valendo.
    expect((await autenticar({ usuario: EU, senha: SENHA, ip: null })).autenticado).toBe(true);
  });

  it("recusa nova senha igual a atual", async () => {
    const resposta = await patchMinhaSenha(
      pedidoPatch("/api/admin/eu/senha", { senhaAtual: SENHA, novaSenha: SENHA }, { cookie }),
    );

    expect(resposta.status).toBe(422);
  });

  it("recusa nova senha curta", async () => {
    const resposta = await patchMinhaSenha(
      pedidoPatch("/api/admin/eu/senha", { senhaAtual: SENHA, novaSenha: "123" }, { cookie }),
    );

    expect(resposta.status).toBe(422);
  });

  it("redefine a senha de outra pessoa sem pedir a senha antiga", async () => {
    const resposta = await patchUsuario(
      pedidoPatch(
        `/api/admin/usuarios/${colegaId}`,
        { novaSenha: "senha-provisoria-77" },
        { cookie },
      ),
      contexto(colegaId),
    );

    expect(resposta.status).toBe(200);

    const login = await autenticar({
      usuario: COLEGA,
      senha: "senha-provisoria-77",
      ip: null,
    });

    expect(login.autenticado).toBe(true);
  });

  it("manda usar o caminho certo para trocar a propria senha", async () => {
    const resposta = await patchUsuario(
      pedidoPatch(`/api/admin/usuarios/${euId}`, { novaSenha: "tentando-pular-99" }, { cookie }),
      contexto(euId),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toMatch(/Trocar minha senha/i);

    // A senha nao mudou.
    expect((await autenticar({ usuario: EU, senha: SENHA, ip: null })).autenticado).toBe(true);
  });
});
