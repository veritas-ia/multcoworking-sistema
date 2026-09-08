import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import { lerCorpo, respostaErro } from "@/lib/api";
import { horarioDaDiaria } from "@/lib/disponibilidade";
import { normalizarTelefone } from "@/lib/telefone";
import { dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";
import { dispararMensagem } from "@/lib/whatsapp";

import { operadorDaRequisicao, statusDaFalhaAdmin } from "../operador";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  salaId: z.string().min(1, "Escolha uma sala."),
  /** Obrigatoria em reserva nova; so o passado tem reserva sem profissao. */
  profissao: z.enum(["MARKETING", "JURIDICO", "CONTABIL", "SAUDE", "OUTROS"], {
    message: "Escolha a área de atuação do cliente.",
  }),
  /** "DIARIA" ignora inicio/fim: o horario vem da configuracao. */
  categoria: z.enum(["HORA", "DIARIA"]).optional(),
  pessoas: z.number().int().min(1).max(500).nullish(),
  telefone: z.string().min(1, "Informe o telefone do cliente."),
  nome: z.string().trim().min(2, "Informe o nome do cliente.").max(120, "Nome muito longo."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
});

/**
 * POST /api/admin/reservas — lancar uma reserva pela recepcao.
 *
 * Sem limite de 3 por telefone, sem codigo de WhatsApp, sem antecedencia
 * minima e sem limite de duracao. A trava de sobreposicao e o intervalo de
 * 30 min continuam valendo — quem garante e o proprio banco.
 *
 * O cliente recebe o mesmo WhatsApp de confirmacao do site.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const operador = await operadorDaRequisicao(requisicao);

  if (!operador) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const telefone = normalizarTelefone(corpo.data.telefone);

  if (!telefone) {
    return respostaErro(
      400,
      "Telefone inválido. Use DDD + celular, como (11) 91234-5678.",
      "TELEFONE_INVALIDO",
    );
  }

  const categoria = corpo.data.categoria ?? "HORA";

  // Na diaria o horario vem da configuracao, e nao do pedido.
  const janela =
    categoria === "DIARIA"
      ? await horarioDaDiaria()
      : { inicio: corpo.data.inicio, fim: corpo.data.fim };

  const inicio = instanteDe(corpo.data.data, janela.inicio);
  const fim = instanteDe(corpo.data.data, janela.fim);

  const resultado = await criarReservaNaRecepcao({
    salaId: corpo.data.salaId,
    telefone,
    nomeCliente: corpo.data.nome,
    profissao: corpo.data.profissao,
    pessoas: corpo.data.pessoas ?? null,
    categoria,
    inicio,
    fim,
    operador,
  });

  if (!resultado.ok) {
    return respostaErro(
      statusDaFalhaAdmin(resultado.falha.codigo),
      resultado.falha.motivo,
      resultado.falha.codigo,
    );
  }

  dispararMensagem({
    chave: ChaveTemplate.reserva_confirmada,
    telefone,
    reservaId: resultado.dados.id,
    variaveis: {
      nome: corpo.data.nome,
      sala: resultado.dados.sala,
      data: dataLocalDe(inicio),
      inicio: horaLocalDe(inicio),
      fim: horaLocalDe(fim),
      valor: `R$ ${resultado.dados.valor.replace(".", ",")}`,
    },
  });

  return NextResponse.json(
    {
      id: resultado.dados.id,
      sala: resultado.dados.sala,
      data: dataLocalDe(inicio),
      inicio: horaLocalDe(inicio),
      fim: horaLocalDe(fim),
      valor: resultado.dados.valor,
      status: "CONFIRMADA",
      origem: "ADMIN",
    },
    { status: 201 },
  );
}
