# Receitas de efeitos (valores e trechos dos materiais)

Convenção: **[material]** = valor/código copiado do material do curso. **[aula]** = a aula só descreve o pedido (o código foi escrito pela IA do editor e não é mostrado). **[nossa adaptação]** = não está no curso; marcado para você validar. Versões/bibliotecas "conforme o curso (nov/2026)".

Princípio: o curso quase sempre pede o efeito **por descrição + referência (print/URL/prompt de componente)** e deixa a IA do editor escrever o código. As receitas abaixo dão o vocabulário certo e, quando o material trouxe código, o código.

---

## 1. Parallax em camadas guiado pelo scroll (sticky 300vh) [material, Venezianico]

Estrutura: seção alta (`height: 300vh`) com um palco `position: sticky; top: 0; height: 100vh` (use também `100dvh`) e `overflow: hidden`; 6 `<img>` empilhadas por `z-index` (6 = fundo, 1 = frente), texto **entre a camada 2 e a 1**. IDs `p-layer1`...`p-layer6` e `p-text` (o JS depende deles).

CSS essencial: camadas `position:absolute; bottom:-32%; left:-8%; width:116%; height:160%; max-width:none; object-fit:cover; object-position:center bottom; pointer-events:none; will-change:transform; transform-style:preserve-3d; backface-visibility:hidden`; a camada 6 usa `top:-8%; bottom:auto`; filtro `grayscale(100%) brightness(0.68) contrast(1.15)` para unificar; fade preto embaixo do palco (`::after`, 280px, `linear-gradient(to top, #000, transparent)`, z-index 65). **Sem `transition` no transform** (o JS atualiza todo frame). Responsivo: ≤1024px a seção vai a `180vh`.

Algoritmo [material]:

```js
// maxOffsets em px: frente se move mais que o fundo
const maxOffsets = [880, 660, 440, 250, 100, 15];   // camadas 1..6
// a cada scroll/resize, via requestAnimationFrame:
progress = clamp(-rect.top / (sectionHeight - viewHeight), 0, 1);
factor   = 1 - progress;
// para cada camada i (0..5):
yTranslate = maxOffsets[i] * factor;
scale      = 1 + (0.09 * factor * (6 - i) / 5);
el.style.transform = `translate3d(0, ${yTranslate}px, 0) scale(${scale})`;
// texto (#p-text):
textOffset = 240 * factor;
if (progress > 0.08) { t = Math.min(1, (progress - 0.08) / 0.20); opacity = t; blur = 12 * (1 - t); }
else { opacity = 0; blur = 12; }
text.style.transform = `translate(-50%, calc(-50% + ${textOffset}px))`;
text.style.filter = blur ? `blur(${blur}px)` : 'none';   // sem fade-out depois
```

Como o curso fez: gerou as camadas (ver `imagens-videos-produto-ia`), numerou 1 = frente, colou o prompt de build completo (`projeto-venezianico.md`). A IA fez primeiro parallax **no mouse**; correção: "O parallax deve ser no scroll. Aplique as técnicas de scroll scrub."

[nossa adaptação, não do curso] Equivalente em GSAP: `ScrollTrigger.create({ trigger: secao, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: s => aplicar(s.progress) })` chamando a mesma função de transformação. Teste antes de prometer ao cliente.

## 2. Parallax reativo ao mouse [aula, Valentino e 1ª tentativa do Venezianico]

Sem código no curso. Pedido: "Cria a primeira dobra usando um parallax. Utilize as imagens que temos em @assets/parallax" (camadas numeradas). A IA gera parallax que reage ao mouse; no Valentino o professor seguiu com o parallax de mouse (não pediu scroll); no Venezianico pediu scroll. Decisão: mouse para hero decorativa; scroll para seção narrativa.

Regra de camadas: todas as imagens do mesmo tamanho/enquadramento/ponto de fuga (ver prompt das 5 camadas). Produto montado em cima da camada 3 como P1/P2/P3 (tampa/borrifador/frasco) empilhados.

## 3. Scroll scrub (vídeo ou frames avançam com o scroll) [aula]

