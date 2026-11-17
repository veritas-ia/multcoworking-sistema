"use client";

import { useCallback, useEffect, useState } from "react";

import { ErroDaApi } from "@/components/reserva/api";
import { AvisoDeErro, Carregando } from "@/components/ui/avisos";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

import {
  buscarUsuarios,
  criarUsuario,
  definirAcessoFinanceiro,
  ligarOuDesligarUsuario,
  redefinirSenha,
  trocarMinhaSenha,
  type UsuarioDoPainel,
} from "./api";
import { CaixaInformativa, Secao } from "./pecas";

function mensagemDe(erro: unknown, padrao: string): string {
  return erro instanceof ErroDaApi ? erro.message : padrao;
}

/**
 * ESTA ABA TEM DOIS ROSTOS (17/11/2026).
 *
 * Para quem tem acesso TOTAL, ela e a administracao de acessos de sempre.
 * Para quem NAO ve o financeiro, ela e so "Minha senha" — e a barra lateral
 * ja a chama assim.
 *
 * POR QUE NAO UMA TELA SEPARADA: trocar a propria senha e a unica coisa que
 * todo mundo faz aqui, e ela ja morava nesta aba. Criar uma segunda tela so
 * para isso deixaria duas portas para a mesma coisa, e um dia as duas
 * discordariam.
 *
 * ESCONDER NAO E A TRANCA: as rotas /api/admin/usuarios recusam no servidor.
 */
export function AbaDeUsuarios({ podeAdministrar }: { podeAdministrar: boolean }) {
  const [usuarios, setUsuarios] = useState<UsuarioDoPainel[] | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState<string | null>(null);

  const carregar = useCallback(
    async (sinal?: AbortSignal) => {
      // Quem nao administra nem PEDE a lista: a rota responderia 403 e a tela
      // mostraria um erro vermelho para quem so queria trocar a propria senha.
      if (!podeAdministrar) {
        return;
      }

      setErroAoCarregar(null);

      try {
        const resposta = await buscarUsuarios(sinal);
        setUsuarios(resposta.usuarios);
      } catch (erro) {
        if (sinal?.aborted) {
          return;
        }
        setErroAoCarregar(mensagemDe(erro, "Não foi possível carregar os usuários."));
      }
    },
    [podeAdministrar],
  );

  useEffect(() => {
    const controle = new AbortController();
    void carregar(controle.signal);
    return () => controle.abort();
  }, [carregar]);

  if (!podeAdministrar) {
    return (
      <div className="flex flex-col gap-4">
        <MinhaSenha />

        <CaixaInformativa titulo="Só quem administra acessos vê a lista">
          <p>
            O seu acesso não inclui a parte financeira, e quem não vê o
            financeiro também não administra usuários — senão bastaria vir
            aqui e liberar o próprio acesso.
          </p>
          <p>
            Para criar um acesso novo, redefinir a senha de alguém ou mudar um
            nível, peça a um administrador.
          </p>
        </CaixaInformativa>
      </div>
    );
  }

  if (erroAoCarregar) {
    return <AvisoDeErro mensagem={erroAoCarregar} aoTentarDeNovo={() => void carregar()} />;
  }

  if (!usuarios) {
    return <Carregando texto="Carregando os usuários…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <MinhaSenha />
      <QuemTemAcesso usuarios={usuarios} aoRecarregar={() => void carregar()} />
      <NovoAcesso aoCriar={() => void carregar()} />

      <CaixaInformativa titulo="Os dois níveis de acesso">
        <p>
          <strong>Acesso total:</strong> pode tudo — inclusive criar contas,
          redefinir a senha de uma colega, desligar alguém e abrir o
          Financeiro.
        </p>
        <p>
          <strong>Sem a parte financeira:</strong> vê a agenda, o empório, os
          clientes, o controle de horas e os relatórios, e continua podendo
          registrar “Recebi no balcão” numa reserva. Não abre o Financeiro, não
          cadastra espaços mensais e <strong>não administra usuários</strong> —
          sem essa última parte o filtro não valeria nada, porque a pessoa
          viria aqui e liberaria o próprio acesso.
        </p>
        <p>
          Ninguém tira o próprio acesso ao financeiro: sem ele você perderia
          também esta tela, e não teria como devolvê-lo a si mesmo.
        </p>
      </CaixaInformativa>
    </div>
  );
}

