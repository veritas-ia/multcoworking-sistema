import Image from "next/image";

import { NOME_DA_MARCA } from "@/lib/marca";

/**
 * A LOGO DO MULT COWORKING, sobre a textura de container.
 *
 * A placa e montada em DUAS CAMADAS:
 *
 *   1. o fundo: um pedaco da foto da parede de container amarelo;
 *   2. por cima: a escrita "MULT. COWORKING" em preto, recortada, com o
 *      fundo transparente.
 *
 * POR QUE A ESCRITA PRECISOU SER RECORTADA
 *
 * A arte original tem fundo amarelo SOLIDO (e um JPEG, sem transparencia).
 * Posta por cima da textura, ela simplesmente tapava tudo — a textura ficava
 * escondida atras de um retangulo amarelo chapado. Entao o recorte
 * ("logotipo-multcoworking-recorte.png") guarda so a escrita, e a textura
 * aparece em volta e entre as letras.
 *
 * CONTRASTE: medido, nao chutado. Contra o ponto mais ESCURO da textura, o
 * preto da escrita da 5,5:1; contra o mais claro, 15,2:1. O minimo exigido
 * para texto e 4,5:1, entao a leitura passa com folga e nao foi preciso
 * clarear nem escurecer a foto.
 *
 * SE A LOGO OU A TEXTURA FOREM TROCADAS: os dois arquivos acima sao GERADOS a
 * partir dos originais, que continuam em public/. O comando que os gerou esta
 * em docs/deploy.md, na secao "Regerar as artes da placa".
 */

/** Proporcao da placa: a mesma do recorte da escrita (1191 x 288). */
const PROPORCAO = 1191 / 288;

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
      {/* A textura. "alt" vazio de proposito: e enfeite, e quem usa leitor de
          tela nao ganha nada ouvindo "parede de container". O nome da marca
          vem na camada de cima. */}
      <Image
        src="/fundo-textura-container-placa.jpg"
        alt=""
        fill
        unoptimized
        priority={prioridade}
        sizes="260px"
        className="object-cover"
      />

      {/* A escrita. Recortada na mesma proporcao da placa, entao "contain"
          encaixa exato — sem faixa sobrando nem corte.

          "unoptimized": as duas sao servidas como estao, sem o otimizador de
          imagens do Next. Ele depende do "sharp", que hoje esta no projeto so
          por tabela e pode nao sobreviver ao empacotamento de producao — e o
          sintoma seria a logo sumir NO AR funcionando no computador de quem
          programa. Sao 19 KB somadas; a otimizacao nao paga esse risco. */}
      <Image
        src="/logotipo-multcoworking-recorte.png"
        alt={NOME_DA_MARCA}
        fill
        unoptimized
        priority={prioridade}
        sizes="260px"
        className="object-contain"
      />
    </span>
  );
}
