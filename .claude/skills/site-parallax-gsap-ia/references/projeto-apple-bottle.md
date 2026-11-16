# Projeto Apple Bottle Pro (garrafa tecnológica, estilo Apple)

Site de exemplo do curso: https://applebottlepro.vercel.app (material em /material). Stack: Astro 100% `.astro`, Tailwind (no material), GSAP + ScrollTrigger e Lenis (scroll suave) citados nos prompts. A aula pede o editor de código com IA (Antigravity com Gemini; "pode usar Cursor, Windsurf ou Claude Code").

## Decisões do curso, aula a aula

**Aula 2: referências + hero.**
1. Baixar o site da Apple com o site downloader da Asimov (colar o link > "baixar site" > zip). `npm create astro@latest` (o áudio diz "astro-latest"), nome do projeto, aceitar as 3 primeiras opções. Colocar a pasta do site baixado em `src/assets`.
2. Primeiro pedido à IA: gerar o **design system** (`design-system.html`) a partir do site baixado (prompt "disponível no material", mas não consta na página de materiais; ver skill `design-system-por-ia`). Resultado: tipografia, cores, bordas, botões e hover.
3. Em paralelo: foto do produto, foto de referência de produto no site (iPhone), print > GPT > prompt de estilo; gerar frame inicial (garrafa) e frame final (atleta bebendo, sem tampa); prompt de vídeo; vídeo no Google Flow (ver `imagens-videos-produto-ia`).
4. Código: abrir `src/pages/index.astro` e `design-system.html` no contexto e pedir "Crie a primeira dobra seguindo o mesmo estilo que temos aqui... Não coloque imagens. Deixe um texto padrão. E já crie o componente header. Use 100% .astro." A 1ª tentativa saiu "com cara de IA" e com **dois headers**.
5. Correção: **print da dobra de referência** (hero do AirPods Pro no site da Apple) + "A primeira dobra deve ser exatamente assim, como na imagem. Use o design system... E já coloque o vídeo ocupando todo o background da primeira dobra. Atente-se de usar apenas um cabeçalho. O correto é o que tem o botão de comprar."
6. Três ajustes de uma vez: "aumente o espaço lateral do site (margens e paddings horizontais estão muito grandes)", "remova a logo da Apple do cabeçalho", "aplique o efeito de scroll scrub no vídeo" (o vídeo avança/volta conforme o scroll).

**Aula 3: componentes.** Print da seção inteira da referência + "Recrie exatamente essa mesma dobra. Quero os mesmos cards, mesmas cores, mesmos espaçamentos, porém tudo adaptado para o meu produto Apple Bottle."

**Aula 4: dobra do atleta (150vh pedido, ajustado para 170vh).** Pedido: "crie a próxima dobra. Ela deve ter 150vh [...] O fundo dela deve ser 100% branco, fff. E centralize a imagem que eu te enviei. Como texto, coloque no topo centralizado..." Depois: aumentar imagem, **remover efeitos de scroll da imagem e a interação com o mouse**; cards "em preto e branco" no final da dobra ("crie cards como esses bem no final da dobra. Porém em preto e branco", dizendo "nessa dobra do atleta 1" para a IA não mexer em outra seção); "o atleta deve encostar no final da própria dobra. Ele deve começar lá debaixo e ir quase até o topo". Trocar imagem: "Utilize essa imagem de atleta 1."

**Aula 5: especificações com vídeo de tela.** Imagem da tampa tecnológica ligada/desligada > vídeo (Frames). Pedido da dobra: "Recrie esses componentes de características do produto e coloque-os em uma nova dobra" (com print). Depois "nessa dobra onde temos o desempenho e autonomia, coloque esse vídeo ocupando todo o background", corrigido com imagem de referência: "O vídeo deve ficar acima do componente de métricas, assim como na imagem. Imagine que são duas dobras empilhadas." + título acima do vídeo; "no vídeo eu não quero bordas, quero que ele ocupe toda a lateral, não quero sombras"; erro: vídeo deslocado para a direita; print + "O vídeo ficou fora da tela, não está centralizado. Ele não deve ter paddings nem margens."

