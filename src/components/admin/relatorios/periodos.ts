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

/** "2026-11-02" -> "02/11/2026". */
export function porExtensoCurto(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}
