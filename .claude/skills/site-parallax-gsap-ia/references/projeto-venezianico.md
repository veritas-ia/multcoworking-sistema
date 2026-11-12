# Projeto Venezianico (relógio de luxo, Redentore Avventurina 40)

Site de exemplo: https://venezianico-astro.vercel.app (material em /material). Aesthetic do material: "quiet luxury", noite cósmica/aventurina, azul-marinho/preto, azul elétrico `#0055ff`, cantos retos (sem pills), EB Garamond (títulos, itálico) + Montserrat (corpo).

**Divergências entre aula e material (dois pontos):** (1) a aula diz que o parallax usa "a biblioteca GSAP" (áudio: "GESAP") e que o professor trocou de parallax-no-mouse para scroll com "técnicas de scroll scrub", mas o **material publicado implementa o parallax com JavaScript puro e `requestAnimationFrame`** (sem GSAP). Use o algoritmo do material (abaixo); se quiser GSAP, a mesma matemática cabe num ScrollTrigger (o curso não mostra essa versão). (2) a aula faz uma dobra de **vídeo que expande no scroll**, mas o material traz no lugar uma **faixa de vídeo ambiente de 380px em loop**; o prompt do vídeo que expande não está no material.

## Estrutura final (ordem do DOM do material)

header fixo (glass só após `scrollY > 20`) > `#intro` (vídeo cinematográfico 100vh, sem texto) > `#artesanal` (parallax 6 camadas, 300vh) > `#hero` (imagem estática editorial + texto à direita) > marquee "The Renaissance of Watchmaking" > faixa de vídeo ambiente (380px, loop) > `#especificacoes-detalhadas` (ficha técnica, 10 linhas) > galeria 4 quadrados > footer (5 colunas, newsletter com label flutuante, redes sociais).

A `#hero` do material corresponde à seção da aula 5: a imagem de pulso reaproveitada do site da Apple com o relógio trocado, conteúdo no canto direito. Na aula 6 há ainda a dobra de "vídeo que expande no scroll" (vídeo do site da marca por URL), ausente do material.

## Fluxo da aula

1. **Referências (aula 2).** Site da marca (header, footer, fonte, efeito de palavras em movimento, imagens do produto real, vídeo, textos) + site da Apple (relógio Series 11, para a foto de pulso) + site de premiados para o parallax. Baixar o site da marca com o site downloader da Asimov para extrair design system, header e footer. Imagens: F12 > Application > Images.
2. **Primeira dobra (aula 3).** Criar projeto Astro (`npm create astro@latest`, nome `vnzn`), pasta do site baixado renomeada `venezianico-design-system`. Vídeo: frame 1 = imagem do site; frame 2 = relógio sem fundo da marca; GPT extrai o JSON do fundo galáctico e aplica no relógio; Google Flow em Frames (frame inicial = imagem 1, final = imagem gerada) com o prompt do material. Código: prompt do material + vídeo + `index.astro` ("Utilize o material acima"). Header: "coloque o header dessa página index.html na nossa página que estamos criando... Crie o componente."; a IA criou o componente e colocou no **layout** para repetir em todas as páginas.
3. **Parallax (aula 4).** Camadas já em PNG numeradas em `src/assets/parallax` (1 = a que aparece na frente). Prompt de build do material. A IA fez primeiro **parallax no mouse**; o professor pediu: "O parallax deve ser no scroll. Aplique as técnicas de scroll scrub." Depois: "Escreva isso como conteúdo dessa seção" e "tira esse bloco com blur".
4. **Seção da foto trocada (aula 5).** Imagem 3 do projeto + prompt simples; a IA mantém as dobras anteriores e cria a nova com o conteúdo no canto direito. (O prompt dessa aula é "bem simples" e não está no material.)
5. **Final (aula 6).** Marquee (prompt do material). Seção do vídeo que expande: o professor colou o endereço do vídeo ("copiar endereço do vídeo") em vez de baixar; a IA colocou o marquee depois do vídeo e foi preciso pedir "Inverte. O marquee deve ser antes do vídeo". Tabela de especificações: "Coloque abaixo do vídeo". Se não quiser esse tipo de ficha, pegar print de uma ficha de outro site, ou extrair do design system de outro site. Galeria: 4 imagens do site da marca (salvas ou por URL) + "Coloque abaixo da ficha técnica". Footer: "Extraia o rodapé dessa página, crie o componente em Astro e coloque na nossa página principal" com o `index.html` baixado e o `index.astro`; correções: ícones das redes sociais errados (print) e "Remova as bolinhas entre os ícones".

