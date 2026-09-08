/** Conversa do dashboard com o servidor. So leitura. */
import { pedir } from "@/components/admin/configuracoes/api";

export type Fatia = { rotulo: string; total: number };
export type FatiaColorida = Fatia & { cor: string };
export type PontoNoTempo = { data: string; total: number };
export type BarraDoDia = { diaDaSemana: number; rotulo: string; total: number };

export type Periodo = { de: string; ate: string };

export type Relatorio = {
  periodo: Periodo;
  total: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  porDia: PontoNoTempo[];
  porDiaDaSemana: BarraDoDia[];
  porHora: Fatia[];
  porProfissao: Fatia[];
};

export type Comparacao = {
  atual: Relatorio;
  anterior: Relatorio;
  variacaoPercentual: number | null;
  variacaoAbsoluta: number;
};

export function buscarRelatorio(
  periodo: Periodo,
  comparacao: Periodo | null,
  sinal?: AbortSignal,
): Promise<Comparacao> {
  const busca = new URLSearchParams({ de: periodo.de, ate: periodo.ate });

  if (comparacao) {
    busca.set("compararDe", comparacao.de);
    busca.set("compararAte", comparacao.ate);
  }

  return pedir(`/api/admin/relatorios?${busca}`, { signal: sinal });
}
