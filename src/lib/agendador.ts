/**
 * O RELOGIO DAS ROTINAS (Fase 10).
 *
 * node-cron rodando DENTRO do mesmo processo do site, como o CLAUDE.md manda.
 * Isso so e seguro porque a producao e um servidor fixo, ligado 24/7 (EasyPanel
 * na Hostinger) — num ambiente que sobe e desce varias copias, duas copias
 * mandariam o mesmo lembrete. Se um dia isso mudar, a marcacao condicional das
 * rotinas continua protegendo contra o envio dobrado.
 *
 * Fica DESLIGADO por padrao. So liga com CRON_ATIVO="true" no .env — assim
 * ninguem dispara WhatsApp de verdade rodando o projeto no proprio computador.
 */
import cron from "node-cron";

import { faxina, passadaDeRotina } from "@/lib/rotinas";

const FUSO = "America/Sao_Paulo";

/** De 5 em 5 minutos: lembretes e marcar concluidas. */
const A_CADA_CINCO_MINUTOS = "*/5 * * * *";

/** Todo dia as 4h da manha, quando ninguem esta usando. */
const TODA_MADRUGADA = "0 4 * * *";

let jaLigado = false;

function anotar(mensagem: string): void {
  process.stdout.write(`[rotinas] ${mensagem}\n`);
}

/**
 * Liga o relogio. Chamar mais de uma vez nao duplica as tarefas: em
 * desenvolvimento o Next recarrega o modulo a cada mudanca de arquivo, e sem
 * essa trava as rotinas iriam se acumulando.
 */
export function ligarRotinas(): void {
  if (jaLigado) {
    return;
  }

  if (process.env.CRON_ATIVO?.trim() !== "true") {
    anotar('desligadas (CRON_ATIVO nao e "true")');
    return;
  }

  jaLigado = true;

  cron.schedule(
    A_CADA_CINCO_MINUTOS,
    () => {
      void passadaDeRotina()
        .then((resumo) => {
          const total =
            resumo.lembrete13h.enviados + resumo.lembrete3h.enviados + resumo.concluidas;
          // So fala quando fez alguma coisa: senao seriam 288 linhas por dia
          // dizendo "nada a fazer".
          if (total > 0) {
            anotar(
              `${resumo.lembrete13h.enviados} lembretes de 13h, ` +
                `${resumo.lembrete3h.enviados} de 3h, ` +
                `${resumo.concluidas} reservas concluidas`,
            );
          }
        })
        .catch((erro: unknown) => {
          // Um tick que falha nao pode derrubar o site inteiro.
          anotar(`falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
        });
    },
    { timezone: FUSO },
  );

  cron.schedule(
    TODA_MADRUGADA,
    () => {
      void faxina()
        .then((resultado) => {
          anotar(
            `faxina: ${resultado.codigos} codigos, ${resultado.sessoes} sessoes, ` +
              `${resultado.tentativasDeLogin} tentativas de login`,
          );
        })
        .catch((erro: unknown) => {
          anotar(`faxina falhou: ${erro instanceof Error ? erro.message : String(erro)}`);
        });
    },
    { timezone: FUSO },
  );

  anotar("ligadas: lembretes de 5 em 5 min, faxina as 4h (America/Sao_Paulo)");
}
