# Prompts de imagem (verbatim dos materiais e ditados nas aulas)

Legenda de origem em cada bloco:
- **[material]** = texto copiado da página de materiais do curso (confiável, literal).
- **[aula]** = prompt dito em voz alta pelo professor; vem de transcrição de áudio (Whisper), então a redação é aproximada. Reescreva se precisar, mantendo a intenção.

Ferramentas de imagem citadas: "GPT" (ChatGPT com geração de imagem) em quase todas as aulas. O Gemini aparece só para dizer que, segundo o professor, não gera PNG com fundo transparente (conforme o curso, nov/2026). Nomes e capacidades das ferramentas mudam rápido; confirme no momento do uso.

---

## 1. Técnica-mãe: extrair estilo/cena em JSON e recriar com o seu produto

Funciona assim nos 4 projetos: (1) salvar a imagem de referência; (2) pedir ao GPT o JSON com todos os detalhes; (3) numa segunda mensagem, mandar o JSON + a foto do seu produto pedindo a troca.

**[aula] Apple Bottle (estilo artístico em JSON):**
> Extraia exatamente o estilo artístico dessa imagem. Me retorne em formato JSON, com o máximo de detalhes possível.

Depois, com a foto do atleta de referência + o JSON + a foto do produto:
> Recrie o atleta acima, seguindo os mesmos padrões visuais do JSON. E também substitua a garrafa do atleta pelo meu produto.

**[aula] Venezianico (cena em JSON, trocando só o relógio):**
> Extraia o Json exato dessa imagem. Com todos os detalhes da foto.

Depois, anexando a foto do relógio do projeto:
> Recrie uma imagem substituindo o relógio desse Json. Recrie a imagem do Json substituindo apenas o relógio por esse da imagem.

(O professor avisa: não peça "troque o objeto" direto; extrair o JSON primeiro e depois substituir deu melhor resultado.)

**[aula] Apple Bottle (casal de tenistas):**
> Extraia exatamente o visual dessa imagem em JSON. Após isso, adapte esse JSON. Mude as pessoas para dois atletas jogadores de tênis. Pode ser um casal, um homem e uma mulher. Os atletas devem estar felizes com roupas de tênis e segurando o meu produto.

(Anexar fotos de estúdio e fotos do produto na mesa. Depois: gerar a imagem passando o JSON adaptado com o comando de criar imagem.)

## 2. Prompts de correção que o professor usou (iteração com o GPT)

**[aula] Ajustar formato:**
- "Não mude o aspect ratio, deve permanecer em 16x9." (HP: personagem saiu 9:16 quando a original era landscape)
- Para elemento alto/PNG de pessoa: pedir "9x16, formato de Story" (Apple).
- Para fundo de vídeo: pedir 16:9 (Venezianico: "a IA não fez 16x9, pedi para trocar").

**[aula] Fundo transparente (Apple):**
> Remova o fundo da imagem. Ela deveria ser 100% transparente em PNG. Apenas o atleta deve ser visível.

Se o fundo vier errado (HP): reenviar mandando as duas referências de novo e repetindo o pedido de PNG 100% transparente.

**[aula] Estilo/iluminação ignorados (Apple):** a IA ignorou o JSON e deixou o atleta "muito iluminado". Correção em 2 passos:
1. Mandar a imagem boa + a imagem ruim: "Extraia o design artístico exato de iluminação dessas imagens." (resultado: JSON só de iluminação)
2. "Recrie o atleta acima seguindo os mesmos padrões visuais do JSON. Eu preciso que a imagem seja em 9x16. Que tenha um background transparente. E garanta que, de fato, a imagem saia no padrão do JSON [de iluminação]."

**[aula] Tampa removida (Apple, frame final do vídeo):**
> Gere o frame final de um vídeo que vai para a Hero. No frame final eu quero apenas um atleta bebendo água pela garrafa. Lembre-se de remover a tampa.

(Motivo: a IA tende a fazer o atleta beber pela tampa; especifique exatamente o que quer.)

**[aula] Produto novo a partir da foto (Apple, "tampa tecnológica"):**
> Gere para mim uma imagem da tampa como se ela fosse tecnológica. Imagine como a Apple faria a tampa de uma garrafa. Quero a visão top-down de estúdio dessa tampa tecnológica. Imagino que teria um visor touch aqui dentro.