**Aula 6: dobra "fora da caixa" (atleta 2 à direita, ~155vh).** Print da dobra do site da Apple a copiar + "Recrie essa mesma dobra com esse mesmo visual. Ela deve ter aproximadamente 155 VH de altura. [...] essa imagem deve estar no canto direito da tela" + cor do fundo com ColorZilla ("o background deve ter essa cor", era cinza, não branco). Ajustes em loop: "atleta maior e mais para a direita", "muito mais para a direita", "fazer ocupar 110vh", "coloque o atleta mais para a esquerda". Lição: **ajustes de posição são normais e iterativos; saiba exatamente o resultado que quer**.

**Aula 7: última dobra (4 cards com imagens) + footer + limpeza.** Extrair as 4 imagens da dobra de referência (F12), jogar numa pasta `apple` e pedir "coloquem essas imagens dentro dos cards"; depois trocar por imagens geradas (tenistas, garrafa no círculo). "Retira o efeito ao passar o mouse" nos cards (é o comportamento da referência). Footer: "Crie um rodapé... siga exatamente o mesmo visual que temos aqui" com site da Apple + design system. Limpeza final: remover a tag "Scroll scrub" visível na hero ("Isso aqui a Apple não colocaria"). Revisão geral: olhar o site todo procurando o que a referência não faria.

## Prompts do material, na ordem do projeto

A ordem da página: header > hero > Environment Gallery > Hidratação (painel 160vh) > Vídeo > Hardware Metrics > Fitness > Health Gallery > Specifications > Footer. **O prompt da seção Specifications NÃO consta na página de materiais** (foi feita por print na aula 5); o do Footer e do Audit constam. O prompt de scaffold vai primeiro e o de auditoria por último ("patches só onde houver drift").

Observação: os prompts estão em inglês e descrevem o site em PT-BR; copie e troque produto/textos. A página os chama de "homenagem quase 1:1 a um site de marca grande": use como molde de estrutura, não copie marca de terceiros para clientes.

### Scaffold, tokens e ordem do DOM (rodar primeiro)

~~~~
You are building a one-page product marketing site for a smart water bottle ("Apple Bottle Pro") that must match a reference design's structure, tokens, type rhythm, motion language and responsive behavior — without copying any specific implementation. Treat every instruction below as the source of truth; do not invent a different visual language.

═══════════════════════════════════════
PROJECT BRIEF
═══════════════════════════════════════
Product: a titanium smart water bottle with UV-C purification, thermal insulation and health-app integration.
Language of UI copy: PT-BR for all on-page copy; class/id names may stay in EN.
Aesthetic: a near-1:1 homage to a big consumer-tech brand's product page — glassmorphic sticky nav, huge semibold SF-Pro-style headlines with tight tracking, generous whitespace, big rounded cards (28px radius), soft shadows, a single blue accent for every CTA, icon accents in a handful of secondary hues used only inside feature cards.
Stack: plain static HTML + CSS is enough; Tailwind utility classes (or an equivalent utility-first approach) is the expected authoring style. GSAP + ScrollTrigger for scroll-linked reveals/number counters, and a lightweight smooth-scroll library (Lenis-style) for eased page scroll.

═══════════════════════════════════════
:root TOKENS (adopt exactly)
═══════════════════════════════════════
:root {
 --font-sans: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif; /* use for everything, headlines and body alike */
 --font-mono: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, monospace; /* only for tabular numeric labels */
 --stone-50: #fbfbfd;
 --stone-100: #f5f5f7; /* the workhorse light-gray section background */
 --stone-150: #e8e8ed;
 --stone-200: #d2d2d7; /* hairline borders */
 --stone-300: #aeaeb2;
 --stone-400: #86868b;
 --stone-500: #6e6e73; /* secondary/muted text */
 --stone-700: #424245;
 --stone-900: #1d1d1f; /* primary ink */
 --accent: #0071e3; /* every CTA button, every link */
 --accent-hover: #0077ed;
 --radius-card: 28px; /* every big card */
 --radius-pill: 999px; /* every button/pill */
 --ease: cubic-bezier(0.16, 1, 0.3, 1);
}
Feature-card icon accents (used only inside small icon badges, never as a page-wide accent): purple #8431e5, orange #f36011, teal #009baf.

