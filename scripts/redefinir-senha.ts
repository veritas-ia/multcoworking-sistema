/**
 * Redefine a senha de um usuario do painel.
 *
 * Uso (no terminal do servidor):
 *   npm run redefinir-senha -- <usuario>
 *
 * Sem o nome do usuario, ele lista quem existe e para.
 *
 * Existe para o caso de a equipe ficar TRANCADA DO LADO DE FORA: ninguem
 * consegue entrar no painel, entao a troca de senha pela tela (Fase 11) nao
 * esta disponivel. Este comando e a saida de emergencia — roda direto no
 * servidor, por quem ja tem acesso a ele.
 *
 * A senha e digitada SEM APARECER na tela, e pedida duas vezes.
 *
 * Para uso automatizado (ou quando o terminal nao deixa digitar escondido),
 * a senha tambem pode vir na variavel NOVA_SENHA. Nesse caso ela aparece no
 * comando — use so quando o outro jeito nao servir.
 *
 * O que ele NAO faz, de proposito:
 *  - nao cria usuario (para isso existe o "criar-admin");
 *  - nao liga um acesso desligado. Desligar foi decisao de alguem, e uma
 *    troca de senha nao e lugar de desfazer isso sem querer.
 */
import "dotenv/config";

import { stdin, stdout } from "node:process";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const CUSTO_DO_HASH = 12;
const MINIMO_DA_SENHA = 8;

/** Teclas especiais, escritas por codigo para nao virarem lixo invisivel. */
const ENTER = ["\n", "\r", "\u0004"];
const CANCELAR = "\u0003";
const APAGAR = ["\u007f", "\b"];

const conexao = process.env.DATABASE_URL;

if (!conexao) {
  throw new Error("DATABASE_URL nao configurada. Confira as variaveis do servico.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

/**
 * O que ja chegou pelo teclado e ainda nao foi usado.
 *
 * Existe porque as duas perguntas de senha leem da MESMA entrada. Quando as
 * duas linhas chegam juntas — alguem colando, ou um comando automatizado —,
 * ler "o que veio agora" e jogar o resto fora faz a segunda pergunta esperar
 * para sempre por algo que ja tinha chegado. Guardando a sobra, as duas
 * perguntas se servem da mesma fila.
 */
let sobra = "";

/** Processa o que chegou: apagar apaga, Ctrl+C cancela, Enter marca fim de linha. */
function engolir(texto: string): void {
  for (const letra of texto) {
    if (letra === CANCELAR) {
      stdout.write("\n\n  Cancelado.\n\n");
      process.exit(1);
    }

    if (APAGAR.includes(letra)) {
      const inicioDaLinha = sobra.lastIndexOf("\n") + 1;
      if (sobra.length > inicioDaLinha) {
        sobra = sobra.slice(0, -1);
      }
      continue;
    }

    sobra += ENTER.includes(letra) ? "\n" : letra;
  }
}

/**
 * Pergunta sem mostrar na tela o que esta sendo digitado.
 *
 * Nao usa "readline" de proposito: ele toma conta da entrada assim que e
 * criado e se fecha sozinho enquanto o programa espera o banco responder —
 * o que fazia este comando morrer com "readline was closed" antes de
 * perguntar qualquer coisa.
 */
function perguntarSenha(rotulo: string): Promise<string> {
  stdout.write(rotulo);

  const ehTerminal = Boolean(stdin.isTTY);

  if (ehTerminal) {
    stdin.setRawMode(true);
  }

  return new Promise((resolve) => {
    const aoReceber = (pedaco: Buffer): void => {
      engolir(pedaco.toString("utf8"));
      entregarSeTiver();
    };

    function entregarSeTiver(): boolean {
      const fim = sobra.indexOf("\n");

      if (fim === -1) {
        return false;
      }

      const linha = sobra.slice(0, fim);
      sobra = sobra.slice(fim + 1);

      if (ehTerminal) {
        stdin.setRawMode(false);
      }

      stdin.removeListener("data", aoReceber);
      stdin.pause();
      stdout.write("\n");
      resolve(linha);
      return true;
    }

    // Pode ja ter chegado junto com a resposta anterior.
    if (entregarSeTiver()) {
      return;
    }

    stdin.resume();
    stdin.on("data", aoReceber);
  });
}

async function main(): Promise<void> {
  const pedido = (process.argv[2] ?? "").trim().toLowerCase();

  const existentes = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { usuario: "asc" }],
    select: { usuario: true, nome: true, ativo: true },
  });

  if (existentes.length === 0) {
    throw new Error(
      'Nao ha nenhum usuario no banco. Use "npm run criar-admin" para criar o primeiro.',
    );
  }

  if (!pedido) {
    stdout.write("\n  Usuarios do painel:\n");
    for (const item of existentes) {
      stdout.write(
        `    - ${item.usuario} (${item.nome})${item.ativo ? "" : "  [DESLIGADO]"}\n`,
      );
    }
    stdout.write(
      "\n  Diga de quem e a senha que voce quer trocar:\n" +
        `    npm run redefinir-senha -- ${existentes[0]?.usuario ?? "usuario"}\n\n`,
    );
    return;
  }

  const alvo = await prisma.usuario.findUnique({
    where: { usuario: pedido },
    select: { nome: true, ativo: true },
  });

  if (!alvo) {
    throw new Error(
      `Nao existe usuario "${pedido}".\n  Rode sem o nome para ver a lista de quem existe.`,
    );
  }

  if (!alvo.ativo) {
    throw new Error(
      `O acesso de "${pedido}" esta DESLIGADO — trocar a senha nao faria ele entrar.\n` +
        "  Ligue o acesso pelo painel, em Configuracoes > Usuarios, com outro admin.",
    );
  }

  const daVariavel = process.env.NOVA_SENHA;
  let senha: string;

  if (daVariavel) {
    senha = daVariavel;
  } else {
    stdout.write(`\n  Trocando a senha de "${pedido}" (${alvo.nome}).\n\n`);
    senha = await perguntarSenha("  Nova senha (nao aparece na tela): ");

    const confirmacao = await perguntarSenha("  Digite a senha de novo: ");

    if (senha !== confirmacao) {
      throw new Error("As duas senhas nao sao iguais. Rode o comando de novo.");
    }
  }

  if (senha.length < MINIMO_DA_SENHA) {
    throw new Error(`A senha precisa ter pelo menos ${MINIMO_DA_SENHA} caracteres.`);
  }

  await prisma.usuario.update({
    where: { usuario: pedido },
    data: { senhaHash: await bcrypt.hash(senha, CUSTO_DO_HASH) },
  });

  stdout.write(
    `\n  Pronto! A senha de "${pedido}" (${alvo.nome}) foi trocada.\n` +
      "  As sessoes ja abertas continuam valendo ate vencerem; para derrubar\n" +
      "  todas na hora, troque a ADMIN_SESSAO_SEGREDO e reinicie o servico.\n\n",
  );
}

main()
  .catch((erro: unknown) => {
    stdout.write(`\n  ${erro instanceof Error ? erro.message : String(erro)}\n\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
