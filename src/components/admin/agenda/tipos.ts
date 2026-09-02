/** O que a agenda do painel troca com o servidor. */

export type ItemDaAgenda = {
  tipo: "RESERVA" | "BLOQUEIO";
  id: string;
  salaId: string;
  sala: string;
  /** "AAAA-MM-DD" no relogio de Sao Paulo. */
  data: string;
  inicio: string;
  fim: string;
  inicioIso: string;
  fimIso: string;
  /** So em RESERVA. */
  status?: string;
  origem?: string;
  nomeCliente?: string;
  telefone?: string;
  valor?: string;
  /** So em BLOQUEIO. */
  motivo?: string | null;
};

export type EntradaDeHistorico = {
  em: string;
  acao: "CRIADA" | "REAGENDADA" | "CANCELADA" | "EDITADA";
  por: "CLIENTE" | "ADMIN";
  quemNome?: string;
  de?: { salaId: string; inicio: string; fim: string; valor: string };
  para?: { salaId: string; inicio: string; fim: string; valor: string };
  camposEditados?: string[];
};

export type ReservaDetalhada = {
  id: string;
  salaId: string;
  sala: string;
  nomeCliente: string;
  telefone: string;
  data: string;
  inicio: string;
  fim: string;
  duracaoMinutos: number;
  valor: string;
  status: string;
  origem: string;
  criadoEm: string;
  canceladoEm: string | null;
  historico: EntradaDeHistorico[];
};

export type Visao = "dia" | "semana" | "mes";

export const VISOES: { chave: Visao; rotulo: string }[] = [
  { chave: "dia", rotulo: "Dia" },
  { chave: "semana", rotulo: "Semana" },
  { chave: "mes", rotulo: "Mês" },
];