═══════════════════════════════════════
GLOBAL MECHANICS (apply site-wide)
═══════════════════════════════════════
1. Smooth/inertia scrolling site-wide (Lenis-style); scroll-linked reveals hook into that library's own scroll event.
2. Fade/rise-in on first viewport entry for most content blocks (opacity 0→1, translateY ~16-24px→0, ~0.6-0.8s var(--ease)), staggered by ~100-150ms between siblings in a grid/row. Do not replay on scroll-up.
3. Numeric stat counters (large "15 dias", "99.9%", "4°C" style numbers) count up from 0 to their target once their card enters the viewport, over ~1.2-1.6s.
4. A brief branded loader overlay covers the whole viewport on first paint: a small spinning ring + percentage readout, fading out once the page/assets are ready (do not block longer than ~1-2s in practice).
5. Every big card (feature cards, stat cards, gallery tiles) uses --radius-card; every button/pill uses --radius-pill. There is no third radius value anywhere on the page.

═══════════════════════════════════════
PAGE ORDER (must match)
═══════════════════════════════════════
1. header (sticky glass bar, see Header prompt)
2. section — Hero: full-bleed looping video, h-screen, bottom-anchored content split left (title+subtitle) / right (price+CTA pill)
3. section — Environment Gallery: headline + "see all specs" link, 3-up grid of big rounded icon-cards (colored icon, headline with one colored highlight phrase, small circular "+" info button bottom-right of each card)
4. section — Personalized Hydration: a tall (~160vh) immersive panel — full-cover photographic background, floating frost-particle dots and soft color-refraction blobs as pure decoration, a centered title zone in the first ~100vh and a row of 3 frosted-glass stat cards in the second ~100vh
5. section — Interactive Video: a centered header (eyebrow label + headline) above a full-bleed video block (~70-80vh)
6. section — Hardware Metrics: a 2-column grid of giant stat blocks ("Até" + huge number + unit), each followed by a hairline divider and a short comparison line vs. the previous generation
7. section — Fitness Integration: a ~90vh section with a right-anchored photographic background and a left-aligned (~45% width) text column stacking two blocks: a longer paragraph about health-app integration, then a small icon badge + IP rating headline + paragraph
8. section — Health & Hydration Gallery: headline + link, then a horizontal snap-scroll row of tall (2:3) image cards with a caption below each (bold lead-in phrase + sentence), plus two small round prev/next buttons bottom-right
9. section — Specifications: headline, then a responsive grid of ~6 icon+title+description feature cards (staggered fade-in), followed by a two-column "full spec sheet" key/value table inside one big rounded panel
10. footer: legal footnotes block, a 4-column link directory, and a copyright/legal bar

═══════════════════════════════════════
HARD RULES
═══════════════════════════════════════
- var(--accent) blue is the only color used for buttons/links across the whole page; icon-badge colors never leak into buttons or headlines
- Every headline uses the same sans stack at semibold/600 weight with tight (-0.02 to -0.03em) letter-spacing — never a different display face
- Big cards always use --radius-card (28px); never mix in a smaller/larger radius on the same card type
- Deliverable after this prompt: scaffold the files/tokens/empty section placeholders in the order above, then implement each fold with its own dedicated prompt

NEGATIVE:
- Do not introduce a serif or rounded typeface anywhere
- Do not use sharp/square corners on any card or button
- Do not add a second brand accent color to CTAs
- Do not skip the loader overlay or the smooth-scroll wrapper — both are structural, not optional polish
~~~~

### Header glass sticky (um único estado)

~~~~
Build the sticky HEADER for the Apple Bottle Pro landing page.

═══════════════════════════════════════
LAYOUT
═══════════════════════════════════════
- position: sticky; top: 0; fixed low height (~48px), full width, single row, content constrained to a max-width wrapper with generous horizontal padding.
- Left: the wordmark, single line, semibold, tight tracking, small size (~19px).
- Right: a horizontal nav list (3-4 short links, tiny size ~12px, ~70% opacity ink, full opacity on hover) immediately followed by a solid pill button (var(--radius-pill), var(--accent) background, white text, small size ~12px, modest padding) with a short CTA label.
- No center zone/logo mark — just left wordmark, right nav+CTA, space-between.

═══════════════════════════════════════
VISUAL TREATMENT (single state, never changes)
═══════════════════════════════════════
- Background: translucent near-white (~80% opacity) with a strong backdrop blur (~20px) and saturation boost, so content scrolling underneath is always softly visible through it.
- A 1px bottom hairline border at ~60% opacity of the border-gray token.
- This header does NOT switch between a transparent and solid state like a typical hero-overlay header — it is the same glass treatment at all scroll positions, including over the video hero.

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] Sticky, constant ~48px height, never grows/shrinks
[ ] Glass/blur background identical at scroll position 0 and at the bottom of the page
[ ] Nav links small and subdued, CTA pill always solid accent-blue
[ ] Hairline bottom border visible at all times

