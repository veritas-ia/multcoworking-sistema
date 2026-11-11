/** Conversa da tela de demonstrativos com o servidor. */
import { pedir } from "@/components/admin/configuracoes/api";

export type ItemDoDemonstrativo = {
  dia: string;
  sala: string;
  inicio: string;
  fim: string;
  horas: number;
};

export type LinhaExtra = { descricao: string; valor: string };

export type Demonstrativo = {
  id: string | null;
  clienteId: string;
  clienteNome: string;
  de: string;
  ate: string;
  valorHora: string;
  itens: ItemDoDemonstrativo[];
  porSala: { sala: string; horas: number }[];
  horas: number;
  linhasExtras: LinhaExtra[];
  valorDasHorasCentavos: number;
  valorDasLinhasCentavos: number;
  totalCalculadoCentavos: number;
  totalAjustado: string | null;
  totalCentavos: number;
  enviadoEm: string | null;
};

export type DemonstrativoNaLista = {
  id: string;
  clienteNome: string;
  de: string;
  ate: string;
  horas: number;
  totalCentavos: number;
  enviadoEm: string | null;
};

/**
 * A pré-visualização, montada a partir das reservas. NÃO grava nada: a gestão
 * mexe no período e no preço à vontade antes de salvar.
 */
export function previsualizar(
  entrada: { clienteId: string; de: string; ate: string; valorHora?: string },
  sinal?: AbortSignal,
): Promise<{ demonstrativo: Demonstrativo }> {
  const busca = new URLSearchParams({
    clienteId: entrada.clienteId,
    de: entrada.de,
    ate: entrada.ate,
  });

  if (entrada.valorHora) {
    busca.set("valorHora", entrada.valorHora);
  }

  return pedir(`/api/admin/demonstrativos?${busca}`, { signal: sinal });
}

export function listarEmitidos(
  clienteId?: string,
  sinal?: AbortSignal,
): Promise<{ emitidos: DemonstrativoNaLista[] }> {
  const busca = new URLSearchParams(clienteId ? { clienteId } : {});
  return pedir(`/api/admin/demonstrativos?${busca}`, { signal: sinal });
}

export function salvarDemonstrativo(entrada: {
  id?: string | null;
  clienteId: string;
  de: string;
  ate: string;
  valorHora: string;
  linhasExtras: LinhaExtra[];
  totalAjustado: string | null;
  lembrarPreco: boolean;
}): Promise<{ demonstrativo: Demonstrativo }> {
  return pedir("/api/admin/demonstrativos", {
    method: "POST",
    body: JSON.stringify(entrada),
  });
}

export function enviarPeloWhatsapp(
  id: string,
  telefone: string,
): Promise<{ mensagem: string }> {
  return pedir(`/api/admin/demonstrativos/${id}/enviar`, {
    method: "POST",
    body: JSON.stringify({ telefone }),
  });
}

/** O endereço do PDF. A tela abre numa aba nova para o navegador baixar. */
export function enderecoDoPdf(id: string): string {
  return `/api/admin/demonstrativos/${id}/pdf`;
}
