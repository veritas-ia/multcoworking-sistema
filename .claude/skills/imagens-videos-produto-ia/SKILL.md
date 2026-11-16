---
name: imagens-videos-produto-ia
description: Gera fotos e vídeos de estúdio de um produto com IA (GPT/ChatGPT imagens + Google Flow/Veo) a partir de uma referência validada, mantendo o produto consistente. Cobre extração de estilo em JSON, troca do produto na imagem, PNG transparente e chroma key, frames inicial/final para vídeo, vídeo em cortes secos, camadas de parallax e conversão de vídeo em frames. Use quando pedirem "gerar foto de produto com ia", "foto de estúdio do produto", "vídeo cinematográfico do produto", "trocar o produto na imagem de referência", "recriar imagem de site", "png com fundo transparente com ia", "imagens para parallax", "frame inicial e final de vídeo" ou "vídeo de anúncio de perfume/relógio/garrafa".
---

# Imagens e vídeos de produto com IA

Método dos cursos-projeto da Asimov (Apple Bottle, Venezianico, Harry Potter, Lando Norris, Valentino). Ferramentas e menus "conforme o curso (nov/2026)": confirme nomes e capacidades antes de afirmar ao usuário. Para montar o site que usa estes assets, ver `site-parallax-gsap-ia`. Para extrair o design system do site de referência, ver `design-system-por-ia`.

## Princípio do curso

Não gere do zero: **pegue uma imagem/vídeo já validado no mercado, extraia o estilo e troque o seu produto** (cenário, elemento, pessoas e até iluminação podem mudar). Quanto mais contexto e referência a IA recebe, melhor o resultado, e é normal ela errar: o diferencial é não aceitar o erro e saber descrever o resultado desejado.

## Passos

1. **Juntar material do produto.** Fotos reais do produto, de mais de um ângulo (o professor fotografou a garrafa e a tampa de cima). Imagens reais do produto fazem a IA se basear melhor. Se a imagem do produto já existe no site da marca, salvar dali (Venezianico).
2. **Escolher a referência visual.** Site da marca, site da categoria (Apple para relógio/garrafa tecnológica), buscas como "Perfume Creative Ad" (anúncios de perfume), e galerias de sites premiados (o professor cita "site Awards", provavelmente Awwwards, confirmar).
3. **Extrair a imagem da referência.** F12 > Application > Frames > Top > Images, salvar. Detalhes e alternativas em `references/pos-processamento.md`.
4. **Extrair o estilo em JSON e recriar com o produto.** Mensagem 1: referência + "Extraia exatamente o estilo artístico dessa imagem. Me retorne em formato JSON, com o máximo de detalhes possível." Mensagem 2: JSON + foto do produto + "recrie ... substituindo apenas o produto". Não peça "troque o objeto" direto. Prompts completos em `references/prompts-imagem.md`, seção 1.
5. **Definir proporção e fundo na hora de pedir.** 16:9 para fundo/frames de vídeo; 9:16 (Story) para elementos altos, como atleta recortado; PNG 100% transparente quando for camada. Se vier errado, corrigir com os prompts da seção 2 de `prompts-imagem.md`.
6. **Corrigir sem aceitar o erro.** Exemplos reais: a IA ignorou o JSON (extrair só a iluminação e pedir de novo), ignorou uma das 3 pessoas (gerar só ela), colocou a pessoa bebendo pela tampa (pedir "remova a tampa"), deixou fundo no PNG (pedir de novo com as referências). Se a IA ignorar a instrução, ser mais rigoroso e repetir explícito.
7. **Fundo transparente.** Rota A: pedir PNG transparente. Rota B (mais universal): pedir chroma key verde puro e remover o verde numa ferramenta web com similaridade ~45%. Ver `references/pos-processamento.md` seção 2.
8. **Gerar o vídeo com frames.** Para vídeo de produto: imagem inicial + imagem final (modo "Frames" do Google Flow, modelo Veo) e um prompt perfeito pedido ao GPT anexando as duas imagens. Para efeito de scroll scrub, peça no prompt que o vídeo seja "pensado para scroll scrub". Configurações por projeto em `references/prompts-video.md`.
   - Sem frame inicial/final (só imagem de referência): modo "Elementos" (Valentino).
   - Gerar mais de uma opção (2 a 4) e escolher; resultado é aleatório.
9. **Vídeo vertical de anúncio.** Prompt com: 9:16, ~8 s, estilo comercial de luxo, paleta definida, **no mínimo 5 cenas com cortes secos** (macro de ingredientes, detalhe do vidro, logo, tampa, hero shot final), produto imutável, sem pessoas, câmera e iluminação premium. Texto verbatim em `references/prompts-video.md`.
10. **Cortar e combinar.** Baixar na maior qualidade (1080p), cortar finais ruins e juntar os melhores trechos em sequência.
11. **Organizar assets.** `hero.mp4` curto; camadas de parallax numeradas pela profundidade; pasta por tipo (fotos, vídeos, parallax, scroll-scrub). Isso ajuda você e a IA do editor.
12. **Vídeo para scroll scrub otimizado.** Converter em frames: 8 FPS e qualidade 75% (64 imagens no exemplo). Ver `references/pos-processamento.md` seção 4.

