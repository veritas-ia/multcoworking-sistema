import Image from "next/image";

import { NOME_DA_MARCA } from "@/lib/marca";

/**
 * A LOGO DO MULT COWORKING.
 *
 * O arquivo tem fundo AMARELO solido — o mesmo amarelo da marca —, e nao
 * fundo transparente. Isso muda o jeito de usar: em vez de tentar disfarcar o
 * retangulo (o que sempre parece adesivo colado), a logo e tratada como uma
 * PLACA da marca, com cantos arredondados iguais aos dos cartoes do sistema.
 * Como o amarelo dela e o mesmo do botao e da barra de progresso da pagina, a
 * placa le como parte do sistema, e nao como corpo estranho.
 *
 * POR QUE HA UM RECORTE
 *
 * O arquivo original (1191x595) tem MUITA folga amarela em volta do desenho:
 * a escrita ocupa so cerca de um terco da altura. Usado inteiro num cabecalho
 * de 32 pixels, o "COWORKING" ficaria com uns 4 pixels de altura — ilegivel.
 *
 * Entao a placa mostra so a faixa do meio. Os numeros abaixo nao sao chute:
 * a tinta preta do arquivo foi MEDIDA pixel a pixel e vai de y=204 a y=371.
 * A faixa foi escolhida para deixar a escrita no centro exato, com 60 pixels
 * de folga em cima e embaixo — proporcao parecida com a folga lateral que a
 * propria arte ja traz (137 pixels de cada lado).
 *
 * O arquivo NAO foi alterado: o recorte e so de exibicao.
 *
 * SE A LOGO FOR TROCADA: meça a tinta da arte nova e ajuste estes numeros.
 * Uma arte com outra folga fica torta com os valores daqui.
 */

/** Tamanho do arquivo, em pixels. */
const LARGURA_DO_ARQUIVO = 1191;
const ALTURA_DO_ARQUIVO = 595;

/**
 * A faixa vertical que aparece na placa: do pixel 144 ao 432.
 * Centro da faixa: 288. Centro da tinta medida: 287,5 — batendo.
 */
const TOPO_DA_FAIXA = 144;
const ALTURA_DA_FAIXA = 288;

/** Proporcao da placa (largura / altura). */
const PROPORCAO = LARGURA_DO_ARQUIVO / ALTURA_DA_FAIXA;

/**
 * Onde a faixa comeca, em porcentagem da sobra recortada — e isso que o
 * "object-position" espera. Sai das medidas acima; nao e um numero chutado.
 */
const POSICAO_VERTICAL = (() => {
  const alturaVisivel = ALTURA_DA_FAIXA / ALTURA_DO_ARQUIVO;
  const inicioDaFaixa = TOPO_DA_FAIXA / ALTURA_DO_ARQUIVO;
  return `${((inicioDaFaixa / (1 - alturaVisivel)) * 100).toFixed(1)}%`;
})();

export function Logotipo({
  className,
  prioridade = false,
}: {
  /** A ALTURA vem daqui (ex.: "h-8"). A largura sai da proporcao. */
  className?: string;
  /** Ligue nas telas em que a logo aparece de cara, sem rolar. */
  prioridade?: boolean;
}) {
  return (
    <span
      className={`relative block shrink-0 overflow-hidden rounded-lg ${className ?? ""}`}
      style={{ aspectRatio: PROPORCAO }}
    >
      {/* "unoptimized": o arquivo e servido como esta, sem passar pelo
          otimizador de imagens do Next.

          O otimizador depende do "sharp", que hoje esta no projeto so por
          tabela — nao e dependencia declarada — e pode nao sobreviver ao
          empacotamento de producao. O sintoma seria a logo sumir NO AR e
          funcionar no computador de quem programa. Para 48 KB exibidos em
          130 pixels de largura, a otimizacao nao paga esse risco. */}
      <Image
        src="/logotipo-multcoworking-v1.png"
        alt={NOME_DA_MARCA}
        fill
        unoptimized
        priority={prioridade}
        sizes="260px"
        className="object-cover"
        style={{ objectPosition: `center ${POSICAO_VERTICAL}` }}
      />
    </span>
  );
}