/** Trocar a propria senha: pede a senha atual. */
function MinhaSenha() {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setPronto(false);

    if (nova !== confirmacao) {
      setErro("A nova senha e a confirmação estão diferentes.");
      return;
    }

    setSalvando(true);

    try {
      await trocarMinhaSenha({ senhaAtual: atual, novaSenha: nova });
      setAtual("");
      setNova("");
      setConfirmacao("");
      setPronto(true);
    } catch (falha) {
      setErro(mensagemDe(falha, "Não foi possível trocar a senha."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Secao
      titulo="Minha senha"
      descricao="A senha atual é pedida de propósito: sem ela, um computador esquecido aberto no balcão viraria uma conta roubada."
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Senha atual"
          type="password"
          autoComplete="current-password"
          value={atual}
          onChange={(evento) => setAtual(evento.target.value)}
        />
        <Campo
          etiqueta="Nova senha"
          type="password"
          autoComplete="new-password"
          value={nova}
          onChange={(evento) => setNova(evento.target.value)}
          dica="Pelo menos 8 caracteres."
        />
        <Campo
          etiqueta="Repita a nova senha"
          type="password"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(evento) => setConfirmacao(evento.target.value)}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <p
            aria-live="polite"
            className={`text-sm sm:mr-auto ${erro ? "font-medium text-destructive" : "text-text-secondary"}`}
          >
            {erro ?? (pronto ? "Senha trocada." : "")}
          </p>
          <Botao
            largura="conteudo"
            disabled={salvando || atual === "" || nova === ""}
            onClick={() => void salvar()}
          >
            {salvando ? "Trocando…" : "Trocar minha senha"}
          </Botao>
        </div>
      </div>
    </Secao>
  );
}

/** A lista de quem entra no painel. */
function QuemTemAcesso({
  usuarios,
  aoRecarregar,
}: {
  usuarios: UsuarioDoPainel[];
  aoRecarregar: () => void;
}) {
  return (
    <Secao
      titulo="Quem tem acesso"
      descricao="Desligar tira a pessoa do painel na mesma hora, mas ela continua aparecendo como autora dos bloqueios e feriados que criou. Tirar o financeiro tira junto a administração de usuários."
    >
      <ul className="flex flex-col divide-y divide-border">
        {usuarios.map((usuario) => (
          <LinhaDoUsuario
            key={usuario.id}
            usuario={usuario}
            aoRecarregar={aoRecarregar}
          />
        ))}
      </ul>
    </Secao>
  );
}

function LinhaDoUsuario({
  usuario,
  aoRecarregar,
}: {
  usuario: UsuarioDoPainel;
  aoRecarregar: () => void;
}) {
  const [redefinindo, setRedefinindo] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function trocarNivel() {
    setErro(null);
    setRecado(null);
    setOcupado(true);

    try {
      await definirAcessoFinanceiro(usuario.id, !usuario.acessoFinanceiro);
      aoRecarregar();
    } catch (falha) {
      setErro(mensagemDe(falha, "Não foi possível mudar o nível de acesso."));
    } finally {
      setOcupado(false);
    }
  }

  async function trocarEstado() {
    setErro(null);
    setRecado(null);
    setOcupado(true);

    try {
      await ligarOuDesligarUsuario(usuario.id, !usuario.ativo);
      aoRecarregar();
    } catch (falha) {
      setErro(mensagemDe(falha, "Não foi possível mudar o acesso."));
    } finally {
      setOcupado(false);
    }
  }

  async function salvarSenha() {
    setErro(null);
    setRecado(null);
    setOcupado(true);

    try {
      await redefinirSenha(usuario.id, novaSenha);
      setNovaSenha("");
      setRedefinindo(false);
      setRecado(`Senha nova definida. Passe para ${usuario.nome} e peça para trocar depois.`);
    } catch (falha) {
      setErro(mensagemDe(falha, "Não foi possível definir a senha."));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-text-primary">
            {usuario.nome}
            {usuario.souEu ? (
              <span className="ml-2 rounded bg-bg-secondary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
                você
              </span>
            ) : null}
            {usuario.ativo ? null : (
              <span className="ml-2 rounded bg-bg-secondary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
                desligado
              </span>
            )}
            {/*
              O nivel aparece na LINHA, e nao escondido atras de um clique:
              quem abre esta tela esta justamente conferindo quem pode o que.
            */}
            <span className="ml-2 rounded bg-bg-secondary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
              {usuario.acessoFinanceiro ? "acesso total" : "sem financeiro"}
            </span>
          </span>
          <span className="font-mono text-sm text-text-secondary">{usuario.usuario}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {usuario.souEu ? null : (
            <Botao
              aparencia="secundario"
              largura="conteudo"
              disabled={ocupado}
              onClick={() => {
                setRedefinindo((atual) => !atual);
                setErro(null);
                setRecado(null);
              }}
            >
              {redefinindo ? "Cancelar" : "Definir nova senha"}
            </Botao>
          )}

          {/*
            O proprio operador NAO ve este botao: tirar o proprio acesso ao
            financeiro tiraria junto esta tela, e nao haveria como devolver.
            O servidor recusa de todo jeito; esconder evita a tentativa.
          */}
          {usuario.souEu ? null : (
            <Botao
              aparencia="secundario"
              largura="conteudo"
              disabled={ocupado}
              onClick={() => void trocarNivel()}
            >
              {usuario.acessoFinanceiro ? "Tirar o financeiro" : "Dar o financeiro"}
            </Botao>
          )}

          {usuario.souEu ? null : (
            <Botao
              aparencia="secundario"
              largura="conteudo"
              disabled={ocupado}
              onClick={() => void trocarEstado()}
            >
              {usuario.ativo ? "Desligar" : "Ligar"}
            </Botao>
          )}
        </div>
      </div>

      {redefinindo ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-secondary p-4">
          <Campo
            etiqueta={`Nova senha para ${usuario.nome}`}
            type="password"
            autoComplete="new-password"
            value={novaSenha}
            onChange={(evento) => setNovaSenha(evento.target.value)}
            dica="Pelo menos 8 caracteres. Combine uma senha provisória e peça para a pessoa trocar depois, em “Minha senha”."
          />
          <Botao
            largura="conteudo"
            className="self-end"
            disabled={ocupado || novaSenha === ""}
            onClick={() => void salvarSenha()}
          >
            {ocupado ? "Salvando…" : "Definir senha"}
          </Botao>
        </div>
      ) : null}

      {erro || recado ? (
        <p
          aria-live="polite"
          className={`text-sm ${erro ? "font-medium text-destructive" : "text-text-secondary"}`}
        >
          {erro ?? recado}
        </p>
      ) : null}
    </li>
  );
}

/** Cadastro de um acesso novo. */
function NovoAcesso({ aoCriar }: { aoCriar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  /**
   * NASCE DESMARCADO, ao contrario do padrao do banco.
   *
   * Aqui quem decide e uma pessoa olhando a tela, e o acesso mais seguro e o
   * menor: liberar o financeiro e um clique, e tirar depois exige perceber
   * que foi liberado sem querer. No banco o padrao e o contrario (ligado),
   * porque la ele serve a quem JA existia.
   */
  const [acessoFinanceiro, setAcessoFinanceiro] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    setSalvando(true);

    try {
      await criarUsuario({ nome, usuario, senha, acessoFinanceiro });
      setNome("");
      setUsuario("");
      setSenha("");
      setAcessoFinanceiro(false);
      setAberto(false);
      aoCriar();
    } catch (falha) {
      setErro(mensagemDe(falha, "Não foi possível criar o acesso."));
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) {
    return (
      <Botao
        aparencia="secundario"
        largura="conteudo"
        className="self-start"
        onClick={() => setAberto(true)}
      >
        + Criar acesso
      </Botao>
    );
  }

  return (
    <Secao
      titulo="Novo acesso"
      descricao="Combine uma senha provisória com a pessoa e peça para ela trocar no primeiro acesso, em “Minha senha”."
    >
      <div className="flex flex-col gap-4">
        <Campo
          etiqueta="Nome da pessoa"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          dica="É o nome que aparece no painel e no histórico."
        />
        <Campo
          etiqueta="Nome de usuário"
          value={usuario}
          autoCapitalize="none"
          onChange={(evento) => setUsuario(evento.target.value.toLowerCase())}
          dica="É o que ela digita para entrar. De 3 a 40 caracteres, sem espaço nem acento."
        />
        <Campo
          etiqueta="Senha provisória"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          dica="Pelo menos 8 caracteres."
        />

        <label className="flex items-start gap-3 rounded-lg border border-border bg-bg-secondary px-4 py-3">
          <input
            type="checkbox"
            checked={acessoFinanceiro}
            onChange={(evento) => setAcessoFinanceiro(evento.target.checked)}
            className="mt-0.5 size-5 accent-black"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-text-primary">
              Pode ver a parte financeira
            </span>
            <span className="text-sm text-text-secondary">
              Dá acesso ao Financeiro, aos espaços mensais e à administração de
              usuários. Sem marcar, a pessoa usa todo o resto do painel.
            </span>
          </span>
        </label>

        {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Botao
            aparencia="secundario"
            largura="conteudo"
            onClick={() => {
              setAberto(false);
              setErro(null);
            }}
          >
            Cancelar
          </Botao>
          <Botao largura="conteudo" disabled={salvando} onClick={() => void salvar()}>
            {salvando ? "Criando…" : "Criar acesso"}
          </Botao>
        </div>
      </div>
    </Secao>
  );
}
