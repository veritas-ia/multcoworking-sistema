/**
 * Que codigo HTTP cada recusa do financeiro vira.
 *
 * Fica FORA do route.ts pela mesma razao do "status.ts" do emporio: um
 * "route.ts" do Next 15 so pode exportar metodos HTTP e configuracao, e
 * qualquer outra exportacao derruba o `next build` — num erro que nem o `tsc`
 * nem o lint acusam.
 */
export function statusDoFinanceiro(codigo: string): number {
  if (codigo === "NAO_ENCONTRADA" || codigo === "NAO_ENCONTRADO") {
    return 404;
  }

  return 422;
}