- **Vídeo da hero (Apple):** vídeo em `src/assets/videos/hero.mp4` como fundo de toda a dobra; pedido "aplique o efeito de scroll scrub no vídeo". Resultado: ao rolar, o vídeo avança/volta. Dica de produção: peça ao gerador de vídeo "pensado para um efeito de scroll scrub" (frame inicial e final bem definidos). O prompt de scaffold do material cita GSAP + ScrollTrigger (e Lenis) para reveals e contadores; o curso não exibe o código do scrub em si.
- **Vídeo em frames (Valentino):** converter o vídeo em imagens (8 FPS, qualidade 75%, 64 imagens; ver `imagens-videos-produto-ia/references/pos-processamento.md`), pasta `src/assets/scroll-scrub`, e pedir: "Na terceira dobra do nosso site, coloque esse vídeo para se expandir e ocupar 100vh [...]. Quero que o vídeo comece menor e se expanda até ocupar toda a tela. Utilizando as técnicas de scroll scrub. @src/assets/scroll-scrub". Trade-off: mais frames = mais fluido e mais pesado.
- **Elemento que "desce" entre dobras (Valentino):** "A imagem que temos na hero deve se deslocar para a segunda dobra, usando scroll scrub."
- **Texto formado pela borrifada:** "Tudo o que está escrito aqui deve ser escrito em partículas que saem como a borrifada do frasco." A IA descobriu de onde sai a borrifada e acrescentou um efeito não pedido.
- Se uma imagem/efeito **não** deve reagir: peça "Remova os efeitos de scroll da imagem" e "Remova a interação com o mouse" (Apple, dobra do atleta).

## 4. Vídeo que expande até a tela cheia [aula, Venezianico e Valentino]

Mesmo conceito: vídeo começa menor e cresce até 100vw x 100vh com o scroll. No Venezianico o vídeo veio de uma URL (botão direito > "copiar endereço do vídeo") colada no prompt; no Valentino, por frames. O prompt de código desse efeito **não consta nos materiais**; use o pedido da seção 3.

## 5. Vídeo de intro que desacelera e congela [material, Venezianico]

HTML: `<video id="introVideo" autoplay muted playsinline class="intro-video-bg"><source src="assets/relogio-espacial.mp4" type="video/mp4"></video>` e `<div class="intro-overlay" aria-hidden="true">`. **Sem `loop`, sem `controls`, sem texto por cima.** CSS: seção `100vh`, `background #000`; vídeo `position:absolute; top/left:50%; width/height:100%; object-fit:cover; transform:translate(-50%,-50%)`; overlay `radial-gradient(circle, rgba(4,2,8,.25) 0%, rgba(4,2,8,.8) 100%)`.

```js
introVideo.addEventListener('timeupdate', () => {
  const timeLeft = introVideo.duration - introVideo.currentTime;
  if (introVideo.duration > 0 && timeLeft > 0 && timeLeft < 2.5) {
    const rate = 0.15 + (timeLeft / 2.5) * 0.85;
    introVideo.playbackRate = Math.max(0.15, Math.min(1.0, rate));
  } else { introVideo.playbackRate = 1.0; }
});
introVideo.addEventListener('ended', () => { introVideo.pause(); introVideo.playbackRate = 0.15; });
```

Efeito: abertura cinematográfica, desacelera nos últimos 2,5 s e congela no último frame até o usuário rolar.

## 6. Marquee infinito (palavras em movimento) [material, Venezianico]

HTML: um wrapper `.scrolling-text__wrapper` com a frase repetida **10 vezes** (a 1ª acessível; as demais com `aria-hidden="true"` e classe `motion-reduce:hidden`). CSS:

```css
.section-full { width:100%; overflow:hidden; background:#000; }
.scrolling-text { overflow:hidden; white-space:nowrap; padding:48px 0; display:flex; align-items:center;
  border-top:1px solid rgba(255,255,255,.05); border-bottom:1px solid rgba(255,255,255,.05); }
.scrolling-text__wrapper { display:flex; white-space:nowrap; animation: marquee 30s linear infinite; min-width:max-content; }
.scrolling-text__text { font-family:var(--font-display); font-style:italic; font-size:4.5rem; font-weight:500;
  text-transform:uppercase; letter-spacing:-.01em; padding:0 40px; display:inline-block; flex-shrink:0; }
.text-gradient { background:linear-gradient(46deg,#8a8f9b 0%,#d1d5db 25%,#fff 50%,#d1d5db 75%,#8a8f9b 100%);
  -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
@keyframes marquee { 0% { transform:translate3d(0,0,0);} 100% { transform:translate3d(-50%,0,0);} }
@media (max-width:768px){ .scrolling-text__text{font-size:3rem;padding:0 24px;} .scrolling-text{padding:32px 0;} }
```