NEGATIVE:
- Do not add a transparent-then-solid scroll transition — this header has exactly one visual state
- Do not make the CTA pill sharp-cornered
- Do not increase the header height on mobile — keep the same compact bar, collapse nav items instead
~~~~

### Hero com vídeo full-bleed (100vh, conteúdo no rodapé)

~~~~
Build the HERO fold — full viewport height (100vh), sitting directly under the sticky header (the header overlays it transparently-through-blur, no extra top padding needed).

═══════════════════════════════════════
BACKGROUND MEDIA
═══════════════════════════════════════
- A single full-bleed looping muted video, object-fit: cover, absolute, filling the entire section, at ~90% opacity with a very subtle white gradient overlay (diagonal, top-right to bottom-left, low opacity) laid on top for contrast grounding — not a heavy dark scrim.
- White background-color fallback behind the video (prevents flash before decode).

═══════════════════════════════════════
CONTENT (positioned near the bottom of the section, not vertically centered)
═══════════════════════════════════════
Content sits roughly 9rem/144px up from the bottom edge, in a row on desktop (stacks on mobile), split into two independent blocks:
- LEFT block (max-width ~40-42rem): a small bold eyebrow line (product name, ~17px semibold) above a large multi-line headline (clamp ~2.25rem mobile to ~3.5rem desktop, semibold, tight tracking, tight leading ~1.08), then a medium-weight muted subtitle line below it (~19px, secondary gray).
- RIGHT block: a compact pill-shaped price card — translucent light-gray/blur background, rounded-full, price text on the left (small, semibold, dark) and a solid accent-blue "buy" pill button on the right, both inside the same outer capsule with generous left padding and a tight 6px gap between the price and the inner button.

═══════════════════════════════════════
BEHAVIOR
═══════════════════════════════════════
- Video autoplays muted/looped/inline on load; no visible native controls.
- Content may play a gentle on-load fade/rise (no scroll dependency).
- No headline/price content should ever sit under the sticky header — with bottom-anchored positioning this is naturally avoided.

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] Section exactly 100vh, video fills it with no gaps
[ ] Content anchored near the bottom, not centered vertically
[ ] Left block: eyebrow + big headline + muted subtitle, stacked
[ ] Right block: pill price-card with an inner solid CTA pill
[ ] Overlay is a subtle gradient, not a heavy dark scrim

NEGATIVE:
- Do not vertically center the hero content — it must read as bottom-anchored
- Do not darken the video so much that it looks like a dark hero — this stays light/bright
- Do not make the price-card square-cornered — it's a full pill shape
~~~~

### Environment Gallery (3 icon-cards com botão +)

~~~~
Build the ENVIRONMENT GALLERY section — background var(--stone-100), generous vertical padding (~7rem), top hairline border.

═══════════════════════════════════════
HEADER ROW
═══════════════════════════════════════
- A large headline (~2.5-3rem, semibold, tight tracking) left-aligned, followed immediately below by a small text link in var(--accent) (not the blue CTA — a slightly different link-blue is fine) with a trailing chevron icon that nudges right on hover.

═══════════════════════════════════════
CARD GRID
═══════════════════════════════════════
- 3 columns on desktop (stack to 1 on mobile), each card: aspect-ratio ~1.38:1, var(--radius-card), white background, soft shadow that deepens slightly on hover, generous padding (~2rem), flex column with content pushed to justify-between.
- Inside each card: a colored icon (no background chip, just a large ~36px icon glyph in one of the three accent hues — purple/orange/teal, one distinct hue per card) at the top, and a headline (~1.4rem, semibold, tight leading) at the bottom where ONE short phrase inside the headline is colored to match that card's icon hue and made bold, while the rest of the headline stays var(--stone-900).
- A small circular dark "+" button (var(--stone-900) background, white plus icon, ~36px) sits absolutely positioned in the bottom-right corner of each card, slightly overlapping the card's own padding, scaling up slightly on hover (this opens more info — a simple hover/scale affordance is enough, a full modal is optional).

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] 3-up grid of large rounded cards, consistent aspect ratio
[ ] Each card has a distinct colored icon + one matching-color highlighted phrase in its headline
[ ] Circular dark "+" button bottom-right of every card
[ ] Header row: big headline + small colored link with chevron

