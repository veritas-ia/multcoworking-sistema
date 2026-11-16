# Prompts e configurações de vídeo (verbatim dos materiais e ditados nas aulas)

Legenda: **[material]** = copiado da página de materiais; **[aula]** = dito pelo professor (transcrição de áudio, redação aproximada).

Ferramenta de vídeo usada nos 3 projetos: **Google Flow** com o modelo "Veo 3.1" (o áudio diz "VEL 3.1"/"VL3"; a grafia é provavelmente Veo, confirmar). Variações citadas: Quality, Fast e Lite. Conforme o curso (nov/2026); nomes de modelos e menus mudam.

## Configurações do Google Flow usadas (por projeto)

| Projeto | Modo | Modelo | Proporção | Observação |
|---|---|---|---|---|
| Apple Bottle, hero | Vídeo > **Frames** (frame inicial = garrafa, final = atleta) | Veo 3.1 Quality; refez com Fast | 16:9, 1 geração | 1ª tentativa errou a logo; refez com Fast e aceitou. "O vídeo é sempre 100% aleatório"; repetir o mesmo prompt até agradar |
| Apple Bottle, tela da tampa | Frames (inicial = visor desligado, final = visor ligado) | Veo 3 Lite | 16:9 | Cortou o fim do vídeo (a tela desligava de novo) |
| Venezianico, intro | Vídeo > **Frames** (inicial = imagem 1, final = relógio no fundo galáctico) | Veo 3 Quality | 16:9 | Gerou 2 opções e baixou em 1080p |
| Valentino, vídeo que expande | Vídeo > **Elementos** (só imagem de referência, sem frame inicial/final) | Veo 3.1 Fast | 16:9 | "Não há necessidade do Quality" |
| Valentino, loop 9:16 | Elementos + imagem de referência | (Veo) | 9:16, ~8 s | Gerou **4 vídeos de uma vez** e escolheu; juntou 3 em sequência |

Passos gerais: (1) pedir ao GPT um prompt de vídeo anexando as imagens; (2) colar no Flow; (3) anexar os frames/imagem de referência; (4) gerar; (5) baixar na maior qualidade (1080p citado); (6) renomear curto (ex.: `hero.mp4`) e colocar em `src/assets/videos`.

## Prompts que o professor pediu ao GPT (para gerar o prompt de vídeo) [aula]

**Apple, vídeo da hero (frame inicial + final), anexando as duas imagens:**
> Gere para mim um prompt perfeito para qualquer IA criar um vídeo usando o frame inicial e frame final numa primeira dobra de um site. O vídeo deve ser profissional, nível Apple, e preparado e pensado para ser usado em um efeito de Scroll Scrub.

**Apple, tela da tampa ligando (anexando as 2 imagens):**
> Preciso de um prompt para uma IA gerar um vídeo dessa tela da garrafa ligando. Ao ligar deve ocorrer uma animação bem interessante no estilo Siri da Apple e mostrar a interface final da tela.

**Valentino, vídeo base (anexando a imagem do anúncio gerado):**
> Preciso de um prompt para gerar um vídeo ultra realista para esse perfume. O que tu colocaria nesse prompt?

**Valentino, vídeo vertical em loop:**
> Cria para mim um prompt profissional de vídeo para esse perfume. Quero que a proporção seja 9x16, uns 8 segundos, estilo comercial de luxo bem cinematográfico. Roxo e preto vão ser as cores predominantes. Quero pelo menos 5 cenas com cortes secos. Mostra as frutas roxas, madeira escura, detalhes macro do vidro, logo, tampa, e termina com o perfume inteiro. O frasco não pode mudar de formato, nem o logo. Sem pessoas, quero câmera e iluminação bem premium. Faz o prompt bem detalhado e preparado para a IA de vídeo.

(Os textos gerados pelo GPT nas aulas não aparecem nos materiais; os dois prompts longos abaixo são os "validados" do material.)

---

## Venezianico: vídeo da intro, "Luxury cinematic product video" [material]

Salvar como `assets/relogio-espacial.mp4`, 1080p+, sujeito centralizado (o site corta com object-fit: cover). Usa imagens de referência como frame inicial e final.

~~~~
Create a premium cinematic luxury product video using the provided reference images as strict visual anchors. The video must preserve the exact same watch and the exact same visual identity shown in the references. The watch design, proportions, materials, colors, reflections, finishes, and minimal dial layout must remain completely unchanged throughout the entire video.

