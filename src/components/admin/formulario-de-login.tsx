"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/botao";
import { Logotipo } from "@/components/marca/logotipo";
import { Campo } from "@/components/ui/campo";

type CorpoDeErro = { erro?: string };

/** Tela de entrada do painel. Login por nome de usuario — sem e-mail. */
export function FormularioDeLogin({ voltarPara }: { voltarPara: string }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(): Promise<void> {
    setEntrando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/admin/sessao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, senha }),
        cache: "no-store",
      });

      if (!resposta.ok) {
        const corpo: unknown = await resposta.json().catch(() => null);
        const { erro: mensagem } =
          typeof corpo === "object" && corpo !== null ? (corpo as CorpoDeErro) : {};
        setErro(mensagem ?? "Não foi possível entrar. Tente de novo.");
        setSenha("");
        return;
      }

      router.replace(voltarPara);
      router.refresh();
    } catch {
      setErro("Não conseguimos falar com o servidor. Verifique sua conexão.");
    } finally {
      setEntrando(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg-secondary px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          {/* A logo entra no lugar da barrinha amarela que representava a
              marca aqui. O titulo continua: a logo diz de QUEM e o sistema, e
              o titulo diz que esta area e a da equipe, nao a do cliente. */}
          <Logotipo className="h-12 sm:h-14" prioridade />
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            Painel do coworking
          </h1>
          <p className="text-sm text-text-secondary">
            Entre com seu usuário e senha da equipe.
          </p>
        </div>

        <form
          className="flex flex-col gap-5 rounded-xl border border-border bg-bg-primary p-6"
          onSubmit={(evento) => {
            evento.preventDefault();
            void entrar();
          }}
        >
          <Campo
            etiqueta="Usuário"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={usuario}
            onChange={(evento) => {
              setUsuario(evento.target.value);
              setErro(null);
            }}
          />

          <Campo
            etiqueta="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            erro={erro}
            onChange={(evento) => {
              setSenha(evento.target.value);
              setErro(null);
            }}
          />

          <Botao type="submit" disabled={entrando || !usuario || !senha}>
            {entrando ? "Entrando…" : "Entrar"}
          </Botao>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Esqueceu a senha? Peça para outro administrador criar uma nova para
          você — não há recuperação por e-mail.
        </p>
      </div>
    </main>
  );
}
