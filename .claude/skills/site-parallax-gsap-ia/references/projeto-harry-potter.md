# Projeto Harry Potter (site institucional "Hogwarts" a partir de um molde)

Site de exemplo: https://harrypotter-asimov.vercel.app (material em /material). Tese do curso: **não comece do zero; use uma boa inspiração como molde** (já validado) e troque imagens, fonte, cores, textos e algumas seções. Aviso nosso: o projeto usa obra/marca de terceiros (nome, brasão, fonte "Wizard World"); é exercício de estudo, não para entregar a cliente.

Nota de honestidade: o título fala em GSAP, mas o curso **não mostra código GSAP próprio**. As animações do site vieram do site de referência (recuperadas pelo Claude Code) e o único código com GSAP no material é o componente MorphSlider (React Bits) com `ogl` + `gsap`. Os efeitos do site original citados na introdução (transição de início, palavras que aparecem "de forma mágica", fundo que muda de cor no scroll, confete, números, parallax) não são detalhados.

## Fluxo, aula a aula

**Aula 2: baixar a referência, restaurar animações, converter para Astro, trocar a 1ª dobra.**
1. Escolher referência de mesmo gênero (site de escola/universidade) que permita trocar imagens, fonte, cor, animações e cards.
2. Baixar com o site downloader da Asimov (sd.asimov.academy). Problema: o HTML baixado **veio sem animações** (fundo não trocava de cor, sem parallax).
3. Claude Code na pasta do download: "Tenho um site baixado em index.html, mas ele veio sem as animações. Pode verificar aqui as animações originais e colocar no meu index.html" + a URL original. Resultado: achou 16 arquivos faltando, recuperou as animações e devolveu um relatório; conferir abrindo o `index.html`.
4. Novo projeto (`npm create astro@latest`), pasta da referência dentro como `referencia`, e: "[index.html] reescreva ele em astro" + `index.astro` (material: "index.html reescreva ele em astro puro: index.astro"). Conferir com `npm run dev`: visual e animações iguais.
5. Imagens da 1ª dobra (2 camadas: grupo ao fundo + menina em PNG na frente): gerar com GPT (prompts em `imagens-videos-produto-ia`), salvar em `src/assets/fotos` como `hero girl` e `hero background`, pedir "troque as duas camadas da hero". Erros: a personagem saiu 9:16 (a original era landscape), então ficou enorme > regerar "não mude o aspect ratio, deve permanecer em 16x9"; saiu com fundo > regerar com PNG transparente. Ajustes de tamanho/posição em passos pequenos: "diminua um pouco essa imagem da garota", "diminua levemente e jogue um pouco mais para a esquerda", "um pouquinho mais para a esquerda".

**Aula 3: imagens em massa, fonte, logo.**
1. Contar as imagens do site (19) e gerar ~20 de uma vez (prompt "inspiração" em `imagens-videos-produto-ia`). Baixar todas e pôr em uma pasta (`Website Images`). Pedir: "Troque todas as imagens do nosso site com exceção das duas da primeira dobra que acabamos de adicionar."
2. **Descobrir a fonte do site de referência**: colar a URL em um "Website Font Checker" (áudio: "Host Weasley"; confirmar o nome), identificar as fontes (Sofia Pro e uma fonte decorativa "Harry Beast Regular"), buscar o download em sites de fontes, colocar em `public/fonts`. O material traz o snippet:
   ```css
   @font-face {
     font-family: "Harry Beast Regular";
     src: url("/fonts/WizardWorldSimplified-Kxr7.ttf") format("truetype");
     font-weight: 400;
     font-style: normal;
     font-display: swap;
   }
   ```
3. Copiar do font checker as **regras de onde cada fonte é usada** e colar no prompt junto com os arquivos: "Troque toda a fonte do nosso site." A IA deixou de fora hero, header e footer: pedir um por um ("Muda a fonte na Hero também", "Troque a fonte também no cabeçalho / no rodapé").
4. Logo: PNG do brasão em `src/assets`. Como o PNG era preto e sumia no fundo escuro: "O PNG do brasão mostra a imagem em preto. Para mostrar branco quando tiver que ser branco, colorido quando tiver que ser colorido e preto quando tiver que ser preto. Além disso, tu removeu o nome. O nome é Hogwarts."

**Aula 4: textos, cor, componentes novos, cursor.**
1. "Mude tudo o que está escrito no nosso site. Faça ele ser um site de apresentação da Escola de Hogwarts. E quero que seja em português."
2. "Troque o vermelho do site para um roxo profundo." (um único comando de cor).
3. **Reaproveitar componentes prontos**: procurar em sites de componentes (áudio: "React Beats", provavelmente React Bits; os prompts do material "Recreate this section" têm `ASSET_BASE_URL` de outro serviço, confirmar a origem). Cada componente tem um botão que copia um **prompt pronto**. Para trocar uma seção existente: copiar o título da seção (a IA acha no código) + "Adapte os cards para se comportarem assim." + o prompt. Para criar seção nova: "Crie uma dobra para usar isso. (Utilize as imagens do nosso projeto mesmo)".
   - Cards empilhados no scroll: "Cards Almanac" (ver `receitas-efeitos.md`).
   - Troca de imagem "como mágica" com distorção WebGL: `MorphSlider` (props em `receitas-efeitos.md`).
4. **Fila de prompts**: enquanto a IA trabalha, mandar os próximos pedidos; eles ficam em fila. O professor enfileirou 4 correções: trocar o brasão antigo da dobra; traduzir o que sobrou em inglês ("Verifique atentamente tudo o que está em inglês"); imagens da dobra nova não apareciam (mandar print); números zerados ("Aqui os valores estão zerados. Ajuste.").
5. Cursor com rastro: o professor copiou dois blocos de código de um componente achado na web (material: `CanvasCursor` + hook `useCanvasCursor`, rastro de linhas em canvas 2D) e pediu "Implemente esse rastro do cursor no nosso site." + "Deixe o rastro menor, mais grosso e roxo."
6. Deixar o resultado "inesperado, mas bom" se agradar (o brasão mudou de lugar e ele manteve).

## Material complementar do curso

- Fontes (zip fechado; Wizard World e Sofia Pro) e o `@font-face` acima.
- Prompts de imagem (3) e comandos (`npm create astro@latest`, `npm run dev`).
- Código/prompts completos: Cards Almanac, MorphSlider, CanvasCursor (resumidos em `receitas-efeitos.md`).