The watch must be reproduced with extreme fidelity and must match the reference product exactly. It is an ultra-minimal luxury dress watch with a clean, refined, sophisticated, and celestial aesthetic. The case is round, slim, elegant, and polished stainless steel or polished silver-tone metal, with smooth sculpted lugs and a highly reflective mirror-like finish. The crystal is a prominent domed crystal with a smooth curved profile, giving the watch a refined, elevated, almost glass-bubble appearance. The crown is positioned at 3 o’clock, medium-sized, fluted, metallic, and elegant, matching the case finish.

The dial is extremely minimal and must remain exactly like the reference. It has NO numerals, NO hour markers, NO minute track, NO indices, and NO complications. The dial contains only the hands and a very small logo near the 12 o’clock position. Nothing else should be added to the dial. The dial surface is a deep midnight blue / dark navy celestial texture, resembling a starry night sky or aventurine-like sparkle finish, with very fine subtle speckled star-like particles distributed across the surface. The dial must feel cosmic, elegant, deep, and luxurious, but still minimal and clean. The logo near 12 o’clock is very small, bright, refined, and isolated, with no surrounding text. Preserve this exact minimalist balance.

The watch hands must remain exactly the same: slim, sharp, polished silver dauphine-style or faceted pointed hands, highly refined and elegant, with a clean central seconds hand. The hands are minimalist and sophisticated, with no lume, no oversized shapes, and no redesign. Their proportions, polishing, angles, and placement must remain faithful to the reference.

The strap must remain exactly the same as the reference: a dark navy blue leather strap with a smooth, clean, premium finish and subtle natural leather grain. The leather should look soft, refined, elegant, and luxurious, not sporty or rugged. The strap is slim to medium in width, understated, and perfectly matched to the dress-watch aesthetic. Preserve its exact color tone, thickness, curvature, and texture. Do not change the strap material, color, stitching style, or shape.

The overall style of the watch is premium, elegant, quiet luxury, minimal, celestial, and high-end. It should feel like a refined luxury watch inspired by the night sky, with a strong sense of restraint and sophistication. The product must not become more complex, more technical, more sporty, or more decorative than it already is.

The video must begin by following the provided starting reference frame with very high fidelity, and end by matching the provided final reference frame with very high fidelity. If additional reference frames are provided, use them as intermediate visual anchors to guide the motion and preserve consistency. The animation should feel like a seamless cinematic transition between these exact views of the same watch. The watch must stay physically consistent at every moment.

The background must remain in the same visual universe as the references: a dark cosmic / galactic environment with elegant swirling star trails, deep black and navy tones, subtle spatial depth, refined particles, and a premium celestial atmosphere. The background should feel luxurious and immersive, like a high-end galaxy vortex, but it must never overpower the watch. It should support the product, not distract from it. Keep the same sophisticated dark-space mood shown in the reference images.

The watch is the only hero object in the video. No additional products, no people, no hands, no accessories, and no foreground objects are allowed. Only the watch and the cosmic background should appear.

The camera motion must be smooth, slow, cinematic, and precise. The watch should appear to float in space with elegant controlled movement. The video may include subtle orbiting camera motion, gentle product rotation, close-up reveals of the domed crystal, polished case edges, the slim crown, the celestial dial texture, and the navy leather strap. Reflections across the crystal and polished metal should be subtle, realistic, premium, and controlled. The product must feel expensive, timeless, and visually striking.

The video should preserve the exact same luxury aesthetic shown in the references:
- ultra-minimal dial
- no markers or numerals
- only hands and a small logo on the dial
- deep starry blue dial texture
- polished silver-tone round case
- domed crystal
- elegant fluted crown
- dark navy leather strap with subtle grain
- clean, sophisticated, quiet-luxury styling
- no design alterations of any kind

The initial frame must be matched as closely as possible to the first reference image. The final frame must be matched as closely as possible to the last reference image. The watch identity must remain exactly the same across the entire sequence.

The final result should feel like a luxury watch commercial set inside a premium galactic universe: elegant, atmospheric, visually impactful, realistic, polished, minimal, and expensive.

