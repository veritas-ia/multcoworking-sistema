/**
 * USUARIOS DO PAINEL (Fase 11).
 *
 * Um unico nivel de acesso (CLAUDE.md): quem entra no painel e admin e pode
 * tudo — inclusive criar outras contas, redefinir a senha de uma colega e
 * desligar alguem. Numa equipe pequena e conhecida isso e o combinado; nao
 * existe "meio admin" neste sistema.
 *
 * Tres travas que evitam a equipe se trancar do lado de fora:
 *
 *   1. ninguem se desliga sozinho — o clique errado tiraria a pessoa do
 *      painel no meio do trabalho, sem ninguem por perto para ligar de volta;
 *   2. o ultimo admin ativo nao pode ser desligado. Na pratica a trava 1 ja
      garante isso pelo painel (quem pede sempre esta ativo e nao e o alvo);
      esta fica como segunda linha de defesa, para o caso de alguem chamar
      esta funcao de outro lugar um dia;
 *   3. trocar a PROPRIA senha exige digitar a senha atual. Um computador
 *      esquecido aberto no balcao nao vira uma conta roubada.
 *
 * Redefinir a senha de OUTRA pessoa nao pede a senha antiga, e esse e o
 * ponto: e exatamente o caso de quem esqueceu a senha (CLAUDE.md, "a troca e
 * feita por outro admin").
 */
import bcrypt from "bcryptjs";

import { CUSTO_DO_HASH, MINIMO_DA_SENHA, criarUsuarioAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export type UsuarioDoPainel = {
  id: string;
  nome: string;
  usuario: string;
  ativo: boolean;
  criadoEm: string;
  /** Este e o proprio operador que esta olhando a tela? */
  souEu: boolean;
};

export type FalhaDeUsuario = {
  codigo: "REGRA" | "NAO_ENCONTRADO" | "SENHA_ATUAL_ERRADA" | "NOME_REPETIDO";
  motivo: string;
};

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeUsuario };

export async function listarUsuarios(euId: string): Promise<UsuarioDoPainel[]> {
  const linhas = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: { id: true, nome: true, usuario: true, ativo: true, criadoEm: true },
  });

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    usuario: linha.usuario,
    ativo: linha.ativo,
    criadoEm: linha.criadoEm.toISOString(),
    souEu: linha.id === euId,
  }));
}

export async function criarUsuario(
  entrada: { nome: string; usuario: string; senha: string },
  euId: string,
): Promise<Resultado<UsuarioDoPainel>> {
  const criado = await criarUsuarioAdmin(entrada);

  if (!criado.criado) {
    return {
      ok: false,
      falha: {
        codigo: criado.motivo.startsWith("Já existe") ? "NOME_REPETIDO" : "REGRA",
        motivo: criado.motivo,
      },
    };
  }

  const lista = await listarUsuarios(euId);
  const novo = lista.find((usuario) => usuario.id === criado.id);

  return novo
    ? { ok: true, dados: novo }
    : { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Usuário não encontrado." } };
}

function senhaCurta(senha: string): string | null {
  return senha.length < MINIMO_DA_SENHA
    ? `A senha precisa ter pelo menos ${MINIMO_DA_SENHA} caracteres.`
    : null;
}

/** Troca a senha de quem esta logado. Exige a senha atual. */
export async function trocarPropriaSenha(entrada: {
  euId: string;
  senhaAtual: string;
  novaSenha: string;
}): Promise<Resultado<{ trocada: true }>> {
  const erro = senhaCurta(entrada.novaSenha);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  const eu = await prisma.usuario.findUnique({
    where: { id: entrada.euId },
    select: { senhaHash: true },
  });

  if (!eu) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Usuário não encontrado." } };
  }

  if (!(await bcrypt.compare(entrada.senhaAtual, eu.senhaHash))) {
    return {
      ok: false,
      falha: { codigo: "SENHA_ATUAL_ERRADA", motivo: "A senha atual não confere." },
    };
  }

  if (entrada.novaSenha === entrada.senhaAtual) {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "A nova senha precisa ser diferente da atual." },
    };
  }

  await prisma.usuario.update({
    where: { id: entrada.euId },
    data: { senhaHash: await bcrypt.hash(entrada.novaSenha, CUSTO_DO_HASH) },
  });

  return { ok: true, dados: { trocada: true } };
}

/** Define uma senha nova para OUTRA pessoa — o caso de quem esqueceu a dela. */
export async function redefinirSenha(entrada: {
  alvoId: string;
  euId: string;
  novaSenha: string;
}): Promise<Resultado<{ trocada: true }>> {
  if (entrada.alvoId === entrada.euId) {
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: 'Para mudar a sua própria senha, use "Trocar minha senha" — lá a senha atual é pedida.',
      },
    };
  }

  const erro = senhaCurta(entrada.novaSenha);

  if (erro) {
    return { ok: false, falha: { codigo: "REGRA", motivo: erro } };
  }

  const alvo = await prisma.usuario.findUnique({
    where: { id: entrada.alvoId },
    select: { id: true },
  });

  if (!alvo) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Usuário não encontrado." } };
  }

  await prisma.usuario.update({
    where: { id: entrada.alvoId },
    data: { senhaHash: await bcrypt.hash(entrada.novaSenha, CUSTO_DO_HASH) },
  });

  return { ok: true, dados: { trocada: true } };
}

export async function ligarOuDesligarUsuario(entrada: {
  alvoId: string;
  euId: string;
  ativo: boolean;
}): Promise<Resultado<UsuarioDoPainel>> {
  const alvo = await prisma.usuario.findUnique({
    where: { id: entrada.alvoId },
    select: { id: true, ativo: true },
  });

  if (!alvo) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Usuário não encontrado." } };
  }

  if (!entrada.ativo) {
    if (entrada.alvoId === entrada.euId) {
      return {
        ok: false,
        falha: {
          codigo: "REGRA",
          motivo: "Você não pode desligar o seu próprio acesso. Peça a outro admin.",
        },
      };
    }

    const outrosAtivos = await prisma.usuario.count({
      where: { ativo: true, id: { not: entrada.alvoId } },
    });

    if (outrosAtivos === 0) {
      return {
        ok: false,
        falha: {
          codigo: "REGRA",
          motivo: "Este é o último acesso ativo. Desligar todos deixaria o painel sem ninguém.",
        },
      };
    }
  }

  await prisma.usuario.update({
    where: { id: entrada.alvoId },
    data: { ativo: entrada.ativo },
  });

  const lista = await listarUsuarios(entrada.euId);
  const atualizado = lista.find((usuario) => usuario.id === entrada.alvoId);

  return atualizado
    ? { ok: true, dados: atualizado }
    : { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Usuário não encontrado." } };
}