## Receitas por tipo de asset (qual projeto mostrou)

| Asset | Como | Onde ver |
|---|---|---|
| Frame inicial + final do vídeo hero | foto do produto como inicial; final = produto em uso (ex.: atleta bebendo, sem tampa) | Apple; `prompts-imagem.md` s.2 |
| Foto "estilo Apple" com qualquer produto | print da foto de referência > GPT gera um prompt de estilo > colar + foto do produto | Apple; s.2 |
| Pessoa recortada (PNG 9:16) | JSON do estilo + iluminação do JSON + "background transparente" | Apple; s.1-2 |
| Produto fictício "tecnológico" a partir de foto real | pedir "como a Apple faria" + visão top-down; depois a versão "desligada" | Apple; s.2 |
| Foto editorial com produto no pulso/mão | JSON da foto de referência, substituir só o produto; prompt "reconstrução estrita" | Venezianico; s.4 |
| Camadas de parallax com textura nova | 1 prompt por camada, "preserve composição", chroma key verde | Venezianico; s.3 |
| 5 camadas de parallax originais, alinhadas | um prompt só pedindo 5 PNGs da mesma cena | Valentino; s.7 |
| Galeria em massa de pessoas/cenas | "inspiração, não igual à obra", 7 a 10 imagens por mensagem, repetir | Harry Potter; s.6 |
| Duas imagens para efeito de hover (base + camada revelada) | mesma pessoa com máscara/roupa/fundo diferente | Lando Norris; ver abaixo |
| Anúncio do produto a partir de anúncio de referência | trocar produto + trocar cenário/frutas/cores | Valentino; s.7 |

**Lando Norris (hover líquido):** as 2 imagens são "base" (ex.: selfie) e "revelada" (mesma pessoa de máscara/armadura/outro figurino, podendo mudar o fundo). O prompt de geração dessas imagens citado na aula **não está** na página de materiais; o professor deu só a ideia: foto do usuário + imagem do que deve mudar. Passo de correção usado: "coloque uma armadura futurista em mim e a máscara deve cobrir os cabelos". Detalhes do efeito em `site-parallax-gsap-ia/references/projeto-lando-hover.md`.

## Cuidados

- **Consistência do produto**: travar forma, tampa e logo no prompt; mesmo assim confira cada vídeo, pois o frasco/logo deformou em várias gerações. Plano B: cortar e combinar trechos.
- **Direitos**: o curso usa "inspirado, autoral, não igual" para obras protegidas (Harry Potter) e usou atores famosos reais sob a afirmação de que "não tem problema". Aviso nosso: para cliente, uso comercial de imagem de pessoa real exige autorização; evite marcas de terceiros.
- **Peso**: o curso trata só de FPS/qualidade dos frames; compressão de MP4/imagem não é coberta (ver `references/pos-processamento.md` seção 5).
- **Texto na imagem de IA**: logos e textos de produto são o ponto fraco; prefira texto/rótulo em código (no Valentino, o texto da segunda dobra virou partículas pedidas à IA do editor).
- O curso não informa custos/créditos das ferramentas.

## Dúvidas de transcrição "(confirmar)"

- "VEL 3.1" no áudio = provavelmente Veo 3.1 (Google).
- "Antigrafting/Antigraft" = provavelmente Antigravity (editor de código com IA); "Insurf/Insert" = Windsurf.
- "PNG Maker / Online PNG Tools", "Video to Frames", "Zimove/Zmove (site downloader)": nomes de sites falados em áudio.

## Fontes (relativas a asimov-academy)

- Site profissional da Apple com Astro e GSAP (Asimov)/01 - Projeto completo/02, 04, 05, 06, 07 (transcrições) e materiais-do-curso/
- Site do relógio Venezianico com Astro (Asimov)/01 - Projeto completo/02, 03, 05, 06 e materiais-do-curso/Pagina de materiais (venezianico-astro.vercel.app).md
- Site Mágico do Harry Potter com Astro e GSAP (Asimov)/01 - Projeto completo/02, 03 e materiais-do-curso/Pagina de materiais (harrypotter-asimov.vercel.app).md
- Hover Lando Norris com Astro e CSS (Asimov)/01 - Projeto completo/01 - Recriando o Hover de Lando Norris com Astro, CSS e IA/transcricao.txt
- Site de Estúdio - Fotos e Vídeos de Produto com IA (Asimov)/01 - Projeto completo/02, 03, 04, 05, 06 e materiais-do-curso/Pagina de materiais (valentino-asimov.vercel.app).md