NEGATIVE PROMPT: do not modify the watch, do not redesign the product, do not change the case shape, do not change the lugs, do not change the crown, do not change the domed crystal, do not change the strap color, do not change the strap material, do not change the strap thickness, do not add stitching details that are not present, do not change the dial color, do not change the dial texture, do not remove the celestial sparkle effect, do not add numerals, do not add hour markers, do not add minute markers, do not add complications, do not add date window, do not add subdials, do not add text, do not add branding text, do not add extra logos, do not alter the hands, do not change the hand shape, do not distort the watch, do not stretch the watch, do not warp the watch, do not alter proportions, do not add a bezel design that is not present, do not make it sporty, do not make it rugged, do not make it futuristic-tech, do not make it bulky, do not add extra objects, do not add people, do not add hands holding the watch, do not add planets in the foreground, do not add spaceships, do not add smoke, do not add fire, do not add explosions, do not add typography, do not add subtitles, do not add interface elements, do not add watermarks, do not duplicate the watch, do not create multiple watches, do not change the background identity into something colorful or chaotic, do not use shaky camera, do not use chaotic motion, do not use low quality rendering, do not make it cartoonish, do not make it stylized, do not lose fidelity to the initial frame, do not lose fidelity to the final frame.

═══════════════════════════════════════
~~~~

Entrega indicada no material: "Export as MP4 1080p (or higher), cinematic 16:9 or 9:16 only if references demand — the site uses object-fit:cover in a 100vh stage, so keep subject centered."

---

## Valentino: comercial cinematográfico 16:9 (macro 100mm, rack focus) [material]

Uso: imagem do anúncio gerado como "exact visual reference and opening frame". No site, esse vídeo alimenta a dobra de vídeo que expande no scroll (convertido em frames; ver `site-parallax-gsap-ia/references/receitas-efeitos.md`).

~~~~
Use the provided image as the exact visual reference and opening frame.

Create an **ultra-realistic cinematic luxury perfume commercial** featuring the Valentino perfume bottle as the unquestionable hero of the scene.

Preserve the perfume bottle **exactly as shown in the reference image**: identical shape, proportions, faceted glass texture, dark metallic cap, studs, black label and VALENTINO typography. Do not redesign, warp, replace or alter any part of the bottle.

The environment is dark, mysterious, sensual and sophisticated, dominated by **deep black, plum, blackberry and violet tones**. Surrounding the perfume are ripe dark-purple grapes, blackberries, sliced figs and sculptural twisted black wood, all covered with subtle condensation.

### CAMERA MOVEMENT

Begin with an extremely slow cinematic push-in toward the perfume bottle.

The camera gently travels through the foreground vegetation and fruit, creating natural parallax and a strong feeling of depth.

Use a **100mm macro cinema lens look**, very shallow depth of field and smooth focus breathing.

The foreground starts slightly out of focus while the perfume bottle remains perfectly sharp.

Gradually perform a subtle rack focus from a wet blackberry and sliced fig in the foreground toward the Valentino bottle.

The camera continues moving closer until the perfume dominates the composition.

### ENVIRONMENTAL MOTION

Everything must move very subtly and realistically.

Tiny droplets of condensation slowly travel across the grapes and figs.

A delicate dark-purple atmospheric mist drifts behind the perfume.

Very fine floating particles occasionally catch the light.

The twisted wood remains almost completely still, with only microscopic environmental movement.

A few droplets slowly fall from the fruit and create tiny realistic splashes on the dark glossy surface below.

No exaggerated motion.

### LIGHTING

Premium luxury fragrance advertising lighting.

The scene is mostly dark with dramatic controlled highlights.

A soft moving **violet rim light** slowly travels across the edges of the bottle, revealing the geometric studs and glass texture.

Subtle purple reflections travel naturally through the transparent glass.

A faint warm champagne-colored highlight briefly touches the metallic collar and cap, contrasting against the purple environment.

The VALENTINO logo stays clearly readable.

The lighting should feel physical, expensive and carefully designed inside a professional photography studio.

### HERO MOMENT

As the camera approaches the bottle, a subtle pulse of violet light appears behind it.

The glass catches the light and produces beautiful realistic refractions.

A delicate cloud of perfume mist passes behind the bottle, illuminated by the purple backlight.

The surrounding grapes, blackberry and fig acquire small sparkling highlights from their moisture.