Segunda imagem para ser o frame inicial do vídeo: "Me manda a mesma imagem, porém com o visor desligado."

**[aula] Imagem de elemento simples (Apple, círculo com a garrafa):** sem JSON, só: "modifique os textos para fazerem sentido em um produto de garrafa de água. E dentro do círculo coloque a minha garrafa." Imagem simples, sem fotorrealismo, não precisou de JSON.

**[aula] Prompt de estilo fotográfico a partir de print (Apple, hero):** print da área da foto de referência no site + pedido: "gere um prompt para a IA conseguir recriar uma foto nesse estilo com qualquer produto que eu enviar depois. Não precisa ser iPhone, quero apenas o estilo fotográfico." Depois colar o prompt gerado + a foto do produto, e pedir para mudar a proporção para widescreen.

---

## 3. Venezianico: camadas de parallax com textura lunar

Fluxo: salvar cada camada do parallax da referência (F12 > Application > Frames > Top > Images), mandar ao GPT com o prompt da camada, receber PNG com **fundo verde chroma key**, remover o verde (ver `pos-processamento.md`).

**[material] Instrução obrigatória (vai no início de todas as camadas):**

~~~~
Instrução obrigatória: preserve exatamente a composição original da imagem, sem alterar layout, enquadramento, proporção, perspectiva, recorte, escala, posição dos elementos ou profundidade. Não mover nada e não criar novos volumes. Altere apenas a aparência visual: materiais, texturas, cores e acabamento da paisagem. O cenário deve parecer um ambiente lunar / extraterrestre, completamente árido e mineral. Não pode existir grama, vegetação, árvores, folhas, musgo ou qualquer elemento terrestre verde. Toda área transparente deve ser preenchida com verde chroma key puro, forte, uniforme, sem gradiente e sem textura.

Após gerar cada camada: remova o chroma key verde e exporte PNG transparente como assets/1.png … assets/6.png (1 = frente / rochas, 6 = fundo / horizonte). No CSS do site as camadas recebem filter grayscale(100%) brightness(0.68) contrast(1.15).
~~~~

**[material] Prompt da camada 1 (pessoa no topo da rocha, frente).** Formato: anexar [imagem original] e [imagem de referência]; colar a instrução obrigatória acima e depois:

~~~~
Edite esta imagem preservando exatamente o mesmo layout, enquadramento, recorte, proporção, posição da montanha e escala dos elementos. Não altere nada na composição. Troque apenas a aparência da cena para que ela se torne um ambiente lunar / extraterrestre. A rocha deve parecer uma formação mineral da Lua, seca, áspera, craterada, empoeirada, sem qualquer traço de vegetação. Não pode haver grama, musgo, mato ou verde sobre as pedras. A superfície deve ter textura de poeira lunar, rocha vulcânica seca, pequenas crateras, erosão dura e material rochoso em tons de cinza, grafite, chumbo e cinza-claro. A pessoa no topo deve ser substituída por um astronauta, mantendo a mesma posição, escala e leitura visual geral. Onde houver transparência, preencher com verde chroma key bem vivo, puro, uniforme e sem textura.
~~~~

**[material] Camada 2 (rochas em primeiro plano):**

~~~~
Edite esta imagem sem mudar absolutamente nada da composição original. Preserve o mesmo enquadramento, os mesmos recortes, a mesma profundidade, a mesma posição das montanhas e a mesma escala dos relevos. Apenas transforme a aparência do ambiente em uma paisagem lunar / alienígena. Remova completamente qualquer sinal de vegetação, grama, árvores, arbustos ou solo terrestre. O cenário deve ser 100% árido e mineral, com pedras secas, poeira lunar, crateras sutis, rochas ásperas e relevo geológico extraterrestre. As superfícies devem ser rochosas e frias, com tons de cinza, grafite, cinza escuro, cinza-claro e areia acinzentada. Não usar verde natural em nenhuma parte da paisagem. As áreas transparentes devem ser preenchidas com verde chroma key puro, chapado, uniforme, sem gradiente e sem detalhes.
~~~~

**[material] Camada 3 (formações intermediárias):**

