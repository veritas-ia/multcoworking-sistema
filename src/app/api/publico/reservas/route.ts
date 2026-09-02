import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ChaveTemplate } from "@/generated/prisma/enums";
import { lerCorpo, respostaErro } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { criarReservaPublica } from "@/lib/reservas";
import { telefoneDaSessao } from "@/lib/sessao-cliente";
import { dataLocalDe, horaLocalDe, instanteDe } from "@/lib/tempo";
import { dispararMensagem } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const Corpo = z.object({
  salaId: z.string().min(1, "Escolha uma sala."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
  nome: z
    .string()
    .trim()
    .min(2, "Informe seu nome.")
    .max(120, "Nome muito longo."),
  aceitePolitica: z.literal(true, {
    message: "É preciso aceitar a política de uso para reservar.",
  }),
});

/**
 * POST /api/publico/reservas
 *
 * Exige sessao de cliente valida. O telefone da reserva e SEMPRE o telefone
 * confirmado na sessao — o que vier no corpo do pedido e ignorado, para
 * ninguem conseguir reservar em nome de outra pessoa.
 */
export async function POST(requisicao: NextRequest): Promise<NextResponse> {
  const telefone = await telefoneDaSessao(requisicao);

  if (!telefone) {
    return respostaErro(
      401,
      "Confirme seu telefone pelo WhatsApp antes de reservar.",
      "SEM_SESSAO",
    );
  }

  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const inicio = instanteDe(corpo.data.data, corpo.data.inicio);
  const fim = instanteDe(corpo.data.data, corpo.data.fim);

  const resultado = await criarReservaPublica({
    salaId: corpo.data.salaId,
    telefone,
    nomeCliente: corpo.data.nome,
    inicio,
    fim,
  });

  if (!resultado.criada) {
    const codigo =
      resultado.falha.tipo === "REGRA" ? resultado.falha.codigo : resultado.falha.tipo;

    // 409 = conflito com o estado atual da agenda (alguem chegou antes,
    // ou o cliente ja tem reservas demais). 422 = a regra em si nao permite.
    const ehConflito =
      codigo === "HORARIO_TOMADO" ||
      codigo === "LIMITE_DE_RESERVAS" ||
      codigo === "HORARIO_OCUPADO";

    return respostaErro(ehConflito ? 409 : 422, resultado.falha.motivo, codigo);
  }

  // A partir daqui a reserva JA existe. Nada abaixo pode derruba-la.
  const sala = await prisma.sala.findUnique({
    where: { id: corpo.data.salaId },
    select: { nome: true },
  });

  dispararMensagem({
    chave: ChaveTemplate.reserva_confirmada,
    telefone,
    reservaId: resultado.reservaId,
    variaveis: {
      nome: corpo.data.nome,
      sala: sala?.nome ?? "",
      data: dataLocalDe(inicio),
      inicio: horaLocalDe(inicio),
      fim: horaLocalDe(fim),
      valor: `R$ ${resultado.valor.replace(".", ",")}`,
    },
  });

  return NextResponse.json(
    {
      id: resultado.reservaId,
      sala: sala?.nome ?? "",
      data: dataLocalDe(inicio),
      inicio: horaLocalDe(inicio),
      fim: horaLocalDe(fim),
      valorEstimado: resultado.valor,
      status: "CONFIRMADA",
    },
    { status: 201 },
  );
}
