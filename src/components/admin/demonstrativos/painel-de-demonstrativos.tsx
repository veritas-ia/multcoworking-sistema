"use client";

import { useCallback, useEffect, useState } from "react";

import { procurarClientes, type ClienteConhecido } from "@/components/admin/agenda/api";
import {
  buscarEmpresas,
  buscarTemplates,
  salvarTemplate,
  type EmpresaDoPainel,
  type TemplateNaTela,
} from "@/components/admin/configuracoes/api";
import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { telefoneVisivel } from "@/lib/telefone";

import { definirEmpresaDoCliente } from "./acoes";
import {
  enderecoDoPdf,
  enviarPeloWhatsapp,
  listarEmitidos,
  previsualizar,
  salvarDemonstrativo,
  type Demonstrativo,
  type DemonstrativoNaLista,
  type LinhaExtra,
} from "./api";

const CHAVE_DO_MODELO = "demonstrativo_mensal";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

/** 183734 -> "R$ 1.837,34". */
function comoDinheiro(centavos: number): string {
  const texto = Math.abs(centavos / 100)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${centavos < 0 ? "-" : ""}R$ ${texto}`;
}

/** 2.5 -> "2,5 h". */
function horasPorExtenso(horas: number): string {
  const texto = Number.isInteger(horas)
    ? String(horas)
    : horas.toFixed(2).replace(/0$/, "").replace(".", ",");
  return `${texto} h`;
}

/** "2026-09-11" -> "11/09/2026". */
function emDiaMesAno(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * CONTROLE DE HORAS: o demonstrativo mensal do cliente.
 *
 * A gestao fazia isto numa planilha, a mao, e os totais eram texto digitado —
 * a de setembro da Toca cobrava R$ 70 a mais do que as proprias linhas dela
 * somavam. Aqui NENHUM total e digitado: o sistema soma.
 */
export function PainelDeDemonstrativos({ hoje }: { hoje: string }) {
  const [procurado, setProcurado] = useState("");
  const [achados, setAchados] = useState<ClienteConhecido[]>([]);
  const [cliente, setCliente] = useState<ClienteConhecido | null>(null);
  /** As empresas mensalistas, para o documento da empresa inteira. */
  const [empresas, setEmpresas] = useState<EmpresaDoPainel[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaDoPainel | null>(null);

  /** De quem é o documento: uma pessoa ou a empresa inteira. */
  const dono = empresa
    ? { empresaId: empresa.id, nome: empresa.nome }
    : cliente
      ? { clienteId: cliente.id, nome: cliente.nome }
      : null;

  const [de, setDe] = useState("");
  const [ate, setAte] = useState(hoje);
  const [valorHora, setValorHora] = useState("");
  const [linhas, setLinhas] = useState<LinhaExtra[]>([]);
  const [totalAjustado, setTotalAjustado] = useState("");

  const [previa, setPrevia] = useState<Demonstrativo | null>(null);
  const [salvo, setSalvo] = useState<Demonstrativo | null>(null);
  const [emitidos, setEmitidos] = useState<DemonstrativoNaLista[]>([]);

  const [modelo, setModelo] = useState<TemplateNaTela | null>(null);
  const [textoDoModelo, setTextoDoModelo] = useState("");
  const [editandoModelo, setEditandoModelo] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const controle = new AbortController();

    buscarEmpresas(controle.signal)
      .then((resposta) => {
        if (!controle.signal.aborted) {
          setEmpresas(resposta.empresas.filter((e) => e.ativa));
        }
      })
      .catch(() => {
        // Sem a lista, a tela ainda serve para o documento de uma pessoa.
      });

    return () => controle.abort();
  }, []);

  // --- o texto do WhatsApp, que e o mesmo de Configuracoes -> Mensagens ------
  useEffect(() => {
    const controle = new AbortController();

    buscarTemplates(controle.signal)
      .then((resposta) => {
        const achado = resposta.templates.find((t) => t.chave === CHAVE_DO_MODELO);
        if (achado && !controle.signal.aborted) {
          setModelo(achado);
          setTextoDoModelo(achado.texto);
        }
      })
      .catch(() => {
        // Sem o modelo a tela continua servindo para baixar o PDF; só o
        // envio pelo WhatsApp é que vai recusar, com a mensagem do servidor.
      });

    return () => controle.abort();
  }, []);

  // --- procurar o cliente ----------------------------------------------------
  useEffect(() => {
    if (procurado.trim().length < 2) {
      setAchados([]);
      return;
    }

    const controle = new AbortController();
    const relogio = setTimeout(() => {
      procurarClientes(procurado, controle.signal)
        .then((resposta) => {
          if (!controle.signal.aborted) {
            setAchados(resposta.clientes);
          }
        })
        .catch(() => {
          if (!controle.signal.aborted) {
            setAchados([]);
          }
        });
    }, 300);

    return () => {
      clearTimeout(relogio);
      controle.abort();
    };
  }, [procurado]);

  const carregarEmitidos = useCallback(async (de?: {
    clienteId?: string;
    empresaId?: string;
  }) => {
    try {
      const resposta = await listarEmitidos(de);
      setEmitidos(resposta.emitidos);
    } catch {
      // Lista vazia não impede emitir um novo.
    }
  }, []);

  useEffect(() => {
    void carregarEmitidos();
  }, [carregarEmitidos]);

  /** Refaz a pré-visualização sempre que período ou preço mudam. */
  const atualizarPrevia = useCallback(
    async (
      quem: { clienteId?: string; empresaId?: string },
      inicio: string,
      fim: string,
      preco: string,
    ) => {
      if (!inicio || !fim) {
        return;
      }

      setErro(null);

      try {
        const resposta = await previsualizar({
          clienteId: quem.clienteId,
          empresaId: quem.empresaId,
          de: inicio,
          ate: fim,
          valorHora: preco || undefined,
        });
        setPrevia(resposta.demonstrativo);
        // O preço guardado do cliente aparece já preenchido na primeira vez.
        if (!preco && resposta.demonstrativo.valorHora !== "0.00") {
          setValorHora(resposta.demonstrativo.valorHora);
        }
      } catch (falha) {
        setPrevia(null);
        setErro(mensagemDe(falha, "Não foi possível montar o demonstrativo."));
      }
    },
    [],
  );

  useEffect(() => {
    if (dono && de && ate) {
      void atualizarPrevia(dono, de, ate, valorHora);
    }
    // "dono" é derivado de cliente e empresa; depender deles evita refazer a
    // consulta a cada renderização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliente, empresa, de, ate, valorHora, atualizarPrevia]);

  function limparEscolha(): void {
    setSalvo(null);
    setPrevia(null);
    setValorHora("");
    setLinhas([]);
    setTotalAjustado("");
  }

  function escolherEmpresa(qual: EmpresaDoPainel | null): void {
    setEmpresa(qual);
    setCliente(null);
    setProcurado("");
    setAchados([]);
    limparEscolha();
    void carregarEmitidos(qual ? { empresaId: qual.id } : undefined);
  }

  function escolher(quem: ClienteConhecido): void {
    setCliente(quem);
    setEmpresa(null);
    setProcurado("");
    setAchados([]);
    limparEscolha();
    void carregarEmitidos({ clienteId: quem.id });
  }

  async function comAviso(acao: () => Promise<string | void>, padrao: string) {
    setOcupado(true);
    setErro(null);
    setRecado(null);

    try {
      const dito = await acao();
      if (dito) {
        setRecado(dito);
      }
    } catch (falha) {
      setErro(mensagemDe(falha, padrao));
    } finally {
      setOcupado(false);
    }
  }

  /** O total que vale: o escrito à mão, quando houver, senão o calculado. */
  const totalCalculado = previa
    ? previa.valorDasHorasCentavos +
      linhas.reduce(
        (soma, linha) => soma + Math.round(Number(linha.valor || "0") * 100),
        0,
      )
    : 0;

  const totalQueVale = totalAjustado
    ? Math.round(Number(totalAjustado.replace(",", ".")) * 100)
    : totalCalculado;

  const podeSalvar = Boolean(dono && de && ate && valorHora && !ocupado);

  return (
    <div className="flex flex-col gap-4">
      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      {recado ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-bg-primary p-3 text-sm leading-relaxed text-text-primary"
        >
          {recado}
        </p>
      ) : null}

      {/* --- 1. o cliente --------------------------------------------------- */}
      {/* DE QUEM É O DOCUMENTO.
          A empresa vem primeiro de propósito: o demonstrativo do mensalista
          é da EMPRESA — o da Toca cobre o Matheus, o Vinicius e todo mundo
          que reservou no nome dela. Fazer um por pessoa obrigaria a gestão a
          somar quatro à mão, que é o trabalho que esta tela veio tirar. */}
      <Secao
        titulo="De quem é o documento"
        apoio="Uma empresa mensalista, ou uma pessoa específica."
      >
        {dono ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-base font-bold text-text-primary">
                {dono.nome}
              </span>
              <span className="text-sm text-text-secondary">
                {empresa
                  ? "empresa — entram as horas de todos os funcionários"
                  : cliente && cliente.telefones.length > 0
                    ? cliente.telefones.map(telefoneVisivel).join(" · ")
                    : "pessoa, sem telefone no cadastro"}
              </span>
            </div>
            <Botao
              largura="conteudo"
              aparencia="secundario"
              onClick={() => {
                setCliente(null);
                setEmpresa(null);
                limparEscolha();
                void carregarEmitidos();
              }}
            >
              Trocar
            </Botao>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {empresas.length > 0 ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  Empresa mensalista
                </span>
                <div className="flex flex-wrap gap-2">
                  {empresas.map((qual) => (
                    <Botao
                      key={qual.id}
                      largura="conteudo"
                      aparencia="secundario"
                      onClick={() => escolherEmpresa(qual)}
                    >
                      {qual.nome}
                    </Botao>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Campo
                etiqueta="Ou procure uma pessoa"
                type="search"
                value={procurado}
                placeholder="Nome ou telefone"
                autoComplete="off"
                onChange={(evento) => setProcurado(evento.target.value)}
              />
              {achados.map((quem) => (
                <div
                  key={quem.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-primary p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => escolher(quem)}
                    className="flex flex-1 flex-col items-start text-left focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                  >
                    <span className="text-sm font-bold text-text-primary">
                      {quem.nome}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {quem.reservas} {quem.reservas === 1 ? "reserva" : "reservas"}
                      {quem.empresa ? ` · ${quem.empresa.nome}` : ""}
                    </span>
                  </button>

                  {/* INCLUIR NA EMPRESA, aqui mesmo.
                      É o que junta os quatro cadastros da Toca: eles não são
                      a mesma pessoa, então não se juntam como cliente — o que
                      os reúne é a empresa. Dito isso uma vez, as reservas
                      PASSADAS dele já entram na fatura dela. */}
                  {empresas.length > 0 ? (
                    <label className="flex items-center gap-1.5 text-sm text-text-secondary">
                      <span className="sr-only">Empresa de {quem.nome}</span>
                      <select
                        value={quem.empresa?.id ?? ""}
                        disabled={ocupado}
                        onChange={(evento) =>
                          void comAviso(async () => {
                            await definirEmpresaDoCliente(
                              quem.id,
                              evento.target.value || null,
                            );
                            // Refaz a busca, para a lista mostrar o vínculo novo.
                            const resposta = await procurarClientes(procurado);
                            setAchados(resposta.clientes);
                            return "Empresa do cliente atualizada.";
                          }, "Não foi possível vincular à empresa.")
                        }
                        className="min-h-9 rounded-md border border-border bg-bg-primary px-2 text-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                      >
                        <option value="">Sem empresa</option>
                        {empresas.map((qual) => (
                          <option key={qual.id} value={qual.id}>
                            {qual.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </Secao>

      {dono ? (
        <>
          {/* --- 2. periodo e preco ----------------------------------------- */}
          <Secao
            titulo="Período e valor"
            apoio="As duas datas são livres: o ciclo não precisa ser mês fechado."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo
                etiqueta="De"
                type="date"
                value={de}
                onChange={(evento) => setDe(evento.target.value)}
              />
              <Campo
                etiqueta="Até"
                type="date"
                value={ate}
                onChange={(evento) => setAte(evento.target.value)}
              />
              <Campo
                etiqueta="Valor por hora"
                inputMode="decimal"
                placeholder="30,00"
                value={valorHora}
                onChange={(evento) => setValorHora(evento.target.value)}
                dica="Fica guardado para a próxima vez."
              />
            </div>
          </Secao>

          {/* --- 3. a tabela de horas --------------------------------------- */}
          {previa ? (
            <Secao
              titulo="Horas no período"
              apoio="Puxadas das reservas. Cancelada não entra."
            >
              {previa.itens.length === 0 ? (
                <p className="text-sm text-text-secondary">
                  Nenhuma reserva deste cliente neste período.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-text-secondary">
                        <th className="py-1.5 font-semibold">Dia</th>
                        <th className="py-1.5 font-semibold">Sala</th>
                        <th className="py-1.5 font-semibold">Horário</th>
                        <th className="py-1.5 text-right font-semibold">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previa.itens.map((item, indice) => (
                        <tr
                          key={`${item.dia}-${item.inicio}-${indice}`}
                          className="border-b border-border/60"
                        >
                          <td className="py-1.5 tabular-nums">{emDiaMesAno(item.dia)}</td>
                          <td className="py-1.5">{item.sala}</td>
                          <td className="py-1.5 tabular-nums text-text-secondary">
                            {item.inicio}–{item.fim}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">
                            {horasPorExtenso(item.horas)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-text-primary">
                <strong>Total de horas</strong>
                <strong className="tabular-nums">
                  {horasPorExtenso(previa.horas)}
                </strong>
              </p>

              {previa.porSala.length > 1 ? (
                <p className="mt-1 text-sm text-text-secondary">
                  {previa.porSala
                    .map((s) => `${s.sala}: ${horasPorExtenso(s.horas)}`)
                    .join(" · ")}
                </p>
              ) : null}
            </Secao>
          ) : null}

          {/* --- 4. as linhas digitadas ------------------------------------- */}
          <Secao
            titulo="Outras linhas"
            apoio="Posições, empório, impressões — o que não sai das reservas."
          >
            <ul className="flex flex-col gap-2">
              {linhas.map((linha, indice) => (
                <li key={indice} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Campo
                      etiqueta="Descrição"
                      value={linha.descricao}
                      maxLength={120}
                      placeholder="2 posições"
                      onChange={(evento) =>
                        setLinhas((atuais) =>
                          atuais.map((l, i) =>
                            i === indice ? { ...l, descricao: evento.target.value } : l,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="w-32">
                    <Campo
                      etiqueta="Valor"
                      inputMode="decimal"
                      placeholder="940,00"
                      value={linha.valor}
                      onChange={(evento) =>
                        setLinhas((atuais) =>
                          atuais.map((l, i) =>
                            i === indice ? { ...l, valor: evento.target.value } : l,
                          ),
                        )
                      }
                    />
                  </div>
                  <Botao
                    largura="conteudo"
                    aparencia="texto"
                    onClick={() =>
                      setLinhas((atuais) => atuais.filter((_, i) => i !== indice))
                    }
                  >
                    Tirar
                  </Botao>
                </li>
              ))}
            </ul>

            <Botao
              largura="conteudo"
              aparencia="secundario"
              className="mt-2"
              onClick={() =>
                setLinhas((atuais) => [...atuais, { descricao: "", valor: "" }])
              }
            >
              + linha
            </Botao>
          </Secao>

          {/* --- 5. o total -------------------------------------------------- */}
          {previa ? (
            <Secao titulo="Total">
              <dl className="flex flex-col gap-1 text-sm">
                <Linha
                  rotulo={`Horas · ${horasPorExtenso(previa.horas)} × ${valorHora || "0"}`}
                  valor={comoDinheiro(previa.valorDasHorasCentavos)}
                />
                {linhas
                  .filter((l) => l.descricao || l.valor)
                  .map((linha, indice) => (
                    <Linha
                      key={indice}
                      rotulo={linha.descricao || "(sem descrição)"}
                      valor={comoDinheiro(
                        Math.round(Number(linha.valor || "0") * 100),
                      )}
                    />
                  ))}
              </dl>

              <p className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-3">
                <strong className="text-base text-text-primary">Valor total</strong>
                <strong className="text-xl tabular-nums text-text-primary">
                  {comoDinheiro(totalQueVale)}
                </strong>
              </p>

              {/* AJUSTE MANUAL: existe porque o dono pediu a saída para o caso
                  de renegociação, avisando que é raro. Fica discreto e com o
                  calculado do lado, para ninguém usar sem perceber. */}
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-text-secondary">
                  Ajustar o total à mão
                </summary>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <div className="w-40">
                    <Campo
                      etiqueta="Total combinado"
                      inputMode="decimal"
                      placeholder={(totalCalculado / 100).toFixed(2)}
                      value={totalAjustado}
                      onChange={(evento) => setTotalAjustado(evento.target.value)}
                    />
                  </div>
                  <p className="pb-3 text-sm text-text-secondary">
                    O sistema calculou {comoDinheiro(totalCalculado)}. Deixe vazio
                    para usar esse valor.
                  </p>
                </div>
              </details>
            </Secao>
          ) : null}

          {/* --- 6. salvar, baixar, enviar ---------------------------------- */}
          <Secao titulo="Emitir">
            <div className="flex flex-wrap gap-3">
              <Botao
                largura="conteudo"
                disabled={!podeSalvar}
                onClick={() =>
                  void comAviso(async () => {
                    const resposta = await salvarDemonstrativo({
                      id: salvo?.id ?? null,
                      clienteId: cliente?.id ?? null,
                      empresaId: empresa?.id ?? null,
                      de,
                      ate,
                      valorHora: valorHora.replace(",", "."),
                      linhasExtras: linhas
                        .filter((l) => l.descricao.trim() && l.valor.trim())
                        .map((l) => ({
                          descricao: l.descricao.trim(),
                          valor: l.valor.replace(",", "."),
                        })),
                      totalAjustado: totalAjustado
                        ? totalAjustado.replace(",", ".")
                        : null,
                      lembrarPreco: true,
                    });
                    setSalvo(resposta.demonstrativo);
                    await carregarEmitidos(
                      empresa ? { empresaId: empresa.id } : { clienteId: cliente!.id },
                    );
                    return "Demonstrativo salvo. Agora dá para baixar e enviar.";
                  }, "Não foi possível salvar.")
                }
              >
                {salvo ? "Salvar de novo" : "Salvar demonstrativo"}
              </Botao>

              <Botao
                largura="conteudo"
                aparencia="secundario"
                disabled={!salvo}
                onClick={() => {
                  if (salvo?.id) {
                    window.open(enderecoDoPdf(salvo.id), "_blank");
                  }
                }}
              >
                Baixar PDF
              </Botao>
            </div>

            {!salvo ? (
              <p className="mt-2 text-sm text-text-secondary">
                Salve primeiro: é o que congela a tabela de horas no documento.
              </p>
            ) : null}

            {salvo && cliente && cliente.telefones.length > 0 ? (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-sm font-semibold text-text-primary">
                  Enviar pelo WhatsApp
                </p>
                <div className="flex flex-wrap gap-2">
                  {cliente.telefones.map((telefone) => (
                    <Botao
                      key={telefone}
                      largura="conteudo"
                      aparencia="secundario"
                      disabled={ocupado}
                      onClick={() =>
                        void comAviso(async () => {
                          const resposta = await enviarPeloWhatsapp(salvo.id!, telefone);
                          await carregarEmitidos({ clienteId: cliente.id });
                          return resposta.mensagem;
                        }, "Não foi possível enviar pelo WhatsApp.")
                      }
                    >
                      Enviar para {telefoneVisivel(telefone)}
                    </Botao>
                  ))}
                </div>
              </div>
            ) : null}

            {salvo && (!cliente || cliente.telefones.length === 0) ? (
              <p className="mt-4 border-t border-border pt-4 text-sm text-text-secondary">
                {empresa
                  ? "Documento de empresa: baixe o PDF e envie para o e-mail do financeiro dela."
                  : "Este cliente não tem telefone no cadastro, então o envio pelo WhatsApp não aparece. Baixe o PDF e envie por e-mail."}
              </p>
            ) : null}
          </Secao>

          {/* --- 7. a previa da mensagem ------------------------------------ */}
          <Secao
            titulo="Mensagem do WhatsApp"
            apoio="É o texto que acompanha o PDF. Vale para todos os demonstrativos — é o mesmo de Configurações → Mensagens."
          >
            {editandoModelo ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={textoDoModelo}
                  rows={8}
                  onChange={(evento) => setTextoDoModelo(evento.target.value)}
                  className="w-full rounded-lg border border-border bg-bg-primary p-3 text-sm leading-relaxed text-text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
                />
                <p className="text-sm text-text-secondary">
                  Variáveis: {"{{nome}}"} {"{{periodo}}"} {"{{horas}}"} {"{{valor}}"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Botao
                    largura="conteudo"
                    disabled={ocupado || textoDoModelo.trim().length < 5}
                    onClick={() =>
                      void comAviso(async () => {
                        const resposta = await salvarTemplate(
                          CHAVE_DO_MODELO,
                          textoDoModelo,
                        );
                        setModelo(resposta.template);
                        setEditandoModelo(false);
                        return "Texto da mensagem atualizado.";
                      }, "Não foi possível salvar o texto.")
                    }
                  >
                    Salvar texto
                  </Botao>
                  <Botao
                    largura="conteudo"
                    aparencia="texto"
                    onClick={() => {
                      setTextoDoModelo(modelo?.texto ?? "");
                      setEditandoModelo(false);
                    }}
                  >
                    Cancelar
                  </Botao>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <pre className="whitespace-pre-wrap rounded-lg border border-border bg-bg-secondary p-3 font-sans text-sm leading-relaxed text-text-primary">
                  {previaDaMensagem(modelo?.texto ?? "", {
                    nome: dono.nome,
                    periodo: de && ate ? `${emDiaMesAno(de)} a ${emDiaMesAno(ate)}` : "…",
                    horas: previa ? horasPorExtenso(previa.horas) : "…",
                    valor: comoDinheiro(totalQueVale),
                  })}
                </pre>
                <Botao
                  largura="conteudo"
                  aparencia="secundario"
                  onClick={() => setEditandoModelo(true)}
                >
                  Editar o texto
                </Botao>
              </div>
            )}
          </Secao>
        </>
      ) : null}

      {/* --- 8. os ja emitidos --------------------------------------------- */}
      <Secao
        titulo="Já emitidos"
        apoio="O controle de qual período já foi para o cliente."
      >
        {emitidos.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum demonstrativo ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {emitidos.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-bg-primary p-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-text-primary">
                    {item.clienteNome}
                  </span>
                  <span className="text-sm tabular-nums text-text-secondary">
                    {emDiaMesAno(item.de)} a {emDiaMesAno(item.ate)} ·{" "}
                    {horasPorExtenso(item.horas)} · {comoDinheiro(item.totalCentavos)}
                  </span>
                  <span className="text-sm text-text-secondary">
                    {item.enviadoEm
                      ? `enviado em ${new Date(item.enviadoEm).toLocaleDateString("pt-BR")}`
                      : "ainda não enviado"}
                  </span>
                </div>
                <Botao
                  largura="conteudo"
                  aparencia="secundario"
                  onClick={() => window.open(enderecoDoPdf(item.id), "_blank")}
                >
                  Baixar PDF
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}

/** Troca as variáveis pelo que vai de verdade, para a pessoa ver o resultado. */
function previaDaMensagem(
  texto: string,
  valores: { nome: string; periodo: string; horas: string; valor: string },
): string {
  if (!texto) {
    return "O modelo de mensagem ainda não está cadastrado.";
  }

  return texto
    .replaceAll("{{nome}}", valores.nome)
    .replaceAll("{{periodo}}", valores.periodo)
    .replaceAll("{{horas}}", valores.horas)
    .replaceAll("{{valor}}", valores.valor);
}

function Secao({
  titulo,
  apoio,
  children,
}: {
  titulo: string;
  apoio?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-bg-primary p-4 sm:p-5">
      <h2 className="text-base font-bold text-text-primary">{titulo}</h2>
      {apoio ? (
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{apoio}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-text-primary">{rotulo}</dt>
      <dd className="tabular-nums text-text-primary">{valor}</dd>
    </div>
  );
}
