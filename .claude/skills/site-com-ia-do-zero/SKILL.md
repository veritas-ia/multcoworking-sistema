---
name: site-com-ia-do-zero
description: "Fluxo de ponta a ponta do curso Asimov 'Construindo sites profissionais com IA' para criar um site estático (HTML/CSS/JS) com agente de IA: fundamentos mínimos, vídeo de hero com scroll, design system, primeira dobra a partir de referência, restante do site dobra a dobra, estratégias alternativas, preparar projeto, Git/GitHub/Vercel e domínio. Use quando o pedido for 'criar site com ia', 'site do zero com ia', 'primeira dobra', 'hero com vídeo no scroll', 'gerar site a partir de design system', 'estilo Apple', 'vibe design/vibe coding de site', 'publicar site feito por IA' ou 'colocar HTML da IA no WordPress'."
---

# Site com IA, do zero (HTML estático)

Método do curso "Construindo sites profissionais com IA" (Asimov). O produto do curso é um site de venda de uma caneta (Artools), com vídeo que avança e volta ao rolar, textos animados e várias dobras. Objetivo declarado: mostrar como design, animação e copy aumentam o valor percebido de um produto.

Esta skill é o roteiro; o detalhe está em `references/`. Para criar ou usar o DS: skill `design-system-por-ia`. Para deploy aprofundado, SEO, velocidade e medição: `site-astro-do-zero`. Para parallax com biblioteca: `site-parallax-gsap-ia`. Para método de design com IA em geral: `design-metodo-ia`.

Ferramentas, modelos, menus e preços citados são "conforme o curso (nov/2026)": Google Antigravity (editor com agente), Whisk -> Flow (Veo 3.1), Gemini 3 Pro, GPT, Git Graph, GitHub, Vercel, Hostinger/registro.br. O método vale em outro editor com agente (o professor cita Cursor, Claude Code, Gemini CLI para tarefas em paralelo); as telas é que mudam. Ele quis montar tudo com ferramentas gratuitas do Google.

## Expectativas honestas (do próprio curso)

- Resultado varia a cada rodada; o professor espera chegar a 80-90% do site da aula ou algo melhor.
- Cerca de 50% de chance de a hero sair ótima de primeira; o resto é bug e correção. O site-modelo levou 4-5 horas de testes; com direção clara, bem menos.
- Ritmo observado: hero em ~1 minuto de IA, dobra nova em ~2 minutos, correção de 3 bugs em 5-6 minutos.
- Pedir à IA sem referência é o que dá pior resultado: a dobra "sem referência" foi a mais sem graça do projeto.

## Passo 0: reunir insumos e se orientar

1. Foto do produto (e, se for o caso, logo e textos). Uma foto de celular basta.
2. Entenda o mínimo: `references/fundamentos.md` (HTML posiciona, CSS estiliza, JS dá vida; site estático; vocabulário; os 3 princípios; Git).
3. Os 3 princípios, em uma linha cada:
   - uma instrução por vez (hero primeiro com toda a energia; depois uma dobra por vez);
   - stack simples (HTML, CSS, JS básicos; framework e arquivos demais confundem a IA);
   - calma com a IA (erra, alucina; peça de novo e corrija).
4. Instale o Git, teste com `git` no terminal, abra a pasta do projeto no editor e inicialize o repositório (`git init`). Commit "checkpoint inicial" antes de mudar qualquer coisa.

## Passo 1: vídeo da hero (opcional, para produto com efeito de scroll)

Gerar frame inicial e final no gerador de imagem, animar no Flow (frames para vídeo, Veo 3.1, 2 variações, 16:9) usando prompts montados por uma IA de texto. Detalhes, aviso "Whisk migrou para o Flow" e limites do plano gratuito em `references/video-hero-scroll.md`. Guarde o vídeo na pasta do projeto.

## Passo 2: design system