Só CSS, sem JS. Para o loop ser contínuo, precisa de cópias suficientes para cobrir 2x a largura (-50%).

## 7. Faixa de vídeo ambiente, ficha técnica e galeria [material, Venezianico]

- **Faixa de vídeo:** `<video autoplay muted loop playsinline class="ambient-video">`, altura `380px` (240px no mobile), `object-fit:cover`, bordas `1px solid rgba(255,255,255,.05)`, vinheta `linear-gradient(to bottom, rgba(4,2,8,.4) 0%, transparent 50%, rgba(4,2,8,.4) 100%)`. Diferença para a intro: tem `loop`, não é 100vh.
- **Ficha técnica:** lista centrada (`max-width:800px`) com 10 linhas `label (uppercase, 13px, 50% branco) / valor (15px, direita, max 60%)`, divisor `1px rgba(255,255,255,.08)` que fica azul (`rgba(0,85,255,.4)`) no hover; no mobile as linhas viram coluna. Âncora `id="especificacoes-detalhadas"` ligada ao botão "Especificações" da hero.
- **Galeria 4 quadrados:** `grid 4 > 2 (≤1024px) > 1 (≤768px)`, `gap:32px`, `aspect-ratio:1/1`, `object-fit:cover`, zoom no hover `transform: scale(1.05)` com `transition: transform .8s var(--ease-out)`, `loading="lazy"`, `box-shadow: 0 10px 40px rgba(0,0,0,.5)`; sem legendas. `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`.
- Se não quiser esse tipo de ficha: print de outra ficha técnica ou extrair do design system de outro site e pedir para a IA recriar.

## 8. Header (dois tratamentos do curso)

- **Vidro de estado único (Apple) [material]:** `position: sticky; top:0`, ~48px fixos, wordmark ~19px à esquerda; à direita 3-4 links de ~12px (70% de opacidade) + botão pill azul; fundo branco ~80% com `backdrop-filter: blur(~20px) saturate(...)`, hairline inferior; **nunca muda de estado** (nem sobre o vídeo da hero); no mobile mantém 48px e colapsa os links.
- **Transparente que vira vidro ao rolar (Venezianico) [material]:** `.site-header.scrolled` com `rgba(4,2,8,.65) + blur(15px) saturate(180%)` depois de `scrollY > 20`; dropdowns e menu mobile (`#mobileMenu`, ícone que vira X, `aria-expanded`).
- Em ambos: **um único header**; a 1ª tentativa da IA na Apple gerou dois headers. Peça "apenas um cabeçalho", descreva qual (o com botão de comprar) e crie como **componente no layout** para repetir nas páginas.

## 9. Reveal, contador numérico e scroll suave (Apple) [material]

- Scroll suave com inércia no site todo (Lenis); os reveals usam o evento de scroll dessa biblioteca.
- Entrada: fade+rise (opacity 0>1, `translateY` 16-24px>0, 0,6-0,8 s, `cubic-bezier(0.16, 1, 0.3, 1)`), **stagger de 100-150 ms** entre irmãos, sem replay ao rolar para cima.
- Contadores ("15 dias", "99.9%", "4°C"): contam de 0 ao alvo **uma vez** quando o card entra na viewport, em ~1,2-1,6 s; número com `font-variant-numeric: tabular-nums` para os dígitos não "tremerem". Os 3 cards de vidro e os 4 blocos de métricas usam **a mesma mecânica**.
- Loader branded ao primeiro paint (anel girando + porcentagem), some quando a página está pronta, sem bloquear mais que ~1-2 s. No material é "estrutural, não polimento opcional".
- Regras globais: um único acento azul `#0071e3` para CTAs/links; um raio para cards (28px) e outro para pills (999px); tipografia sans semibold com tracking -0.02 a -0.03em.
- No Harry Potter, números zerados foram corrigidos com "Aqui os valores estão zerados. Ajuste."

