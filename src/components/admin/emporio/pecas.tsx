"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { CategoriaDoProduto, TagNaTela } from "./tipos";

/**
 * "6.00" -> 600 centavos.
 *
 * TODA CONTA DE DINHEIRO AQUI PASSA POR CENTAVOS, e isto nao e preciosismo:
 * somar reais em ponto flutuante acumula diferenca de um centavo ao longo de
 * muitas linhas, e a ficha do emporio tem dezenas por dia. E a mesma regra do
 * servidor — se a tela somasse de outro jeito, os dois numeros discordariam.
 */
export function centavosDe(reais: string): number {
  const numero = Number(reais);

  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

/** 600 -> "R$ 6,00". */
export function emReaisDeCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * "6.00" -> "R$ 6,00".
 *
 * O preco chega do servidor como texto em reais, e nao como numero: assim ele
 * atravessa o JSON sem passar por ponto flutuante.
 */
export function precoVisivel(reais: string): string {
  const numero = Number(reais);

  if (!Number.isFinite(numero)) {
    return reais;
  }

  return emReaisDeCentavos(centavosDe(reais));
}

/** Soma uma lista de valores em reais, SEMPRE por centavos. */
export function totalVisivel(valores: readonly string[]): string {
  return emReaisDeCentavos(
    valores.reduce((soma, valor) => soma + centavosDe(valor), 0),
  );
}

/** "COMIDA" -> "Comida". O rotulo que a equipe le nas fichas. */
export const NOME_DA_CATEGORIA: Record<CategoriaDoProduto, string> = {
  COMIDA: "Comida",
  BEBIDA: "Bebida",
};

/**
 * A etiqueta colorida do produto.
 *
 * A cor vem do cadastro e e desenhada como BORDA e TEXTO, nunca como fundo
 * cheio: as nove cores do empório sao claras, e texto branco em cima de
 * algumas delas fica ilegivel. Assim qualquer cor que a equipe escolher
 * continua legivel.
 */
export function Etiqueta({ tag }: { tag: TagNaTela }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold"
      style={{ borderColor: tag.cor, color: tag.cor }}
    >
      {tag.nome}
    </span>
  );
}

/**
 * A foto do produto, como no iFood.
 *
 * SEM FOTO NAO FICA ESPACO VAZIO: aparece a inicial do nome num quadrado
 * cinza. Um buraco na lista pareceria defeito, e a equipe ficaria procurando
 * a imagem que nunca existiu.
 */
export function FotoDoProduto({
  nome,
  foto,
  tamanho = "normal",
}: {
  nome: string;
  foto: { url: string } | null;
  tamanho?: "normal" | "pequena";
}) {
  const medida = tamanho === "pequena" ? "size-10" : "size-14";

  if (!foto) {
    return (
      <div
        aria-hidden
        className={cn(
          medida,
          "flex shrink-0 items-center justify-center rounded-lg bg-bg-secondary text-lg font-bold text-text-secondary",
        )}
      >
        {nome.trim().charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    // Imagem do Cloudinary, ja pedida no tamanho de tela pelo proprio
    // endereco. Sem next/image de proposito: o dominio variaria por conta e
    // configurar o host para uma miniatura nao se paga.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={foto.url}
      alt={`Foto de ${nome}`}
      className={cn(medida, "shrink-0 rounded-lg border border-border object-cover")}
    />
  );
}

/** Lista de opcoes com etiqueta, no estilo dos outros campos do painel. */
export function Escolha<T extends string>({
  etiqueta,
  valor,
  opcoes,
  aoMudar,
  dica,
  desabilitado,
}: {
  etiqueta: string;
  valor: T;
  opcoes: readonly { valor: T; rotulo: string }[];
  aoMudar: (valor: T) => void;
  dica?: ReactNode;
  desabilitado?: boolean;
}) {
  const id = useId();
  const idDica = `${id}-dica`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-text-primary">
        {etiqueta}
      </label>

      <select
        id={id}
        value={valor}
        disabled={desabilitado}
        aria-describedby={dica ? idDica : undefined}
        onChange={(evento) => aoMudar(evento.target.value as T)}
        className="min-h-12 w-full rounded-lg border border-border bg-bg-primary px-4 py-3 text-base text-text-primary disabled:text-text-secondary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-black"
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>

      {dica ? (
        <p id={idDica} className="text-sm text-text-secondary">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

/**
 * O numero do estoque, com o aviso quando ele esta negativo.
 *
 * ESTOQUE NEGATIVO NAO E ERRO DO SISTEMA, e a tela precisa dizer isso: a venda
 * que foi lancada ja aconteceu de verdade, e o negativo significa que falta
 * lancar uma reposicao. Sem a explicacao, a equipe acharia que o numero
 * quebrou e pararia de confiar nele.
 */
export function Estoque({ quantidade }: { quantidade: number }) {
  if (quantidade < 0) {
    return (
      <span className="font-semibold tabular-nums text-destructive">
        {quantidade} <span className="font-normal">· falta lançar reposição</span>
      </span>
    );
  }

  return (
    <span className="font-semibold tabular-nums text-text-primary">
      {quantidade}
    </span>
  );
}