~~~~
Use esta imagem como base e preserve exatamente a composição original: mesmo recorte, mesmas proporções, mesma perspectiva, mesma profundidade e mesma posição de todos os elementos. Não alterar layout nem silhueta dos relevos. Apenas substitua a aparência da paisagem terrestre por um ambiente lunar / extraterrestre. Toda vegetação deve desaparecer completamente. Não pode haver grama, floresta, árvores, musgo ou qualquer elemento orgânico. O solo e as formações devem parecer feitos de rocha seca, pedra mineral, poeira lunar e superfícies crateradas. As montanhas devem ter aparência dura, árida, áspera e inóspita, com tons de cinza, grafite, chumbo e reflexos frios. O resultado deve lembrar a superfície da Lua, não uma montanha terrestre. Onde houver transparência, preencher com verde chroma key intenso, uniforme, sem gradiente e sem textura.
~~~~

**[material] Camada 4 (faixa larga ao fundo):**

~~~~
Edite esta imagem preservando rigorosamente o mesmo layout, recorte, enquadramento, posição das montanhas, profundidade e proporção. Não mover nada. Troque somente os materiais, texturas, cores e acabamento do cenário. Transforme a paisagem em um relevo lunar / extraterrestre, completamente árido, sem qualquer sinal de vida. Não pode existir grama, vegetação, floresta, musgo ou áreas verdes naturais. O relevo deve parecer seco, empoeirado, mineral e rochoso, com textura craterada e aparência geológica alienígena. Use tons de cinza, grafite, cinza-pedra, chumbo e variações frias. A iluminação pode continuar coerente com a imagem original, mas o material das montanhas deve parecer lunar. Todas as áreas transparentes devem ser preenchidas com verde chroma key puro, forte e uniforme, sem textura.
~~~~

**[material] Camada 5 (montanhas distantes):**

~~~~
Transforme esta imagem em uma camada de fundo lunar / extraterrestre, preservando integralmente a composição original. Não altere o recorte, a escala, a posição do horizonte, a perspectiva ou o layout. Apenas mude as texturas, materiais e cores. A montanha distante deve parecer uma formação mineral árida, com aparência seca, rochosa, poeirenta e levemente craterada. Remova completamente qualquer aparência de mata, árvores, vegetação ou grama. O ambiente deve ser totalmente inóspito, semelhante à Lua, com tons de cinza, grafite, cinza-claro, cinza escuro e poeira mineral. Nada de verde natural no relevo. Onde houver transparência, preencher com verde chroma key puro, uniforme, sem gradiente e sem textura.
~~~~

**[material] Camada 6 (horizonte / fundo):**

~~~~
Edite esta imagem sem mudar absolutamente nada da composição: preserve o mesmo recorte, o mesmo formato da camada, a mesma posição do horizonte e a mesma proporção. Não alterar layout, escala ou perspectiva. Apenas transforme o relevo em um cenário lunar / extraterrestre. A superfície deve parecer mineral, rochosa, árida e desolada, com textura de poeira lunar e formações secas ao fundo. Remova totalmente qualquer leitura de floresta, vegetação, grama ou ambiente terrestre. O resultado precisa parecer um planeta semelhante à Lua, com tons frios e neutros como cinza, grafite, chumbo e poeira clara. Todas as áreas transparentes devem ser preenchidas com um verde chroma key forte, puro, uniforme e sem gradiente.
~~~~

Ajuste de pós-processo no CSS do site (do material): `filter: grayscale(100%) brightness(0.68) contrast(1.15)` em cada camada. Nomeação: `assets/1.png` (frente) até `assets/6.png` (fundo).

## 4. Venezianico: foto editorial de fundo da Hero (mulher com o relógio) [material]

Imagens anexadas no material: Referência Master (a foto original do site da Apple trocada), Auxiliar 1 (girlApple) e Auxiliar 2 (Venezianico). Estratégia "reconstrução estrita": prompt gigante em caixa-alta proibindo mudar composição + JSON de especificação + negative prompt. Copie e troque só descrições do produto/sujeito.

