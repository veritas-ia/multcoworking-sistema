/**
 * Que codigo HTTP cada recusa do emporio vira.
 *
 * POR QUE ESTE ARQUIVO EXISTE, e nao uma funcao exportada do route.ts:
 * um arquivo "route.ts" do Next 15 so pode exportar os metodos HTTP e alguns
 * campos de configuracao. Qualquer outra exportacao faz o build FALHAR com
 * *"'statusDoEmporio' is not a valid Route export field"* — e o erro aparece
 * so no `next build`, nunca no `tsc` nem no lint.
 *
 * Mesmo lugar e mesma razao de "operador.ts", ao lado.
 */
export function statusDoEmporio(codigo: string): number {
  if (codigo === "NAO_ENCONTRADO") {
    return 404;
  }

  // "Sem Cloudinary" e 503: nao e culpa de quem pediu, e passa a funcionar
  // quando as variaveis forem preenchidas no servidor.
  return codigo === "CLOUDINARY_DESLIGADO" ? 503 : 422;
}
