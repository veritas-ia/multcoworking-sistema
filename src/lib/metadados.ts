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

import { ehPrevia } from "@/lib/ambiente";
import { NOME_DA_MARCA, urlDoSite } from "@/lib/marca";
import {
  CAMINHO_DO_MANIFESTO_DO_PAINEL,
  nomeNoCelular,
} from "@/lib/manifesto";

/**
 * O titulo que aparece na ABA do navegador.
 *
 * Na previa ele vem com "PRÉVIA ·" na frente, e isso nao e enfeite: o
 * acidente que se quer evitar e a pessoa com as duas abas abertas lancando
 * reserva na errada, e a aba e justamente onde a faixa da tela nao aparece.
 */
function tituloDaPagina(titulo: string): string {
  const completo = `${titulo} | ${NOME_DA_MARCA}`;
  return ehPrevia() ? `PRÉVIA · ${completo}` : completo;
}

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
  const titulo = tituloDaPagina(entrada.titulo);

  // A PREVIA NUNCA E INDEXADA, nem nas paginas publicas. Duas versoes do
  // mesmo site no Google confundiriam o cliente, que acabaria reservando no
  // sistema que nao vale.
  const indexar = entrada.indexar && !ehPrevia();

  return {
    metadataBase: urlDoSite(),
    title: titulo,
    description: entrada.descricao,
    applicationName: NOME_DA_MARCA,
    ...(indexar ? {} : { robots: { index: false, follow: false } }),
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
    /**
     * A PARTE QUE SO O IPHONE LE.
     *
     * O iPhone nao usa a ficha do aplicativo para decidir duas coisas:
     *
     *   - "capable" e o que faz o site abrir SEM a barra de endereco depois
     *     de salvo na tela de inicio. Sem isso, o iPhone antigo abre o site
     *     dentro do Safari de sempre, e o ganho desaparece;
     *   - "title" e o nome que ele escreve embaixo do icone. Sem isso ele usa
     *     o titulo da pagina do momento, cortado — o icone nasceria chamado
     *     "Agenda | Mult Cowo...", conforme a tela em que a pessoa estava
     *     quando salvou.
     */
    appleWebApp: {
      capable: true,
      title: nomeNoCelular("site"),
      statusBarStyle: "default",
    },
  };
}

/** Pagina do painel: nunca entra em buscador. */
export function metadadosDoPainel(titulo: string): Metadata {
  return {
    metadataBase: urlDoSite(),
    title: tituloDaPagina(titulo),
    robots: { index: false, follow: false },
    // A FICHA DO APLICATIVO DA EQUIPE, e nao a do site.
    //
    // E o que faz o icone da recepcionista abrir o PAINEL. Sem esta linha
    // valeria a ficha do site publico, que o Next amarra em todas as paginas,
    // e o icone dela abriria a tela de reservar do cliente — ela teria de
    // navegar ate o painel toda vez, o contrario do ganho.
    //
    // Fica AQUI, e nao em cada pagina, pelo mesmo motivo do "nao me indexe"
    // logo acima: escrito a mao pagina por pagina, a proxima tela nova nasce
    // sem ele e ninguem percebe.
    manifest: CAMINHO_DO_MANIFESTO_DO_PAINEL,
    /**
     * A PARTE QUE SO O IPHONE LE.
     *
     * O iPhone nao usa a ficha do aplicativo para decidir duas coisas:
     *
     *   - "capable" e o que faz o site abrir SEM a barra de endereco depois
     *     de salvo na tela de inicio. Sem isso, o iPhone antigo abre o site
     *     dentro do Safari de sempre, e o ganho desaparece;
     *   - "title" e o nome que ele escreve embaixo do icone. Sem isso ele usa
     *     o titulo da pagina do momento, cortado — o icone nasceria chamado
     *     "Agenda | Mult Cowo...", conforme a tela em que a pessoa estava
     *     quando salvou.
     */
    appleWebApp: {
      capable: true,
      title: nomeNoCelular("painel"),
      statusBarStyle: "default",
    },
  };
}
