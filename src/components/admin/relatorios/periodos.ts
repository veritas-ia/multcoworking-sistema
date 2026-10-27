/**
 * Os atalhos de periodo do dashboard.
 *
 * As contas sao feitas em cima do texto "AAAA-MM-DD", e nao com o Date do
 * navegador: o tablet da recepcao pode estar em outro fuso, e a data do
 * relatorio tem de ser a mesma que o servidor usa.
 */
export type Periodo = { de: string; ate: string };

export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const base = new Date(Date.UTC(ano!, mes! - 1, dia!));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

export type Atalho = {
  id: string;
  rotulo: string;
  /** Recebe "hoje" no relogio de Sao Paulo, vindo do servidor. */
  calcular: (hoje: string) => Periodo;
};

export const ATALHOS: readonly Atalho[] = [
  {
    id: "7dias",
    rotulo: "Últimos 7 dias",
    calcular: (hoje) => ({ de: somarDias(hoje, -6), ate: hoje }),
  },
  {
    id: "30dias",
    rotulo: "Últimos 30 dias",
    calcular: (hoje) => ({ de: somarDias(hoje, -29), ate: hoje }),
  },
  {
    id: "mes",
    rotulo: "Este mês",
    calcular: (hoje) => ({ de: `${hoje.slice(0, 7)}-01`, ate: hoje }),
  },
] as const;

/**
 * O periodo com que o relatorio ABRE.
 *
 * Trinta dias, e nao sete (mudado em 27/10/2026). Sete dias respondia a
 * pergunta errada: quem abre o relatorio quer saber quanto um cliente usou, e
 * uma semana nunca e essa resposta. O dono do coworking leu "poucas horas" da
 * Toca Imoveis achando que era o total, quando era so a ultima semana — as
 * horas estavam todas no banco.
 *
 * Nao e o primeiro da lista de proposito: na tela os atalhos seguem na ordem
 * 7, 30, este mes, que e a ordem que se le. Qual deles abre e outra decisao.
 */
export const ATALHO_PADRAO: Atalho = ATALHOS.find((a) => a.id === "30dias")!;

/** "2026-11-02" -> "02/11/2026". */
export function porExtensoCurto(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}
