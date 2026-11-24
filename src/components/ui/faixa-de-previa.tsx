import { ehPrevia, ROTULO_DA_PREVIA } from "@/lib/ambiente";

/**
 * A FAIXA QUE AVISA "ISTO NAO E O SISTEMA DE VERDADE".
 *
 * A previa e uma copia do sistema, com o mesmo visual e as mesmas telas. Em
 * duas abas abertas, nada distingue uma da outra — e o acidente e sempre o
 * mesmo: a recepcao lanca a reserva de um cliente na previa, ela nunca chega
 * na agenda de verdade, e o cliente aparece no dia sem sala.
 *
 * Por isso a faixa aparece em TODA pagina, publica e do painel, e fica
 * grudada no topo quando a pagina rola. Preto com amarelo de proposito: e
 * lido como recado do sistema, e nao como parte do site.
 *
 * Em producao ela simplesmente nao existe — "ehPrevia()" e falso e o
 * componente nao desenha nada.
 */
export function FaixaDePrevia() {
  if (!ehPrevia()) {
    return null;
  }

  return (
    <div
      role="note"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-black px-4 py-1.5 text-center text-sm leading-snug text-white"
    >
      <strong className="rounded-sm bg-brand px-1.5 py-0.5 text-xs font-bold tracking-wide text-brand-foreground">
        {ROTULO_DA_PREVIA}
      </strong>
      <span>
        Ambiente de demonstração. Nada aqui chega ao cliente, e as reservas não
        valem na agenda de verdade.
      </span>
    </div>
  );
}
