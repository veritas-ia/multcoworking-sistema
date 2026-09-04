/**
 * SUBSTITUTO VAZIO DO AGENDADOR (so para o empacotador).
 *
 * O `middleware.ts` roda num ambiente restrito, sem banco e sem os modulos do
 * Node. Como ele existe, o Next monta o `instrumentation.ts` DUAS vezes: uma
 * para o servidor de verdade e outra para esse ambiente restrito — e na segunda
 * ele tenta abrir o node-cron e o driver do Postgres, que nao cabem la.
 *
 * O `register()` do `instrumentation.ts` ja desiste antes de chamar qualquer
 * coisa daqui quando nao esta no servidor de verdade. Este arquivo so ocupa o
 * lugar do agendador nessa montagem (trocado no `next.config.ts`), para que o
 * empacotador nao precise abrir o que nunca vai rodar. Se um dia rodar, nao faz
 * nada — de proposito.
 */
export function ligarRotinas(): void {
  // Nada a fazer fora do servidor.
}