~~~~
USE THE PROVIDED IMAGE AS THE MASTER REFERENCE AND ABSOLUTE VISUAL SOURCE. THIS IS NOT A LOOSE RECREATION. THIS IS A STRICT VISUAL RECONSTRUCTION TASK. RECREATE THE IMAGE AS IDENTICALLY AS POSSIBLE. DO NOT REDESIGN, REINTERPRET, RESTYLE, MODERNIZE, BEAUTIFY, SIMPLIFY, IMPROVISE, OR INVENT ANYTHING. DO NOT CHANGE THE COMPOSITION, FRAMING, CROP, ASPECT RATIO, LAYOUT, SUBJECT POSITION, CAMERA ANGLE, PERSPECTIVE, DEPTH, LIGHTING DIRECTION, FACIAL VISIBILITY, BODY POSE, ARM POSITIONS, FINGER GESTURE, WARDROBE, JEWELRY, WATCH PLACEMENT, SCALE RELATIONSHIPS, BACKGROUND STRUCTURE, BLUR LEVEL, SHADOWS, HIGHLIGHTS, OR OVERALL CINEMATIC MOOD. THIS MUST LOOK LIKE THE SAME PHOTOGRAPH RECREATED WITH MAXIMUM FIDELITY.

Generate an ultra-realistic cinematic editorial photograph in exact 16:9 horizontal format. The scene is a premium lifestyle / fashion-tech image set in a dark, heavily blurred modern architectural or industrial-looking environment with deep blue-black and charcoal tones. The composition must remain exactly the same: an adult woman occupies mostly the left half and lower-left portion of the frame, while her extended arm, hand and watch occupy the right half. Preserve the large dark negative space in the upper-right and center-right areas. The crop must remain exact, including the top-left cropping of the hair and the lower-left cropping of the torso. Preserve the same visual flow from hair and face edge to collar, sleeve, forearm, watch, and pointing finger.

The subject is an adult woman seen from a three-quarter rear-left angle. Her body is turned away from the camera, with her left shoulder closer to the camera. Her head is turned to the right and slightly downward, looking toward the watch on her extended wrist. Her face must remain only partially visible in side/rear profile. Do not make her face front-facing and do not reveal more of the face than in the reference. Her expression is mostly obscured and her attention is focused on the watch. Her skin tone is warm medium-tan with natural realistic texture and subtle photographic detail.

Her hair is long platinum-blonde / silver, loose, smooth, and slightly wavy, with a subtle side part. Preserve the exact silhouette and flow of the hair, including the way it fills the upper-left side of the frame and is cropped by the top and left borders. The hair must show high-detail strands, with strong warm-white highlights on the lit areas and gray-silver shadow tones elsewhere.

She is wearing an oversized light-blue button-up shirt with very thin dark navy vertical pinstripes. Preserve the exact shirt look: relaxed fit, crisp fabric, visible woven texture, large pointed collar, rolled or pushed-up sleeves, and natural dense folds around the elbow and forearm. The shirt color must remain a cool desaturated blue with navy pinstripes, with bright cool blue-white highlights, medium steel-blue midtones, and deep navy shadows.

She wears a small polished gold hoop earring in the visible ear, and a small metallic piercing detail near the upper ear area. On the wrist/hand in the lower-middle foreground, preserve the thin polished bracelets in warm gold / rose-gold tones, including their delicate minimal design, curved shape, and bright specular reflections.

Her pose and gesture must remain identical. One arm extends almost horizontally from left to right across the lower-middle area of the image. The other hand rises from the lower-middle / lower-center area, closer to the camera, with the index finger extended diagonally upward-right toward the watch. Preserve the exact angle, spacing, and gesture of the pointing finger. Do not alter wrist anatomy, finger count, or hand proportions.

On the extended wrist, preserve the exact position, scale, orientation, and perspective of the analog watch. The watch must remain placed in the right half of the frame, around the lower-right third. It must be a round polished silver metal analog wristwatch with a smooth rounded bezel, slightly domed glossy crystal, ridged crown on the right side, sculpted lugs, and a dark navy / black leather-like strap with a matte to semi-matte finish. The dial must be deep midnight blue with a subtle starry / speckled galaxy-like texture, minimalist and refined, with no numerals, extremely minimal or absent hour markers, a small metallic logo or symbol near the upper dial area, polished silver hour and minute hands, and a very thin central silver seconds hand. The watch must look exactly like the same physical watch from the reference, photographed in the same perspective and light, without changing its proportions, rotation, wrist placement, or scale.