## 10. Painel imersivo alto sem pin (Apple, 160vh) [material]

Seção `height:160vh; overflow:hidden`; camadas de trás para frente: (1) foto full-cover `top:0; height:115%; object-position:center bottom`; (2) vinheta radial (transparente a ~25%, ~55% branco a 65%, ~92% branco a 100%); (3) fade linear para branco no último quarto; (4) 5-6 pontos "de gelo" borrados com keyframes de deriva (7-13 s, delays diferentes); (5) 2 círculos azuis pálidos borrados 30-40px, 150-300px, loops 12-15 s. Conteúdo em duas zonas: título centralizado no topo (~55vh) e 3 cards de vidro (branco ~70% + backdrop-blur, borda branca 40%) na parte de baixo. **Não pina nem faz scrub**: é só uma seção muito alta que rola normalmente.

## 11. Galeria horizontal com snap + setas (Apple) [material]

Trilho com `overflow-x: scroll; scroll-snap-type: x mandatory`, scrollbar oculta, 4 cards 2:3 (`scroll-snap-align: start`, largura ~220px mobile a ~340px desktop), gap ~2rem, imagem `scale(1.05)` em 0,7 s no hover, **legenda abaixo** do card (frase inicial em negrito + resto cinza, 13-14px), 2 botões redondos 36px que rolam ~1 card com `behavior: smooth` e desativam nas pontas; o 1º card alinhado com o título; o último "sangrando" para sugerir mais.

## 12. Cards empilhados no scroll, "Cards Almanac" [material, Harry Potter]

Coluna de cards `position: sticky` que se sobrepõem: o próximo sobe e cobre o anterior deixando uma fresta no topo. Loop em `requestAnimationFrame` dá profundidade 3D e revela capa/texto quando ~metade do card está na tela, e anuncia o card ativo em região `aria-live`. Respeita `prefers-reduced-motion`.

Constantes [material]: `baseVh 5`, `peekPx 34`, `gapVh 46`, `revealPx 480`, `revealAt 0.5`, `persp 1500`, `arriveTilt 15`, `buriedTilt 3`, `scaleStep 0.035`, `dimStep 0.02`, `liftPx 4`; paleta `--bg #f1f0ed`, `--card #fff`, `--ink #1a1917`, `--accent #ff6a2b`; stack `width: min(80vw, 1080px)`; ≤900px `86vw`; ≤620px 1 coluna com capa 16/10 e raio 20px.

Núcleo [material]:

```js
function layout() {
  const vh = innerHeight;
  const cardH = CARDH = cards[0].offsetHeight;
  const centred = (vh - cardH) / 2 - ((N - 1) / 2) * S.peekPx;
  const base = Math.max(centred, (S.baseVh / 100) * vh);
  restTops = cards.map((el, i) => { const t = Math.round(base + i * S.peekPx); el.style.setProperty('--top', t + 'px'); return t; });
}
function update() {
  // risen[i] = clamp((restTops[i] + S.revealPx - top) / S.revealPx, 0, 1)
  // buried = soma dos 'risen' dos cards posteriores
  // rx = S.arriveTilt * (1 - risen[i]) - S.buriedTilt * buried
  // el.style.transform = `perspective(${S.persp}px) translateY(${-buried*S.liftPx}px) rotateX(${rx}deg) scale(${1 - S.scaleStep*buried})`
  // el.style.filter = `brightness(${1 - S.dimStep*buried})`; zIndex = 10 + i
  // revela (.-in) quando top <= vh - S.revealAt*CARDH; re-arma quando top >= vh - 0.04*CARDH
}
addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
```

Como foi usado: copiar o prompt do componente no site de componentes + "Adapte os cards para se comportarem assim" na seção existente. Para adaptar: troque cores/textos/imagens e o número de cards (6 no material).

## 13. Troca de imagem com distorção líquida WebGL, `MorphSlider` (React Bits) [material]

