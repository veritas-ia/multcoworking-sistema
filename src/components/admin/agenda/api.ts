/** Conversa da agenda do painel com o servidor. */
import { ErroDaApi } from "@/components/reserva/api";

import type { ItemDaAgenda, ReservaDetalhada } from "./tipos";

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

export function buscarAgendaAdmin(
  entrada: { de: string; ate: string; salaId?: string },
  sinal?: AbortSignal,
): Promise<{ itens: ItemDaAgenda[] }> {
  const busca = new URLSearchParams({ de: entrada.de, ate: entrada.ate });
  if (entrada.salaId) {
    busca.set("salaId", entrada.salaId);
  }
  return pedir(`/api/admin/agenda?${busca}`, { signal: sinal });
}

export function buscarReserva(
  id: string,
  sinal?: AbortSignal,
): Promise<ReservaDetalhada> {
  return pedir(`/api/admin/reservas/${id}`, { signal: sinal });
}

export function criarNaRecepcao(entrada: {
  salaId: string;
  telefone: string;
  nome: string;
  data: string;
  inicio: string;
  fim: string;
}): Promise<{ id: string }> {
  return pedir("/api/admin/reservas", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

export function editarCadastroDaReserva(
  id: string,
  entrada: { nome: string; telefone: string },
): Promise<{ id: string }> {
  return pedir(`/api/admin/reservas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(entrada),
  });
}

export function cancelarComoAdmin(id: string): Promise<{ id: string }> {
  return pedir(`/api/admin/reservas/${id}/cancelar`, { method: "POST" });
}

export function reagendarComoAdmin(
  id: string,
  entrada: { salaId: string; data: string; inicio: string; fim: string },
): Promise<{ id: string }> {
  return pedir(`/api/admin/reservas/${id}/reagendar`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}
