"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import type { CategoriaReserva } from "@/lib/precos";
import { Logotipo } from "@/components/marca/logotipo";

import {
  buscarAgenda,
  buscarSalas,
  buscarSessao,
  criarReserva,
  encerrarSessao,
  ErroDaApi,
  mensagemDoErro,
} from "./api";
import { EtapaCategoria } from "./etapa-categoria";
import { EtapaConfirmacao } from "./etapa-confirmacao";
import { EtapaData } from "./etapa-data";
import { EtapaFim, EtapaInicio } from "./etapa-horarios";
import { EtapaNome } from "./etapa-nome";
import { EtapaResumo } from "./etapa-resumo";
import { EtapaSala } from "./etapa-sala";
import { EtapaTelefone } from "./etapa-telefone";
import { BarraDeProgresso } from "./pecas";
import {
  ETAPAS,
  type Agenda,
  type Etapa,
  type ReservaCriada,
  type Sala,
} from "./tipos";

const TITULOS: Record<Etapa, string> = {
  categoria: "Como você quer reservar",
  sala: "Sala",
  data: "Dia",
  inicio: "Início",
  fim: "Término",
  telefone: "WhatsApp",
  nome: "Seu nome",
  resumo: "Conferir",
  confirmacao: "Pronto",
};

/**
 * Codigos de recusa que sao problema de HORARIO. Quando um deles aparece na
 * hora de confirmar, alguem chegou antes ou o relogio andou: a tela volta para
 * a etapa 3 e recarrega a grade em vez de insistir num horario que ja morreu.
 */
const PROBLEMAS_DE_HORARIO = new Set([
  "HORARIO_TOMADO",
  "HORARIO_OCUPADO",
  "INTERVALO_ENTRE_RESERVAS",
  "NO_PASSADO",
  "ANTECEDENCIA_MINIMA",
  "ANTECEDENCIA_MAXIMA",
  "DIA_FECHADO",
  "ANTES_DA_ABERTURA",
  "DEPOIS_DO_FECHAMENTO",
  "DURACAO_MINIMA",
  "DURACAO_MAXIMA_DA_SALA",
  "FORA_DA_GRADE",
]);

type DadosIniciais = {
  salas: Sala[];
  agenda: Agenda;
  telefoneMascarado: string | null;
};

