/** Conversa da area "Minhas reservas" com o servidor. */
import { ErroDaApi } from "@/components/reserva/api";
import type { TextosDePolitica } from "@/components/reserva/tipos";

export type ReservaDoCliente = {
  id: string;
  salaId: string;
  sala: string;
  data: string;
  inicio: string;
  fim: string;
  valor: string;
  status: string;
  /** Ja considera prazo e status. Quem decide e o servidor. */
  podeAlterar: boolean;
};

export type ListaDeReservas = {
  futuras: ReservaDoCliente[];
  historico: ReservaDoCliente[];
  janelaCancelamentoHoras: number;
  horaInicioNoturno: string;
  textos: TextosDePolitica;
};

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

export function buscarMinhasReservas(sinal?: AbortSignal): Promise<ListaDeReservas> {
  return pedir("/api/publico/minhas-reservas", { signal: sinal });
}

/** Manda um codigo novo para o telefone da sessao. */
export function pedirCodigoDaSessao(): Promise<{ validadeMinutos: number }> {
  return pedir("/api/publico/minhas-reservas/codigo", { method: "POST" });
}

export function cancelar(reservaId: string, codigo: string): Promise<{ id: string }> {
  return pedir(`/api/publico/minhas-reservas/${reservaId}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ codigo }),
  });
}

export function reagendar(
  reservaId: string,
  entrada: { codigo: string; salaId: string; data: string; inicio: string; fim: string },
): Promise<{ sala: string; data: string; inicio: string; fim: string; valorEstimado: string }> {
  return pedir(`/api/publico/minhas-reservas/${reservaId}/reagendar`, {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}
