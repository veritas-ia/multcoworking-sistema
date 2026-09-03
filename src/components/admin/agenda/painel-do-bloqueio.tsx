"use client";

import { useEffect, useState } from "react";

import { mensagemDoErro } from "@/components/reserva/api";
import { blocosEntre, dataPorExtenso } from "@/components/reserva/datas";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

import {
  buscarBloqueio,
  editarBloqueio,
  removerBloqueio,
  type BloqueioDetalhado,
} from "./api";

const BLOCOS = blocosEntre("00:00", "23:30");

/**
 * Detalhe do bloqueio, com editar e remover.
 *
 * Quando o bloqueio faz parte de um feriado (varias salas criadas juntas), a
 * remocao pergunta: so esta sala, ou o feriado inteiro? E o mesmo padrao de
 * "uma ocorrencia ou a serie" das recorrencias.
 */
export function PainelDoBloqueio({
  bloqueioId,
  aoMudarAgenda,
}: {
  bloqueioId: string;
  aoMudarAgenda: () => void;
}) {
  const [bloqueio, setBloqueio] = useState<BloqueioDetalhado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [editando, setEditando] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroDaAcao, setErroDaAcao] = useState<string | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    setBloqueio(null);
    setErro(null);

    buscarBloqueio(bloqueioId, controle.signal)
      .then((dados) => {
        if (!controle.signal.aborted) {
          setBloqueio(dados);
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErro(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, [bloqueioId, tentativa]);

  if (erro) {
    return <AvisoDeErro mensagem={erro} aoTentarDeNovo={() => setTentativa((n) => n + 1)} />;
  }

  if (!bloqueio) {
    return <Carregando texto="Abrindo o bloqueio…" />;
  }

  const ehFeriado = bloqueio.salasNoGrupo > 1;

  async function remover(oGrupoInteiro: boolean): Promise<void> {
    setEnviando(true);
    setErroDaAcao(null);
    try {
      await removerBloqueio(bloqueioId, oGrupoInteiro);
      aoMudarAgenda();
    } catch (problema: unknown) {
      setErroDaAcao(mensagemDoErro(problema));
      setEnviando(false);
    }
  }

  if (editando) {
    return (
      <FormularioDeEdicao
        bloqueio={bloqueio}
        enviando={enviando}
        erro={erroDaAcao}
        aoSalvar={async (dados) => {
          setEnviando(true);
          setErroDaAcao(null);
          try {
            await editarBloqueio(bloqueioId, dados);
            setEditando(false);
            setTentativa((n) => n + 1);
            aoMudarAgenda();
          } catch (problema: unknown) {
            setErroDaAcao(mensagemDoErro(problema));
          } finally {
            setEnviando(false);
          }
        }}
        aoDesistir={() => {
          setEditando(false);
          setErroDaAcao(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <span className="w-fit rounded-md border border-text-primary bg-bg-secondary px-2 py-1 text-xs font-semibold text-text-primary">
        {ehFeriado ? `Bloqueio em ${bloqueio.salasNoGrupo} salas` : "Bloqueio"}
      </span>

      <dl className="flex flex-col gap-3">
        <Linha rotulo="Sala" valor={bloqueio.sala} />
        <Linha rotulo="Dia" valor={dataPorExtenso(bloqueio.data)} />
        <Linha rotulo="Horário" valor={`${bloqueio.inicio} às ${bloqueio.fim}`} />
        <Linha rotulo="Motivo" valor={bloqueio.motivo ?? "sem motivo registrado"} />
      </dl>

      <p className="rounded-lg border border-border bg-bg-secondary p-3 text-sm leading-relaxed text-text-secondary">
        O cliente vê este horário apenas como indisponível. O motivo nunca sai
        da área do painel.
      </p>

      {erroDaAcao ? <AvisoDeErro mensagem={erroDaAcao} /> : null}

      {confirmandoRemocao ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive bg-bg-primary p-4">
          <p className="text-sm font-medium text-text-primary">
            {ehFeriado
              ? `Este bloqueio faz parte de um conjunto em ${bloqueio.salasNoGrupo} salas. O que você quer remover?`
              : "Remover este bloqueio? O horário volta para a agenda."}
          </p>

          <div className="flex flex-col gap-2">
            <Botao
              aparencia="primario"
              disabled={enviando}
              onClick={() => void remover(false)}
            >
              {enviando ? "Removendo…" : ehFeriado ? "Só desta sala" : "Sim, remover"}
            </Botao>

            {ehFeriado ? (
              <Botao
                aparencia="secundario"
                disabled={enviando}
                onClick={() => void remover(true)}
              >
                Remover das {bloqueio.salasNoGrupo} salas
              </Botao>
            ) : null}

            <Botao
              aparencia="secundario"
              disabled={enviando}
              onClick={() => setConfirmandoRemocao(false)}
            >
              Voltar
            </Botao>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Botao
            aparencia="primario"
            largura="conteudo"
            onClick={() => {
              setErroDaAcao(null);
              setEditando(true);
            }}
          >
            Editar
          </Botao>
          <Botao
            aparencia="secundario"
            largura="conteudo"
            onClick={() => setConfirmandoRemocao(true)}
          >
            Remover
          </Botao>
        </div>
      )}
    </div>
  );
}

function FormularioDeEdicao({
  bloqueio,
  enviando,
  erro,
  aoSalvar,
  aoDesistir,
}: {
  bloqueio: BloqueioDetalhado;
  enviando: boolean;
  erro: string | null;
  aoSalvar: (dados: { data: string; inicio: string; fim: string; motivo?: string }) => void;
  aoDesistir: () => void;
}) {
  const [data, setData] = useState(bloqueio.data);
  const [inicio, setInicio] = useState(bloqueio.inicio);
  const [fim, setFim] = useState(bloqueio.fim);
  const [motivo, setMotivo] = useState(bloqueio.motivo ?? "");

  const invalido = fim <= inicio;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        aoSalvar({ data, inicio, fim, motivo: motivo.trim() || undefined });
      }}
    >
      <h3 className="text-sm font-bold text-text-primary">Editar bloqueio</h3>
      <p className="text-sm text-text-secondary">
        Muda só este bloqueio, na sala {bloqueio.sala}.
      </p>

      <Campo
        etiqueta="Dia"
        type="date"
        value={data}
        onChange={(evento) => setData(evento.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <Escolha etiqueta="Início" valor={inicio} aoMudar={setInicio} />
        <Escolha etiqueta="Término" valor={fim} aoMudar={setFim} />
      </div>

      <Campo
        etiqueta="Motivo (só a equipe vê)"
        value={motivo}
        maxLength={200}
        onChange={(evento) => setMotivo(evento.target.value)}
      />

      {invalido ? (
        <p className="text-sm font-medium text-destructive">
          O término precisa ser depois do início.
        </p>
      ) : null}

      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      <div className="flex flex-wrap gap-2">
        <Botao type="submit" largura="conteudo" disabled={enviando || invalido}>
          {enviando ? "Salvando…" : "Salvar"}
        </Botao>
        <Botao
          aparencia="secundario"
          largura="conteudo"
          disabled={enviando}
          onClick={aoDesistir}
        >
          Voltar
        </Botao>
      </div>
    </form>
  );
}

function Escolha({
  etiqueta,
  valor,
  aoMudar,
}: {
  etiqueta: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-text-primary">{etiqueta}</span>
      <select
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        className="min-h-12 rounded-lg border border-border bg-bg-primary px-3 text-base text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
      >
        {BLOCOS.map((bloco) => (
          <option key={bloco} value={bloco}>
            {bloco}
          </option>
        ))}
      </select>
    </label>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
      <dt className="text-sm text-text-secondary">{rotulo}</dt>
      <dd className="text-right font-semibold text-text-primary">{valor}</dd>
    </div>
  );
}
