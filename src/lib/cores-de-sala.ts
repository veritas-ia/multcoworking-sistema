/**
 * AS CORES QUE UMA SALA PODE TER NA AGENDA.
 *
 * Paleta FECHADA, e nao cor livre. Dois motivos:
 *
 *   1. contraste. Todas as cores daqui foram escolhidas para funcionar com
 *      texto PRETO em cima, como o amarelo da marca (CLAUDE.md). Com cor
 *      livre, alguem escolheria um azul-marinho e a agenda ficaria ilegivel
 *      sem ninguem entender por que;
 *   2. a cor da sala nao pode competir com a leitura da SITUACAO da reserva,
 *      que se distingue por borda, textura e texto — nunca so por cor.
 */
export type CorDeSala = { valor: string; nome: string };

export const PALETA: readonly CorDeSala[] = [
  { valor: "#FFC700", nome: "Amarelo da marca" },
  { valor: "#9AD5F0", nome: "Azul claro" },
  { valor: "#B7E4A0", nome: "Verde claro" },
  { valor: "#F5B7C8", nome: "Rosa claro" },
  { valor: "#D9C2F0", nome: "Lilás" },
  { valor: "#FFD9A0", nome: "Laranja claro" },
  { valor: "#A8E6DA", nome: "Verde-água" },
  { valor: "#E5E5E5", nome: "Cinza" },
] as const;

export const COR_PADRAO = PALETA[0]!.valor;

/** So "#RRGGBB". Qualquer outra coisa vira estilo quebrado na tela. */
export function ehCorValida(cor: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(cor);
}

/** A cor esta na paleta oferecida? */
export function estaNaPaleta(cor: string): boolean {
  return PALETA.some((item) => item.valor.toLowerCase() === cor.toLowerCase());
}