End on a perfectly composed **luxury product hero shot**, with the Valentino perfume completely sharp in the center and the background fading into rich black and violet bokeh.

### VISUAL STYLE

Ultra photorealistic.
High-end fragrance commercial. 
Luxury fashion campaign.
Dark editorial photography.
Physical studio lighting.
Realistic glass refraction.
Realistic metallic reflections.
Natural fruit textures.
Micro condensation.
Volumetric atmospheric lighting.
Deep blacks.
Rich violet highlights.
Subtle film grain.
High dynamic range.
Cinematic contrast.
Extremely detailed textures.
Premium commercial cinematography.
4K.
24fps.
Natural motion blur.

The final result should feel like a **real Valentino fragrance campaign filmed with a professional cinema camera**, not CGI and not AI-generated.

### IMPORTANT CONSTRAINTS

Do not distort the perfume bottle.
Do not change the bottle design.
Do not change the Valentino logo or typography.
Do not create additional bottles.
Do not make the bottle float.
Do not make fruits float.
Do not use fast camera movements.
Do not create unrealistic liquid physics.
Do not make the environment excessively animated.
Do not introduce people or hands.
Do not add text, captions or graphic overlays.
Avoid flickering.
Avoid morphing.
Avoid label deformation.
Avoid object duplication.
Avoid artificial-looking reflections.
Avoid plastic-looking fruit.
Avoid cartoonish or fantasy visuals.

**Mood:** seductive, mysterious, masculine, nocturnal, sophisticated, expensive, sensual and exclusive.

**Pacing:** extremely slow, controlled and hypnotic, like a premium 8–10 second perfume commercial.
~~~~

---

## Valentino: vídeo vertical 9:16, 8 s, 5 cenas com cortes secos [material]

Uso: dobra final de 45vh em loop. Cenas: 1 macro de frutas/madeira, 2 macro do vidro, 3 foco no logo, 4 destaque da tampa, 5 hero shot final. Frasco igual em todas as cenas.

~~~~
**Use a imagem do perfume como referência principal do produto.**
Crie um vídeo **vertical 9:16**, com **8 segundos de duração**, estética de **comercial de luxo ultracinematográfico**, extremamente **premium, sofisticado e fotorealista**, com paleta dominada por **roxo profundo, ameixa, violeta escuro e preto**, sem pessoas.

## Prompt

Gerar um **vídeo publicitário de perfume de luxo** em formato **9:16**, com **8 segundos**, visual **ultrarrealista**, linguagem de **fragrance commercial premium**, atmosfera elegante, sensual e sofisticada.

O produto principal é o **frasco de perfume Valentino** da imagem de referência.
**O frasco deve permanecer rigorosamente igual durante todo o vídeo**:

* mesmo **formato do vidro**
* mesma **silhueta**
* mesma **tampa**
* mesmo **logo/rotulagem “VALENTINO”**
* mesma **proporção do frasco**
* mesma **identidade visual**

**Não alterar o design do frasco em hipótese alguma.**
**Não distorcer, não redesenhar, não trocar o logo, não mudar o formato da tampa, não mudar a geometria do vidro.**

### Direção visual

Estética de campanha de perfume de alto padrão, com clima noturno e luxuoso.
Ambiente rico em **tons roxos e pretos**, com:

* **frutas roxas** realistas (uvas roxas, figos, amoras, ameixas)
* **madeira escura** elegante e texturizada
* superfície levemente molhada com reflexos sofisticados
* fumaça suave / névoa discreta no fundo
* brilhos controlados e reflexos refinados no vidro
* sensação editorial, premium e cinematográfica

### Estrutura do vídeo — mínimo 5 cenas, com cortes secos

O vídeo deve ter **pelo menos 5 cenas**, com **cortes secos** entre elas (**sem fade, sem dissolvência, sem transições suaves**).

#### Cena 1 — Macro atmosfera de abertura

Macro cinematográfico de frutas roxas e madeira escura molhada.
Close extremo em gotas de condensação sobre uvas e figos.
Luz roxa e preta com reflexos elegantes.
A câmera faz um movimento sutil e controlado, revelando textura, umidade e luxo.

#### Cena 2 — Macro do vidro

Corte seco para um **close extremo do vidro do frasco**, mostrando a textura facetada/cravejada.
Destacar refração, brilho, transparência e profundidade do material.
A câmera deve deslizar lateralmente ou fazer um micro push-in premium.
Mostrar reflexos roxos sofisticados no vidro.

