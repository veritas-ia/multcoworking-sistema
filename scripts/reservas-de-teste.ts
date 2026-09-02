/**
 * Cria duas reservas de teste para experimentar a area "Minhas reservas":
 * uma LONGE (mais de 12h — da para cancelar e remarcar) e uma PERTO
 * (menos de 12h — os botoes ficam travados).
 *
 * Uso:
 *   npm run reservas-de-teste -- "(11) 91234-5678"
 *
 * Respeita o horario de funcionamento que estiver no banco e nao encosta em
 * horario ja ocupado: procura o proximo bloco livre.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { PrismaClient } from "../src/generated/prisma/client";

const FUSO = "America/Sao_Paulo";
const BLOCO = 30;

const conexao = process.env.DATABASE_URL;

if (!conexao) {
  throw new Error("DATABASE_URL nao configurada. Confira o arquivo .env.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });

function normalizar(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");
  const semPais = digitos.startsWith("55") ? digitos.slice(2) : digitos;
  return semPais.length === 11 ? `+55${semPais}` : null;
}

const dataDe = (instante: Date) => formatInTimeZone(instante, FUSO, "yyyy-MM-dd");
const horaDe = (instante: Date) => formatInTimeZone(instante, FUSO, "HH:mm");
const instanteDe = (data: string, hora: string) =>
  fromZonedTime(`${data}T${hora}:00.000`, FUSO);

function diaDaSemanaDe(data: string): number {
  const iso = Number(formatInTimeZone(instanteDe(data, "12:00"), FUSO, "i"));
  return iso === 7 ? 0 : iso;
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const base = new Date(Date.UTC(ano ?? 0, (mes ?? 1) - 1, dia ?? 1));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Sobe o instante para o proximo bloco cheio de 30 min. */
function arredondarParaGrade(instante: Date): Date {
  const passo = BLOCO * 60_000;
  return new Date(Math.ceil(instante.getTime() / passo) * passo);
}

type Expediente = { abertura: string; fechamento: string } | null;

async function main(): Promise<void> {
  const digitado = process.argv[2];

  if (!digitado) {
    throw new Error(
      'Informe o telefone. Exemplo:\n  npm run reservas-de-teste -- "(11) 91234-5678"',
    );
  }

  const telefone = normalizar(digitado);

  if (!telefone) {
    throw new Error(`Telefone invalido: "${digitado}". Use DDD + celular de 9 digitos.`);
  }

  const [sala, horarios] = await Promise.all([
    prisma.sala.findFirst({ where: { ativa: true }, orderBy: { ordem: "asc" } }),
    prisma.horarioFuncionamento.findMany(),
  ]);

  if (!sala) {
    throw new Error('Nenhuma sala ativa. Rode "npm run db:seed".');
  }

  const expedientes = new Map<number, Expediente>(
    horarios.map((h) => [
      h.diaDaSemana,
      h.aberto && h.horaAbertura && h.horaFechamento
        ? { abertura: h.horaAbertura, fechamento: h.horaFechamento }
        : null,
    ]),
  );

  const agora = new Date();
  const criadas: string[] = [];

  // --- A reserva LONGE: proximo dia aberto daqui a 3 dias ou mais ----------
  let dataLonge = somarDias(dataDe(agora), 3);
  for (let tentativa = 0; tentativa < 14; tentativa += 1) {
    if (expedientes.get(diaDaSemanaDe(dataLonge))) {
      break;
    }
    dataLonge = somarDias(dataLonge, 1);
  }

  const expedienteLonge = expedientes.get(diaDaSemanaDe(dataLonge));

  if (expedienteLonge) {
    const inicio = await primeiroLivre(
      sala.id,
      dataLonge,
      expedienteLonge.abertura,
      expedienteLonge.fechamento,
    );
    if (inicio) {
      criadas.push(await criar(sala.id, telefone, inicio, "LONGE (mais de 12h)"));
    }
  }

  // --- A reserva PERTO: hoje, entre 2h e 11h a frente ----------------------
  const hoje = dataDe(agora);
  const expedienteHoje = expedientes.get(diaDaSemanaDe(hoje));

  if (!expedienteHoje) {
    criadas.push(
      "  (a de MENOS de 12h nao foi criada: o coworking nao abre hoje — rode em um dia util)",
    );
  } else {
    const cedoDemais = arredondarParaGrade(new Date(agora.getTime() + 2 * 60 * 60_000));
    const limite = new Date(agora.getTime() + 11 * 60 * 60_000);
    const fechamento = instanteDe(hoje, expedienteHoje.fechamento);

    const comeco = horaDe(cedoDemais) < expedienteHoje.abertura
      ? expedienteHoje.abertura
      : horaDe(cedoDemais);

    const inicio =
      cedoDemais < limite && cedoDemais < fechamento
        ? await primeiroLivre(sala.id, hoje, comeco, expedienteHoje.fechamento, limite)
        : null;

    criadas.push(
      inicio
        ? await criar(sala.id, telefone, inicio, "PERTO (menos de 12h)")
        : "  (a de MENOS de 12h nao coube hoje: ja e tarde demais — rode mais cedo)",
    );
  }

  process.stdout.write(
    `\nTelefone: ${telefone}\n\n${criadas.join("\n")}\n\n` +
      `Agora abra http://localhost:3000/minhas-reservas e confirme esse numero.\n` +
      `O codigo de 6 digitos aparece no terminal do "npm run dev".\n\n`,
  );

  await prisma.$disconnect();
}

/** Primeiro bloco de 1h livre no dia, dentro da faixa pedida. */
async function primeiroLivre(
  salaId: string,
  data: string,
  de: string,
  ate: string,
  limite?: Date,
): Promise<Date | null> {
  const fechamento = instanteDe(data, ate);

  for (
    let inicio = instanteDe(data, de);
    inicio < fechamento;
    inicio = new Date(inicio.getTime() + BLOCO * 60_000)
  ) {
    const fim = new Date(inicio.getTime() + 60 * 60_000);

    if (fim > fechamento || (limite && inicio > limite)) {
      return null;
    }

    // Uma hora de folga dos dois lados cobre o intervalo obrigatorio.
    const conflito = await prisma.reserva.findFirst({
      where: {
        salaId,
        status: { in: ["CONFIRMADA", "REAGENDADA"] },
        inicio: { lt: new Date(fim.getTime() + 60 * 60_000) },
        fim: { gt: new Date(inicio.getTime() - 60 * 60_000) },
      },
      select: { id: true },
    });

    if (!conflito) {
      return inicio;
    }
  }

  return null;
}

async function criar(
  salaId: string,
  telefone: string,
  inicio: Date,
  rotulo: string,
): Promise<string> {
  const fim = new Date(inicio.getTime() + 60 * 60_000);
  const sala = await prisma.sala.findUniqueOrThrow({ where: { id: salaId } });

  await prisma.reserva.create({
    data: {
      salaId,
      nomeCliente: "Reserva de teste",
      telefone,
      inicio,
      fim,
      duracaoMinutos: 60,
      valor: sala.precoPorHora,
      status: "CONFIRMADA",
      origem: "PUBLICO",
    },
  });

  return `  ${rotulo}: ${sala.nome}, ${dataDe(inicio)}, ${horaDe(inicio)} as ${horaDe(fim)}`;
}

main().catch(async (erro: unknown) => {
  await prisma.$disconnect();
  process.stderr.write(`\n${erro instanceof Error ? erro.message : String(erro)}\n\n`);
  process.exitCode = 1;
});
