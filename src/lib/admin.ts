/**
 * AUTENTICACAO DO PAINEL (Fase 7).
 *
 * Este arquivo fala com o banco — NAO pode ser importado pelo middleware.
 * A parte que o middleware usa (assinar e conferir o token) esta em
 * "sessao-admin.ts", que nao encosta no Prisma.
 *
 * Decisoes do CLAUDE.md aplicadas aqui:
 *  - login por NOME DE USUARIO, nunca e-mail;
 *  - um unico nivel de acesso: quem entra e admin;
 *  - sem recuperacao de senha por e-mail no MVP.
 */
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { lerToken } from "@/lib/sessao-admin";

/** Custo do bcrypt. O mesmo ja usado na carga inicial. */
export const CUSTO_DO_HASH = 12;

/** Tamanho minimo da senha do painel. */
export const MINIMO_DA_SENHA = 8;

// --- Limites contra forca bruta (aprovados na Fase 7) ------------------------
export const MAXIMO_DE_TENTATIVAS = 5;
export const MINUTOS_DA_JANELA = 15;
/** O IP tem folga maior: um escritorio inteiro pode sair pelo mesmo endereco. */
export const MAXIMO_POR_IP = 20;

export type MotivoRecusa = "CREDENCIAL_INVALIDA" | "BLOQUEADO" | "DESLIGADO";

export type ResultadoLogin =
  | { autenticado: true; usuarioId: string; nome: string }
  | { autenticado: false; codigo: MotivoRecusa; motivo: string };

export type AdminDaSessao = { id: string; nome: string; usuario: string };

function inicioDaJanela(): Date {
  return new Date(Date.now() - MINUTOS_DA_JANELA * 60_000);
}

/**
 * Este nome de usuario (ou este IP) ja errou demais?
 *
 * Conta so os ERROS: um login certo no meio nao limpa o historico, mas
 * tambem nao conta contra. Quem acerta a senha passa direto.
 */
async function estaBloqueado(usuario: string, ip: string | null): Promise<boolean> {
  const desde = inicioDaJanela();

  const [porUsuario, porIp] = await Promise.all([
    prisma.tentativaLogin.count({
      where: { usuario, sucesso: false, criadoEm: { gte: desde } },
    }),
    ip
      ? prisma.tentativaLogin.count({
          where: { ip, sucesso: false, criadoEm: { gte: desde } },
        })
      : Promise.resolve(0),
  ]);

  return porUsuario >= MAXIMO_DE_TENTATIVAS || porIp >= MAXIMO_POR_IP;
}

/**
 * Confere usuario e senha.
 *
 * Usuario inexistente e senha errada devolvem EXATAMENTE a mesma resposta.
 * Se fossem diferentes, daria para descobrir quais nomes de usuario existem
 * testando um por um.
 *
 * Quando o usuario nao existe, ainda assim gastamos o tempo de um bcrypt
 * contra um hash de mentira: sem isso, a resposta rapida denunciaria que o
 * nome nao existe.
 */
export async function autenticar(entrada: {
  usuario: string;
  senha: string;
  ip: string | null;
}): Promise<ResultadoLogin> {
  const usuario = entrada.usuario.trim().toLowerCase();

  if (await estaBloqueado(usuario, entrada.ip)) {
    return {
      autenticado: false,
      codigo: "BLOQUEADO",
      motivo: `Muitas tentativas erradas. Aguarde ${MINUTOS_DA_JANELA} minutos e tente de novo.`,
    };
  }

  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });

  const confere = encontrado
    ? await bcrypt.compare(entrada.senha, encontrado.senhaHash)
    : await bcrypt.compare(entrada.senha, HASH_DE_MENTIRA);

  await prisma.tentativaLogin.create({
    data: { usuario, ip: entrada.ip, sucesso: Boolean(encontrado) && confere },
  });

  if (!encontrado || !confere) {
    return {
      autenticado: false,
      codigo: "CREDENCIAL_INVALIDA",
      motivo: "Usuário ou senha incorretos.",
    };
  }

  // A senha estava CERTA: quem chegou aqui e a pessoa dona da conta, e nao
  // alguem tentando descobrir nomes de usuario. Por isso este aviso pode ser
  // especifico — dizer "usuário ou senha incorretos" para quem digitou tudo
  // certo so faria a equipe procurar defeito onde nao tem.
  if (!encontrado.ativo) {
    return {
      autenticado: false,
      codigo: "DESLIGADO",
      motivo: "Este acesso foi desligado. Peça a outro admin para ligar de novo.",
    };
  }

  return { autenticado: true, usuarioId: encontrado.id, nome: encontrado.nome };
}

/**
 * Hash bcrypt de verdade (custo 12) de um texto aleatorio que ninguem conhece.
 * Serve so para gastar o mesmo tempo quando o nome de usuario nao existe —
 * senao a resposta rapida denunciaria que aquele nome nao esta cadastrado.
 */
const HASH_DE_MENTIRA =
  "$2b$12$VOqSNO82uS3arwkO0JE6suIeXyhjkvBchjk7VHduBCmxIw11hmSAW";

/**
 * Quem esta logado no painel, conferindo TAMBEM no banco.
 *
 * O middleware ja checou a assinatura do cookie, mas ele nao consegue olhar
 * o banco. Aqui a gente confirma que o usuario ainda existe — assim um admin
 * removido perde o acesso na proxima tela, sem esperar o token vencer.
 */
export async function adminDoToken(token: string | undefined): Promise<AdminDaSessao | null> {
  const conteudo = await lerToken(token);

  if (!conteudo) {
    return null;
  }

  // "ativo: true" e o que faz um acesso desligado cair na hora, sem esperar o
  // cookie vencer: toda pagina e rota do painel passa por aqui.
  const usuario = await prisma.usuario.findFirst({
    where: { id: conteudo.sub, ativo: true },
    select: { id: true, nome: true, usuario: true },
  });

  return usuario ?? null;
}

/** Cria (ou recusa) um usuario do painel. Usado pelo comando de instalacao. */
export async function criarUsuarioAdmin(entrada: {
  nome: string;
  usuario: string;
  senha: string;
}): Promise<{ criado: true; id: string } | { criado: false; motivo: string }> {
  const usuario = entrada.usuario.trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    return {
      criado: false,
      motivo:
        "O nome de usuário deve ter de 3 a 40 caracteres, usando apenas letras, números, ponto, hífen ou sublinhado.",
    };
  }

  if (entrada.senha.length < MINIMO_DA_SENHA) {
    return {
      criado: false,
      motivo: `A senha precisa ter pelo menos ${MINIMO_DA_SENHA} caracteres.`,
    };
  }

  if (await prisma.usuario.findUnique({ where: { usuario } })) {
    return { criado: false, motivo: `Já existe um usuário chamado "${usuario}".` };
  }

  const criado = await prisma.usuario.create({
    data: {
      nome: entrada.nome.trim() || usuario,
      usuario,
      senhaHash: await bcrypt.hash(entrada.senha, CUSTO_DO_HASH),
    },
    select: { id: true },
  });

  return { criado: true, id: criado.id };
}