Siga `design-system-por-ia` (Fluxo A): recombinar 3-4 referências com um pilar, um DS por chat, vários em paralelo, avaliar no navegador, escolher e refinar. O DS escolhido fica em `assets/` (depois, em templates). O curso entrega vários DS prontos como opções, mais o DS que originou o site original.

## Passo 3: primeira dobra (hero) a partir do DS

O curso monta dois sites; este é o fluxo "com referência" (o mais fácil: "copiar é mais fácil que criar do zero"; copiar com estilo, adaptando ao seu DS).

1. Escolha um site de referência com a estrutura desejada e tire um print. Fontes de referência citadas: o próprio site da Apple, Aura.build, Dribbble, Mobbin.
2. Peça a uma IA de texto (anexando o print) um prompt para o agente de código que gere um `index.html` com uma hero apenas. Use o esqueleto de `references/prompts-do-fluxo.md` (seção 2): layout do print, identidade só do DS, vídeo com parallax estilo Apple, "pense em bibliotecas via CDN". Motivo: ela descreve posições e sugere tecnologia melhor que você.
3. No agente, abra chat novo com o melhor modelo; marque o DS e o vídeo. Rode 2 ou 3 versões em paralelo (index1, index2...). Escolha a melhor e continue só nela.
4. Corrija em pedidos separados, um assunto por mensagem (tela cheia do vídeo, fluidez, alinhamento à esquerda, espaçamento do H1, fade/blur in e out). Tabela de sintomas e pedidos em `references/video-hero-scroll.md`. Mensagens em fila funcionam: a segunda espera a primeira terminar.
5. Para ajustes de layout, mande de novo o print: serve para layout, não para identidade (a identidade é do DS).
6. Aceite as mudanças e faça hard refresh no navegador a cada teste.
7. Tudo certo? Commit "hero finalizada". Faça commit a cada acerto; se um pedido seguinte estragar, volte pelo Git Graph (Checkout no commit).

A hero merece cerca de 80% da energia de design, segundo o professor.

## Passo 4: restante do site, dobra a dobra

1. Para cada dobra: print de referência de uma só seção (pode ser de um site preto, só a estrutura importa) + "use o layout desta imagem, use a nossa identidade visual" + pedido de conteúdo de alto valor (termos específicos, benefícios) + "animações de entrada e saída, capricho". Modelos em `references/prompts-do-fluxo.md` (seção 3).
2. Se a dobra sair invisível ou fora da identidade, descreva o sintoma e lembre o DS ("Era apenas para modelar o layout").
3. Refine duas ou três vezes com pedidos curtos ("melhora mais um pouquinho; olhe o design system, veja as animações; background, textura, detalhes"). O professor diz que o design melhora muito só repetindo isso.
4. Para dobra sem referência, pergunte à IA o que ela julgar melhor, ou aponte um arquivo de animações do banco (ex.: efeito de glow) para ela reaproveitar. No curso, a quarta dobra com vídeo ao fundo e caixa com glow ficou entre as melhores.
5. Ao fim, 1 ou 2 rodadas de acabamento geral (fundo com textura, transições, pequenas animações) e teste de rolar o site inteiro e voltar (bug visto: texto não reaparece ao subir de novo, resolvido por prompt).

## Passo 5: estratégias para quando se parte do zero

Quatro estratégias do curso (recapitulação da aula 5). Preferir sempre a que usa referência.

1. Prompt melhorado por outra IA: para as partes mais importantes (hero). Prompt grande e descritivo reduz criatividade e aumenta precisão; prompt curto e abstrato ("seja criativo", "melhore o site") dá mais variedade e funciona melhor com modelos bons.
2. Referência explícita: print da seção + "modele só este layout com o meu DS". Melhor resultado do curso.
3. IA livre, sem referência: possível, mas dá a pior dobra; use quando não tiver ideia.
4. Planejar com a IA: pergunte que seções colocaria e um plano breve. Cada seção vira um prompt separado, com busca de referência. Lista que a IA propôs para a caneta: hero; problema e solução; tecnologia por trás; demonstração visual; experiência de escrita; benefícios da vida real (5 tópicos); prova social (quem usa, melhoras); o que vem na caixa. (Lista de exemplo; adapte ao seu produto.)

