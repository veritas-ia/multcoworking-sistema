/**
 * USUARIOS DO PAINEL (Fase 11).
 *
 * DOIS NIVEIS, desde 17/11/2026 (pedido dos donos do coworking): acesso
 * TOTAL, ou tudo MENOS o Financeiro — o caso da recepcionista.
 *
 * QUEM NAO VE O FINANCEIRO TAMBEM NAO ADMINISTRA USUARIOS, e isso nao e um
 * segundo filtro: e o que faz o primeiro valer. Sem essa amarracao, a pessoa
 * entraria em Configuracoes > Usuarios e se promoveria sozinha — ou criaria
 * uma conta com acesso total e entraria com ela. A cobranca e das ROTAS
 * (/api/admin/usuarios), nao da tela: esconder o botao nao para quem manda o
 * pedido direto.
 *
 * Ela continua podendo trocar a PROPRIA senha, que mora noutra rota
 * (/api/admin/eu/senha) e continua aberta a todos.
 *
 * Cinco travas que evitam a equipe se trancar do lado de fora:
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
 *   4. ninguem tira o PROPRIO acesso ao financeiro. Esta e a mais
 *      importante das cinco: perder o financeiro e perder junto a tela de
 *      usuarios, entao quem se rebaixasse por engano NAO TERIA COMO SE
 *      DEVOLVER o acesso — e se fosse a unica pessoa com ele, o coworking
 *      inteiro ficaria sem financeiro, sem erro nenhum aparecer;
 *   5. o ultimo acesso ao financeiro nao se desliga nem se rebaixa. Na
 *      pratica a trava 4 ja garante isso pelo painel (quem pede sempre tem o
 *      acesso e nao e o alvo); esta fica como segunda linha de defesa.
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
  /** Ve a parte financeira? Falso = tudo menos o Financeiro. */
  acessoFinanceiro: boolean;
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
    select: {
      id: true,
      nome: true,
      usuario: true,
      ativo: true,
      acessoFinanceiro: true,
      criadoEm: true,
    },
  });

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    usuario: linha.usuario,
    ativo: linha.ativo,
    acessoFinanceiro: linha.acessoFinanceiro,
    criadoEm: linha.criadoEm.toISOString(),
    souEu: linha.id === euId,
  }));
}

export async function criarUsuario(
  entrada: {
    nome: string;
    usuario: string;
    senha: string;
    /** Em branco vale acesso TOTAL, que e o que o sistema sempre fez. */
    acessoFinanceiro?: boolean;
  },
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

    if (await ficariaSemFinanceiro(entrada.alvoId)) {
      return {
        ok: false,
        falha: {
          codigo: "REGRA",
          motivo:
            "Esta é a última pessoa com acesso à parte financeira. Desligar deixaria o painel sem ninguém que possa abrir o Financeiro — e sem ninguém que possa administrar usuários.",
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

/**
 * Tirando ESTA pessoa, ainda sobra alguem ativo que ve o financeiro?
 *
 * A pergunta importa em dois lugares — desligar o acesso e rebaixar o nivel —
 * e a resposta errada tem a mesma consequencia nos dois: o painel fica sem
 * ninguem que consiga abrir o Financeiro E sem ninguem que consiga
 * administrar usuarios, ou seja, sem como voltar atras.
 */
async function ficariaSemFinanceiro(alvoId: string): Promise<boolean> {
  const outros = await prisma.usuario.count({
    where: { ativo: true, acessoFinanceiro: true, id: { not: alvoId } },
  });

  return outros === 0;
}

/**
 * Liga ou tira o acesso de alguem a parte financeira.
 *
 * NINGUEM TIRA O PROPRIO ACESSO. E a trava mais importante daqui: perder o
 * financeiro e perder junto a tela de usuarios, entao quem se rebaixasse por
 * engano nao teria como se devolver o acesso — teria de chamar alguem que
 * ainda o tivesse, e se nao houvesse ninguem, o jeito seria mexer no banco.
 */
export async function definirAcessoFinanceiro(entrada: {
  alvoId: string;
  euId: string;
  acessoFinanceiro: boolean;
}): Promise<Resultado<UsuarioDoPainel>> {
  const alvo = await prisma.usuario.findUnique({
    where: { id: entrada.alvoId },
    select: { id: true },
  });

  if (!alvo) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Usuário não encontrado." } };
  }

  if (!entrada.acessoFinanceiro) {
    if (entrada.alvoId === entrada.euId) {
      return {
        ok: false,
        falha: {
          codigo: "REGRA",
          motivo:
            "Você não pode tirar o seu próprio acesso à parte financeira — depois não teria como devolvê-lo. Peça a outro administrador.",
        },
      };
    }

    if (await ficariaSemFinanceiro(entrada.alvoId)) {
      return {
        ok: false,
        falha: {
          codigo: "REGRA",
          motivo:
            "Esta é a última pessoa com acesso à parte financeira. Sem ninguém, o Financeiro e a tela de usuários ficariam fechados para todo mundo.",
        },
      };
    }
  }

  await prisma.usuario.update({
    where: { id: entrada.alvoId },
    data: { acessoFinanceiro: entrada.acessoFinanceiro },
  });

  const lista = await listarUsuarios(entrada.euId);
  const atualizado = lista.find((usuario) => usuario.id === entrada.alvoId);

  return atualizado
    ? { ok: true, dados: atualizado }
    : { ok: false, falha: { codigo: "NAO_ENCONTRADO", motivo: "Usuário não encontrado." } };
}
