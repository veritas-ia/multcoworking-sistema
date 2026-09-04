import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { respostaErro } from "@/lib/api";
import { textosParaOSite } from "@/lib/politicas";
import { listarDoTelefone, type ReservaNaLista } from "@/lib/minhas-reservas";
import { telefoneDaSessao } from "@/lib/sessao-cliente";
import { dataLocalDe, horaLocalDe } from "@/lib/tempo";

export const dynamic = "force-dynamic";

export type ReservaParaTela = {
  id: string;
  salaId: string;
  sala: string;
  data: string;
  inicio: string;
  fim: string;
  valor: string;
  status: string;
  podeAlterar: boolean;
};

/**
 * GET /api/publico/minhas-reservas
 *
 * As reservas do telefone que esta na sessao — e so dele. O telefone sai do
 * cookie, nunca de um parametro: nao existe forma de pedir as reservas de
 * outra pessoa por esta rota.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const telefone = await telefoneDaSessao(requisicao);

  if (!telefone) {
    return respostaErro(
      401,
      "Confirme seu telefone pelo WhatsApp para ver suas reservas.",
      "SEM_SESSAO",
    );
  }

  const { futuras, historico, janelaHoras } = await listarDoTelefone(telefone);

  return NextResponse.json({
    futuras: futuras.map(paraTela),
    historico: historico.map(paraTela),
    janelaCancelamentoHoras: janelaHoras,
    textos: await textosParaOSite(janelaHoras),
  });
}

function paraTela(reserva: ReservaNaLista): ReservaParaTela {
  return {
    id: reserva.id,
    salaId: reserva.salaId,
    sala: reserva.sala,
    data: dataLocalDe(reserva.inicio),
    inicio: horaLocalDe(reserva.inicio),
    fim: horaLocalDe(reserva.fim),
    valor: reserva.valor,
    status: reserva.status,
    podeAlterar: reserva.podeAlterar,
  };
}
