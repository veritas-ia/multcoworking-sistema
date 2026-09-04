/**
 * IDENTIDADE DO SITE NUM LUGAR SO (Fase 12).
 *
 * O nome e o endereco aparecem no titulo da aba, no cartao que o WhatsApp
 * monta quando alguem cola o link, no icone e no robots.txt. Espalhados,
 * viravam cinco lugares para esquecer de atualizar no dia da troca de
 * dominio — e um cartao de WhatsApp apontando para o endereco velho nao
 * carrega imagem nenhuma, sem aviso.
 */

/** Nome do coworking, como o cliente conhece. */
export const NOME_DA_MARCA = "Mult Coworking";

/** O amarelo da marca (CLAUDE.md). Repetido aqui porque as imagens geradas
 *  nao passam pelo Tailwind e nao enxergam as variaveis do CSS. */
export const AMARELO = "#FFC700";
export const PRETO = "#000000";

/**
 * Endereco publico do site, sem a barra do fim.
 *
 * Sai do APP_URL: hoje aponta para o ambiente de teste
 * (sistema-mult.veritassdigital.com.br) e, no dia em que o cliente entrar no
 * dominio proprio, troca-se uma linha do .env e nada mais.
 */
export function enderecoDoSite(): string {
  return (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}

/** O mesmo endereco em forma de URL, do jeito que os metadados do Next pedem. */
export function urlDoSite(): URL {
  try {
    return new URL(enderecoDoSite());
  } catch {
    // APP_URL escrita errada nao pode derrubar o site inteiro: o cartao de
    // compartilhamento fica sem imagem, e so.
    return new URL("http://localhost:3000");
  }
}
