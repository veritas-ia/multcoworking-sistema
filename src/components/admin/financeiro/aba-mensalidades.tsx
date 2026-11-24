"use client";

import { useCallback, useEffect, useState } from "react";

import { Secao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import {
  buscarCobrancas,
  buscarContratos,
  buscarEmpresas,
  criarContrato,
  editarContrato,
  gerarMensalidades,
  marcarPagamento,
  type EntradaDeContrato,
  type RespostaDeContratos,
} from "./api";
import {
  EscolherCliente,
  type ClienteParaEscolher,
} from "../escolher-cliente";
import {
  centavosDe,
  diaCompleto,
  emReais,
  Escolha,
  Situacao,
  valorVisivel,
} from "./pecas";
import type {
  ContratoNaTela,
  EmpresaParaEscolher,
  LancamentoNaTela,
  RelatorioDaGeracao,
} from "./tipos";

/** "2026-12" -> "dezembro de 2026". */
function mesPorExtenso(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);

  return new Date(Date.UTC(ano!, mes! - 1, 1)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** Soma meses a "AAAA-MM". */
function somarMeses(competencia: string, quantos: number): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const data = new Date(Date.UTC(ano!, mes! - 1 + quantos, 1));

  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * AS MENSALIDADES — de onde vem a maior parte do dinheiro do coworking.
 *
 * ELA RESPONDE A PERGUNTA DO DONO: *"como que o sistema iria saber que tá
 * pago?"*. O contrato diz QUANTO e QUANDO; a cobrança do mês nasce dele,
 * PENDENTE; e alguém marca "Recebi" quando o Pix cai. É exatamente como o
 * dinheiro chega — um Pix por mês, uma linha por mês.
 *
 * GERAR É AÇÃO DA EQUIPE, e não rotina automática: a prévia roda com as
 * rotinas desligadas, e uma rotina simplesmente não aconteceria lá — pior,
 * ninguém veria que não aconteceu. Um botão acontece quando a pessoa clica,
 * na frente dela, com o resultado na tela.
 */
export function AbaDeMensalidades({ hoje }: { hoje: string }) {
  const [dados, setDados] = useState<RespostaDeContratos | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaParaEscolher[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [competencia, setCompetencia] = useState(hoje.slice(0, 7));
  const [relatorio, setRelatorio] = useState<RelatorioDaGeracao | null>(null);
  const [abrindoForm, setAbrindoForm] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setDados(await buscarContratos());
      setErro(null);
    } catch (falha: unknown) {
      setErro(
        falha instanceof ErroDaApi
          ? falha.message
          : "Não conseguimos abrir os contratos.",
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    // As empresas são para o formulário. Se falhar, dá para fazer contrato de
    // pessoa — travar tudo por causa disso seria pior.
    buscarEmpresas()
      .then((resposta) => setEmpresas(resposta.empresas.filter((uma) => uma.ativa)))
      .catch(() => setEmpresas([]));
  }, [recarregar]);

  async function gerar(): Promise<void> {
    setOcupado(true);
    setErro(null);
    setRelatorio(null);

    try {
      const resposta = await gerarMensalidades(competencia);
      setRelatorio(resposta.relatorio);
      await recarregar();
    } catch (falha: unknown) {
      setErro(
        falha instanceof ErroDaApi
          ? falha.message
          : "Não conseguimos gerar as mensalidades.",
      );
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo as mensalidades…" />;
  }

  if (erro && !dados) {
    return <AvisoDeErro mensagem={erro} />;
  }

  if (!dados) {
    return null;
  }

  const vigentes = dados.contratos.filter((um) => um.vigente);
  const totalMensal = vigentes.reduce(
    (soma, contrato) => soma + centavosDe(contrato.valorMensal),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      {/* --- GERAR AS COBRANÇAS DO MÊS --- */}
      <Secao
        titulo="Gerar as cobranças do mês"
        descricao="Cria uma cobrança por contrato vigente, PENDENTE. Clicar duas vezes no mesmo mês não cobra em dobro."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Botao
                aparencia="secundario"
                largura="conteudo"
                aria-label="Mês anterior"
                onClick={() => setCompetencia((atual) => somarMeses(atual, -1))}
                disabled={ocupado}
              >
                ←
              </Botao>

              <span className="min-w-40 text-center text-base font-bold text-text-primary">
                {mesPorExtenso(competencia)}
              </span>

              <Botao
                aparencia="secundario"
                largura="conteudo"
                aria-label="Mês seguinte"
                onClick={() => setCompetencia((atual) => somarMeses(atual, 1))}
                disabled={ocupado}
              >
                →
              </Botao>
            </div>

            <Botao
              largura="conteudo"
              onClick={gerar}
              disabled={ocupado || vigentes.length === 0}
            >
              {ocupado ? "Gerando…" : `Gerar ${mesPorExtenso(competencia)}`}
            </Botao>
          </div>

          <p className="text-sm leading-relaxed text-text-secondary">
            {vigentes.length === 0
              ? "Nenhum contrato vigente. Cadastre um contrato abaixo para poder gerar cobranças."
              : `${vigentes.length} ${vigentes.length === 1 ? "contrato vigente" : "contratos vigentes"} · ${emReais(totalMensal)} por mês`}
          </p>

          {/*
            O RELATÓRIO DIZ O QUE **NÃO** ENTROU, e isso é o que importa: sem
            ele, um contrato pulado sumiria em silêncio e a equipe só
            descobriria no fim do mês, ao faltar o dinheiro. Mesmo desenho do
            relatório da série recorrente.
          */}
          {relatorio ? (
            <div
              aria-live="polite"
              className="flex flex-col gap-2 rounded-lg border border-border bg-bg-secondary p-4"
            >
              <p className="text-sm font-semibold text-text-primary">
                {relatorio.criadas === 0
                  ? "Nenhuma cobrança nova."
                  : `${relatorio.criadas} ${relatorio.criadas === 1 ? "cobrança criada" : "cobranças criadas"} · ${emReais(relatorio.totalCentavos)}`}
              </p>

              {relatorio.jaExistiam > 0 ? (
                <p className="text-sm text-text-secondary">
                  {relatorio.jaExistiam}{" "}
                  {relatorio.jaExistiam === 1 ? "já existia" : "já existiam"} — não
                  foram cobradas de novo.
                </p>
              ) : null}

              {relatorio.pulados.length > 0 ? (
                <div className="text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">
                    Ficaram de fora:
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {relatorio.pulados.map((pulado) => (
                      <li key={pulado.contratoId}>
                        {pulado.quem} — {pulado.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-sm text-text-secondary">
                As cobranças nascem <strong>pendentes</strong>. Marque “Recebi” em
                Financeiro → Contas quando o pagamento entrar.
              </p>
            </div>
          ) : null}
        </div>
      </Secao>

      {/* --- OS CONTRATOS --- */}
      <Secao
        titulo="Contratos"
        descricao="Quem paga, quanto, em que dia e quantas horas de sala estão inclusas."
      >
        <div className="flex flex-col gap-4">
          {abrindoForm ? (
            <FormularioDeContrato
              espacos={dados.espacos}
              empresas={empresas}
              hoje={hoje}
              ocupado={ocupado}
              aoOcupar={setOcupado}
              aoFechar={() => setAbrindoForm(false)}
              aoSalvar={() => {
                setAbrindoForm(false);
                void recarregar();
              }}
            />
          ) : (
            <Botao
              aparencia="secundario"
              largura="conteudo"
              onClick={() => setAbrindoForm(true)}
            >
              Novo contrato
            </Botao>
          )}

          {dados.contratos.length === 0 ? (
            <AvisoVazio>Nenhum contrato cadastrado ainda.</AvisoVazio>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {dados.contratos.map((contrato) => (
                <LinhaDoContrato
                  key={contrato.id}
                  contrato={contrato}
                  hoje={hoje}
                  ocupado={ocupado}
                  aoOcupar={setOcupado}
                  aoMudar={() => void recarregar()}
                  aoFalhar={setErro}
                />
              ))}
            </ul>
          )}
        </div>
      </Secao>
    </div>
  );
}

// -----------------------------------------------------------------------------

/**
 * O FORMULÁRIO DO CONTRATO.
 *
 * QUEM PAGA VEM PRIMEIRO, e é uma escolha de UM dos dois — pessoa ou empresa,
 * nunca os dois. Nenhum deixaria a cobrança sem dono; os dois deixariam a tela
 * sem saber para quem emitir. O servidor e o banco recusam as duas situações.
 */
function FormularioDeContrato({
  espacos,
  empresas,
  hoje,
  ocupado,
  aoOcupar,
  aoFechar,
  aoSalvar,
}: {
  espacos: { id: string; nome: string; ocupado: boolean }[];
  empresas: EmpresaParaEscolher[];
  hoje: string;
  ocupado: boolean;
  aoOcupar: (ocupado: boolean) => void;
  aoFechar: () => void;
  aoSalvar: () => void;
}) {
  const [quemPaga, setQuemPaga] = useState<"PESSOA" | "EMPRESA">("EMPRESA");
  const [cliente, setCliente] = useState<ClienteParaEscolher | null>(null);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [espacoId, setEspacoId] = useState("");
  const [valorMensal, setValorMensal] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [cotaHoras, setCotaHoras] = useState("");
  const [inicio, setInicio] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);

  const valorInvalido = valorMensal.trim() !== "" && centavosDe(valorMensal) <= 0;
  const dia = Number(diaVencimento);
  const diaInvalido = !Number.isInteger(dia) || dia < 1 || dia > 31;
  const cota = cotaHoras.trim() === "" ? null : Number(cotaHoras);
  const cotaInvalida = cota !== null && (!Number.isInteger(cota) || cota <= 0);

  const invalido =
    (quemPaga === "PESSOA" ? !cliente : !empresaId) ||
    valorMensal.trim() === "" ||
    valorInvalido ||
    diaInvalido ||
    cotaInvalida ||
    !inicio;

  async function salvar(): Promise<void> {
    aoOcupar(true);
    setErro(null);

    const entrada: EntradaDeContrato = {
      clienteId: quemPaga === "PESSOA" ? cliente?.id : null,
      empresaId: quemPaga === "EMPRESA" ? empresaId : null,
      espacoId: espacoId || null,
      valorMensal,
      diaVencimento: dia,
      cotaHoras: cota,
      inicio,
    };

    try {
      await criarContrato(entrada);
      aoSalvar();
    } catch (falha: unknown) {
      setErro(
        falha instanceof ErroDaApi
          ? falha.message
          : "Não conseguimos salvar o contrato.",
      );
    } finally {
      aoOcupar(false);
    }
  }

  // Só os espaços LIVRES: oferecer um ocupado faria a pessoa preencher o
  // formulário inteiro para levar a recusa no fim.
  const livres = espacos.filter((um) => !um.ocupado);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-secondary p-4">
      <h3 className="text-sm font-bold text-text-primary">Contrato novo</h3>

      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-text-primary">Quem paga</span>

        <div
          role="group"
          aria-label="Quem paga"
          className="flex gap-1.5 rounded-lg border border-border bg-bg-primary p-1.5 sm:max-w-80"
        >
          {(
            [
              { valor: "EMPRESA", rotulo: "Uma empresa" },
              { valor: "PESSOA", rotulo: "Uma pessoa" },
            ] as const
          ).map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={quemPaga === opcao.valor}
              onClick={() => setQuemPaga(opcao.valor)}
              className={cn(
                "min-h-10 flex-1 rounded-md px-3 text-sm font-semibold",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                quemPaga === opcao.valor
                  ? "bg-brand text-brand-foreground"
                  : "text-text-secondary hover:bg-bg-secondary",
              )}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>

        <p className="text-sm text-text-secondary">
          Na empresa, as horas de todos os funcionários entram na conta dela — é
          o caso da Toca.
        </p>
      </div>

      {quemPaga === "EMPRESA" ? (
        empresas.length === 0 ? (
          <AvisoVazio>
            Nenhuma empresa ativa cadastrada. Cadastre em Configurações →
            Empresas, ou faça o contrato no nome de uma pessoa.
          </AvisoVazio>
        ) : (
          <Escolha
            etiqueta="Empresa"
            valor={empresaId}
            aoMudar={setEmpresaId}
            opcoes={empresas.map((empresa) => ({
              valor: empresa.id,
              rotulo: empresa.nome,
            }))}
          />
        )
      ) : (
        <EscolherCliente
          escolhido={cliente}
          aoEscolher={setCliente}
          aoLimpar={() => setCliente(null)}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Valor da mensalidade"
          value={valorMensal}
          inputMode="decimal"
          onChange={(evento) => setValorMensal(evento.target.value)}
          placeholder="2400,00"
          erro={valorInvalido ? "Escreva como 2400,00." : null}
        />

        <Campo
          etiqueta="Dia do vencimento"
          type="number"
          inputMode="numeric"
          min={1}
          max={31}
          value={diaVencimento}
          onChange={(evento) => setDiaVencimento(evento.target.value)}
          erro={diaInvalido ? "De 1 a 31." : null}
          dica="Mês que não tem esse dia (31 em fevereiro) vence no último dele."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Escolha
          etiqueta="Espaço (opcional)"
          valor={espacoId}
          aoMudar={setEspacoId}
          opcoes={[
            { valor: "", rotulo: "Sem espaço fixo" },
            ...livres.map((espaco) => ({
              valor: espaco.id,
              rotulo: espaco.nome,
            })),
          ]}
          dica="Só os espaços livres aparecem. Quem paga só pelo acesso fica sem espaço."
        />

        <Campo
          etiqueta="Horas de sala inclusas (opcional)"
          type="number"
          inputMode="numeric"
          min={1}
          value={cotaHoras}
          onChange={(evento) => setCotaHoras(evento.target.value)}
          erro={cotaInvalida ? "Precisa ser maior que zero." : null}
          dica="Em branco = toda hora é cobrada. Não escreva zero."
        />
      </div>

      <Campo
        etiqueta="Início do contrato"
        type="date"
        value={inicio}
        onChange={(evento) => setInicio(evento.target.value)}
        dica="A cobrança só é gerada nos meses em que o contrato está vigente."
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Botao
          aparencia="secundario"
          largura="conteudo"
          onClick={aoFechar}
          disabled={ocupado}
        >
          Cancelar
        </Botao>

        <Botao largura="conteudo" onClick={salvar} disabled={invalido || ocupado}>
          Salvar contrato
        </Botao>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------

/** Uma linha de contrato, que abre o extrato das cobranças. */
function LinhaDoContrato({
  contrato,
  hoje,
  ocupado,
  aoOcupar,
  aoMudar,
  aoFalhar,
}: {
  contrato: ContratoNaTela;
  hoje: string;
  ocupado: boolean;
  aoOcupar: (ocupado: boolean) => void;
  aoMudar: () => void;
  aoFalhar: (erro: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [cobrancas, setCobrancas] = useState<LancamentoNaTela[] | null>(null);
  const [valor, setValor] = useState(contrato.valorMensal);
  const [encerrando, setEncerrando] = useState(false);
  const [fim, setFim] = useState(hoje);

  const quem = contrato.cliente?.nome ?? contrato.empresa?.nome ?? "sem pagador";

  async function abrir(): Promise<void> {
    setAberto((atual) => !atual);

    if (cobrancas === null) {
      try {
        const resposta = await buscarCobrancas(contrato.id);
        setCobrancas(resposta.cobrancas);
      } catch {
        // O extrato é conferência: se falhar, o resto da tela continua. Travar
        // por isso seria pior.
        setCobrancas([]);
      }
    }
  }

  async function comErro(acao: () => Promise<unknown>): Promise<void> {
    aoOcupar(true);
    aoFalhar(null);

    try {
      await acao();
      setCobrancas(null);
      aoMudar();
    } catch (falha: unknown) {
      aoFalhar(
        falha instanceof ErroDaApi ? falha.message : "Não conseguimos salvar.",
      );
    } finally {
      aoOcupar(false);
    }
  }

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-text-primary">
              {quem}
            </span>

            {contrato.vigente ? (
              <span className="inline-flex items-center rounded-full border border-black px-2 py-0.5 text-xs font-semibold text-text-primary">
                vigente
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-bg-secondary px-2 py-0.5 text-xs font-semibold text-text-secondary">
                {contrato.ativo ? "fora do período" : "desligado"}
              </span>
            )}
          </p>

          <p className="mt-0.5 text-sm text-text-secondary">
            {valorVisivel(contrato.valorMensal)} · vence dia{" "}
            {contrato.diaVencimento}
            {contrato.espaco ? ` · ${contrato.espaco.nome}` : " · sem espaço fixo"}
            {contrato.cotaHoras
              ? ` · ${contrato.cotaHoras} h inclusas`
              : " · sem horas inclusas"}
          </p>

          <p className="mt-0.5 text-sm text-text-secondary">
            desde {diaCompleto(contrato.inicio)}
            {contrato.fim ? ` até ${diaCompleto(contrato.fim)}` : ""} ·{" "}
            {contrato.cobrancas === 0
              ? "nenhuma cobrança gerada"
              : contrato.cobrancas === 1
                ? "1 cobrança gerada"
                : `${contrato.cobrancas} cobranças geradas`}
          </p>
        </div>

        <Botao
          aparencia="secundario"
          largura="conteudo"
          disabled={ocupado}
          onClick={() => void abrir()}
        >
          {aberto ? "Fechar" : "Abrir"}
        </Botao>
      </div>

      {aberto ? (
        <div className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-bg-secondary p-4">
          {/* --- REAJUSTE --- */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Campo
                etiqueta="Valor da mensalidade"
                value={valor}
                inputMode="decimal"
                onChange={(evento) => setValor(evento.target.value)}
                dica="Reajustar vale do próximo mês gerado. As cobranças já geradas ficam com o valor que era."
              />
            </div>

            <Botao
              largura="conteudo"
              disabled={ocupado || centavosDe(valor) <= 0}
              onClick={() =>
                void comErro(() => editarContrato(contrato.id, { valorMensal: valor }))
              }
            >
              Reajustar
            </Botao>
          </div>

          {/* --- ENCERRAR --- */}
          {contrato.ativo && !contrato.fim ? (
            encerrando ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-primary p-4">
                <p className="text-sm leading-relaxed text-text-primary">
                  <strong>Encerrar o contrato</strong> para de gerar cobrança a
                  partir do mês seguinte à data, e libera o espaço para outro
                  mensalista. As cobranças já geradas ficam no caixa.
                </p>

                <Campo
                  etiqueta="Último dia do contrato"
                  type="date"
                  value={fim}
                  onChange={(evento) => setFim(evento.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <Botao
                    largura="conteudo"
                    disabled={ocupado}
                    onClick={() =>
                      void comErro(() => editarContrato(contrato.id, { fim }))
                    }
                  >
                    Encerrar
                  </Botao>

                  <Botao
                    aparencia="secundario"
                    largura="conteudo"
                    onClick={() => setEncerrando(false)}
                    disabled={ocupado}
                  >
                    Cancelar
                  </Botao>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Botao
                  aparencia="secundario"
                  largura="conteudo"
                  disabled={ocupado}
                  onClick={() => setEncerrando(true)}
                >
                  Encerrar contrato
                </Botao>
              </div>
            )
          ) : null}

          {/* --- O EXTRATO --- */}
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-text-primary">
              Cobranças deste contrato
            </h4>

            {cobrancas === null ? (
              <Carregando texto="Carregando o extrato…" />
            ) : cobrancas.length === 0 ? (
              <AvisoVazio>
                Nenhuma cobrança gerada. Use “Gerar as cobranças do mês” acima.
              </AvisoVazio>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-bg-primary">
                {cobrancas.map((cobranca) => (
                  <li
                    key={cobranca.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="text-base text-text-primary">
                          {valorVisivel(cobranca.valor)}
                        </span>
                        <Situacao
                          situacao={cobranca.situacao}
                          diasDeAtraso={cobranca.diasDeAtraso}
                        />
                      </p>
                      <p className="mt-0.5 text-sm text-text-secondary">
                        vence {diaCompleto(cobranca.vencimento)}
                        {cobranca.pagoEm
                          ? ` · recebido ${diaCompleto(cobranca.pagoEm)}`
                          : ""}
                      </p>
                    </div>

                    {cobranca.situacao === "PAGO" ? (
                      <Botao
                        aparencia="secundario"
                        largura="conteudo"
                        disabled={ocupado}
                        onClick={() =>
                          void comErro(() =>
                            marcarPagamento(cobranca.id, { pagoEm: null }),
                          )
                        }
                      >
                        Desmarcar
                      </Botao>
                    ) : (
                      <Botao
                        largura="conteudo"
                        disabled={ocupado}
                        onClick={() =>
                          void comErro(() =>
                            marcarPagamento(cobranca.id, { pagoEm: hoje }),
                          )
                        }
                      >
                        Recebi
                      </Botao>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}