The background must remain a dark, modern, out-of-focus architectural or industrial scene with very low detail due to shallow depth of field. Preserve the overall deep blue-black / charcoal palette and the subtle blurred horizontal structural bands. Preserve the two soft blurred rectangular light shapes toward the middle-right / lower-right background. Do not introduce any new elements, colors, or details. The background must remain strongly defocused and minimal.

The lighting must remain exactly the same: hard directional cinematic light coming from the upper-left / front-left, creating strong warm highlights on the woman’s hair, face edge, forearm, hand, shirt folds, watch case, and jewelry. Shadows must be deep, cool, and high-contrast. Preserve the dramatic warm-vs-cool split, with warm highlights and cool blue-charcoal shadows. Maintain the same premium high-end commercial photographic finish, including restrained saturation, strong contrast, subtle fine grain, realistic hair strands, realistic skin texture, realistic metallic reflections, realistic fabric detail, shallow depth of field, and no CGI appearance.

Technical reconstruction target: exact 16:9 landscape composition, ultra-realistic cinematic editorial photography, natural mild telephoto compression, approximately 70mm full-frame look, shallow depth of field, extremely sharp subject foreground, heavily blurred background, minimal distortion, high-end color grading, cool deep blue-black background, cool blue shirt, warm golden skin highlights, platinum hair with warm highlights, gold jewelry, and overall sophisticated technology-lifestyle campaign aesthetic.

JSON SPECIFICATION TO FOLLOW INSIDE THIS SAME TASK: { "task": "exact_image_reconstruction", "instruction_priority": "maximum_fidelity", "reference_policy": { "use_reference_image": true, "reference_role": "master_reference", "allow_reinterpretation": false, "allow_recomposition": false, "allow_style_change": false, "preserve_exact_layout": true, "preserve_exact_crop": true, "preserve_exact_subject_positions": true, "preserve_exact_camera_angle": true, "preserve_exact_lighting": true, "preserve_exact_depth_of_field": true }, "output": { "aspect_ratio": "16:9", "orientation": "landscape", "style": "ultra-realistic cinematic editorial photography", "quality": "high", "goal": "recreate the same image with no noticeable visual changes" }, "must_preserve": [ "exact 16:9 composition", "exact crop", "exact subject placement", "exact pose", "exact arm direction", "exact finger gesture", "exact watch placement and scale", "exact hair position and silhouette", "exact shirt appearance", "exact dark negative space on the right", "exact background blur structure", "exact lighting direction", "exact cinematic mood" ], "must_not_change": [ "layout", "framing", "camera angle", "perspective", "proportion", "crop", "subject identity", "pose", "watch orientation", "scale relationships", "depth of field", "background composition", "lighting design", "color mood" ] }

NEGATIVE PROMPT: different composition, different framing, different crop, different aspect ratio, centered subject, front-facing portrait, different pose, different arm angle, different hand position, different finger gesture, different watch placement, different watch orientation, smartwatch, different watch design, extra fingers, extra hands, deformed hands, different hair style, different hair color, different shirt color, different shirt stripes, different jewelry, bright background, clean studio background, sharp detailed background, soft flat lighting, weak contrast, illustration, painting, drawing, cartoon, CGI, 3D render, overly retouched skin, beauty retouching, HDR, neon colors, wide-angle distortion.

FINAL RULE: RETURN AN IMAGE THAT MATCHES THE REFERENCE IMAGE AS CLOSELY AS POSSIBLE, WITH NO VISIBLE CHANGES IN COMPOSITION, SCENE DESIGN, SUBJECT PLACEMENT, LIGHTING, OR STYLE.
~~~~


## 5. Venezianico: relógio sobre fundo galáctico (frame final do vídeo da intro) [aula]

1. Com o frame 1 (relógio com fundo, do site) anexado: "Extraia o json do background galáctico dessa imagem."
2. Com a imagem do relógio sem fundo anexada + o JSON: "Aplique o background desse json na imagem que eu tenho enviado."

Resultado = frame final; o frame inicial é a primeira imagem. Os dois alimentam o vídeo (ver `prompts-video.md`).

---

## 6. Harry Potter: cenário e personagem inspirados (evitando bloqueio de direitos autorais)

