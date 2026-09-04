/**
 * TITULO E CARTAO DE CADA PAGINA (Fase 12).
 *
 * Os metadados moram aqui, e nao dentro de cada pagina, por dois motivos:
 *
 *   1. o painel INTEIRO precisa ficar fora dos buscadores. Escrevendo isso a
 *      mao em cada pagina, a proxima pagina nova nasce indexavel — e ninguem
 *      percebe ate a agenda do coworking aparecer no Google;
 *   2. assim da para testar. Uma pagina e um arquivo .tsx, que a suite de
 *      testes nao consegue abrir; este arquivo e TypeScript puro.
 */
import type { Metadata } from "next";

import { NOME_DA_MARCA, urlDoSite } from "@/lib/marca";

export const DESCRICAO_DO_SITE =
  "Reserve a Sala CI, a Sala de Reunião ou a Sala Container em poucos toques.";

/**
 * Pagina que o cliente ve.
 *
 * "metadataBase" e o que faz a imagem do cartao aparecer: sem ele o Next
 * escreve o endereco da imagem de forma relativa, e o WhatsApp — que busca a
 * imagem de fora, sem saber de que site veio — nao consegue baixa-la. A falha
 * e silenciosa: o link so aparece sem imagem.
 */
export function metadadosPublicos(entrada: {
  titulo: string;
  descricao: string;
  caminho: string;
  /** Falso na area pessoal do cliente: nao ha por que ela estar no Google. */
  indexar: boolean;
}): Metadata {
  const titulo = `${entrada.titulo} | ${NOME_DA_MARCA}`;

  return {
    metadataBase: urlDoSite(),
    title: titulo,
    description: entrada.descricao,
    applicationName: NOME_DA_MARCA,
    ...(entrada.indexar ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: NOME_DA_MARCA,
      title: titulo,
      description: entrada.descricao,
      url: entrada.caminho,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: entrada.descricao,
    },
  };
}

/** Pagina do painel: nunca entra em buscador. */
export function metadadosDoPainel(titulo: string): Metadata {
  return {
    metadataBase: urlDoSite(),
    title: `${titulo} | ${NOME_DA_MARCA}`,
    robots: { index: false, follow: false },
  };
}
