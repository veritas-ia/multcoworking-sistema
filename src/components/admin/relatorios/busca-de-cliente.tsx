"use client";

import { useEffect, useRef, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { comoDinheiro } from "@/lib/precos";
import { telefoneVisivel } from "@/lib/telefone";

import {
  buscarClientes,
  buscarDetalheDoCliente,
  type DetalheDoCliente,
  type HorasDoCliente,
  type Periodo,
} from "./api";
import { BarrasHorizontais, Cartao, SemDados } from "./graficos";
import { porExtensoCurto } from "./periodos";

/** Espera a pessoa parar de digitar antes de consultar o servidor. */
const ESPERA_MS = 350;

/** "3,5 h" — com virgula, e sem o ",0" quando e hora cheia. */
export function horasPorExtenso(horas: number): string {
  const texto = Number.isInteger(horas) ? String(horas) : horas.toFixed(1).replace(".", ",");
  return `${texto} h`;
}

/**
 * BUSCA DE UM CLIENTE no dashboard.
 *
 * O TELEFONE manda: se o que foi digitado vira um celular valido, o servidor
 * responde com um cliente so. Nome e busca auxiliar — dois clientes podem se
 * chamar igual, entao a equipe escolhe na lista.
 *
 * So consulta. Nada aqui altera reserva, sala ou configuracao.
 */
export function BuscaDeCliente({
  periodo,
  aoAbrirCliente,
}: {
  periodo: Periodo;
  /** Avisa o painel: com um cliente aberto, o relatorio geral sai da tela. */
  aoAbrirCliente: (aberto: boolean) => void;
}) {
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<HorasDoCliente[] | null>(null);
  const [escolhido, setEscolhido] = useState<DetalheDoCliente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [procurando, setProcurando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  // Trocar o periodo com um cliente aberto mostraria numeros de um periodo com
  // o titulo de outro. Fecha o detalhe e refaz a busca.
  useEffect(() => {
    setEscolhido(null);
    aoAbrirCliente(false);
  }, [periodo, aoAbrirCliente]);

  useEffect(() => {
    const procurado = termo.trim();

    if (procurado.length < 2) {
      setAchados(null);
      setErro(null);
      return;
    }

    const controle = new AbortController();
    const relogio = setTimeout(() => {
      setProcurando(true);
      setErro(null);

      buscarClientes(periodo, procurado, controle.signal)
        .then((resposta) => {
          if (!controle.signal.aborted) {
            setAchados(resposta.clientes);
          }
        })
        .catch((falha: unknown) => {
          if (!controle.signal.aborted) {
            setErro(falha instanceof ErroDaApi ? falha.message : "Não foi possível buscar.");
          }
        })
        .finally(() => {
          if (!controle.signal.aborted) {
            setProcurando(false);
          }
        });
    }, ESPERA_MS);

    return () => {
      clearTimeout(relogio);
      controle.abort();
    };
  }, [termo, periodo]);

  async function abrir(telefone: string): Promise<void> {
    setErro(null);
    try {
      const resposta = await buscarDetalheDoCliente(periodo, telefone);
      setEscolhido(resposta.detalheDoCliente);
      aoAbrirCliente(true);
    } catch (falha) {
      setErro(
        falha instanceof ErroDaApi ? falha.message : "Não foi possível abrir o cliente.",
      );
    }
  }

  function limpar(): void {
    setEscolhido(null);
    aoAbrirCliente(false);
    setTermo("");
    setAchados(null);
    campo.current?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <Cartao
        titulo="Procurar um cliente"
        apoio="Digite o telefone (o mais certeiro) ou parte do nome."
        largo
      >
        <div className="flex flex-col gap-3">
          <input
            ref={campo}
            type="search"
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            placeholder="(11) 91234-5678 ou Maria"
            aria-label="Procurar cliente por telefone ou nome"
            className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-4 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
          />

          {erro ? <AvisoDeErro mensagem={erro} /> : null}

          {escolhido ? null : achados === null ? (
            <p className="text-sm text-text-secondary">
              A busca procura só entre quem tem reserva no período escolhido.
            </p>
          ) : achados.length === 0 ? (
            <p className="text-sm text-text-secondary">
              {procurando
                ? "Procurando…"
                : "Ninguém com esse telefone ou nome tem reserva neste período."}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {achados.map((cliente) => (
                <li key={cliente.telefone}>
                  <button
                    type="button"
                    onClick={() => void abrir(cliente.telefone)}
                    className="flex min-h-12 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-bg-primary px-4 py-2.5 text-left hover:border-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  >
                    <span className="flex flex-col">
                      <span className="font-semibold text-text-primary">{cliente.nome}</span>
                      <span className="text-sm text-text-secondary">
                        {telefoneVisivel(cliente.telefone)}
                      </span>
                    </span>
                    <span className="text-sm text-text-secondary">
                      {horasPorExtenso(cliente.horas)} em {cliente.reservas}{" "}
                      {cliente.reservas === 1 ? "reserva" : "reservas"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Cartao>

      {escolhido ? <DetalheDoClienteEscolhido dados={escolhido} aoFechar={limpar} /> : null}
    </div>
  );
}

// -----------------------------------------------------------------------------

function DetalheDoClienteEscolhido({
  dados,
  aoFechar,
}: {
  dados: DetalheDoCliente;
  aoFechar: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Cartao
        titulo={dados.nome}
        apoio={`${telefoneVisivel(dados.telefone)} · ${porExtensoCurto(dados.periodo.de)} a ${porExtensoCurto(dados.periodo.ate)}`}
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

            <span className="flex flex-col">
              <span className="text-base font-semibold text-text-primary">
                {dados.profissao}
              </span>
              <span className="text-sm text-text-secondary">
                {dados.profissaoDivergente
                  ? "área mais usada — há outra marcada em alguma reserva"
                  : "área de atuação"}
              </span>
            </span>
          </div>

          {/* O sistema nao processa pagamento: o numero acima e a soma do que
              as reservas valem, e nao do que entrou em caixa. Sem esta linha a
              equipe leria como dinheiro recebido. */}
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
        titulo="As reservas no período"
        apoio="Da mais antiga para a mais recente."
        largo
      >
        {dados.reservas.length === 0 ? (
          <SemDados />
        ) : (
          /* Rola na horizontal no celular em vez de espremer as colunas. */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="pb-2 pr-3 font-semibold">Dia</th>
                  <th className="pb-2 pr-3 font-semibold">Sala</th>
                  <th className="pb-2 pr-3 font-semibold">Horário</th>
                  <th className="pb-2 pr-3 font-semibold">Duração</th>
                  <th className="pb-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody>
                {dados.reservas.map((reserva, indice) => (
                  <tr
                    key={`${reserva.data}-${reserva.inicio}-${indice}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-2 pr-3 text-text-primary">
                      {porExtensoCurto(reserva.data)}
                    </td>
                    <td className="py-2 pr-3 text-text-primary">{reserva.sala}</td>
                    <td className="py-2 pr-3 tabular-nums text-text-primary">
                      {reserva.inicio} às {reserva.fim}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-text-primary">
                      {horasPorExtenso(reserva.duracaoHoras)}
                    </td>
                    <td className="py-2 text-text-secondary">{reserva.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </div>
  );
}
