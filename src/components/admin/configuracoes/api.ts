/** Conversa das telas de configuracao com o servidor (Fase 11). */
import { ErroDaApi } from "@/components/reserva/api";

type CorpoDeErro = { erro?: string; codigo?: string };

function lerErro(corpo: unknown): CorpoDeErro {
  return typeof corpo === "object" && corpo !== null ? (corpo as CorpoDeErro) : {};
}

export async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;

  try {
    resposta = await fetch(caminho, {
      ...init,
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ErroDaApi(0, "Não conseguimos falar com o servidor. Verifique sua conexão.");
  }

  const corpo: unknown = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const { erro, codigo } = lerErro(corpo);
    throw new ErroDaApi(
      resposta.status,
      erro ?? "Algo deu errado por aqui. Tente de novo.",
      codigo ?? null,
    );
  }

  return corpo as T;
}

// -----------------------------------------------------------------------------
// Parametros
// -----------------------------------------------------------------------------

export type ParametroNaTela = {
  chave: string;
  rotulo: string;
  ajuda: string;
  unidade: string;
  minimo: number;
  maximo: number;
  multiploDe?: number;
  valor: number;
};

export type LimitesDoCodigo = {
  minutosDeValidade: number;
  maximoDeTentativas: number;
  minutosDeBloqueio: number;
  porMinutoPorNumero: number;
  porHoraPorNumero: number;
  porHoraPorIp: number;
};

export type RespostaDeParametros = {
  parametros: ParametroNaTela[];
  intervaloMinutos: number;
  codigoWhatsapp: LimitesDoCodigo;
};

export function buscarParametros(sinal?: AbortSignal): Promise<RespostaDeParametros> {
  return pedir("/api/admin/parametros", { signal: sinal });
}

export function salvarParametros(
  valores: Record<string, number>,
): Promise<RespostaDeParametros> {
  return pedir("/api/admin/parametros", {
    method: "PATCH",
    body: JSON.stringify(valores),
  });
}

// -----------------------------------------------------------------------------
// Salas
// -----------------------------------------------------------------------------

export type SalaDoPainel = {
  id: string;
  nome: string;
  slug: string;
  ativa: boolean;
  capacidade: number | null;
  precoPorHora: string;
  duracaoMaximaMinutos: number | null;
  ordem: number;
  reservasFuturas: number;
};

export type DadosDeSala = {
  nome: string;
  capacidade: number | null;
  precoPorHora: number;
  duracaoMaximaMinutos: number | null;
  ordem: number;
};

export function buscarSalas(sinal?: AbortSignal): Promise<{ salas: SalaDoPainel[] }> {
  return pedir("/api/admin/salas", { signal: sinal });
}

export function criarSala(dados: DadosDeSala): Promise<{ sala: SalaDoPainel }> {
  return pedir("/api/admin/salas", { method: "POST", body: JSON.stringify(dados) });
}

export function salvarSala(
  id: string,
  dados: DadosDeSala,
): Promise<{ sala: SalaDoPainel }> {
  return pedir(`/api/admin/salas/${id}`, { method: "PATCH", body: JSON.stringify(dados) });
}

export function ligarOuDesligarSala(
  id: string,
  ativa: boolean,
): Promise<{ sala: SalaDoPainel }> {
  return pedir(`/api/admin/salas/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ativa }),
  });
}

// -----------------------------------------------------------------------------
// Horario de funcionamento
// -----------------------------------------------------------------------------

export type DiaDeFuncionamento = {
  diaDaSemana: number;
  aberto: boolean;
  horaAbertura: string | null;
  horaFechamento: string | null;
};

export type ReservaForaDoHorario = {
  id: string;
  sala: string;
  nomeCliente: string;
  telefone: string;
  data: string;
  inicio: string;
  fim: string;
  status: string;
  motivo: string;
};

export function buscarHorarios(
  sinal?: AbortSignal,
): Promise<{ horarios: DiaDeFuncionamento[] }> {
  return pedir("/api/admin/horarios", { signal: sinal });
}

export function conferirHorarios(
  horarios: DiaDeFuncionamento[],
): Promise<{ reservas: ReservaForaDoHorario[] }> {
  return pedir("/api/admin/horarios/conferir", {
    method: "POST",
    body: JSON.stringify({ horarios }),
  });
}

export function salvarHorarios(
  horarios: DiaDeFuncionamento[],
): Promise<{ horarios: DiaDeFuncionamento[]; reservasForaDoHorario: ReservaForaDoHorario[] }> {
  return pedir("/api/admin/horarios", {
    method: "PUT",
    body: JSON.stringify({ horarios }),
  });
}

// -----------------------------------------------------------------------------
// Politicas (textos que o cliente le no site)
// -----------------------------------------------------------------------------

export type DefinicaoPolitica = {
  chave: string;
  rotulo: string;
  ajuda: string;
  variaveis: string[];
  padrao: string;
  maximo: number;
};

export type RespostaDePoliticas = {
  definicoes: DefinicaoPolitica[];
  textos: Record<string, string>;
};

export function buscarPoliticas(sinal?: AbortSignal): Promise<RespostaDePoliticas> {
  return pedir("/api/admin/politicas", { signal: sinal });
}

export function salvarPoliticas(
  textos: Record<string, string>,
): Promise<RespostaDePoliticas> {
  return pedir("/api/admin/politicas", { method: "PATCH", body: JSON.stringify(textos) });
}