**[material] Cenário (imagem de grupo na floresta + castelo):**

~~~~
recrie essa imagem, porém num cenario inspirado em harry potter. a floresta deve ser parecida com a floresta negra e no fundo deve aparecer hogwarts, os alunos devem estar com robe inspirado no robe de hogwarts. não faça igual a harry potter, deve ser uma imagem inspirada.
~~~~

**[material] Personagem em PNG transparente (substitui a camada frontal do hero):**

~~~~
recrie essa imagem também em PNG com o fundo 100% transparente, mas ela deve ser inspirada num aluno de hogwarts também com as vestes inspiradas em hogwarts. mas deve ser autoral
~~~~

**[material] Galeria em massa (7 imagens por mensagem; o professor pediu 10 e repetiu para ter ~20):**

~~~~
o que eu vou te pedir agora é inspiração! nao quero igual a obra original! de fato não precisa ser igual sabe? pode gerar 7 imagens realistas de alunos de hogwarts fazendo qualquer coisa? podem estar usando o robe inspirado no robe de hogwarts de casas diferentes

quero algo autoral msm pode ter imagem de bruxos conversando, pode ter imagens de meninas, pode ter imagem dos professores, varia sabe? seja bem diversificado nas pessoas
~~~~

Regra do professor: sempre dizer "inspirado, não igual à obra original / autoral"; sem isso, é provável cair em mensagem de direitos autorais e a imagem nem é gerada. Pediu ~20 imagens para o site inteiro (o site tinha 19 imagens).

---

## 7. Valentino (perfume): prompts de imagem do material

**[material] Prompt 1: hero com parallax em 5 camadas PNG alinhadas** (mesma cena, mesmo tamanho/enquadramento/ponto de fuga, alpha real):

~~~~
Crie um conjunto de 5 imagens separadas para compor uma hero section com efeito parallax premium e cinematográfico.

IMPORTANTE:
- As 5 imagens devem fazer parte da MESMA cena.
- Não crie 5 artes diferentes.
- Crie 5 CAMADAS complementares de uma única composição.
- Todas as imagens devem ter o MESMO tamanho, o MESMO enquadramento, a MESMA perspectiva e o MESMO ponto de fuga.
- Todas devem estar perfeitamente alinhadas entre si para sobreposição em um site.
- Sempre que uma camada não ocupar o canvas inteiro, o restante deve ficar com FUNDO 100% TRANSPARENTE REAL, em PNG com canal alpha limpo.
- Não use fundo preto para simular transparência.
- Entregue 5 arquivos PNG individuais.
- A composição precisa deixar uma área central limpa para futura inserção de um produto, como um perfume ou outro item premium.
- A cena deve ter visual ultra refinado, realista, cinematográfico, sci-fi elegante, luxuoso, imersivo e fora da caixa.

DIREÇÃO DE ARTE:
Criar uma paisagem fantástica e futurista com atmosfera roxo-azulada, inspirada em um cenário cósmico sofisticado ao entardecer. A cena deve ter:
- céu dramático azul-violeta com nuvens suaves;
- um grande halo/luz circular no horizonte, como um eclipse luminoso;
- montanhas rochosas distantes com névoa;
- um lago espelhado com pequenas rochas emergindo da água e reflexos dourados/violáceos;
- um pódio circular futurista e elegante para apresentar um produto;
- uma passarela/plataforma metálica molhada e iluminada, vindo do primeiro plano em direção ao centro;
- uma moldura orgânica nas bordas com rochas escuras, flores roxas e cristais brilhantes;
- iluminação premium, contraste suave, reflexos bonitos, clima editorial de campanha publicitária de luxo.

A composição final deve ser dividida exatamente nas seguintes 5 camadas:

CAMADA 1 — BACKGROUND BASE
- Esta é a camada mais ao fundo.
- Mostrar o céu completo, as nuvens, o halo luminoso no horizonte e as montanhas distantes.
- Esta camada pode preencher o quadro inteiro.
- Não incluir pódio, passarela, moldura floral/cristais nem elementos de primeiro plano.
- O foco é estabelecer o cenário distante e a atmosfera geral.

