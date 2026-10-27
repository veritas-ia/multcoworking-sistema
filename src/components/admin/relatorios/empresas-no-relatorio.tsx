"use client";

import { useState } from "react";

import { AvisoDeErro } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { ErroDaApi } from "@/components/reserva/api";
import { comoDinheiro } from "@/lib/precos";

import {
  buscarDetalheDaEmpresa,
  type DetalheDaEmpresa,
  type HorasDaEmpresa,
  type Periodo,
} from "./api";
import { horasPorExtenso } from "./busca-de-cliente";
import { BarrasHorizontais, Cartao, SemDados } from "./graficos";
import { porExtensoCurto } from "./periodos";

/**
 * AS EMPRESAS NO RELATORIO.
 *
 * A lista geral mostra horas e reservas, SEM dinheiro — mesma regra do
 * relatorio do coworking inteiro. O faturamento aparece so quando a equipe
 * ABRE uma empresa, do mesmo jeito que no relatorio de um cliente: o dono
 * liberou a metrica por empresa, nao um painel de receita a ceu aberto.
 */
export function EmpresasNoRelatorio({
  empresas,
  periodo,
  aoAbrirEmpresa,
}: {
  empresas: HorasDaEmpresa[];
  periodo: Periodo;
  /** Avisa o painel para ele esconder os numeros gerais. */
  aoAbrirEmpresa: (aberta: boolean) => void;
}) {
  const [escolhida, setEscolhida] = useState<DetalheDaEmpresa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);

  async function abrir(empresaId: string) {
    setErro(null);
    setCarregando(empresaId);

    try {
      const resposta = await buscarDetalheDaEmpresa(periodo, empresaId);
      setEscolhida(resposta.detalheDaEmpresa);
      aoAbrirEmpresa(true);
    } catch (falha) {
      setErro(
        falha instanceof ErroDaApi
          ? falha.message
          : "Não foi possível abrir o relatório da empresa.",
      );
    } finally {
      setCarregando(null);
    }
  }

  function fechar() {
    setEscolhida(null);
    setErro(null);
    aoAbrirEmpresa(false);
  }

  if (escolhida) {
    return <DetalheDaEmpresaEscolhida dados={escolhida} aoFechar={fechar} />;
  }

  return (
    <>
      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      <Cartao
        titulo="Empresas"
        apoio="Junta as reservas da equipe de cada empresa. Toque numa para ver o faturamento dela."
        largo
      >
        {empresas.length === 0 ? (
          <SemDados />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {empresas.map((empresa) => (
              <li key={empresa.id}>
                <button
                  type="button"
                  disabled={carregando !== null}
                  onClick={() => void abrir(empresa.id)}
                  className="flex min-h-14 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                >
                  <span className="text-sm font-semibold text-text-primary">
                    {empresa.nome}
                  </span>
                  <span className="text-sm tabular-nums text-text-secondary">
                    {carregando === empresa.id
                      ? "abrindo…"
                      : `${horasPorExtenso(empresa.horas)} em ${empresa.reservas} ${
                          empresa.reservas === 1 ? "reserva" : "reservas"
                        }`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
}

function DetalheDaEmpresaEscolhida({
  dados,
  aoFechar,
}: {
  dados: DetalheDaEmpresa;
  aoFechar: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao
        titulo={dados.nome}
        apoio={`${porExtensoCurto(dados.periodo.de)} a ${porExtensoCurto(dados.periodo.ate)}`}
        largo
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <span className="flex flex-col">
              <span className="text-3xl font-bold tabular-nums text-text-primary">
                {horasPorExtenso(dados.horas)}
              </span>
              <span className="text-sm text-text-secondary">
                usadas no período (canceladas não contam)
              </span>
            </span>

            <span className="flex flex-col">
              <span className="text-3xl font-bold tabular-nums text-text-primary">
                {dados.totalDeReservas}
              </span>
              <span className="text-sm text-text-secondary">
                {dados.totalDeReservas === 1 ? "reserva no total" : "reservas no total"}
              </span>
            </span>

            <span className="flex flex-col">
              <span className="text-3xl font-bold tabular-nums text-text-primary">
                {comoDinheiro(dados.faturamentoCentavos)}
              </span>
              <span className="text-sm text-text-secondary">
                faturamento gerado no período (canceladas não contam)
              </span>
            </span>
          </div>

          {/* Mesma ressalva do relatorio de cliente: o sistema nao processa
              pagamento, e sem esta linha a equipe leria como dinheiro
              recebido. */}
          <p className="text-sm text-text-secondary">
            O faturamento é a soma do valor das reservas, congelado quando cada
            uma foi criada. Não é pagamento confirmado — o sistema não processa
            pagamento.
          </p>

          <Botao aparencia="secundario" largura="conteudo" onClick={aoFechar}>
            Voltar ao relatório geral
          </Botao>
        </div>
      </Cartao>

      <Cartao titulo="Salas usadas">
        <BarrasHorizontais barras={dados.porSala} />
      </Cartao>

      <Cartao titulo="Situação das reservas">
        <BarrasHorizontais barras={dados.porStatus} />
      </Cartao>

      <Cartao
        titulo="Quem reservou"
        apoio="As pessoas da equipe que marcaram no nome da empresa."
        largo
      >
        {dados.pessoas.length === 0 ? (
          <SemDados />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {dados.pessoas.map((pessoa) => (
              <li
                key={pessoa.telefoneVisivel}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-text-primary">
                    {pessoa.nome}
                  </span>
                  {/* Telefone INTEIRO, como no relatorio de clientes: e a
                      equipe olhando o proprio cliente, atras de login. */}
                  <span className="font-mono text-sm text-text-secondary">
                    {pessoa.telefoneVisivel}
                  </span>
                </span>
                <span className="text-sm tabular-nums text-text-secondary">
                  {horasPorExtenso(pessoa.horas)} em {pessoa.reservas}{" "}
                  {pessoa.reservas === 1 ? "reserva" : "reservas"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
