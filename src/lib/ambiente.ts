/**
 * EM QUE AMBIENTE ESTE SISTEMA ESTA RODANDO.
 *
 * POR QUE ISTO EXISTE
 *
 * A partir da versao 2.0 existem DOIS sistemas no ar, com o mesmo visual e as
 * mesmas telas: o de verdade, que a recepcao usa todo dia, e a PREVIA, que
 * serve para mostrar o que esta sendo construido antes de ir para o original.
 *
 * Duas telas identicas em duas abas e um acidente esperando acontecer: alguem
 * lanca a reserva de um cliente na previa, ela nunca chega na agenda de
 * verdade, e o cliente aparece no dia sem sala. Por isso a previa se anuncia
 * em TODA pagina, de cima a baixo, e nao so no painel.
 *
 * A previa tambem nao pode ser achada no Google: ver "src/app/robots.ts".
 *
 * COMO SE LIGA: a variavel de ambiente AMBIENTE="previa". Em branco (o normal,
 * e o que vale em producao) nada disso aparece, e o sistema e o de sempre.
 */

/** O rotulo que aparece na faixa. Curto de proposito: a faixa e estreita. */
export const ROTULO_DA_PREVIA = "PRÉVIA";

/**
 * Estamos na previa?
 *
 * Lido do ambiente a cada chamada, e nao guardado numa constante de modulo:
 * no EasyPanel as variaveis so existem quando o container SOBE, e uma
 * constante avaliada na construcao da imagem sairia sempre falsa.
 */
export function ehPrevia(): boolean {
  return process.env.AMBIENTE?.trim().toLowerCase() === "previa";
}
