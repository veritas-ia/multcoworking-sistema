/**
 * Criacao de reservas do lado do servidor.
 *
 * Camadas de protecao, nesta ordem:
 *  1. Motor da Fase 3 revalida TODAS as regras de agenda.
 *  2. Trava por telefone (advisory lock) impede que dois pedidos simultaneos
 *     furem o limite de reservas ativas, quando ele esta ligado.
 *  3. As exclusion constraints do banco (Fase 2) sao a palavra final sobre
 *     sobreposicao de horario.
 */
import { StatusReserva } from "@/generated/prisma/enums";
import { calcularValor, validarReserva } from "@/lib/disponibilidade";
import type { CategoriaProfissao } from "@/generated/prisma/enums";
import {
  empresaEscolhidaEhValida,
  lembrarEmpresaDoTelefone,
} from "@/lib/empresas";
import { AVISO_PROFISSAO_BLOQUEADA, profissaoBloqueada } from "@/lib/profissoes";
import type { CategoriaReserva } from "@/lib/precos";
import { prisma } from "@/lib/prisma";
import { minutosEntre } from "@/lib/tempo";

/**
 * Quantas reservas FUTURAS um mesmo telefone pode ter no site.
 *
 * Vem da tabela Configuracao, editavel em Configuracoes -> Parametros, e
 * ZERO SIGNIFICA SEM LIMITE — mesma convencao de "intervaloMinutos".
 *
 * Desde 16/10/2026 nasce em zero, por decisao do dono. O numero continua no
 * sistema, desligado, para a equipe religar sozinha se a agenda apertar: a
 * regra some do caminho do cliente sem sumir do produto.
 *
 * Nunca foi um teto por MES. Conta reservas com inicio no futuro, em qualquer
 * data: cancelada, concluida e passada nao entram.
 */
async function maximoDeReservasAtivas(): Promise<number> {
  const linha = await prisma.configuracao.findUnique({
    where: { chave: "maximoReservasAtivas" },
  });

  // Registro faltando vale como SEM LIMITE, e nao como um numero inventado
  // aqui: um padrao escondido no codigo viraria regra de negocio que ninguem
  // encontra depois.
  if (!linha) {
    return 0;
  }

  const numero = Number(linha.valor);
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : 0;
}

export type FalhaAoReservar =
  | { tipo: "REGRA"; codigo: string; motivo: string }
  | { tipo: "LIMITE_DE_RESERVAS"; motivo: string }
  | { tipo: "HORARIO_TOMADO"; motivo: string };

export type ResultadoCriacao =
  | { criada: true; reservaId: string; valor: string }
  | { criada: false; falha: FalhaAoReservar };

/**
 * O banco recusou por sobreposicao de horario?
 * 23P01 e o codigo do PostgreSQL para violacao de exclusion constraint.
 */
export function ehConflitoDeHorario(erro: unknown): boolean {
  const texto =
    erro instanceof Error ? `${erro.message}` : typeof erro === "string" ? erro : "";
  return (
    texto.includes("23P01") ||
    texto.includes("ocupacao_sem_sobreposicao") ||
    texto.includes("ocupacao_intervalo_entre_reservas")
  );
}

/** Quantas reservas ativas e futuras este telefone ja tem. */
export async function contarReservasAtivas(telefone: string): Promise<number> {
  return prisma.reserva.count({
    where: {
      telefone,
      status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
      inicio: { gt: new Date() },
    },
  });
}

