/**
 * Cores da agenda.
 *
 * So a paleta do CLAUDE.md, com uma excecao consciente: cancelada usa o
 * vermelho de erro que ja existe (--destructive) e concluida usa cinza. As
 * quatro situacoes tambem se distinguem por TEXTURA e TEXTO, nunca so por cor
 * — quem nao enxerga bem cores continua conseguindo ler a agenda.
 */
export type EstiloDoItem = {
  caixa: string;
  rotulo: string;
};

const POR_STATUS: Record<string, EstiloDoItem> = {
  CONFIRMADA: {
    caixa: "border-black bg-brand text-black",
    rotulo: "Confirmada",
  },
  REAGENDADA: {
    // Mesma familia da confirmada (esta ativa), com borda tracejada para
    // dizer "esta foi remarcada" sem depender de enxergar a cor.
    caixa: "border-black border-dashed bg-brand/60 text-black",
    rotulo: "Remarcada",
  },
  CANCELADA: {
    caixa: "border-destructive bg-bg-primary text-text-secondary line-through",
    rotulo: "Cancelada",
  },
  CONCLUIDA: {
    caixa: "border-border bg-bg-secondary text-text-secondary",
    rotulo: "Concluída",
  },
};

const BLOQUEIO: EstiloDoItem = {
  caixa:
    "border-text-primary bg-[repeating-linear-gradient(45deg,#E5E5E5_0px,#E5E5E5_6px,#F7F7F7_6px,#F7F7F7_12px)] text-text-primary",
  rotulo: "Bloqueio",
};

export function estiloDoItem(tipo: string, status?: string): EstiloDoItem {
  if (tipo === "BLOQUEIO") {
    return BLOQUEIO;
  }
  return POR_STATUS[status ?? ""] ?? POR_STATUS.CONFIRMADA;
}

export function rotuloDoStatus(status: string): string {
  return POR_STATUS[status]?.rotulo ?? status;
}
