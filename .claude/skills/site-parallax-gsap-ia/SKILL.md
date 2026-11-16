---
name: site-parallax-gsap-ia
description: Monta um site visual de produto (landing de uma página) com Astro e animações de scroll, usando referências validadas, IA no editor de código e assets gerados por IA. Cobre achar e baixar a referência, extrair design system, recriar dobras por print, parallax em camadas (scroll e mouse), scroll scrub de vídeo/frames, marquee, vídeo que expande, cards empilhados, accordion, hover líquido WebGL, cursor com rastro, contadores, header de vidro, ficha técnica, galeria e finalização. Use quando pedirem "site com parallax", "animação gsap", "scroll scrub", "efeito hover", "recriar site de referência", "site de produto estilo Apple", "dobra fora da caixa", "hero com vídeo", "reaproveitar componente de outro site", "landing page animada de produto".
---

# Site de produto animado (Astro + parallax/GSAP + IA)

Método extraído de 5 cursos-projeto da Asimov (Apple Bottle Pro, Venezianico, Harry Potter, Lando Norris, Valentino). Valores e menus "conforme o curso (nov/2026)". Skills irmãs: `site-astro-do-zero` (base de Astro), `site-com-ia-do-zero`, `design-system-por-ia` e `design-metodo-ia` (design system/estilo), e `imagens-videos-produto-ia` (assets do produto).

## Princípios do curso

1. **Referência antes de prompt.** O que evita "cara de IA" é ter uma boa referência e dizer exatamente o resultado que quer. Quanto mais contexto (print + design system + link + imagens), melhor.
2. **Molde validado, conteúdo seu.** Pegue um site que já funciona, extraia design system/estrutura/animações e troque imagens, fonte, cor e texto. Não precisa começar do zero.
3. **Uma dobra por vez**, com print da dobra de referência, e correções curtas em ciclo. A IA errar é normal; não aceite o erro.
4. **Assets reais do produto** + imagens/vídeos gerados a partir de referência validada (ver `imagens-videos-produto-ia`).
5. Qualquer produto serve: o professor sugere até transformar o layout em portfólio.
6. O curso não exige saber programar; recomenda o curso de Astro como base.

## Fluxo (referência > componentes > efeitos > assets > finalização)

### Fase 1. Referências

1. Defina o produto e ache **duas referências**: uma de categoria (site da marca ou da Apple para produto tecnológico) e uma de efeito (site premiado como o Awwwards, o áudio diz "site Awards"; ou biblioteca de componentes).
2. **Baixe o site de referência** no site downloader da Asimov (colar o link > "baixar site" > zip). Se a página vier quebrada ("indisponível") ou sem animações, veja o plano B em `references/fluxo-e-prompts-no-editor.md` e `references/projeto-harry-potter.md` (Claude Code restaurando animações).
3. **Extraia o design system** do site baixado com um prompt de "extrair design system" (gera `design-system.html` com tipografia, cores, bordas, botões, hover). Ver `design-system-por-ia`.
4. Se precisar da **fonte** da referência: colar a URL em um "Website Font Checker" e baixar as fontes; guardar em `public/fonts` e declarar com `@font-face` (exemplo em `references/projeto-harry-potter.md`).
5. Extraia imagens/vídeos da referência: F12 > Application > Images, ou "copiar endereço do vídeo/imagem" (ver `imagens-videos-produto-ia/references/pos-processamento.md`).

### Fase 2. Projeto e componentes

6. `npm create astro@latest`, abrir num editor com IA (Antigravity, Cursor, Windsurf ou Claude Code), `npm run dev`. Pastas de assets: ver `references/fluxo-e-prompts-no-editor.md`.
7. Primeiro pedido de página: arraste `src/pages/index.astro` + `design-system.html` + a página da referência e peça a **primeira dobra** "seguindo o mesmo estilo", sem imagens, texto padrão, header como componente, "100% .astro". Quando sair errado, mande **print da dobra de referência** ("exatamente como na imagem; use o design system").
8. Para cada seção: print da seção de referência > "Recrie exatamente essa dobra, mesmos cards/cores/espaçamentos, adaptado para o meu produto". Informe **onde** ela entra ("abaixo do vídeo") e a altura (`150vh`).
9. Header e footer: peça como componentes a partir do HTML da referência/design system ("Extraia o rodapé dessa página, crie o componente em Astro e coloque na página principal"). Confira ícones, bolinhas e espaçamentos.
10. Se o design system trouxer cores/raios/fontes, mantenha **um acento, dois raios (card e pill), uma família tipográfica** (regras do material Apple).

