"use client";

import { dataCurta, duracaoPorExtenso, minutosEntreHoras } from "@/components/reserva/datas";

import type { EntradaDeHistorico } from "./tipos";

const VERBO: Record<string, string> = {
  CRIADA: "Criada",
  REAGENDADA: "Remarcada",
  CANCELADA: "Cancelada",
  EDITADA: "Cadastro corrigido",
};

/** "2026-10-07T13:00:00.000Z" -> "07/10 às 10:00" no relogio de Sao Paulo. */
function quando(iso: string): string {
  const instante = new Date(iso);
  const formatador = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const partes = formatador.formatToParts(instante);
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pegar("day")}/${pegar("month")} às ${pegar("hour")}:${pegar("minute")}`;
}

function horaLocal(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function dataLocal(iso: string): string {
  const formatador = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const partes = formatador.formatToParts(new Date(iso));
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
}

/** O historico em português, uma linha por alteração. */
export function Historico({ linhas }: { linhas: EntradaDeHistorico[] }) {
  if (linhas.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Nenhuma alteração desde que a reserva foi feita.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {[...linhas].reverse().map((linha, indice) => (
        <li
          key={`${linha.em}-${indice}`}
          className="border-l-2 border-border pl-3 text-sm"
        >
          <p className="font-semibold text-text-primary">
            {VERBO[linha.acao] ?? linha.acao}{" "}
            <span className="font-normal text-text-secondary">
              por {linha.por === "ADMIN" ? (linha.quemNome ?? "equipe") : "cliente"},{" "}
              {quando(linha.em)}
            </span>
          </p>

          {linha.acao === "REAGENDADA" && linha.de && linha.para ? (
            <p className="mt-0.5 text-text-secondary">
              {dataCurta(dataLocal(linha.de.inicio))}, {horaLocal(linha.de.inicio)}–
              {horaLocal(linha.de.fim)} → {dataCurta(dataLocal(linha.para.inicio))},{" "}
              {horaLocal(linha.para.inicio)}–{horaLocal(linha.para.fim)}{" "}
              <span className="whitespace-nowrap">
                (
                {duracaoPorExtenso(
                  minutosEntreHoras(
                    horaLocal(linha.para.inicio),
                    horaLocal(linha.para.fim),
                  ),
                )}
                )
              </span>
            </p>
          ) : null}

          {linha.acao === "EDITADA" && linha.camposEditados ? (
            <p className="mt-0.5 text-text-secondary">
              Alterou: {linha.camposEditados.join(" e ")}.
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
