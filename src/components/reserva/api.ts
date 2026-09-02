/**
 * Conversa da tela com as rotas publicas.
 *
 * Toda resposta de erro do servidor vira um ErroDaApi com a mensagem que o
 * proprio servidor escreveu — a tela nunca inventa texto de erro de regra de
 * negocio. Sem internet, a mensagem e generica e o status fica 0.
 */
import type { Agenda, Bloco, ReservaCriada, Sala, Sessao } from "./tipos";

export class ErroDaApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly codigo: string | null = null,
  ) {
    super(mensagem);
    this.name = "ErroDaApi";
  }
}

type CorpoDeErro = { erro?: string; codigo?: string };

function lerErro(corpo: unknown): CorpoDeErro {
  return typeof corpo === "object" && corpo !== null ? (corpo as CorpoDeErro) : {};
}

async function pedir<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;

  try {
    resposta = await fetch(caminho, {
      ...init,
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ErroDaApi(
      0,
      "Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.",
    );
  }

  const corpo: unknown = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const { erro, codigo } = lerErro(corpo);
    throw new ErroDaApi(
      resposta.status,
      erro ?? "Algo deu errado por aqui. Tente de novo em instantes.",
      codigo ?? null,
    );
  }

  return corpo as T;
}

export function buscarSalas(sinal?: AbortSignal): Promise<{ salas: Sala[] }> {
  return pedir("/api/publico/salas", { signal: sinal });
}

export function buscarAgenda(sinal?: AbortSignal): Promise<Agenda> {
  return pedir("/api/publico/agenda", { signal: sinal });
}

export function buscarSessao(sinal?: AbortSignal): Promise<Sessao> {
  return pedir("/api/publico/sessao", { signal: sinal });
}

export function encerrarSessao(): Promise<{ mensagem: string }> {
  return pedir("/api/publico/sessao", { method: "DELETE" });
}

export function buscarBlocos(
  salaId: string,
  data: string,
  sinal?: AbortSignal,
  /** Reagendamento: a reserva sendo remarcada nao ocupa o proprio horario. */
  reservaId?: string,
): Promise<{ data: string; blocos: Bloco[] }> {
  const busca = new URLSearchParams({ salaId, data });
  if (reservaId) {
    busca.set("reservaId", reservaId);
  }
  return pedir(`/api/publico/disponibilidade?${busca}`, { signal: sinal });
}

export function buscarTerminos(
  salaId: string,
  data: string,
  inicio: string,
  sinal?: AbortSignal,
  reservaId?: string,
): Promise<{ inicio: string; terminos: string[] }> {
  const busca = new URLSearchParams({ salaId, data, inicio });
  if (reservaId) {
    busca.set("reservaId", reservaId);
  }
  return pedir(`/api/publico/terminos?${busca}`, { signal: sinal });
}

export function enviarCodigo(telefone: string): Promise<{ validadeMinutos: number }> {
  return pedir("/api/publico/verificacao/enviar", {
    method: "POST",
    body: JSON.stringify({ telefone }),
  });
}

export function confirmarCodigo(
  telefone: string,
  codigo: string,
): Promise<{ expiraEm: string }> {
  return pedir("/api/publico/verificacao/confirmar", {
    method: "POST",
    body: JSON.stringify({ telefone, codigo }),
  });
}

export function criarReserva(entrada: {
  salaId: string;
  data: string;
  inicio: string;
  fim: string;
  nome: string;
}): Promise<ReservaCriada> {
  return pedir("/api/publico/reservas", {
    method: "POST",
    body: JSON.stringify({ ...entrada, aceitePolitica: true }),
  });
}

/** Texto de erro pronto para a tela, venha ele de onde vier. */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDaApi) {
    return erro.message;
  }
  return "Algo deu errado por aqui. Tente de novo em instantes.";
}