NEGATIVE:
- Do not use the same accent hue on more than one card
- Do not let the "+" button color match the card's icon color — it is always dark/near-black
- Do not square off the card corners
~~~~

### Hidratação Personalizada (painel imersivo 160vh, sem pin/scrub)

~~~~
Build the PERSONALIZED HYDRATION section — a tall immersive panel, height: 160vh, position: relative, overflow: hidden, background var(--stone-100) as fallback.

═══════════════════════════════════════
LAYERS (back to front)
═══════════════════════════════════════
1. Full-cover photographic background image, absolute, top:0, width:100%, height:115% (slightly taller than the section so it never shows an edge), object-fit: cover, object-position: center bottom.
2. A radial vignette overlay: mostly transparent in the upper-middle area, fading to near-white toward the edges/bottom (ellipse gradient, transparent at ~25%, ~55% white at 65%, ~92% white at 100%) — this is what fades the photograph into the page's white/light-gray palette.
3. A bottom linear fade-to-white gradient covering roughly the last quarter of the section height, for a clean handoff into the next section.
4. Purely decorative floating "frost" particles: 5-6 small soft-blurred white dots scattered at different top/left positions, each with its own gentle floating keyframe animation (translateY/translateX drift + opacity pulse, 7-13s loops, staggered delays).
5. A couple of large soft color-tinted blurred circles (very pale blue tones, ~150-300px, heavy blur ~30-40px) slowly drifting/scaling in place (12-15s loops) for subtle atmospheric refraction.

═══════════════════════════════════════
CONTENT (two zones)
═══════════════════════════════════════
- Top zone (first ~55vh of the section, content flex-aligned to flex-start / top): a centered text block — small semibold eyebrow label, then a large (clamp ~2.25rem to ~4.5rem) semibold headline of 1-2 short lines, then a short muted paragraph below (max-width ~36rem).
- Bottom zone (remaining ~105vh, content flex-aligned to the bottom): a row of 3 frosted glass stat-cards (var(--radius-card), translucent white ~70% + backdrop-blur, thin white/40% border, soft shadow) — each card has a small dark circular icon badge + a big counted-up number with its unit, a bold short title, and a short muted description.

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] Section is exactly 160vh, no scroll-jacking/pin — it just scrolls past normally
[ ] Background image + vignette + bottom fade create a smooth photo→white transition
[ ] Decorative frost particles and color blobs animate continuously and independently
[ ] Top zone: eyebrow + headline + paragraph, centered, sits in the section's first half
[ ] Bottom zone: exactly 3 frosted-glass stat cards in a row, each with counting number + icon badge

NEGATIVE:
- Do not pin/scrub this section to scroll — it is a normal tall section, not a scrollytelling zone
- Do not make the frosted stat cards opaque — they must show blur/translucency
- Do not skip the vignette/fade layers — without them the photo won't blend into the page
~~~~

### Vídeo full-bleed com cabeçalho acima

~~~~
Build the INTERACTIVE VIDEO section — background var(--stone-100).

═══════════════════════════════════════
LAYOUT
═══════════════════════════════════════
- A centered text header sitting entirely above the video (generous top/bottom padding, ~6-7rem top, ~3-4rem bottom): a small semibold eyebrow label, then a large (clamp ~2.25rem to ~3.75rem) semibold headline, both centered, max content width constrained.
- Directly below: a full-bleed video block, tall (~70-80vh on desktop), width 100%, video absolutely filling it with object-fit: cover, muted/looped/autoplay, no visible controls.

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] Header text never overlaps the video — it sits in its own space above it
[ ] Video is full-bleed width, tall, object-fit cover, no letterboxing
[ ] Eyebrow + headline both centered

NEGATIVE:
- Do not overlay text on top of the video in this section — that treatment belongs to the Hero, not here
- Do not add a dark scrim over the video — it should read clean/bright

~~~~

### Hardware Metrics (números gigantes com count-up)

~~~~
Build the HARDWARE METRICS section — background var(--stone-100), top hairline border, generous vertical padding (~6rem).

