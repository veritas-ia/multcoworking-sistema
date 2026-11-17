/**
 * O ICONE NA TELA DE INICIO DO CELULAR (Fase 16, ultimo item).
 *
 * O QUE ISTO FAZ, em uma frase: deixa a pessoa colocar o sistema na tela de
 * inicio do celular ou do tablet, com icone proprio, e abrir em TELA CHEIA —
 * sem a barra de endereco do navegador em cima. Nao e um aplicativo de loja:
 * e o proprio site, que o celular passa a tratar como aplicativo depois que
 * esta ficha ("manifesto") diz como ele se chama e de que cor e.
 *
 * Serve iPhone E Android. No Android o Chrome oferece a instalacao sozinho,
 * por causa deste arquivo; no iPhone a pessoa usa "Compartilhar > Adicionar a
 * Tela de Inicio", que ja funcionava, mas abria COM a barra de endereco e com
 * o nome da pagina do momento embaixo do icone.
 *
 * SAO DUAS FICHAS, DE PROPOSITO:
 *
 *   - a publica abre o SITE ("/"), que e o que o cliente quer;
 *   - a do painel abre o PAINEL ("/admin"), que e o que a equipe quer.
 *
 * Com uma ficha so, o icone da recepcionista abriria a tela de reservar do
 * cliente, e ela teria de navegar ate o painel toda vez — o contrario do
 * ganho. A do painel e amarrada em "metadadosDoPainel", entao toda pagina do
 * painel ja nasce com ela.
 *
 * NAO EXISTE FUNCIONAMENTO SEM INTERNET, e isso e decisao, nao falta: um
 * sistema que guardasse a agenda no aparelho mostraria uma agenda VELHA, e
 * alguem lancaria reserva em cima de horario que acabou de ser ocupado. Risco
 * grande para ganho nenhum.
 */
import type { MetadataRoute } from "next";

import { ehPrevia, ROTULO_DA_PREVIA } from "@/lib/ambiente";
import {
  AMARELO,
  DESCRICAO_DO_SITE,
  NOME_DA_MARCA,
  PRETO,
} from "@/lib/marca";

/** Onde a ficha do painel e servida. Fora de "/admin" de proposito: o
 *  middleware protege /admin, e o navegador precisa ler a ficha ANTES de
 *  alguem entrar. */
export const CAMINHO_DO_MANIFESTO_DO_PAINEL = "/manifest-painel.webmanifest";

/**
 * OS TAMANHOS DE ICONE, num lugar so.
 *
 * O Android so OFERECE a instalacao se existir um icone de 192 pixels ou
 * maior — e quando nao existe, nao da erro em lugar nenhum: o convite
 * simplesmente nunca aparece, e ninguem liga uma coisa a outra. Os 512 sao
 * para a tela de abertura.
 *
 * Esta lista e lida pela ficha E pela rota que desenha o icone
 * ("/icone/[tamanho]"), entao as duas nunca discordam. Escritos em dois
 * lugares, bastaria a ficha pedir um tamanho que a rota nao desenha para o
 * icone sumir — calado.
 */
export const TAMANHOS_DE_ICONE = [192, 512] as const;

/**
 * A cor da barra de cima do aplicativo instalado.
 *
 * Na previa ela e PRETA, igual a faixa de aviso: com as duas instaladas no
 * mesmo celular, a de verdade abre amarela e a previa abre preta. E o mesmo
 * sinal da faixa, no unico lugar onde a faixa nao aparece — a moldura do
 * aplicativo.
 */
function corDaBarra(): string {
  return ehPrevia() ? PRETO : AMARELO;
}

/** Nome completo, com "PRÉVIA ·" na frente quando for o caso. */
function nomeCompleto(base: string): string {
  return ehPrevia() ? `${ROTULO_DA_PREVIA} · ${base}` : base;
}

/**
 * Nome curto: e ele que aparece embaixo do icone, e o celular corta em
 * poucas letras. Na previa vale a palavra PRÉVIA sozinha — dois icones com o
 * mesmo nome na mesma tela seria exatamente o acidente que a previa inteira
 * tenta evitar.
 */
function nomeCurto(base: string): string {
  return ehPrevia() ? ROTULO_DA_PREVIA : base;
}

/**
 * O NOME QUE APARECE EMBAIXO DO ICONE, no site ou no painel.
 *
 * Usado em dois lugares que precisam concordar: a ficha do aplicativo (que o
 * Android le) e os metadados do iPhone (que le outra etiqueta, propria dele).
 * Escritos separados, um aparelho mostraria "Painel" e o outro "Mult" para o
 * mesmo icone.
 */
export function nomeNoCelular(area: "site" | "painel"): string {
  return nomeCurto(area === "site" ? "Mult" : "Painel");
}

/**
 * CADA TAMANHO APARECE DUAS VEZES, com o mesmo desenho.
 *
 * "any" e o icone comum. "maskable" avisa que o Android pode recortar em
 * circulo ou em quadrado arredondado, conforme o aparelho — sem esse aviso
 * ele desenha o nosso quadrado amarelo DENTRO de outro quadrado branco, com
 * uma moldura feia em volta. O mesmo desenho serve para os dois porque a
 * letra fica no meio, ocupando metade do quadrado, justamente para nenhum
 * recorte come-la.
 */
function icones(): MetadataRoute.Manifest["icons"] {
  return TAMANHOS_DE_ICONE.flatMap((lado) =>
    (["any", "maskable"] as const).map((finalidade) => ({
      src: `/icone/${lado}`,
      sizes: `${lado}x${lado}`,
      type: "image/png",
      purpose: finalidade,
    })),
  );
}

/** A ficha do SITE: abre em "/", que e a tela de reservar. */
export function manifestoPublico(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: nomeCompleto(`${NOME_DA_MARCA} — reservar sala`),
    short_name: nomeNoCelular("site"),
    description: DESCRICAO_DO_SITE,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: corDaBarra(),
    lang: "pt-BR",
    dir: "ltr",
    icons: icones(),
  };
}

/**
 * A ficha do PAINEL: abre em "/admin".
 *
 * POR QUE "/admin" e nao "/admin/agenda": aquela pagina e a porta de entrada
 * feita para o celular — ela cumprimenta a pessoa e mostra os quatro atalhos
 * mais usados, justamente porque no celular o menu fica escondido atras do
 * botao. Num tablet, um toque a mais para chegar na agenda; num celular, o
 * caminho mais curto.
 *
 * "scope" preso em /admin: um link para o site publico abre no navegador, e
 * nao dentro do aplicativo da equipe.
 */
export function manifestoDoPainel(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: nomeCompleto(`${NOME_DA_MARCA} — painel`),
    short_name: nomeNoCelular("painel"),
    description:
      "Agenda, empório, financeiro e cadastros do coworking. Área da equipe.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: corDaBarra(),
    lang: "pt-BR",
    dir: "ltr",
    icons: icones(),
  };
}

/**
 * Qual icone desenhar para o tamanho pedido no endereco ("/icone/192").
 *
 * Mora aqui, e nao dentro da rota, por um motivo pratico: a rota desenha uma
 * imagem e por isso e um arquivo .tsx, que a suite de testes nao consegue
 * abrir. A regra em TypeScript puro fica testada.
 *
 * LISTA FECHADA. Desenhar qualquer numero que chegasse pelo endereco deixaria
 * um estranho pedir uma imagem de vinte mil pixels e ocupar o servidor
 * inteiro com ela.
 */
export function ladoDoIcone(pedido: string): number | null {
  const lado = Number(pedido);
  return TAMANHOS_DE_ICONE.some((aceito) => aceito === lado) ? lado : null;
}
