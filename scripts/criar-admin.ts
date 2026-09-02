/**
 * Cria um usuario do painel administrativo.
 *
 * Uso:
 *   npm run criar-admin
 *
 * Ele pergunta o nome, o usuario e a senha. A senha NAO aparece na tela
 * enquanto voce digita, e e pedida duas vezes para evitar erro de digitacao.
 *
 * Nao existe recuperacao de senha por e-mail (decisao do CLAUDE.md): para dar
 * acesso a alguem, outro administrador roda este comando.
 */
import "dotenv/config";

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

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
  throw new Error("DATABASE_URL nao configurada. Confira o arquivo .env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });
const terminal = createInterface({ input: stdin, output: stdout });

/** Pergunta sem mostrar na tela o que esta sendo digitado. */
function perguntarSenha(rotulo: string): Promise<string> {
  stdout.write(rotulo);

  const ehTerminal = Boolean(stdin.isTTY);

  if (ehTerminal) {
    stdin.setRawMode(true);
  }

  return new Promise((resolve) => {
    let digitado = "";

    const aoReceber = (pedaco: Buffer): void => {
      const letra = pedaco.toString("utf8");

      if (ENTER.includes(letra)) {
        if (ehTerminal) {
          stdin.setRawMode(false);
        }
        stdin.removeListener("data", aoReceber);
        stdout.write("\n");
        resolve(digitado);
        return;
      }

      if (letra === CANCELAR) {
        stdout.write("\n\n  Cancelado.\n\n");
        process.exit(1);
      }

      if (APAGAR.includes(letra)) {
        digitado = digitado.slice(0, -1);
        return;
      }

      digitado += letra;
    };

    stdin.on("data", aoReceber);
  });
}

function usuarioValido(usuario: string): boolean {
  return /^[a-z0-9._-]{3,40}$/.test(usuario);
}

async function main(): Promise<void> {
  stdout.write("\n  Criar usuario do painel\n  -----------------------\n\n");

  const nome = (await terminal.question("  Nome completo: ")).trim();

  const usuario = (await terminal.question("  Nome de usuario (para entrar): "))
    .trim()
    .toLowerCase();

  if (!usuarioValido(usuario)) {
    throw new Error(
      "Nome de usuario invalido. Use de 3 a 40 caracteres, apenas letras sem\n" +
        "  acento, numeros, ponto, hifen ou sublinhado. Exemplo: maria.silva",
    );
  }

  if (await prisma.usuario.findUnique({ where: { usuario } })) {
    throw new Error(`Ja existe um usuario chamado "${usuario}". Escolha outro nome.`);
  }

  const senha = await perguntarSenha("  Senha (nao aparece na tela): ");

  if (senha.length < MINIMO_DA_SENHA) {
    throw new Error(`A senha precisa ter pelo menos ${MINIMO_DA_SENHA} caracteres.`);
  }

  const confirmacao = await perguntarSenha("  Digite a senha de novo: ");

  if (senha !== confirmacao) {
    throw new Error("As duas senhas nao sao iguais. Rode o comando de novo.");
  }

  await prisma.usuario.create({
    data: {
      nome: nome || usuario,
      usuario,
      senhaHash: await bcrypt.hash(senha, CUSTO_DO_HASH),
    },
  });

  const total = await prisma.usuario.count();

  stdout.write(
    `\n  Pronto! Usuario "${usuario}" criado.\n` +
      `  O painel agora tem ${total} ${total === 1 ? "usuario" : "usuarios"}.\n\n` +
      "  Entre em http://localhost:3000/admin\n\n",
  );
}

main()
  .then(async () => {
    terminal.close();
    await prisma.$disconnect();
  })
  .catch(async (erro: unknown) => {
    terminal.close();
    await prisma.$disconnect();
    stdout.write(`\n  ${erro instanceof Error ? erro.message : String(erro)}\n\n`);
    process.exitCode = 1;
  });
