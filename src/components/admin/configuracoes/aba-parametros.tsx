"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Campo } from "@/components/ui/campo";

import {
  buscarParametros,
  salvarParametros,
  type RespostaDeParametros,
} from "./api";
import { BarraDeSalvar, CaixaInformativa, Secao, type Situacao } from "./pecas";

/** Os quatro campos como texto, para o campo poder ficar vazio enquanto digita. */
type Rascunho = Record<string, string>;

function rascunhoDe(resposta: RespostaDeParametros): Rascunho {
  return Object.fromEntries(
    resposta.parametros.map((parametro) => [parametro.chave, String(parametro.valor)]),
  );
}

export function AbaDeParametros() {
  const [dados, setDados] = useState<RespostaDeParametros | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>({});
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);
  const [situacao, setSituacao] = useState<Situacao>({ tipo: "parado" });

  const carregar = useCallback(async (sinal?: AbortSignal) => {
    setErroAoCarregar(null);

    try {
      const resposta = await buscarParametros(sinal);
      setDados(resposta);
      setRascunho(rascunhoDe(resposta));
    } catch (erro) {
      if (sinal?.aborted) {
        return;
      }
      setErroAoCarregar(
        erro instanceof ErroDaApi ? erro.message : "Não foi possível carregar os parâmetros.",
      );
    }
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!dados) {
    return <Carregando texto="Carregando os parâmetros…" />;
  }

  const alterado = dados.parametros.some(
    (parametro) => rascunho[parametro.chave] !== String(parametro.valor),
  );

  async function salvar() {
    if (!dados) {
      return;
    }

    const valores: Record<string, number> = {};

    for (const parametro of dados.parametros) {
      const bruto = (rascunho[parametro.chave] ?? "").trim();

      if (bruto === "" || !/^\d+$/.test(bruto)) {
        setSituacao({
          tipo: "erro",
          mensagem: `${parametro.rotulo}: escreva um número inteiro.`,
        });
        return;
      }

      valores[parametro.chave] = Number(bruto);
    }

    setSituacao({ tipo: "salvando" });

    try {
      const resposta = await salvarParametros(valores);
      setDados(resposta);
      setRascunho(rascunhoDe(resposta));
      setSituacao({ tipo: "salvo", mensagem: "Parâmetros salvos." });
    } catch (erro) {
      setSituacao({
        tipo: "erro",
        mensagem:
          erro instanceof ErroDaApi ? erro.message : "Não foi possível salvar. Tente de novo.",
      });
    }
  }

  const limites = dados.codigoWhatsapp;

  return (
    <div className="flex flex-col gap-4">
      <Secao
        titulo="Regras de reserva"
        descricao="Valem para o cliente no site. A recepção continua podendo lançar reserva fora dessas regras quando precisar."
      >
        <div className="flex flex-col gap-5">
          {dados.parametros.map((parametro) => (
            <Campo
              key={parametro.chave}
              etiqueta={`${parametro.rotulo} (${parametro.unidade})`}
              inputMode="numeric"
              value={rascunho[parametro.chave] ?? ""}
              onChange={(evento) => {
                setSituacao({ tipo: "parado" });
                setRascunho((atual) => ({
                  ...atual,
                  [parametro.chave]: evento.target.value.replace(/\D/g, ""),
                }));
              }}
              dica={parametro.ajuda}
            />
          ))}

          <BarraDeSalvar
            situacao={situacao}
            alterado={alterado}
            aoSalvar={() => void salvar()}
            aoDescartar={() => {
              setRascunho(rascunhoDe(dados));
              setSituacao({ tipo: "parado" });
            }}
          />
        </div>
      </Secao>

      <Secao
        titulo="Regras que não se mudam por aqui"
        descricao="Ficam visíveis para a equipe consultar, mas mudá-las exige alteração no sistema."
      >
        <div className="flex flex-col gap-3">
          <CaixaInformativa
            titulo={`Intervalo entre reservas: ${dados.intervaloMinutos} minutos`}
          >
            <p>
              Toda reserva precisa dessa folga antes e depois, na mesma sala. É o
              próprio banco de dados que garante isso, no momento de gravar.
            </p>
            <p>
              Mudar esse número deixaria as reservas já marcadas com a folga antiga e
              as novas com a folga nova — duas regras na mesma agenda. Por isso a
              troca é feita no sistema, recalculando as reservas futuras junto.
            </p>
          </CaixaInformativa>

          <CaixaInformativa titulo="Código de verificação por WhatsApp">
            <p>
              O código vale {limites.minutosDeValidade} minutos e serve uma vez só.
            </p>
            <p>
              Depois de {limites.maximoDeTentativas} tentativas erradas, o código morre
              na hora e o número fica {limites.minutosDeBloqueio} minutos sem poder
              pedir outro.
            </p>
            <p>
              Envio: no máximo {limites.porMinutoPorNumero} por minuto e{" "}
              {limites.porHoraPorNumero} por hora para o mesmo número, e{" "}
              {limites.porHoraPorIp} por hora vindos do mesmo aparelho.
            </p>
            <p>
              São freios contra abuso: afrouxá-los abriria a porta para alguém torrar a
              conta de WhatsApp do coworking.
            </p>
          </CaixaInformativa>
        </div>
      </Secao>
    </div>
  );
}
