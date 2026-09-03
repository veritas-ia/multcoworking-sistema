"use client";

import { dataCurta } from "@/components/reserva/datas";
import { Botao } from "@/components/ui/botao";

import type { RelatorioDaSerie } from "./api";

/**
 * O que a serie criou e o que ficou de fora.
 *
 * O CLAUDE.md pede um relatorio claro: nao basta dizer "pronto", a equipe
 * precisa saber exatamente quais datas nao entraram e por que — senao ela
 * descobre pelo cliente reclamando.
 */
export function RelatorioDaSerieCriada({
  relatorio,
  aoFechar,
}: {
  relatorio: RelatorioDaSerie;
  aoFechar: () => void;
}) {
  const porDiaFechado = relatorio.puladas.filter((p) => p.tipo === "DIA_FECHADO");
  const porConflito = relatorio.puladas.filter((p) => p.tipo === "CONFLITO");

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 p-4">
      <div className="mt-6 flex w-full max-w-md flex-col gap-4 rounded-xl border border-border bg-bg-primary p-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full bg-brand text-2xl font-bold text-black"
          >
            ✓
          </span>
          <h2 className="text-lg font-bold text-text-primary">
            {relatorio.criadas.length === 1
              ? "1 reserva criada"
              : `${relatorio.criadas.length} reservas criadas`}
          </h2>
          <p className="text-sm text-text-secondary">{relatorio.resumo}</p>
        </div>

        {relatorio.criadas.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-text-primary">Datas criadas</h3>
            <ul className="flex flex-wrap gap-1.5">
              {relatorio.criadas.map((ocorrencia) => (
                <li
                  key={ocorrencia.id}
                  className="rounded-md border border-black bg-brand px-2 py-1 text-xs font-semibold text-black"
                >
                  {dataCurta(ocorrencia.data)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {porConflito.length > 0 ? (
          <section className="flex flex-col gap-2 rounded-lg border border-destructive bg-bg-primary p-3">
            <h3 className="text-sm font-bold text-destructive">
              {porConflito.length === 1
                ? "1 data pulada por conflito"
                : `${porConflito.length} datas puladas por conflito`}
            </h3>
            <ul className="flex flex-col gap-1 text-sm text-text-secondary">
              {porConflito.map((pulada) => (
                <li key={pulada.data}>
                  <strong className="font-semibold text-text-primary">
                    {dataCurta(pulada.data)}
                  </strong>{" "}
                  — {pulada.motivo}
                </li>
              ))}
            </ul>
            <p className="text-sm text-text-secondary">
              Se precisar dessas datas, libere o horário na agenda e lance cada
              uma como reserva avulsa.
            </p>
          </section>
        ) : null}

        {porDiaFechado.length > 0 ? (
          <section className="flex flex-col gap-2 rounded-lg border border-border bg-bg-secondary p-3">
            <h3 className="text-sm font-bold text-text-primary">
              {porDiaFechado.length === 1
                ? "1 data pulada por dia fechado"
                : `${porDiaFechado.length} datas puladas por dia fechado`}
            </h3>
            <p className="text-sm text-text-secondary">
              O coworking não abre nesses dias:{" "}
              {porDiaFechado.map((pulada) => dataCurta(pulada.data)).join("; ")}.
            </p>
            <p className="text-sm text-text-secondary">
              Se for um evento especial, dá para lançar como reserva avulsa — a
              recepção pode marcar em dia fechado.
            </p>
          </section>
        ) : null}

        {relatorio.criadas.length > 0 ? (
          <p className="text-sm text-text-secondary">
            O cliente recebeu a confirmação de cada data no WhatsApp.
          </p>
        ) : null}

        <Botao onClick={aoFechar}>Fechar</Botao>
      </div>
    </div>
  );
}