CAMADA 2 — LAGO / MEIO DE CENA
- Mostrar apenas o lago espelhado com pequenas rochas emergindo da água e reflexos de luz.
- Deve ocupar a parte inferior/média da cena.
- Todo o restante fora dessa área deve ser 100% transparente.
- Não incluir céu completo, pódio, passarela ou moldura lateral.
- A linha do horizonte deve combinar perfeitamente com a CAMADA 1.

CAMADA 3 — PÓDIO CENTRAL
- Mostrar apenas um pódio circular futurista, sofisticado, escuro, com linhas de luz douradas/violáceas.
- O pódio deve estar centralizado e pronto para receber um produto em cima.
- Todo o restante do canvas deve ser 100% transparente.
- Não incluir cenário extra ao redor além do pódio.

CAMADA 4 — PASSARELA DE PRIMEIRO PLANO
- Mostrar apenas a passarela/plataforma metálica iluminada vindo da borda inferior em direção ao centro da cena.
- Ela deve apontar visualmente para o pódio central.
- Adicionar algumas rochas laterais baixas se necessário para integrar a passarela.
- Todo o restante do canvas deve ser 100% transparente.
- Não incluir céu, halo nem elementos laterais decorativos grandes.

CAMADA 5 — MOLDURA FRONTAL DECORATIVA
- Mostrar apenas a moldura orgânica de primeiro plano nas laterais e cantos, composta por rochas escuras, cristais translúcidos e flores roxas luminosas.
- O centro da imagem deve permanecer livre para enxergar as outras camadas.
- Todo o restante deve ser 100% transparente.
- Essa camada deve funcionar como a camada mais próxima da câmera.

REGRAS TÉCNICAS OBRIGATÓRIAS:
- Entregar 5 PNGs separados.
- Todos com exatamente a mesma resolução.
- Sugestão: 1920x1080, 1600x900 ou 1440x810.
- Não variar zoom entre as camadas.
- Não variar ângulo entre as camadas.
- Não reposicionar a linha do horizonte.
- Não alterar a perspectiva entre os arquivos.
- As camadas precisam se encaixar perfeitamente quando sobrepostas.
- As áreas transparentes devem ter alpha limpo e real, sem fundo sólido, sem borda preta, sem halo escuro e sem artefatos.
- Não achatar todas as camadas em uma só imagem.
- Não inserir texto, logo, watermark ou mockup de interface.

RESULTADO ESPERADO:
Um conjunto de 5 arquivos PNG separados, realistas e premium, formando uma única cena parallax coerente, com profundidade visual clara:
1. fundo distante,
2. lago intermediário,
3. pódio central,
4. passarela frontal,
5. moldura decorativa frontal.

NOMEIE AS SAÍDAS COMO:
- parallax_layer_01_background.png
- parallax_layer_02_lake.png
- parallax_layer_03_podium.png
- parallax_layer_04_walkway.png
- parallax_layer_05_frame.png
~~~~

**[material] Prompt 2: segunda dobra, frasco à esquerda borrifando partículas que formam o texto** (imagem de referência/composição; no site, a segunda dobra foi feita em código com partículas, ver `site-parallax-gsap-ia`):

~~~~
Crie uma imagem premium para a SEGUNDA DOBRA de um site de perfume de luxo, mantendo continuidade visual com a primeira dobra, que já possui um hero parallax cinematográfico com o perfume centralizado.

OBJETIVO:
Na segunda dobra, o perfume deve crescer de escala e aparecer posicionado no LADO ESQUERDO da composição. O frasco deve estar elegante, sofisticado, em destaque, levemente inclinado ou posicionado de forma nobre e editorial. Do borrifador do perfume deve sair uma nuvem de partículas refinadas e fluidas, como se estivesse sendo borrifado em direção ao lado direito da tela.

COMPOSIÇÃO:
- Layout horizontal, pensado para seção de website.
- O perfume deve ficar no lado esquerdo.
- O lado direito deve ser construído visualmente a partir das partículas da borrifada.
- Essas partículas devem formar uma composição artística e tecnológica, como se o conteúdo estivesse nascendo da fragrância.
- As partículas principais devem ser roxas, violetas e lilases, com brilho sutil, aparência luxuosa e etérea.
- Algumas partículas secundárias podem assumir cores relacionadas às notas olfativas do perfume.

