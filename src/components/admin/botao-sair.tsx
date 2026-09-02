"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/botao";

/** Encerra a sessao do painel. Nao encosta na sessao do cliente. */
export function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  return (
    <Botao
      aparencia="secundario"
      largura="conteudo"
      disabled={saindo}
      onClick={() => {
        setSaindo(true);
        void fetch("/api/admin/sessao", { method: "DELETE", cache: "no-store" })
          .catch(() => undefined)
          .finally(() => {
            router.replace("/admin/login");
            router.refresh();
          });
      }}
      className="min-h-11"
    >
      {saindo ? "Saindo…" : "Sair"}
    </Botao>
  );
}
