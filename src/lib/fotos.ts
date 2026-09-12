/**
 * O QUE O NAVEGADOR TAMBEM PRECISA SABER SOBRE AS FOTOS.
 *
 * Modulo PURO, sem nada do Node. Existe separado de "cloudinary.ts" porque
 * aquele usa a criptografia do Node para assinar os pedidos — e arrastar isso
 * para o navegador quebra a construcao do site inteira, com uma mensagem que
 * nao explica nada ("Reading from node:crypto is not handled").
 *
 * Aqui ficam so os limites (que a tela precisa para avisar cedo) e a montagem
 * do endereco da imagem.
 */

/** Quanto cada arquivo pode ter. Foto de sala nao precisa de mais que isso. */
export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;

/** Quantas fotos cada sala aceita. */
export const MAXIMO_DE_FOTOS = 5;

/** Os unicos tipos aceitos. */
export const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * O endereco da foto no tamanho que a tela precisa.
 *
 * O Cloudinary redimensiona e escolhe o formato pelo proprio endereco
 * ("f_auto,q_auto,w_800"). E melhor do que otimizar aqui: o trabalho fica com
 * quem ja o faz bem, e o celular baixa uma imagem do tamanho do celular.
 */
export function enderecoDaFoto(url: string, largura: number): string {
  const marca = "/upload/";
  const corte = url.indexOf(marca);

  // Endereco fora do formato esperado volta como veio: melhor a foto grande
  // do que a foto quebrada.
  if (corte === -1) {
    return url;
  }

  const inicio = corte + marca.length;
  return `${url.slice(0, inicio)}f_auto,q_auto,w_${largura}/${url.slice(inicio)}`;
}