LADO DIREITO:
No lado direito, as partículas devem montar visualmente:
1. O nome do perfume em destaque.
2. Um pequeno texto ou subtítulo sofisticado.
3. As notas olfativas / características do perfume.

IMPORTANTE:
- O conteúdo do lado direito não deve parecer apenas “texto jogado”.
- Ele deve parecer formado, desenhado ou revelado pelas partículas da borrifada.
- Parte das partículas pode se transformar em fumaça fina, poeira luminosa, traços fluidos, pétalas microscópicas, cristais ou energia aromática.
- O texto precisa continuar legível, elegante e premium.

CONTEÚDO SUGERIDO:
Nome do perfume: VALENTINO
Subtítulo: “Uma fragrância intensa, sofisticada e magnética.”
Notas olfativas:
- Saída: bergamota e frutas roxas
- Corpo: lavanda, violeta e flor de íris
- Fundo: baunilha, âmbar e madeiras nobres

DIREÇÃO DE ARTE:
- Estilo ultra premium, realista, cinematográfico e sofisticado.
- Estética de campanha publicitária de perfume de luxo.
- Predominância de tons roxos, violetas, ameixa e magenta escuro.
- As notas olfativas podem ganhar pequenas variações cromáticas:
 - frutas roxas = ameixa / uva / blackberry em tons violeta
 - lavanda / violeta = lilás suave
 - íris = azul-violeta delicado
 - baunilha = dourado cremoso
 - âmbar = dourado quente
 - madeiras nobres = marrom escuro / cobre sutil
- Fundo elegante, escuro e atmosférico, com profundidade, sem poluição visual.
- Pode haver brilho sutil, névoa fina, reflexos delicados e atmosfera sensorial.
- Visual clean, moderno, editorial e tecnológico.
- Sensação de luxo, desejo e imersão.

ESTRUTURA VISUAL:
- Esquerda: frasco grande e dominante.
- Centro: transição da borrifada.
- Direita: composição de partículas formando título, subtítulo e notas olfativas.
- O fluxo visual deve conduzir naturalmente o olhar da esquerda para a direita.
- Deve parecer uma seção de site de perfume de alta performance, premium, elegante e fora da caixa.

REGRAS:
- Não criar visual infantil ou fantasioso demais.
- Não exagerar nos efeitos a ponto de perder legibilidade.
- Não usar fundo branco.
- Não transformar a composição em um simples banner genérico.
- A imagem precisa parecer parte de um site de luxo, como a segunda seção após a hero principal.

RESULTADO ESPERADO:
Uma imagem horizontal sofisticada de segunda dobra de website, onde um perfume grande no lado esquerdo borrifa partículas roxas para o lado direito, e essas partículas constroem artisticamente o nome do perfume e suas notas olfativas, com aparência premium, realista e cinematográfica.
~~~~

**[aula] Frasco separado em 3 peças para animar a tampa e o borrifador (o texto exato deste prompt NÃO está no material; foi dito em linhas gerais):** pedir ao GPT, com a foto do perfume, uma imagem do frasco, uma só do borrifador e uma só da tampa, todas do mesmo tamanho e enquadramento para empilhar e parecer um produto único (no código: P1, P2, P3).

**[aula] Anúncio do perfume a partir de referência (base do vídeo):**
> Troque esse perfume pelo segundo da imagem, o Valentino. [anexar referência de anúncio + foto do perfume]
> Troque o cenário e as frutas por frutas roxas e um cenário mais roxo.

**[material] Prompt 4: criativos 9:16 com figuras públicas** (anexar as fotos das pessoas):

~~~~
pode gerar imagens aleatórias em 9:16 agr? com essas pessoas? mas lembre-se mude a pose deles, mude o cenario, deve ser um criativo desse meu perfume... sempre com tons roxos, como sao figuras publicas não tem problemas de direitos autorais
~~~~

Aviso nosso (não é do curso): o curso afirma que "figuras públicas não têm problema de direitos autorais". Imagem e voz de pessoa real em peça comercial costuma exigir autorização (direito de imagem); para cliente, prefira modelos fictícios/autorizados. Em uma das tentativas o GPT ignorou uma das pessoas (Ronaldinho) e foi preciso gerar de novo só com a foto dela.