Dica de método vista aqui: **dizer onde a seção entra** ("abaixo do vídeo", "abaixo da ficha técnica") para a IA não errar a ordem.

## Prompt de build do parallax em 6 camadas (verbatim do material)

Contém markup, CSS e o algoritmo JS exatos. Valores-chave: seção `height: 300vh`; stage `position: sticky; top: 0; height: 100vh`; camadas `bottom:-32%; left:-8%; width:116%; height:160%`; `maxOffsets = [880, 660, 440, 250, 100, 15]` (frente move mais); `scale = 1 + (0.09 * factor * (6 - i) / 5)`; texto entra após 8% de progresso, em 20% de curso, com blur 12px > 0; sem fade-out; `will-change: transform` e **nenhuma transition CSS no transform** (o JS manda em todos os frames).

~~~~
Build the PARALLAX LANDSCAPE FOLD (`#artesanal`) exactly like index.html + style.css + main.js.

═══════════════════════════════════════
POSITION
═══════════════════════════════════════
Second fold inside <main>, after #intro, before #hero.
<section class="parallax-section" id="artesanal">

═══════════════════════════════════════
EXACT MARKUP
═══════════════════════════════════════
<section class="parallax-section" id="artesanal">
 <div class="parallax-container">
 <img src="assets/6.png" alt="Céu e Distância" class="parallax-layer layer-6" id="p-layer6" style="z-index:10;">
 <img src="assets/5.png" alt="Montanhas Distantes" class="parallax-layer layer-5" id="p-layer5" style="z-index:20;">
 <img src="assets/4.png" alt="Montanhas Intermediárias" class="parallax-layer layer-4" id="p-layer4" style="z-index:30;">
 <img src="assets/3.png" alt="Montanhas Próximas" class="parallax-layer layer-3" id="p-layer3" style="z-index:40;">
 <img src="assets/2.png" alt="Montanhas em Foco" class="parallax-layer layer-2" id="p-layer2" style="z-index:50;">

 <div class="parallax-text-overlay" id="p-text" style="z-index:55;">
 <div class="parallax-badge">Tradição Murano</div>
 <h2 class="parallax-title">Tempo & Natureza</h2>
 <p class="parallax-description">A aventurina surgiu de forma acidental e mágica no século XVII.
 Redentore traz essa mesma essência: o encontro harmônico entre a tradição dos mestres de Murano
 e a precisão da relojoaria moderna.</p>
 </div>

 <img src="assets/1.png" alt="Rochas de Primeiro Plano" class="parallax-layer layer-1" id="p-layer1" style="z-index:60;">
 </div>
</section>

Layer order (back → front): 6,5,4,3,2, TEXT, 1
IDs p-layer1…p-layer6 and p-text are MANDATORY (main.js).

Assets come from the Image prompts in this section (lunar conversion + chroma key cleanup → transparent PNGs named 1.png…6.png).

═══════════════════════════════════════
CSS (exact)
═══════════════════════════════════════
.parallax-section
- position:relative; height:300vh; background:var(--bg-dark)
- border-top:1px solid var(--border-light); z-index:5
- content-visibility:auto