### Fase 3. Efeitos (receitas em `references/receitas-efeitos.md`)

| Quero | Receita | Observação |
|---|---|---|
| Parallax em camadas no scroll | seção 1 | sticky 300vh + algoritmo rAF com offsets por camada |
| Parallax que reage ao mouse | seção 2 | a IA faz isso por padrão se você não pedir scroll |
| Vídeo/frames que avançam com o scroll | seção 3 | "aplique as técnicas de scroll scrub"; frames 8 FPS/75% |
| Vídeo que expande até a tela cheia | seção 4 | começa menor, ocupa 100vh/100vw |
| Vídeo de intro que desacelera e congela | seção 5 | JS de `playbackRate` nos últimos 2,5 s |
| Marquee infinito | seção 6 | CSS puro, 30 s linear |
| Faixa de vídeo, ficha técnica, galeria | seção 7 | valores exatos |
| Header de vidro | seção 8 | estado único (Apple) ou vidro após scroll (Venezianico) |
| Reveal, contador, scroll suave, loader | seção 9 | fade+rise, count-up, tabular-nums |
| Painel imersivo alto, sem pin | seção 10 | 160vh, vinheta, partículas |
| Galeria com snap + setas | seção 11 | legendas abaixo |
| Cards empilhados no scroll | seção 12 | "Cards Almanac", constantes completas |
| Troca de imagem com distorção | seção 13 | MorphSlider (ogl + gsap) |
| Cursor com rastro | seção 14 | canvas 2D com molas |
| Accordion de colunas | seção 15 | "Colonnade", sobe-um-sai-outro |
| Hover líquido revelando outra imagem | seção 16 + `projeto-lando-hover.md` | WebGL; prompt completo em `liquid-reveal-prompt.md` |
| Texto formado por partículas / produto que "desce" | seção 3 | exemplo do Valentino |

**Reaproveitar componente de outro site:** achar o componente em biblioteca (React Bits foi citado; áudio "React Beats"), copiar o **prompt pronto** do componente, e no editor dizer "Adapte os cards para se comportarem assim" (seção existente) ou "Crie uma dobra para usar isso. Utilize as imagens do nosso projeto" (seção nova). Para escolher: o professor descartou os que "precisam de muito mais imagens do que a gente tem" e os que não se encaixam no estilo; escolheu o que "ocupa a imagem inteira na tela".

**Efeito "fora da caixa" (dobra criativa):** pense em um elemento do próprio produto (o frasco que borrifa o nome; a tampa tecnológica que liga; o atleta recortado que sai da dobra) e separe o produto em partes/camadas para animar cada uma. Gere as imagens/vídeos para essa ideia (ver `imagens-videos-produto-ia`).

### Fase 4. Assets (ver `imagens-videos-produto-ia`)

11. Gere/organize: vídeo da hero (frame inicial + final), imagens recortadas (PNG transparente), camadas de parallax numeradas, galeria, vídeos de loop. Nomeie em ordem de profundidade.
12. Não aceite deformação de produto: regere ou corte/combine trechos.

### Fase 5. Finalização

13. Padronize fontes/espaçamentos com o design system ("Aproveite o design system para adaptar e padronizar todas as fontes do site"). Fonte fora do Google Fonts: baixar, pôr em `public/fonts`, "baixei a fonte; substitua".
14. Revisão geral procurando o que a referência **não** teria: etiqueta de "scroll scrub", logo da marca original, textos em inglês, números zerados, brasão antigo, hover que a referência não tem.
15. Rodar o prompt de **auditoria de consistência** (tokens, raios, acentos, ordem das seções, contadores iguais, header em estado único) em `references/projeto-apple-bottle.md`.
16. Para o checklist de lançamento (SEO, responsivo, desempenho): o curso **não** cobre; use as skills irmãs e a de SEO do repositório.

## Estrutura típica de um site de produto (Apple Bottle, 10 dobras)

