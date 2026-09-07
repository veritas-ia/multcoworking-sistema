import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { lerCorpo, respostaErro } from "@/lib/api";
import { atualizarSala, ligarOuDesligarSala } from "@/lib/salas-admin";

import { operadorDaRequisicao } from "../../operador";

export const dynamic = "force-dynamic";

const Opcional = z.union([z.number().int(), z.null()]);

/**
 * Duas coisas diferentes chegam por aqui:
 *  - editar os dados da sala;
 *  - so ligar/desligar (a tela manda apenas "ativa").
 */
const Corpo = z.union([
  z.object({ ativa: z.boolean() }).strict(),
  z.object({
    nome: z.string().trim().min(1, "Escreva o nome da sala."),
    capacidade: Opcional,
    precoPorHora: z.number(),
    precoPorHoraNoturno: z.number(),
    precoPorHoraNoturnoGrupo: z.union([z.number(), z.null()]),
    pessoasParaGrupo: Opcional,
    aceitaDiaria: z.boolean(),
    precoDiaria: z.union([z.number(), z.null()]),
    duracaoMaximaMinutos: Opcional,
    ordem: z.number().int(),
  }),
]);

/** PATCH /api/admin/salas/[id] */
export async function PATCH(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!(await operadorDaRequisicao(requisicao))) {
    return respostaErro(401, "Faça login no painel para continuar.", "SEM_SESSAO_ADMIN");
  }

  const { id } = await contexto.params;
  const corpo = Corpo.safeParse(await lerCorpo(requisicao));

  if (!corpo.success) {
    return respostaErro(400, corpo.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const resultado =
    "ativa" in corpo.data
      ? await ligarOuDesligarSala(id, corpo.data.ativa)
      : await atualizarSala(id, corpo.data);

  if (!resultado.ok) {
    const status =
      resultado.falha.codigo === "NAO_ENCONTRADA"
        ? 404
        : resultado.falha.codigo === "NOME_REPETIDO"
          ? 409
          : 422;

    return respostaErro(status, resultado.falha.motivo, resultado.falha.codigo);
  }

  return NextResponse.json({ sala: resultado.dados });
}
