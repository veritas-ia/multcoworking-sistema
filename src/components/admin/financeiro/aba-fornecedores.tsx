"use client";

import { useEffect, useState } from "react";

import { Secao } from "@/components/admin/configuracoes/pecas";
import { AvisoDeErro, AvisoVazio, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { ErroDaApi } from "@/components/reserva/api";
import { cn } from "@/lib/utils";

import { buscarFornecedores, criarFornecedor, editarFornecedor } from "./api";
import type { FornecedorNaTela } from "./tipos";

/**
 * OS FORNECEDORES — quem recebe o dinheiro das saídas.
 *
 * POR QUE NÃO SÃO CLIENTES: cliente é quem PAGA ao coworking. Misturar os dois
 * faria a empresa de limpeza aparecer no relatório de clientes como se fosse
 * cliente, somando horas que não existem.
 *
 * EXCLUIR NÃO EXISTE, mesma regra de salas, empresas, áreas de atuação e
 * clientes: apagar tiraria as despesas dele do relatório em silêncio, e a
 * chave estrangeira do banco recusaria de todo jeito. Desligar tira das telas
 * de lançamento e o histórico fica inteiro.
 */
export function AbaDeFornecedores() {
  const [fornecedores, setFornecedores] = useState<FornecedorNaTela[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [novoNome, setNovoNome] = useState("");
  const [novaObservacao, setNovaObservacao] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    buscarFornecedores()
      .then((resposta) => {
        setFornecedores(resposta.fornecedores);
        setCarregando(false);
      })
      .catch((falha: unknown) => {
        setErro(
          falha instanceof ErroDaApi
            ? falha.message
            : "Não conseguimos abrir os fornecedores.",
        );
        setCarregando(false);
      });
  }, []);

  function avisar(falha: unknown, padrao: string): void {
    setErro(falha instanceof ErroDaApi ? falha.message : padrao);
  }

  async function cadastrar(): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { fornecedor } = await criarFornecedor({
        nome: novoNome.trim(),
        observacao: novaObservacao.trim() || null,
      });

      setFornecedores((atuais) =>
        [...atuais, fornecedor].sort((um, outro) => um.nome.localeCompare(outro.nome)),
      );
      setNovoNome("");
      setNovaObservacao("");
      setRecado(`${fornecedor.nome} cadastrado.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos cadastrar o fornecedor.");
    } finally {
      setOcupado(false);
    }
  }

  async function salvar(id: string): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const { fornecedor } = await editarFornecedor(id, {
        nome: nome.trim(),
        // Mandar sempre, inclusive vazio: aqui o campo está na tela e em
        // branco significa "apaguei a anotação", não "não mexi".
        observacao: observacao.trim() || null,
      });

      setFornecedores((atuais) =>
        atuais.map((um) => (um.id === id ? fornecedor : um)),
      );
      setEditandoId(null);
      setRecado(`${fornecedor.nome} salvo.`);
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos salvar o fornecedor.");
    } finally {
      setOcupado(false);
    }
  }

  async function ligarOuDesligar(fornecedor: FornecedorNaTela): Promise<void> {
    setOcupado(true);
    setErro(null);

    try {
      const salvo = await editarFornecedor(fornecedor.id, {
        ativo: !fornecedor.ativo,
      });

      setFornecedores((atuais) =>
        atuais.map((um) => (um.id === fornecedor.id ? salvo.fornecedor : um)),
      );
      setRecado(
        salvo.fornecedor.ativo
          ? `${salvo.fornecedor.nome} voltou para a lista.`
          : `${salvo.fornecedor.nome} saiu das telas de lançamento. As despesas dele continuam no relatório.`,
      );
    } catch (falha: unknown) {
      avisar(falha, "Não conseguimos mudar o fornecedor.");
    } finally {
      setOcupado(false);
    }
  }

  if (carregando) {
    return <Carregando texto="Abrindo os fornecedores…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      {erro ? <AvisoDeErro mensagem={erro} /> : null}

      {recado ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm text-text-primary"
        >
          {recado}
        </p>
      ) : null}

      <Secao
        titulo="Fornecedores"
        descricao="Quem recebe o dinheiro das saídas. É opcional no lançamento — serve para depois dar para somar quanto foi para cada um."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Nome"
              value={novoNome}
              onChange={(evento) => setNovoNome(evento.target.value)}
              placeholder="Energia da Cidade"
            />

            <Campo
              etiqueta="Anotação (opcional)"
              value={novaObservacao}
              maxLength={300}
              onChange={(evento) => setNovaObservacao(evento.target.value)}
              placeholder="CNPJ, telefone, nº da conta…"
            />
          </div>

          <div className="flex justify-end">
            <Botao
              largura="conteudo"
              onClick={cadastrar}
              disabled={ocupado || novoNome.trim().length < 2}
            >
              Cadastrar fornecedor
            </Botao>
          </div>

          {fornecedores.length === 0 ? (
            <AvisoVazio>
              Nenhum fornecedor cadastrado. Dá para lançar saída sem ele — o
              campo é opcional.
            </AvisoVazio>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {fornecedores.map((fornecedor) => (
                <li
                  key={fornecedor.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  {editandoId === fornecedor.id ? (
                    <>
                      <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                        <Campo
                          etiqueta="Nome"
                          value={nome}
                          onChange={(evento) => setNome(evento.target.value)}
                        />
                        <Campo
                          etiqueta="Anotação"
                          value={observacao}
                          maxLength={300}
                          onChange={(evento) => setObservacao(evento.target.value)}
                        />
                      </div>

                      <Botao
                        largura="conteudo"
                        onClick={() => void salvar(fornecedor.id)}
                        disabled={ocupado || nome.trim().length < 2}
                      >
                        Salvar
                      </Botao>

                      <Botao
                        aparencia="secundario"
                        largura="conteudo"
                        onClick={() => setEditandoId(null)}
                        disabled={ocupado}
                      >
                        Cancelar
                      </Botao>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-base font-semibold",
                            fornecedor.ativo
                              ? "text-text-primary"
                              : "text-text-secondary",
                          )}
                        >
                          {fornecedor.nome}
                          {!fornecedor.ativo ? (
                            <span className="ml-2 text-sm font-normal text-text-secondary">
                              (desligado — fora das telas de lançamento,
                              histórico mantido)
                            </span>
                          ) : null}
                        </p>

                        <p className="mt-0.5 text-sm text-text-secondary">
                          {fornecedor.observacao ? `${fornecedor.observacao} · ` : ""}
                          {fornecedor.lancamentos === 0
                            ? "nenhuma despesa"
                            : fornecedor.lancamentos === 1
                              ? "1 despesa"
                              : `${fornecedor.lancamentos} despesas`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          disabled={ocupado}
                          onClick={() => {
                            setEditandoId(fornecedor.id);
                            setNome(fornecedor.nome);
                            setObservacao(fornecedor.observacao ?? "");
                          }}
                        >
                          Editar
                        </Botao>

                        <Botao
                          aparencia="secundario"
                          largura="conteudo"
                          disabled={ocupado}
                          onClick={() => void ligarOuDesligar(fornecedor)}
                        >
                          {fornecedor.ativo ? "Desligar" : "Religar"}
                        </Botao>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Secao>
    </div>
  );
}
