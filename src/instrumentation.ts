/**
 * Gancho que o Next chama uma vez, quando o servidor sobe.
 *
 * E daqui que as rotinas automaticas (Fase 10) sao ligadas — no MESMO processo
 * do site, como o CLAUDE.md pede.
 */
export async function register(): Promise<void> {
  // O middleware roda num ambiente restrito, sem acesso ao banco nem a timers
  // longos. So ligamos o relogio no processo de servidor de verdade.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ligarRotinas } = await import("@/lib/agendador");
  ligarRotinas();
}