═══════════════════════════════════════
LAYOUT
═══════════════════════════════════════
- 2-column grid on desktop (1 column on mobile), 4 metric blocks total, generous gap between columns (~6rem) and rows (~5rem).
- Each block, top to bottom: a small semibold muted label ("Até"-style qualifier), then a huge number+unit line (clamp ~4.5rem to ~6rem, semibold, tight tracking, tabular-nums so digits don't jitter while counting), then a short muted description paragraph, then a full-width 1px hairline divider, then a short comparison sentence where the key figure is bold/dark and the rest stays muted.

═══════════════════════════════════════
BEHAVIOR
═══════════════════════════════════════
- The big number counts up from 0 to its target value once the block enters the viewport (reuse the same counter mechanic as the Hydration section's stat cards).

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] 2x2 grid of metric blocks (2 columns, stacks to 1 on mobile)
[ ] Each block: small label → huge counted number → description → hairline → comparison line
[ ] Numbers use tabular-nums and count up on scroll-into-view

NEGATIVE:
- Do not center-align the metric blocks — everything is left-aligned within its column
- Do not omit the hairline divider — it's what separates the headline number from the comparison line

~~~~

### Fitness Integration (foto à direita + coluna de texto à esquerda)

~~~~
Build the FITNESS INTEGRATION section — height ~90vh (min-height ~700px), background var(--stone-100), content vertically centered.

═══════════════════════════════════════
LAYOUT
═══════════════════════════════════════
- A full-bleed photographic background image, absolute, object-fit: cover, positioned toward the right side of the frame (object-position right-ish) so the right ~55% of the frame shows the photo's subject while the left side stays relatively open for text contrast.
- A content column constrained to ~45% width on desktop (full width on mobile), left-aligned, containing two stacked text blocks with a large gap (~3rem) between them:
 1. A longer paragraph (medium weight, muted-to-dark mixed — the product/feature name in dark bold at the start, rest in muted gray) describing health-app integration.
 2. A small dark circular icon badge (~32px) above a bold small headline and a muted paragraph below it, describing a durability/water-resistance rating.

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] Background photo anchored right, text column constrained left at ~45% width
[ ] Two text blocks stacked with a large gap, second one has an icon badge above it
[ ] Section height ~90vh, content vertically centered within it

NEGATIVE:
- Do not stretch the text column to full width on desktop — it must stay narrow/left-anchored so the photo has room to breathe
- Do not center-align the text blocks — everything left-aligned

~~~~

### Galeria snap-scroll (cards 2:3 + setas)

~~~~
Build the HEALTH & HYDRATION GALLERY section — background white, top hairline border, generous vertical padding (~6rem).

═══════════════════════════════════════
HEADER ROW
═══════════════════════════════════════
- A large headline (~2.5-3rem, semibold) followed by a small colored text link with a trailing chevron (same treatment as the Environment Gallery's link).

═══════════════════════════════════════
GALLERY TRACK
═══════════════════════════════════════
- A horizontally scrollable row (native overflow-x scroll with scroll-snap-type: x mandatory, hidden scrollbar), 4 tall cards, each scroll-snap-align: start, fixed width per breakpoint (roughly 220px mobile up to ~340px desktop), aspect-ratio 2:3.
- Each card: the image fills the card (var(--radius-card), object-fit cover, subtle scale-up on hover ~1.05 over ~0.7s), with NO text inside the image — the caption sits BELOW the card instead: a short paragraph where the first few words are bold/dark ("lead-in" phrase) and the rest is muted gray, small size (~13-14px).
- Cards sit edge-to-edge with a consistent gap (~2rem) and the row's left padding aligns with the page's content gutter (align the first card exactly under the headline above).

═══════════════════════════════════════
NAVIGATION
═══════════════════════════════════════
- Two small round buttons (~36px, light-gray fill, dark chevron icon) bottom-right of the gallery, right-aligned to the same content gutter as the headline — clicking them programmatically scrolls the track by roughly one card-width, smooth behavior. Buttons dim/disable at either end if not looping.

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] Horizontal snap-scroll track, 4 tall (2:3) image cards, hidden scrollbar
[ ] Caption sits below each card (bold lead-in + muted rest), never overlaid on the image
[ ] Round prev/next buttons bottom-right, disabled state at the ends
[ ] First card aligns with the headline's left edge; last card can partially bleed to signal more content

NEGATIVE:
- Do not overlay caption text on top of the images — captions live below each card
- Do not make the scrollbar visible
- Do not use the same card width at every breakpoint — it should shrink on mobile
~~~~

### Footer (legal + diretório + copyright)

~~~~
Build the FOOTER — background var(--stone-100), muted text color throughout, content constrained to a narrower max-width than the rest of the page (~980px, centered), everything in very small type (~12px).

