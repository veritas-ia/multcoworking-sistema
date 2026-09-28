/** Conversa do dashboard com o servidor. So leitura. */
import { pedir } from "@/components/admin/configuracoes/api";

export type Fatia = { rotulo: string; total: number };
export type FatiaColorida = Fatia & { cor: string };
export type PontoNoTempo = { data: string; total: number };
export type BarraDoDia = { diaDaSemana: number; rotulo: string; total: number };

export type Periodo = { de: string; ate: string };

export type HorasDoCliente = {
  telefone: string;
  nome: string;
  horas: number;
  reservas: number;
};

export type ReservaDoCliente = {
  data: string;
  sala: string;
  inicio: string;
  fim: string;
  duracaoHoras: number;
  status: string;
};

export type DetalheDoCliente = {
  periodo: Periodo;
  telefone: string;
  nome: string;
  profissao: string;
  profissaoDivergente: boolean;
  horas: number;
  totalDeReservas: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  reservas: ReservaDoCliente[];
};

export type Relatorio = {
  periodo: Periodo;
  total: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  porDia: PontoNoTempo[];
  porDiaDaSemana: BarraDoDia[];
  porHora: Fatia[];
  porProfissao: Fatia[];
  horasPorCliente: HorasDoCliente[];
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

/** Procura clientes com reserva no periodo, por telefone ou por nome. */
export function buscarClientes(
  periodo: Periodo,
  termo: string,
  sinal?: AbortSignal,
): Promise<{ clientes: HorasDoCliente[] }> {
  const busca = new URLSearchParams({
    de: periodo.de,
    ate: periodo.ate,
    cliente: termo,
  });

  return pedir(`/api/admin/relatorios?${busca}`, { signal: sinal });
}

/** O relatorio de UM cliente no periodo. */
export function buscarDetalheDoCliente(
  periodo: Periodo,
  telefone: string,
  sinal?: AbortSignal,
): Promise<{ detalheDoCliente: DetalheDoCliente }> {
  const busca = new URLSearchParams({
    de: periodo.de,
    ate: periodo.ate,
    telefone,
  });

  return pedir(`/api/admin/relatorios?${busca}`, { signal: sinal });
}
