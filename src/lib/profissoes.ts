/**
 * AS CATEGORIAS DE PROFISSAO.
 *
 * Perguntadas na reserva e usadas so no relatorio do painel: elas nao entram
 * em preco, em disponibilidade nem em regra nenhuma da agenda.
 *
 * A lista fica aqui, num lugar so, porque ela aparece em quatro telas (site,
 * recepcao, serie e relatorio). Espalhada, uma opcao nova entraria em umas e
 * ficaria faltando noutras.
 */
import { CategoriaProfissao } from "@/generated/prisma/enums";

export type OpcaoDeProfissao = {
  valor: CategoriaProfissao;
  /** Como aparece na tela, do jeito que o cliente entende. */
  rotulo: string;
};

export const PROFISSOES: readonly OpcaoDeProfissao[] = [
  { valor: "MARKETING", rotulo: "Marketing" },
  { valor: "JURIDICO", rotulo: "Jurídico" },
  { valor: "CONTABIL", rotulo: "Contábil" },
  { valor: "SAUDE", rotulo: "Área da Saúde" },
  { valor: "OUTROS", rotulo: "Outros" },
] as const;

/** Como o relatorio chama as reservas antigas, anteriores a este campo. */
export const NAO_INFORMADO = "Não informado";

export function ehProfissaoValida(valor: string): valor is CategoriaProfissao {
  return PROFISSOES.some((opcao) => opcao.valor === valor);
}

/** O nome de tela de uma profissao. Nulo vira "Nao informado". */
export function rotuloDaProfissao(valor: CategoriaProfissao | null): string {
  if (valor === null) {
    return NAO_INFORMADO;
  }

  return PROFISSOES.find((opcao) => opcao.valor === valor)?.rotulo ?? valor;
}