═══════════════════════════════════════
BLOCK 1 — Legal footnotes
═══════════════════════════════════════
- A short stack of numbered footnote paragraphs (tiny, ~12px, extra-muted gray, relaxed line-height) explaining conditions/limitations behind the claims made higher up the page (battery life varies with usage, thermal preservation tested under lab conditions, max/min temperature ratings, purification is not a substitute for water treatment, etc. — invent short factual-sounding disclaimers matching whatever numbered claims exist earlier on the page).
- A bottom hairline border closes this block.

═══════════════════════════════════════
BLOCK 2 — Link directory
═══════════════════════════════════════
- A 4-column grid (2 columns on mobile), each column: a small bold dark heading (~12px) followed by a short vertical list of muted text links (~12px, underline on hover only).
- Suggested column themes: product/buy links, feature/resource links, support links, company/about links — 3 links per column is enough.
- A bottom hairline border closes this block.

═══════════════════════════════════════
BLOCK 3 — Copyright bar
═══════════════════════════════════════
- A single row, space-between on desktop (stacks on mobile): a copyright line with the brand name and year on the left, and on the right a small inline group of legal links separated by thin vertical dividers, ending with a country/region label.

═══════════════════════════════════════
ACCEPTANCE CHECKLIST
═══════════════════════════════════════
[ ] Three stacked blocks separated by hairlines, all in ~12px type
[ ] Footer content narrower than the rest of the page's max-width
[ ] 4-column link directory with bold small headings
[ ] Copyright bar: brand+year left, legal links + region right

NEGATIVE:
- Do not use a font size larger than ~12-13px anywhere in the footer
- Do not widen the footer content to the same max-width as the rest of the page — it stays narrower

~~~~

### Auditoria do design system (rodar por último)

~~~~
Audit and adjust the ENTIRE page so it complies with the tokens and behaviors defined across the previous prompts in this material. Goal: remove any remaining drift between sections, radius/color rules, and the shared components (CTA pill, counted-number stat cards, feature-card pattern). Surgical fixes only — do not invent a new visual language.

═══════════════════════════════════════
TOKENS THAT MUST MATCH
═══════════════════════════════════════
--stone-50 #fbfbfd · --stone-100 #f5f5f7 · --stone-150 #e8e8ed · --stone-200 #d2d2d7
--stone-500 #6e6e73 · --stone-900 #1d1d1f · --accent #0071e3 (the only CTA/link color)
Icon-badge accents (feature icons only, never on CTAs): purple #8431e5, orange #f36011, teal #009baf
--radius-card 28px (every big card) · --radius-pill 999px (every button/pill)
Font: SF Pro system stack, semibold/600 weight headlines, tight tracking, used for everything (no secondary display face)

═══════════════════════════════════════
PAGE ORDER TO VERIFY
═══════════════════════════════════════
Header (glass, single state) → Hero (100vh video, bottom-anchored) → Environment Gallery (3 colored icon-cards) → Personalized Hydration (160vh immersive) → Interactive Video → Hardware Metrics (2x2 counted numbers) → Fitness Integration (right photo + left text) → Health & Hydration Gallery (snap-scroll) → Specifications (dark-icon grid + spec table) → Footer

═══════════════════════════════════════
CROSS-SECTION CONSISTENCY CHECKS
═══════════════════════════════════════
[ ] Header keeps its single glass state everywhere — never switches to solid/opaque
[ ] Every CTA/button/link uses var(--accent) blue; icon-badge accent hues never appear on a button
[ ] Every big card (feature, stat, gallery) uses exactly --radius-card; every button/pill uses exactly --radius-pill — no third radius anywhere
[ ] All counted-number stats (Hydration cards + Hardware Metrics) animate identically (count-up on viewport entry, tabular-nums)
[ ] The Environment Gallery's colored icons/highlight-phrases and the Specifications grid's dark-only icons are not mixed up
[ ] Sticky header never overlaps content — check the Hero's bottom-anchored content especially
[ ] Footer type stays consistently small (~12px) and narrower max-width than the rest of the page

═══════════════════════════════════════
DELIVERABLES
═══════════════════════════════════════
1. Patch only the non-compliant spots found above
2. Short changelog: fixed vs. already correct
3. Prefer surgical CSS/JS edits over a full rewrite of any section

NEGATIVE:
- Do not introduce a second CTA color
- Do not mix --radius-card and --radius-pill on the same element type
- Do not let icon-badge accent colors appear outside their designated cards
~~~~

