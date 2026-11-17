"use client";

import { useEffect, useState } from "react";

import { Campo } from "@/components/ui/campo";
import { telefoneVisivel } from "@/lib/telefone";

import { procurarClientes } from "./api";
import type { ClienteParaEscolher } from "./tipos";

/**
 * ESCOLHER O CLIENTE DO CADASTRO, nunca digitar o nome.
 *
 * POR QUE NAO UM CAMPO DE NOME LIVRE: a recepcionista explicou sozinha, sem
 * ninguem perguntar — *"pego o sobrenome para nao ficar tipo Matheus da Toca,
 * Matheus Vitullo"*. Nome solto aqui recriaria dentro do emporio a bagunca dos
 * 44 nomes para 25 telefones que a Fase 14 levou meses para desfazer. E o
 * consumo precisa cair na conta certa: e ele que entra no fechamento do mes
 * do mensalista.
 *
 * O NOME SO SERVE PARA ACHAR O CADASTRO, mesma regra da busca do balcao e do
 * relatorio: achado o cadastro, vale o identificador dele.
 */
export function EscolherCliente({
  escolhido,
  aoEscolher,
  aoLimpar,
}: {
  escolhido: ClienteParaEscolher | null;
  aoEscolher: (cliente: ClienteParaEscolher) => void;
  aoLimpar: () => void;
}) {
  const [procurado, setProcurado] = useState("");
  const [achados, setAchados] = useState<ClienteParaEscolher[]>([]);
  const [procurando, setProcurando] = useState(false);

  useEffect(() => {
    if (procurado.trim().length < 2) {
      setAchados([]);
      setProcurando(false);
      return;
    }

    const controle = new AbortController();
    setProcurando(true);

    // Espera a pessoa parar de digitar: sem isto sai um pedido por tecla.
    const relogio = setTimeout(() => {
      procurarClientes(procurado, controle.signal)
        .then((resposta) => {
          if (!controle.signal.aborted) {
            setAchados(resposta.clientes);
            setProcurando(false);
          }
        })
        .catch(() => {
          if (!controle.signal.aborted) {
            setAchados([]);
            setProcurando(false);
          }
        });
    }, 300);

    return () => {
      clearTimeout(relogio);
      controle.abort();
    };
  }, [procurado]);

  if (escolhido) {
    return (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text-primary">Cliente</span>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-secondary px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-text-primary">
              {escolhido.nome}
            </p>
            <p className="truncate text-sm text-text-secondary">
              {escolhido.empresa ? `${escolhido.empresa.nome} · ` : ""}
              {escolhido.telefones[0]
                ? telefoneVisivel(escolhido.telefones[0])
                : "sem telefone cadastrado"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              aoLimpar();
              setProcurado("");
            }}
            className="shrink-0 text-sm font-semibold text-text-primary underline underline-offset-4"
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Campo
        etiqueta="Cliente"
        value={procurado}
        onChange={(evento) => setProcurado(evento.target.value)}
        placeholder="Procure por nome ou telefone"
        autoComplete="off"
        dica="Escolha quem está na ficha. O consumo entra na conta desse cadastro."
      />

      {procurado.trim().length >= 2 ? (
        <div className="rounded-lg border border-border bg-bg-primary">
          {procurando && achados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-secondary">Procurando…</p>
          ) : null}

          {!procurando && achados.length === 0 ? (
            /*
             * NAO ACHOU: a tela manda cadastrar na agenda, e nao oferece um
             * campo de nome livre aqui. Um cadastro criado no empório nasceria
             * sem telefone e sem reserva, e seria mais um "cliente" solto para
             * a equipe juntar depois no painel.
             */
            <p className="px-4 py-3 text-sm text-text-secondary">
              Ninguém encontrado. O cliente precisa estar cadastrado — ele nasce
              na primeira reserva, ou em Configurações → Clientes.
            </p>
          ) : null}

          <ul className="divide-y divide-border">
            {achados.map((cliente) => (
              <li key={cliente.id}>
                <button
                  type="button"
                  onClick={() => {
                    aoEscolher(cliente);
                    setProcurado("");
                    setAchados([]);
                  }}
                  className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black"
                >
                  <span className="text-base font-semibold text-text-primary">
                    {cliente.nome}
                  </span>

                  <span className="text-sm text-text-secondary">
                    {cliente.empresa ? `${cliente.empresa.nome} · ` : ""}
                    {cliente.telefones.length > 0
                      ? cliente.telefones.map(telefoneVisivel).join(" · ")
                      : "sem telefone cadastrado"}
                  </span>

                  {/*
                    Os outros nomes que as reservas dele ja usaram. Aparecem de
                    proposito: e justamente a variacao ("Prestare", "Prestare
                    Karen") que faz a equipe reconhecer de quem e o cadastro.
                  */}
                  {cliente.outrosNomes.length > 0 ? (
                    <span className="text-sm text-text-secondary">
                      também: {cliente.outrosNomes.join(" · ")}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