export function FluxoDeReserva({
  salaPreSelecionada,
}: {
  /** Slug vindo da URL (?sala=sala-container), para QR Code e link do Instagram. */
  salaPreSelecionada: string | null;
}) {
  const [iniciais, setIniciais] = useState<DadosIniciais | null>(null);
  /** Quantas pessoas. So as salas com preco de grupo perguntam isso. */
  const [pessoas, setPessoas] = useState("");
  /** Por hora ou dia inteiro. So as salas com diaria oferecem a escolha. */
  const [categoria, setCategoria] = useState<CategoriaReserva>("HORA");
  /** Area de atuacao do cliente. Vazia ate ele escolher. */
  const [profissao, setProfissao] = useState("");
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [tentativaInicial, setTentativaInicial] = useState(0);

  const [etapa, setEtapa] = useState<Etapa>("sala");
  const [salaId, setSalaId] = useState<string | null>(null);
  const [data, setData] = useState<string | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [fim, setFim] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefoneMascarado, setTelefoneMascarado] = useState<string | null>(null);

  const [reserva, setReserva] = useState<ReservaCriada | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erroDoResumo, setErroDoResumo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Muda de valor para obrigar a grade de horarios a ser lida de novo. */
  const [versaoDaGrade, setVersaoDaGrade] = useState(0);

  const conteudo = useRef<HTMLDivElement>(null);
  const primeiraRenderizacao = useRef(true);

  // --- Carga inicial: salas, regras da agenda e quem esta com o cookie -------
  useEffect(() => {
    const controle = new AbortController();
    setIniciais(null);
    setErroInicial(null);

    Promise.all([
      buscarSalas(controle.signal),
      buscarAgenda(controle.signal),
      buscarSessao(controle.signal),
    ])
      .then(([resultadoSalas, agenda, sessao]) => {
        if (controle.signal.aborted) {
          return;
        }

        setIniciais({
          salas: resultadoSalas.salas,
          agenda,
          telefoneMascarado: sessao.telefoneMascarado,
        });
        setTelefoneMascarado(sessao.telefoneMascarado);

        const daUrl = resultadoSalas.salas.find(
          (sala) => sala.slug === salaPreSelecionada,
        );
        if (daUrl) {
          setSalaId(daUrl.id);
          setEtapa("data");
        }
      })
      .catch((problema: unknown) => {
        if (!controle.signal.aborted) {
          setErroInicial(mensagemDoErro(problema));
        }
      });

    return () => controle.abort();
  }, [salaPreSelecionada, tentativaInicial]);

  // --- A cada troca de etapa, o foco vai para o comeco do conteudo novo ------
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    conteudo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [etapa]);

  const sala = iniciais?.salas.find((item) => item.id === salaId) ?? null;
  // Pergunta nascida do CADASTRO da sala, e nao de uma lista de nomes no
  // codigo: ligar a regra numa sala nova e so preencher o painel.
  const perguntarPessoas = sala?.pessoasParaGrupo !== null && sala !== null;
  const pulaTelefone = telefoneMascarado !== null;

  /**
   * As telas que ESTA reserva vai percorrer.
   *
   * A escolha entre hora e dia inteiro so existe nas salas que trabalham com
   * diaria; e quem escolhe diaria nao passa por inicio e fim, porque o
   * horario dela e fixo. Calcular a lista aqui, num lugar so, evita a barra
   * de progresso dizer "etapa 3 de 7" numa reserva que tem 5 telas.
   */
  const etapasVisiveis: Etapa[] = ETAPAS.filter((nome) => {
    if (nome === "categoria") {
      return sala?.aceitaDiaria === true;
    }
    if (nome === "inicio" || nome === "fim") {
      return categoria === "HORA";
    }
    return true;
  });

  const numeroDaEtapa = etapasVisiveis.indexOf(etapa) + 1;
  /** A confirmacao nao entra na contagem: ela ja e o fim. */
  const totalDeEtapas = etapasVisiveis.length - 1;

  function etapaAnterior(): Etapa | null {
    if (etapa === "sala" || etapa === "confirmacao") {
      return null;
    }

    if (etapa === "nome" && pulaTelefone) {
      // Sem a tela de telefone, voltar do nome tem de pular por cima dela.
      const posicao = etapasVisiveis.indexOf("telefone");
      return etapasVisiveis[posicao - 1] ?? null;
    }

    return etapasVisiveis[etapasVisiveis.indexOf(etapa) - 1] ?? null;
  }

  function escolherSala(novaSala: string): void {
    const escolhida = iniciais?.salas.find((item) => item.id === novaSala) ?? null;

    setSalaId(novaSala);
    setData(null);
    setInicio(null);
    setFim(null);
    setAviso(null);
    // Sala nova, escolha nova: quem vinha de uma diaria e troca para uma sala
    // que nao tem diaria nao pode continuar marcado como "dia inteiro".
    setCategoria("HORA");
    setEtapa(escolhida?.aceitaDiaria ? "categoria" : "data");
  }

  function escolherCategoria(nova: CategoriaReserva): void {
    setCategoria(nova);
    setInicio(null);
    setFim(null);
    setAviso(null);
    setEtapa("data");
  }

  function escolherData(novaData: string): void {
    setData(novaData);
    setAviso(null);

    // Na diaria o horario e fixo: nao ha o que escolher depois da data.
    if (categoria === "DIARIA") {
      setInicio(iniciais?.agenda.diaria.inicio ?? null);
      setFim(iniciais?.agenda.diaria.fim ?? null);
      setEtapa(pulaTelefone ? "nome" : "telefone");
      return;
    }

    setInicio(null);
    setFim(null);
    setEtapa("inicio");
  }

  function escolherInicio(novoInicio: string): void {
    setInicio(novoInicio);
    setFim(null);
    setAviso(null);
    setEtapa("fim");
  }

  function escolherFim(novoFim: string): void {
    setFim(novoFim);
    setAviso(null);
    setEtapa(pulaTelefone ? "nome" : "telefone");
  }

  async function trocarDeNumero(): Promise<void> {
    try {
      await encerrarSessao();
    } catch {
      // Se a chamada falhar, a sessao pode continuar viva no servidor — mas a
      // tela precisa seguir pedindo um numero novo de qualquer jeito.
    }
    setTelefoneMascarado(null);
    setAviso(null);
    setEtapa("telefone");
  }

  async function confirmar(): Promise<void> {
    if (!salaId || !data || !inicio || !fim) {
      return;
    }

    setConfirmando(true);
    setErroDoResumo(null);

    try {
      const criada = await criarReserva({
        salaId,
        data,
        inicio,
        fim,
        nome: nome.trim(),
        pessoas: perguntarPessoas && pessoas !== "" ? Number(pessoas) : null,
        categoria,
        profissao,
      });
      setReserva(criada);
      setAviso(null);
      setEtapa("confirmacao");
    } catch (problema: unknown) {
      tratarFalhaAoConfirmar(problema);
    } finally {
      setConfirmando(false);
    }
  }

  function tratarFalhaAoConfirmar(problema: unknown): void {
    const mensagem = mensagemDoErro(problema);

    if (!(problema instanceof ErroDaApi)) {
      setErroDoResumo(mensagem);
      return;
    }

    // Sessao venceu enquanto a pessoa preenchia: pede o telefone de novo.
    if (problema.status === 401 || problema.codigo === "SEM_SESSAO") {
      setTelefoneMascarado(null);
      setAviso(mensagem);
      setEtapa("telefone");
      return;
    }

    // Alguem pegou o horario antes (409) ou a regra de horario mudou (422):
    // volta para a etapa 3 com a grade recarregada.
    if (problema.codigo && PROBLEMAS_DE_HORARIO.has(problema.codigo)) {
      setInicio(null);
      setFim(null);
      setVersaoDaGrade((numero) => numero + 1);
      setAviso(`${mensagem} Escolha outro horário, por favor.`);
      setEtapa("inicio");
      return;
    }

    // Limite de reservas ativas e afins: o problema nao e o horario.
    setErroDoResumo(mensagem);
  }

  function recomecar(): void {
    setReserva(null);
    setSalaId(null);
    setData(null);
    setInicio(null);
    setFim(null);
    setErroDoResumo(null);
    setAviso(null);
    setVersaoDaGrade((numero) => numero + 1);
    setEtapa("sala");
  }

  // ---------------------------------------------------------------------------

  if (erroInicial) {
    return (
      <Moldura>
        <AvisoDeErro
          mensagem={erroInicial}
          aoTentarDeNovo={() => setTentativaInicial((numero) => numero + 1)}
        />
      </Moldura>
    );
  }

  if (!iniciais) {
    return (
      <Moldura>
        <Carregando texto="Abrindo a agenda…" />
      </Moldura>
    );
  }

  const anterior = etapaAnterior();

  return (
    <div className="flex min-h-dvh flex-col bg-bg-secondary">
      <header className="sticky top-0 z-10 border-b border-border bg-bg-primary">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            {anterior ? (
              <button
                type="button"
                onClick={() => {
                  setAviso(null);
                  setEtapa(anterior);
                }}
                aria-label={`Voltar para ${TITULOS[anterior].toLowerCase()}`}
                className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-2xl text-text-primary hover:bg-bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                <span aria-hidden>‹</span>
              </button>
            ) : (
              <span aria-hidden className="size-11 shrink-0" />
            )}

            {/* Quem chega pelo Instagram precisa ver de cara ONDE esta. A etapa
                atual ja aparece logo abaixo, na barra de progresso.

                A logo e menor no celular para caber ao lado do botao de voltar
                e do link das reservas, sem espremer nenhum dos dois. */}
            <Logotipo className="h-7 sm:h-8" prioridade />
            <span aria-hidden className="flex-1" />

            <Link
              href="/minhas-reservas"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-text-primary underline underline-offset-4 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              Minhas reservas
            </Link>
          </div>

          {etapa === "confirmacao" ? null : (
            <BarraDeProgresso
              numero={numeroDaEtapa}
              titulo={TITULOS[etapa]}
              total={totalDeEtapas}
            />
          )}
        </div>
      </header>

      <main
        ref={conteudo}
        tabIndex={-1}
        className="mx-auto w-full max-w-lg flex-1 px-4 py-6 focus:outline-none"
      >
        {/* Regiao viva: o leitor de tela anuncia conflitos sem a pessoa procurar. */}
        <div role="alert" aria-live="assertive">
          {aviso ? (
            <p className="mb-5 rounded-lg border border-destructive bg-bg-primary p-4 text-sm font-medium text-destructive">
              {aviso}
            </p>
          ) : null}
        </div>

        {pulaTelefone && (etapa === "nome" || etapa === "resumo") ? (
          <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-bg-primary px-4 py-3 text-sm text-text-secondary">
            <span>
              Você está identificado como{" "}
              <strong className="font-semibold text-text-primary">
                {telefoneMascarado}
              </strong>
            </span>
            <span aria-hidden>·</span>
            <button
              type="button"
              onClick={() => void trocarDeNumero()}
              className="rounded font-semibold text-text-primary underline underline-offset-4 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              trocar número
            </button>
          </p>
        ) : null}

        {etapa === "sala" ? (
          <EtapaSala
            salas={iniciais.salas}
            horaInicioNoturno={iniciais.agenda.horaInicioNoturno}
            salaEscolhida={salaId}
            aoEscolher={escolherSala}
          />
        ) : null}

        {etapa === "categoria" && sala ? (
          <EtapaCategoria
            sala={sala}
            diaria={iniciais.agenda.diaria}
            escolhida={categoria}
            aoEscolher={escolherCategoria}
          />
        ) : null}

        {etapa === "data" && sala ? (
          <EtapaData
            agenda={iniciais.agenda}
            nomeDaSala={sala.nome}
            dataEscolhida={data}
            aoEscolher={escolherData}
          />
        ) : null}

        {etapa === "inicio" && salaId && data ? (
          <EtapaInicio
            salaId={salaId}
            data={data}
            versao={versaoDaGrade}
            inicioEscolhido={inicio}
            aoEscolher={escolherInicio}
            aoTrocarDeData={() => setEtapa("data")}
          />
        ) : null}

        {etapa === "fim" && salaId && data && inicio ? (
          <EtapaFim
            salaId={salaId}
            data={data}
            versao={versaoDaGrade}
            inicio={inicio}
            fimEscolhido={fim}
            aoEscolher={escolherFim}
            aoTrocarDeInicio={() => setEtapa("inicio")}
          />
        ) : null}

        {etapa === "telefone" ? (
          <EtapaTelefone
            aoConfirmar={(mascarado) => {
              setTelefoneMascarado(mascarado);
              setAviso(null);
              setEtapa("nome");
            }}
          />
        ) : null}

        {etapa === "nome" ? (
          <EtapaNome
            nome={nome}
            pessoas={pessoas}
            perguntarPessoas={perguntarPessoas}
            profissao={profissao}
            aoMudar={setNome}
            aoMudarPessoas={setPessoas}
            aoMudarProfissao={setProfissao}
            aoContinuar={() => setEtapa("resumo")}
          />
        ) : null}

        {etapa === "resumo" && sala && data && inicio && fim ? (
          <EtapaResumo
            sala={sala}
            data={data}
            inicio={inicio}
            fim={fim}
            nome={nome.trim()}
            telefoneMascarado={telefoneMascarado}
            janelaCancelamentoHoras={iniciais.agenda.janelaCancelamentoHoras}
            horaInicioNoturno={iniciais.agenda.horaInicioNoturno}
            pessoas={perguntarPessoas && pessoas !== "" ? Number(pessoas) : null}
            categoria={categoria}
            textos={iniciais.agenda.textos}
            enviando={confirmando}
            erro={erroDoResumo}
            aoConfirmar={() => void confirmar()}
          />
        ) : null}

        {etapa === "confirmacao" && reserva ? (
          <EtapaConfirmacao
            reserva={reserva}
            telefoneMascarado={telefoneMascarado}
            janelaCancelamentoHoras={iniciais.agenda.janelaCancelamentoHoras}
            aoRecomecar={recomecar}
          />
        ) : null}
      </main>
    </div>
  );
}

/** Moldura das telas de carregando e de erro da carga inicial. */
function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-secondary">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-10">{children}</main>
    </div>
  );
}