.parallax-container
- position:sticky; top:0; height:100vh / 100dvh; width:100%; overflow:hidden
- flex center
- ::after fade: absolute bottom 0; height 280px; z-index 65
 background: linear-gradient(to top, #000 0%, transparent 100%); pointer-events:none

.parallax-layer
- position:absolute; bottom:-32%; left:-8%; width:116%; height:160%; max-width:none
- object-fit:cover; object-position:center bottom; pointer-events:none
- filter: grayscale(100%) brightness(0.68) contrast(1.15)
- will-change:transform; transform-style:preserve-3d; backface-visibility:hidden
- NO transform CSS transition (JS drives every frame)

.layer-6 special: top:-8%; bottom:auto; same width/height

.parallax-text-overlay
- absolute; top:50%; left:50%; transform:translate(-50%,-50%)
- flex column center; text-align:center; padding:0 40px; max-width:800px
- opacity:0 initially; transition:none (JS controls opacity/blur/transform)

.parallax-badge → 11px/600/0.25em uppercase lavender; margin-bottom 16px
.parallax-title → EB Garamond clamp(36px,5vw,64px)/500/1.1 white; text-shadow 0 0 40px rgba(0,0,0,.95); mb 24px
.parallax-description → 15px/1.8/300 --text-secondary; max-width 600px; text-shadow 0 4px 15px rgba(0,0,0,.95)

Responsive
- ≤1024: section height 180vh; text overlay top 25%; title mb 16px; desc 14px/1.7
- ≤580: overlay top 20%; padding 0 24px; title 32px

═══════════════════════════════════════
JS PARALLAX (main.js) — exact algorithm
═══════════════════════════════════════
pLayers order array: [p-layer1, p-layer2, p-layer3, p-layer4, p-layer5, p-layer6]
maxOffsets px: [880, 660, 440, 250, 100, 15] // foreground moves most

On scroll/resize via rAF:
 progress = clamp( -rect.top / (sectionHeight - viewHeight), 0, 1 )
 factor = 1 - progress
 each layer i:
 yTranslate = maxOffsets[i] * factor
 scale = 1 + (0.09 * factor * (6 - i) / 5)
 transform = translate3d(0, yTranslate px, 0) scale(scale)

Text overlay (#p-text):
 textOffset = 240 * factor
 if progress > 0.08:
 t = min(1, (progress - 0.08) / 0.20)
 opacity = t; blur = 12 * (1 - t)
 else opacity 0, blur 12
 transform: translate(-50%, calc(-50% + textOffset px))
 filter: blur(...) or none
 NO fade-out after appearing

═══════════════════════════════════════
ACCEPTANCE
═══════════════════════════════════════
[ ] Sticky 100vh stage inside 300vh scroll track
[ ] 6 layers + text between 2 and 1
[ ] Grayscale/dark filter on layers
[ ] Bottom black fade
[ ] Text “Tradição Murano / Tempo & Natureza” fades in with blur→sharp
[ ] Smooth rAF parallax, no CSS transform transitions fighting JS
~~~~

## Prompt de build da Hero (resumo do material, em português)

Hero estática: **uma única imagem de fundo** cobrindo a tela (`min-height: 100vh/100dvh`, `background-size: cover`), conteúdo editorial à direita (largura ~420 a 560px, container `max-width` ~1600px, `display:flex; justify-content:flex-end; align-items:center`). Regras proibitivas repetidas no prompt: **sem overlay, sem vinheta, sem gradiente, sem `::before/::after` escurecendo, sem filtros/opacity/blend na imagem, sem canvas, sem 3D falso, sem tilt, sem anéis, sem texto em gradiente**; cor de texto sólida. Imagem resolvida pelo sistema de assets do Astro (import ou prop), sem caminhos absolutos. Título em duas linhas (`VENEZIANICO` / `REDENTORE`, `clamp(44px, 5vw, 80px)`, line-height ~1.02), descrição 14 a 16px com `max-width` ~480px, dois botões (sólido claro + contorno, hover só com pequeno `translateY` e troca de cor, sem glow), barra com 3 specs (Seiko NH35A / Cristal Safira / Aço 316L) com separador sutil. O prompt manda **apagar o "palco" anterior** (relógio/galáxia interativos) e não depender de `index.html/style.css/main.js/galaxy.js`. A imagem de fundo vem do prompt "girlsWatch" (ver skill `imagens-videos-produto-ia`, `prompts-imagem.md` seção 4).

## Outros trechos do material (CSS/JS exatos) reaproveitáveis

Estão em `receitas-efeitos.md`: vídeo de intro que desacelera e congela, marquee infinito CSS, faixa de vídeo ambiente, ficha técnica, galeria 4 quadrados, header glass após scroll.
