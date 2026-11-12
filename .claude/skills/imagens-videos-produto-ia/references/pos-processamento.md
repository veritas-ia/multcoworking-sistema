# Pós-processamento de imagens e vídeos (como o curso fez)

Tudo "conforme o curso (nov/2026)". Ferramentas web citadas podem ter mudado de nome ou de regra; marque "(confirmar)" ao reutilizar.

## 1. Extrair imagens de um site de referência

- No navegador: **F12 > aba Application (Aplicativo) > rolar até "Frames" > Top > Images**. Aparecem todas as imagens carregadas; abrir, achar a desejada e "Salvar imagem como". Usado nos 4 projetos.
- Para pegar **todas as camadas de um parallax** da referência, é o mesmo caminho: salvar uma por uma e numerar.
- Para um vídeo de um site: botão direito > "copiar endereço do vídeo" (Venezianico) e colar a URL no prompt para a IA usar sem baixar. Também dá para baixar o arquivo. Imagens de galeria: idem (copiar endereço da imagem). Aviso nosso: usar mídia do site de terceiros em site do cliente exige permissão; no curso é material de estudo.
- Para tirar só uma imagem não precisa baixar o site inteiro.
- Para o site inteiro (design system, header, footer, fontes): usar o "site downloader" da Asimov (sd.asimov.academy) ou ferramenta equivalente. Em alguns sites (Dior no Valentino) o download veio como "página indisponível": alternativa foi passar a URL à IA para descrever o design system; como ainda falhou, o professor usou só o site do próprio produto.
- Cor exata de um fundo: extensão de navegador "ColorZilla" > escolher cor > a cor vai para a área de transferência > colar no prompt ("o background deve ter essa cor"). Foi necessário porque o cinza do site da Apple não era branco.

## 2. Fundo transparente

Duas rotas no curso:

1. **Pedir PNG com fundo 100% transparente ao GPT.** Funcionou para o atleta e a personagem (Apple, Harry Potter), mas falhou algumas vezes (veio com fundo). Corrigir pedindo de novo e mandando as referências novamente. Conferir: ao passar o mouse sobre o PNG, aparece o quadriculado de transparência.
2. **Chroma key verde + remoção** (Venezianico). Motivo dado: "nem toda IA gera PNG transparente; o Gemini, pelo que sei, não gera", então o prompt pede "verde chroma key puro, forte, uniforme, sem gradiente e sem textura" nas áreas transparentes. Depois remover o verde numa ferramenta web gratuita (busca por "PNG Maker"; "Online PNG Tools > Try Transparent", confirmar o nome):
   - escolher a cor a remover = verde;
   - ajustar a **similaridade**: 20% deixou pontinhos verdes; 35% ainda; **45%** limpou as bordas. Aumentar até sumir; se começar a comer o objeto, usar outra ferramenta;
   - salvar (Save as) e baixar. Leva ~10 s e é gratuito.
3. Para parallax em camadas, o Valentino pediu 5 PNGs de uma vez, todos do mesmo tamanho, com alpha real ("Não use fundo preto para simular transparência"). Tamanhos sugeridos no prompt: 1920x1080, 1600x900 ou 1440x810.

## 3. Vídeo: baixar, cortar, organizar

- Baixar na maior qualidade disponível (1080p citado).
- Cortar o fim se a IA "desligou" o que você queria ligado (Apple, tela) ou se o final está ruim (Valentino). O professor corta na tela do Flow (a aula não detalha a ferramenta de corte; confirmar).
- Gerar várias opções (2 a 4) e escolher; vídeos de IA nunca saem iguais.
- Nomes curtos e estrutura: `src/assets/videos/hero.mp4` (a primeira dobra de um site se chama "hero"); fotos em `src/assets/fotos` (ex.: `atleta1.png`); parallax em `src/assets/parallax` com **camadas numeradas pela ordem de profundidade** (1 = frente) para a IA do editor saber a ordem; `src/assets/scroll-scrub` para frames; fontes em `public/fonts`.

## 4. Vídeo para frames (scroll scrub otimizado)

Do Valentino (aula 4):
1. Site "Video to Frames" (nome citado; confirmar) > carregar o vídeo.
2. **FPS: 8** (gera 64 imagens neste vídeo) e **qualidade 75%** para não pesar.
3. Extrair frames > baixar tudo > colocar em `src/assets/scroll-scrub`.
4. No prompt do código, apontar a pasta (`@src/assets/scroll-scrub`) e pedir o efeito (ver `site-parallax-gsap-ia`).

Trade-off explicado: mais FPS = mais imagens, mais pesado e mais fluido; menos FPS = mais leve e menos detalhe no scroll. "Achem um meio-termo."

No projeto Apple, o scroll scrub foi feito direto com o **vídeo** (hero.mp4 avançando/voltando com o scroll), sem converter em frames. O curso não compara os dois métodos em desempenho.

## 5. Peso dos arquivos: o que o curso cobre e o que não cobre

Cobre: FPS e qualidade dos frames (acima); baixar vídeo em 1080p; hospedar o vídeo/imagens por URL remota em vez de no projeto (Venezianico: vídeo ambiente e galeria via CDN do site da marca; `loading="lazy"` nas imagens da galeria).

Não cobre: compressão de MP4 (bitrate, codecs), conversão para WebP/AVIF, poster, limites de hospedagem. Indício de peso: os zips dos projetos têm 205 MB (Venezianico) e 174 MB (Valentino) segundo os LEIA-ME. Se for publicar, comprimir por conta própria (verificar com o usuário a ferramenta).

## 6. Consistência do produto (o ponto que mais dá errado)

- Use **fotos reais do produto** (tiradas pelo usuário, de mais de um ângulo; Apple: foto de cima da tampa, foto de estúdio já gerada reaproveitada como referência) para a IA se basear.
- Reaproveitar a foto de estúdio já aprovada como referência das imagens seguintes mantém o produto igual.
- Trava de produto nos prompts de vídeo: repetir "forma, proporções, tampa, logo/rótulo idênticos à referência" e a lista de "não faça" (ver `prompts-video.md`). Mesmo assim o frasco/logo deformou em vários vídeos do Valentino.
- Frase de reforço colada no fim (material Valentino): "Reference the uploaded perfume image for exact bottle identity. Keep the bottle shape, cap and logo unchanged in every shot..."
- Produto decomposto (frasco/borrifador/tampa) em imagens do mesmo tamanho para animar partes separadas.
- Iluminação: se a IA deixar a pessoa "muito iluminada" ao recortar, extraia a iluminação da imagem boa em JSON e peça para seguir (ver `prompts-imagem.md`, seção 2).
- Proporção certa desde o início (16:9 para fundo; 9:16 para elementos altos) evita elemento gigante no código.
- Se a IA ignorar um pedido (ignorou o JSON, ignorou uma pessoa), ser mais rigoroso: mandar de novo isolando o item, repetir a instrução explícita.