export async function criarReservaPublica(entrada: {
  salaId: string;
  telefone: string;
  nomeCliente: string;
  inicio: Date;
  fim: Date;
  /** Quantas pessoas. So as salas com preco de grupo perguntam isso. */
  pessoas?: number | null;
  /** Por hora ou dia inteiro. Padrao: HORA. */
  categoria?: CategoriaReserva;
  /** Area de atuacao do cliente. Obrigatoria em reserva nova. */
  profissao: CategoriaProfissao;
  /**
   * A empresa mensalista, escolhida pelo cliente. Nulo = nao e de empresa,
   * que e o caso da maioria. Nao muda preco nem disponibilidade: serve ao
   * relatorio.
   */
  empresaId?: string | null;
}): Promise<ResultadoCriacao> {
  // A trava do contrato de exclusividade vem ANTES de qualquer outra conta:
  // nao ha por que conferir horario e preco de uma reserva que nao pode
  // existir. E e aqui, no servidor, que ela vale — esconder o botao na tela
  // nao para quem manda o pedido direto.
  if (profissaoBloqueada(entrada.profissao)) {
    return {
      criada: false,
      falha: {
        tipo: "REGRA",
        codigo: "PROFISSAO_BLOQUEADA",
        motivo: AVISO_PROFISSAO_BLOQUEADA,
      },
    };
  }

  // A tela manda o identificador da empresa, e ninguem precisa acreditar na
  // tela: aqui se confere que ela existe e esta ativa. Inventado ou
  // desligado, a reserva nasceria apontando para o nada.
  if (!(await empresaEscolhidaEhValida(entrada.empresaId))) {
    return {
      criada: false,
      falha: {
        tipo: "REGRA",
        codigo: "EMPRESA_INVALIDA",
        motivo: "Essa empresa não está mais disponível. Escolha outra ou siga sem empresa.",
      },
    };
  }

  const categoria = entrada.categoria ?? "HORA";

  const validacao = await validarReserva({
    salaId: entrada.salaId,
    inicio: entrada.inicio,
    fim: entrada.fim,
    categoria,
    pessoas: entrada.pessoas ?? null,
  });

  if (!validacao.valido) {
    return {
      criada: false,
      falha: {
        tipo: "REGRA",
        codigo: validacao.codigo ?? "INVALIDO",
        motivo: validacao.motivo ?? "Horário inválido.",
      },
    };
  }

  const valor = await calcularValor(entrada.salaId, entrada.inicio, entrada.fim, {
    pessoas: entrada.pessoas ?? null,
    categoria,
  });

  const teto = await maximoDeReservasAtivas();

  try {
    const reservaId = await prisma.$transaction(async (tx) => {
      // Segura este telefone ate o fim da transacao: dois pedidos ao mesmo
      // tempo entram em fila em vez de contarem as reservas ao mesmo tempo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${entrada.telefone}))`;

      // Com o limite desligado (zero) nem vale a pena contar.
      if (teto > 0) {
        const ativas = await tx.reserva.count({
          where: {
            telefone: entrada.telefone,
            status: { in: [StatusReserva.CONFIRMADA, StatusReserva.REAGENDADA] },
            inicio: { gt: new Date() },
          },
        });

        if (ativas >= teto) {
          throw new LimiteDeReservasAtingido(teto);
        }
      }

      const reserva = await tx.reserva.create({
        data: {
          salaId: entrada.salaId,
          nomeCliente: entrada.nomeCliente,
          telefone: entrada.telefone,
          pessoas: entrada.pessoas ?? null,
          inicio: entrada.inicio,
          fim: entrada.fim,
          duracaoMinutos: minutosEntre(entrada.inicio, entrada.fim),
          valor,
          status: StatusReserva.CONFIRMADA,
          origem: "PUBLICO",
          categoria,
          profissao: entrada.profissao,
          empresaId: entrada.empresaId ?? null,
        },
        select: { id: true },
      });

      return reserva.id;
    });

    // Guarda o telefone na empresa para a PROXIMA reserva ja vir escolhida.
    // Depois da transacao, de proposito: e conveniencia, e nao pode derrubar
    // uma reserva que ja esta confirmada.
    if (entrada.empresaId) {
      await lembrarEmpresaDoTelefone(entrada.telefone, entrada.empresaId);
    }

    return { criada: true, reservaId, valor: valor.toFixed(2) };
  } catch (erro: unknown) {
    if (erro instanceof LimiteDeReservasAtingido) {
      return {
        criada: false,
        falha: {
          tipo: "LIMITE_DE_RESERVAS",
          motivo: `Você já tem ${erro.teto} ${erro.teto === 1 ? "reserva marcada" : "reservas marcadas"}. Cancele uma para marcar outra.`,
        },
      };
    }

    if (ehConflitoDeHorario(erro)) {
      return {
        criada: false,
        falha: {
          tipo: "HORARIO_TOMADO",
          motivo: "Este horário acabou de ser reservado. Escolha outro, por favor.",
        },
      };
    }

    throw erro;
  }
}

class LimiteDeReservasAtingido extends Error {
  /** O teto que estava valendo, para a mensagem dizer o numero certo. */
  readonly teto: number;

  constructor(teto: number) {
    super("Limite de reservas ativas atingido.");
    this.name = "LimiteDeReservasAtingido";
    this.teto = teto;
  }
}