header de vidro > hero em vídeo (100vh, conteúdo no rodapé, preço + CTA em pill) > 3 icon-cards > painel imersivo 160vh com 3 cards de vidro > vídeo full-bleed (cabeçalho acima, nunca sobre o vídeo) > métricas 2x2 com contagem > foto + coluna de texto 45% > galeria snap > especificações (cards + tabela) > footer denso (legal, 4 colunas, copyright). Venezianico, por sua vez: intro em vídeo > parallax > hero estática > marquee > vídeo ambiente > ficha técnica > galeria > footer. Valentino: parallax de 5 camadas > produto que desce e borrifa > vídeo que expande > accordion > loop de vídeos. Escolha e combine conforme o produto; use a ordem do material Apple como padrão quando não houver preferência.

## Armadilhas (do curso)

- IA cria **parallax de mouse** se você não pedir scroll.
- IA ignora instruções de estilo/JSON: ser mais rigoroso.
- Dobra "bugada" parece quebrada quando falta o footer: construa header/footer antes de julgar.
- Scroll scrub com muitos frames pesa; encontre o meio-termo.
- Sem overlay/vinheta quando o material pede imagem "intocada" (Hero Venezianico); com vinheta quando o objetivo é fundir foto com a página (painel Apple).
- Os prompts do material são gigantes e em inglês: copie e troque marca/produto/texto; não reproduza marca de terceiros em site de cliente.

## O que o curso NÃO cobre

- Código GSAP/ScrollTrigger e Lenis "de verdade": o curso cita as bibliotecas, mas quem escreve o código é a IA; só o MorphSlider mostra `gsap` em código. O parallax do material Venezianico é rAF puro.
- Acessibilidade e desempenho além do que os prompts mencionam (`prefers-reduced-motion`, `loading="lazy"`).
- Deploy, SEO, formulários, CMS, i18n. (Os sites de exemplo estão na Vercel, mas a aula de publicação não existe nesses cursos.)
- Compressão de vídeos/imagens.

## Referências desta skill

- `references/receitas-efeitos.md`: receitas com valores e código dos materiais.
- `references/fluxo-e-prompts-no-editor.md`: setup, frases que funcionam, erros comuns.
- `references/projeto-apple-bottle.md`: decisões + 11 prompts verbatim (scaffold, header, hero, seções, footer, auditoria).
- `references/projeto-venezianico.md`: decisões + prompt de parallax em 6 camadas verbatim.
- `references/projeto-harry-potter.md`: baixar/restaurar referência, fonte, componentes, cursor.
- `references/projeto-lando-hover.md` e `references/liquid-reveal-prompt.md`: hover líquido WebGL.
- `references/projeto-valentino.md`: parallax de 5 camadas, produto que borrifa, vídeo que expande, accordion, design system.

## Fontes (relativas a asimov-academy)

- Site profissional da Apple com Astro e GSAP (Asimov)/01 - Projeto completo/01 a 07 (transcricao.txt) e materiais-do-curso/ (LEIA-ME.md, Pagina de materiais (applebottlepro.vercel.app).md, Prompts do projeto Apple.pdf)
- Site do relógio Venezianico com Astro (Asimov)/01 - Projeto completo/01 a 06 e materiais-do-curso/ (LEIA-ME.md, Pagina de materiais (venezianico-astro.vercel.app).md)
- Site Mágico do Harry Potter com Astro e GSAP (Asimov)/01 - Projeto completo/01 a 04 e materiais-do-curso/ (LEIA-ME.md, Pagina de materiais (harrypotter-asimov.vercel.app).md)
- Hover Lando Norris com Astro e CSS (Asimov)/01 - Projeto completo/01 - Recriando o Hover de Lando Norris com Astro, CSS e IA/transcricao.txt e materiais-do-curso/ (LEIA-ME.md, Pagina de materiais (hover-lando-norris.vercel.app).md)
- Site de Estúdio - Fotos e Vídeos de Produto com IA (Asimov)/01 - Projeto completo/01 a 06 e materiais-do-curso/ (LEIA-ME.md, Pagina de materiais (valentino-asimov.vercel.app).md)

## Dúvidas de transcrição "(confirmar)"

"Antigraft/Antigrafting" = Antigravity; "Insurf/Insert/Devin" = Windsurf; "React Beats" = React Bits; "Host Weasley" (font checker) nome incerto; "VEL 3.1" = Veo 3.1; "GESAP" = GSAP; "Zimove/Zmove" = site downloader (nome incerto); modelo "Gemini 3.6/3.7" citado no áudio, versões incertas.
