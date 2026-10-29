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
  /**
   * Esta linha é um NOME dentro de um telefone de balcão, e não o número
   * inteiro. Para abrir, tem de mandar o nome junto — senão vêm as reservas
   * de todas as pessoas que usam aquele telefone.
   */
  separadoPorNome: boolean;
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
  /** Soma do valor gravado nas reservas não canceladas, em centavos. */
  faturamentoCentavos: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  reservas: ReservaDoCliente[];
};

export type HorasDaEmpresa = {
  id: string;
  nome: string;
  horas: number;
  reservas: number;
};

export type PessoaDaEmpresa = {
  nome: string;
  telefoneVisivel: string;
  horas: number;
  reservas: number;
};

export type DetalheDaEmpresa = {
  periodo: Periodo;
  id: string;
  nome: string;
  horas: number;
  totalDeReservas: number;
  /** Soma do valor gravado nas reservas não canceladas, em centavos. */
  faturamentoCentavos: number;
  porSala: FatiaColorida[];
  porStatus: Fatia[];
  pessoas: PessoaDaEmpresa[];
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
  horasPorEmpresa: HorasDaEmpresa[];
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

/**
 * O relatorio de UM cliente no periodo.
 *
 * O "nome" so e mandado quando a linha veio separada por nome, num telefone
 * de balcao. Nos numeros normais o servidor ignora.
 */
export function buscarDetalheDoCliente(
  periodo: Periodo,
  telefone: string,
  nome?: string,
  sinal?: AbortSignal,
): Promise<{ detalheDoCliente: DetalheDoCliente }> {
  const busca = new URLSearchParams({
    de: periodo.de,
    ate: periodo.ate,
    telefone,
  });

  if (nome) {
    busca.set("nomeCliente", nome);
  }

  return pedir(`/api/admin/relatorios?${busca}`, { signal: sinal });
}

/** O relatorio de UMA empresa no periodo. */
export function buscarDetalheDaEmpresa(
  periodo: Periodo,
  empresaId: string,
  sinal?: AbortSignal,
): Promise<{ detalheDaEmpresa: DetalheDaEmpresa }> {
  const busca = new URLSearchParams({
    de: periodo.de,
    ate: periodo.ate,
    empresaId,
  });

  return pedir(`/api/admin/relatorios?${busca}`, { signal: sinal });
}