#### Cena 3 — Foco no logo

Corte seco para um enquadramento fechado do rótulo frontal.
O texto **“VALENTINO”** deve aparecer **nítido, legível e fiel**.
A iluminação deve valorizar o logo com elegância, sem estourar highlights.
O fundo permanece escuro, roxo e luxuoso.

#### Cena 4 — Destaque da tampa e do topo

Corte seco para close premium da **tampa** e do topo do frasco.
Mostrar a tampa com aparência sólida, refinada e luxuosa.
Pode haver leve giro de câmera ou mudança de foco entre tampa e gargalo.
Ressaltar materiais, acabamento, contraste entre preto e roxo.

#### Cena 5 — Hero shot final

Corte seco para a cena final com o **perfume inteiro em destaque**, centralizado e dominante.
O frasco aparece completo, elegante, impecável, rodeado por **frutas roxas**, **madeira escura** e reflexos premium.
Atmosfera sofisticada, com névoa suave e luz volumétrica discreta.
Encerrar com o perfume como **hero product shot**, forte presença visual e acabamento de campanha de luxo.

### Câmera

Cinematografia de altíssimo nível, típica de comercial de perfume premium.

Usar sensação de câmera real com:

* lente macro para detalhes extremos
* lente de retrato / produto para hero shot
* movimentos suaves, lentos e precisos
* micro dolly
* push-in elegante
* rack focus refinado
* profundidade de campo rasa
* bokeh natural
* motion blur realista
* composição sofisticada e editorial

### Iluminação

Iluminação extremamente premium, com look de estúdio de luxo:

* key light suave e controlada
* rim light violeta sutil para desenhar o frasco
* reflexos elegantes no vidro
* highlights controlados
* sombras profundas e ricas
* luz volumétrica discreta
* contraste cinematográfico
* ambientação roxa e preta, sem neon exagerado

### Textura e realismo

O resultado deve parecer uma produção real de alto orçamento:

* vidro ultrarrealista
* refração fisicamente plausível
* condensação e gotas realistas
* frutas com textura natural
* madeira escura com textura rica
* fumaça suave realista
* reflexos luxuosos
* acabamento de campanha de marca premium
* aparência fotográfica e cinematográfica, não ilustrativa

### Restrições importantes

* **Sem pessoas**
* **Sem mãos**
* **Sem modelos**
* **Sem mudar o frasco**
* **Sem mudar o logo**
* **Sem deformar a tampa**
* **Sem morphing**
* **Sem transições com fade**
* **Usar apenas cortes secos**
* **Não criar frascos extras**
* **Não inventar outro design**
* **Não distorcer o texto “VALENTINO”**
* **Não deixar o produto parecer CGI barato**
* **Evitar exageros artificiais, excesso de partículas ou surrealismo**

### Resultado esperado

Um vídeo vertical de **8 segundos**, com **5 ou mais cenas**, visual **ultrarrealista**, **luxuoso**, **cinematográfico**, com **tons roxos e pretos**, destacando **frutas roxas**, **madeira escura**, **detalhes macro do vidro**, **logo**, **tampa** e finalizando com o **frasco inteiro em hero shot**.
O resultado deve parecer um **comercial premium de perfume**, elegante, sofisticado e digno de campanha internacional de luxo.

## Instrução curta extra para colar junto, se a IA aceitar observações finais

**Reference the uploaded perfume image for exact bottle identity. Keep the bottle shape, cap and logo unchanged in every shot. 9:16, 8 seconds, at least 5 scenes, hard cuts only, no people, luxury cinematic perfume commercial, purple and black palette, ultra realistic, premium lighting, premium camera work.**

Design System & ShowcasePrompt 7 — Design System Showcase Builder (Dior / design-system.html)
~~~~

## Resultado real e como lidar (aula 6 do Valentino)

- Dos 4 vídeos, o frasco saiu deformado em alguns, o corte não era o desejado em outros, e em outro a tampa errou. O professor favoritou os bons, baixou 3 e **cortou trechos ruins** (finais) para montar a sequência. Ou seja: espere imperfeição no frasco/logo e planeje cortar/combinar.
- Para a Hero da Apple, a IA errou "um pouco a logo"; a solução foi regerar.