Dependências: `ogl` e `gsap` (GSAP dirige o progresso da transição). Props principais: `items [{image, caption}]`, `transition: "melt" | "ripple" | "shear" | "swirl"` (padrão melt), `duration 1.1`, `ease "power2.inOut"`, `intensity 0.55`, `scale 2.4`, `aberration 0.35` (divisão RGB no meio da transição), `drift 0.4`, `autoplay` (pausa no hover), `autoplayDelay 4`, `loop true`, `radius 16`, `showCaptions/showControls/showIndicators`. Exemplo do material: `<MorphSlider items={items} transition="melt" intensity={0.55} aberration={0.35} drift={0.4} autoplay />` em contêiner com altura definida (`height: 500px; position: relative`). É componente React: em Astro precisa de integração React (o curso não detalha; a IA do editor fez). Pedido: "Crie uma dobra para usar isso. (Utilize as imagens do nosso projeto mesmo)".

## 14. Rastro de cursor em canvas [material, Harry Potter]

Hook `useCanvasCursor` + `<canvas className='pointer-events-none fixed inset-0' id='canvas' />`. Linhas com física de mola desenham curvas quadráticas seguindo o mouse. Configuração [material]: `trails: 20, size: 50, friction: 0.5, dampening: 0.25, tension: 0.98`; cor `hsla(h,50%,50%,0.2)` com `h` oscilando (`amplitude 85, frequency 0.0015, offset 285`); `globalCompositeOperation = 'lighter'`; `lineWidth 1`; resize: `width = innerWidth - 20`. Pedido na aula: "Implemente esse rastro do cursor no nosso site... Deixe o rastro menor, mais grosso e roxo." (Para "mais grosso", suba `lineWidth`; para "roxo", troque a faixa do matiz; [nossa leitura do código]).

## 15. Accordion de colunas "Colonnade" (one in, one out) [material, Valentino]

Seção em tela cheia (`position:fixed; inset:0`) com 4 colunas flex lado a lado; ao passar o mouse/tocar/focar uma coluna, o painel de arte **sobe** para dentro enquanto o anterior **sobe** e sai por cima (esteira contínua para cima), a coluna ativa alarga (`flex-grow: 2.5`; `3.4` no mobile ≤860px, onde as colunas empilham) e o título central e a legenda trocam no mesmo movimento. Paineis são mesh gradients CSS (sem imagens) no material; no projeto, o professor passou 3 fotos para ocuparem as colunas.

Constantes: `--slide: 900ms; --ease: cubic-bezier(.76, 0, .18, 1)`; papel `#f6f4f0`, tinta `#1c1a16`, acento `#b5521d`. Fontes: Space Grotesk + Inter.

Lógica-chave [material]:

```js
const CAN_HOVER = matchMedia('(hover: hover) and (pointer: fine)').matches;
function enter(el){ if (el.classList.contains('-out')) { el.style.transition='none'; el.classList.remove('-out'); void el.offsetWidth; el.style.transition=''; } el.classList.add('-in'); }
function exit(el){ el.classList.remove('-in'); el.classList.add('-out'); }
// armReset: ao fim do transitionend do -out, volta para baixo sem transição, para sempre reentrar subindo
// setActive(i): sai o anterior (exit media+head), entra o novo (enter media+head), alterna .-active e aria-selected
if (CAN_HOVER) col.addEventListener('pointerenter', () => setActive(i));
col.addEventListener('click', () => setActive(i));
col.addEventListener('focus', () => setActive(i));
// setas Direita/Baixo e Esquerda/Cima navegam (com wrap) e movem o foco
requestAnimationFrame(() => requestAnimationFrame(() => setActive(0)));   // entrada inicial animada
```

Acessibilidade: `role="tablist"`, `tabindex=0`, `prefers-reduced-motion` reduz as durações para .01ms.

## 16. Hover líquido que revela outra imagem [material, Lando Norris]

WebGL1 puro, 24 pontos de trilha, `smin`, SDF de cápsula, refração de menisco. Ver `projeto-lando-hover.md` (resumo e parâmetros) e `liquid-reveal-prompt.md` (prompt completo com shaders).

## 17. Hover e microinterações citados

- Cards da Apple na última dobra: **sem efeito de hover** (a referência não tem; "Retira o efeito ao passar o mouse").
- Botão "+" circular escuro 36px nos icon-cards, `scale` no hover; link com chevron que desliza para a direita no hover (Apple).
- Botões do Venezianico: hover só com `translateY(-2px)`, troca sutil de cor/borda; sem glow/brilho/animated border.
- Underline do menu que cresce do centro (gradiente transparente > azul > transparente) no hover (Venezianico, nav).
