import { NextResponse } from "next/server";

import { carregarParametros, lerHoraInicioNoturno } from "@/lib/disponibilidade";
import { prisma } from "@/lib/prisma";
import { textosParaOSite } from "@/lib/politicas";
import { dataLocalDe, somarMinutos } from "@/lib/tempo";

export const dynamic = "force-dynamic";

export type DiaDeExpediente = {
  /** 0 = domingo ... 6 = sabado. */
  diaDaSemana: number;
  horaAbertura: string;
  horaFechamento: string;
};

export type RespostaAgenda = {
  /** Dias da semana em que o coworking nao abre. */
  diasFechados: number[];
  /** Dias em que abre, com o horario — para a legenda do calendario. */
  diasAbertos: DiaDeExpediente[];
  /** Primeiro dia que ainda da para reservar, ja descontada a antecedencia minima. */
  primeiraData: string;
  /** Ultimo dia que da para reservar. */
  ultimaData: string;
  antecedenciaMinimaMinutos: number;
  antecedenciaMaximaDias: number;
  duracaoMinimaMinutos: number;
  /** Horas de antecedencia para o cliente cancelar sozinho (a regra das 12h). */
  janelaCancelamentoHoras: number;
  /** A partir de que hora vale o preco noturno das salas. */
  horaInicioNoturno: string;
  /** Textos de politica editaveis no painel, com {{horas}} ja trocado. */
  textos: { politicaCancelamento: string; avisoDoValor: string };
};

/**
 * GET /api/publico/agenda
 *
 * O que a tela precisa saber ANTES de escolher uma data: quais dias da semana
 * sao fechados e ate onde vai a janela de reserva. Nao fala de reserva de
 * ninguem — sao so as regras da casa, as mesmas que estao na porta.
 *
 * Feriado e bloqueio de dia inteiro NAO entram aqui de proposito: o dia
 * continua no calendario e aparece sem horarios livres quando o cliente toca
 * nele. Assim o cliente nao descobre a agenda interna pela ausencia de dias.
 */
export async function GET(): Promise<NextResponse<RespostaAgenda>> {
  const [horarios, parametros] = await Promise.all([
    prisma.horarioFuncionamento.findMany({ orderBy: { diaDaSemana: "asc" } }),
    carregarParametros(),
  ]);

  const textos = await textosParaOSite(parametros.janelaCancelamentoHoras);
  const horaInicioNoturno = await lerHoraInicioNoturno();

  const agora = new Date();

  return NextResponse.json({
    diasFechados: horarios
      .filter((horario) => !horario.aberto)
      .map((horario) => horario.diaDaSemana),
    diasAbertos: horarios
      .filter(
        (horario) =>
          horario.aberto && horario.horaAbertura && horario.horaFechamento,
      )
      .map((horario) => ({
        diaDaSemana: horario.diaDaSemana,
        horaAbertura: horario.horaAbertura ?? "",
        horaFechamento: horario.horaFechamento ?? "",
      })),
    primeiraData: dataLocalDe(
      somarMinutos(agora, parametros.antecedenciaMinimaMinutos),
    ),
    ultimaData: dataLocalDe(
      somarMinutos(agora, parametros.antecedenciaMaximaDias * 24 * 60),
    ),
    antecedenciaMinimaMinutos: parametros.antecedenciaMinimaMinutos,
    antecedenciaMaximaDias: parametros.antecedenciaMaximaDias,
    duracaoMinimaMinutos: parametros.duracaoMinimaMinutos,
    janelaCancelamentoHoras: parametros.janelaCancelamentoHoras,
    horaInicioNoturno,
    textos,
  });
}