Também: prompt aberto = criatividade; prompt fechado = exatidão. Escolha conforme a necessidade.

## Passo 6: preparar e publicar

Siga `references/checklist-deploy.md`: limpar projeto, mover DS para templates com imports corrigidos, reorganizar pastas, commit, GitHub, Vercel, domínio (CNAME `www` + registro A `@`), fluxo de atualização (`git add .`, `git commit`, `git push`). Há também as 3 formas de levar HTML da IA ao WordPress (HTML Personalizado, widget HTML do Elementor, File Manager).

## Checagens finais

- [ ] Hero ocupa a tela, vídeo fluido ao rolar nos dois sentidos, textos legíveis, botões visíveis.
- [ ] Todas as dobras aparecem (nenhum elemento invisível) e respeitam o DS (cores, fontes, efeitos).
- [ ] Animações de entrada/saída e hover funcionando; sem itálico ou cor proibida por regra do projeto, se houver.
- [ ] Imagens e vídeo carregam depois da reorganização de pastas.
- [ ] Commits feitos; repositório no GitHub; URL pública da Vercel abre igual ao local.
- [ ] Domínio apontado, se houver.
- [ ] Copy trocada: textos de exemplo (caneta) não ficaram em site de outro produto.
- Não verificado por este curso (verificar com `site-astro-do-zero`): versão mobile, velocidade, SEO, medição.

## Dúvidas (confirmar)

- "Artools", "Rtools", "ArtTools", "arttools": o produto é a caneta Artools; grafias variam na legenda.
- "WISC" = Whisk; "VO 3.1" = Veo 3.1; "Cloud" = Claude; "EA" = IA; "Aura.build" aparece como "Auro.Build".
- "180x240xview-height" (altura da área de rolagem da hero): provavelmente entre 180vh e 240vh.
- "git branch main" na aula: o comando padrão do GitHub é `git branch -M main`.
- O curso afirma ter sido gravado com Gemini 3 Pro; confirmar o nome do modelo na sua ferramenta.
- Prompts do vídeo e do site "originais" prometidos como material não estão na pasta: só existe o `Prompt.txt` do DS.
- Os arquivos do projeto (`artools_inicial.zip`, `artools_final.zip`, com todos os DS de exemplo) existem no curso, mas não foram abertos para esta skill.

## Fontes (relativas a asimov-academy)

Pasta base: `Construindo sites profissionais com IA (Asimov)/`

- `01 - Princípios e ferramentas fundamentais/01` a `05` (Que site vamos construir; Quais ferramentas; HTML, CSS e JS; Os 3 princípios; Git), cada uma em `transcricao.txt`
- `02 - Criando um site incrível do zero com IA/01 - Criando o nosso vídeo com Whisk e Google Flow/` (`transcricao.txt`, `materiais/Aviso - Whisk migrou para o Flow.md`)
- `02 - Criando um site incrível do zero com IA/02 - Criando DSs/` (`transcricao.txt`, `materiais/Prompt.txt`)
- `02 - Criando um site incrível do zero com IA/03 - Criando a primeira dobra a partir do DS/transcricao.txt`
- `02 - Criando um site incrível do zero com IA/04 - Criando o restante do site/transcricao.txt`
- `02 - Criando um site incrível do zero com IA/05 - Explorando estratégias alternativas/transcricao.txt`
- `02 - Criando um site incrível do zero com IA/06 - Como adicionar interfaces personalizadas ao WordPress/transcricao.txt`
- `03 - Como compartilhar nosso site com o mundo/01`, `02`, `03` (Preparando o projeto para o Deploy; Compartilhando o site com o mundo; Criando um domínio personalizado), cada uma em `transcricao.txt`
- `materiais-do-curso/LEIA-ME.md`, `indice.md`
- Complemento do fluxo de redesign: `Modernizando Sites Antigos com Design Systems (Asimov)/` (ver `design-system-por-ia`)
