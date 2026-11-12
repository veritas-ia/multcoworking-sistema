---
name: design-metodo-ia
description: Método da Asimov Academy ("vibe design") para fazer a IA criar designs de site e landing page com nível profissional, sem cair no visual genérico de IA. Fluxo completo - referência visual, imagem + prompt, base do design system em HTML, aplicar o DS, iterar seção por seção - com os erros comuns a evitar e quando chamar as skills extract-ds e img-to-html. Inclui o projeto prático de portfólio. Use quando pedirem "criar design com ia", "vibe design", "design absurdo", "como fazer a ia criar um site bonito", "partir de uma referência visual", "meu site com cara de IA / roxo", "extrair design system de um site", "transformar imagem em html", "portfólio com ia", ou antes de montar qualquer página a partir de uma referência.
---

# Método para criar designs absurdos com IA (vibe design)

Método do curso "O Método para Criar Designs Absurdos com IA" e do projeto "Portfólio com Vibe Design" (Asimov Academy). Tudo que depende de ferramenta, menu, versão, modelo ou preço vale **conforme o curso (nov/2026)**; confira antes de afirmar ao cliente.

## Princípio em uma frase
Não peça o design em texto. **Parta de uma referência real, transforme-a em um design system em HTML (o "DNA" visual) e mande a IA aplicar esse DS em uma coisa nova, uma seção por vez.** O curso afirma (e demonstra em experimento) que um modelo fraco com o DS vence um modelo forte só com prints.

## Quando usar
- Criar ou redesenhar site, landing page, portfólio ou tela a partir de uma referência visual.
- O resultado da IA saiu genérico (roxo, degradê azul-roxo, serifada com itálico, dobras vazias, sem animação).
- Quando o cliente "gostou deste site" e quer algo no estilo (sem copiar).
- Extrair a identidade visual de um site (DS) ou recriar uma imagem/mock como HTML.

## Quando NÃO usar (o curso não cobre)
- Hospedagem, domínio, SEO, responsividade fina, back-end, métricas. Para site do zero ver a skill irmã `site-com-ia-do-zero`; Astro: `site-astro-do-zero`; parallax/GSAP: `site-parallax-gsap-ia`; organizar DS/tokens por conta própria: `design-system-por-ia`.
- Apresentações, dashboards, apps, animações e 3D: o curso cita como metas do método, mas **não ensina** o passo a passo aqui. Aplicar a lógica por analogia e avisar.
- Identidade visual do cliente: tem prioridade; o método serve para **estrutura, movimento e acabamento**, não para sobrescrever marca.

## Fluxo (passos acionáveis)

### Passo 0 - Definir objetivo e conteúdo
1. O que é a página (portfólio, landing, produto) e para quem.
2. Escrever/obter o **texto antes do design** (o capricho do método é estético, não de copy). Dividir em dobras (seções) e anotar o que cada uma precisa (ex.: hero com foto, headline, subheadline e botão para a próxima dobra).
3. Garantir um **agente de código** com acesso à pasta do projeto (Antigravity, Cursor, Claude Code, Codex, etc.). Ver `references/ferramentas-e-referencias.md`.

### Passo 1 - Reunir referências
1. Banco de referências do curso: https://ds.asimov.academy/ (48 sites curados, temas claros, componentes; já pré-processados). Exclusivo dos alunos.
2. Outras fontes citadas: Aura.build (favorita do instrutor), Mobbin, Dribbble, Webflow. Salve tudo que gostar.
3. Escolha **2 a 3 referências** pelo que cada uma tem de melhor (botão, fundo animado, cards, tipografia, cores). Misturar referências é parte do método.
4. Ética: pegar elementos e recombinar com algo seu; copiar inteiro o mesmo site para o mesmo nicho com o mesmo nome seria plágio (disclaimer do curso).

### Passo 2 - Capturar a referência como código
- Referência é **site** (URL): baixar com o Site Downloader 3.0 (https://sd.asimov.academy/; exclusivo dos alunos). Formato "duplo clique" primeiro; se o site não abrir, o formato "servidor local" (precisa de Python). Não baixa páginas com login. Detalhes em `references/ferramentas-e-referencias.md`.
- Referência é **só uma imagem**: não peça "recrie isto"; use a skill `img-to-html` (ver abaixo).
- Já veio do banco `ds.asimov.academy`: pule este passo.

### Passo 3 - Criar a base: design system em HTML
- Com o site baixado, chame a skill **`extract-ds`** (ver "Quando chamar as skills"). Ela entrega `design-system.html` com **Overview** (cópia funcional com texto trocado por Lorem Ipsum) e **Components** (tipografia, cores, backgrounds, superfícies, ícones, componentes, motion), com **duas aprovações suas**.
- **Valide visualmente** cada etapa e peça correção pontual ("a navbar no original era translúcida"). IAs erram; o check visual faz parte.
- Por que HTML e não texto/JSON: botões com animação, fundos animados e scroll effects só existem em CSS/JS; e você enxerga a mudança. Detalhe em `references/design-system-base.md`.

### Passo 4 - Aplicar o DS (criar algo novo)
1. **Conversa nova**, DS dentro do projeto, arquivo de saída novo (ex.: `index.html`).
2. Mencione o arquivo do DS (`@arquivo` nas IDEs do curso; no Claude Code cite o caminho) e diga **só o produto/conteúdo** e **o que usar do DS**. Modelo de prompt do curso:
   > Crie uma landing page de [produto]. Utilize este Design System como referência para seu projeto. [DS]. Use as animações, tipografia, cores, botões. Tudo o que encontrar nesse arquivo, para que nosso site fique tão bonito quanto este.
3. Para **recombinar**, cite 2 ou 3 DSs e diga o que vem de cada um (botão de um, fundo do outro, cards do terceiro).
4. Print só como complemento (qual dobra) ou para mostrar erro; **não** como base. Se o print mostra efeitos que ele não revela, descreva-os em texto.
5. Mais exemplos e o experimento em `references/aplicando-o-ds.md`.

### Passo 5 - Iterar sem destruir
Regras do projeto do portfólio (`references/portfolio-vibe-design.md`):
1. **Uma seção por vez.** Comece pela primeira: "Vamos começar pela primeira seção. Não faça mais nenhuma seção por enquanto."
2. **Trave o escopo em todo pedido:** "Não modifique nada nas seções 1 e 2", "não mude mais nada".
3. **Uma mudança (ou poucas e simples) por pedido;** corrija bugs primeiro, ajuste fino depois.
4. **Fundos diferentes** por seção ("não repita o background da seção 1").
5. Reporte bug com **print**; se a IA disser que corrigiu e nada mudou, mande print. Dê refresh você mesmo; peça à IA para não abrir o navegador a cada mudança (economiza tempo).
6. Seção insiste em bugar: "Apague toda a seção X e refaça do zero". Quebrou outra: "volte o código para o anterior" e reforce o escopo.
7. Resultado genérico: peça mudança radical com direção ("pense em novas cores, outras formas de mostrar esse card") e cite o DS de onde pegar (ex.: cards).
8. **Imagens:** peça busca (ex.: Unsplash) e "não gere nenhuma imagem" quando quiser fotos reais; arquivos do usuário precisam estar na pasta do projeto, com o caminho informado.
9. **Refino final em lote:** botões funcionais (âncoras), textos em português, alinhamentos, cor fora da identidade (o roxo reaparece), sobreposições.
10. Você é o **diretor/revisor**: a IA às vezes entrega algo sem sentido para o objetivo. Em nenhum momento o curso mexe em código à mão; peça a correção.
11. O chutômetro (pedir-ajustar-pedir) só vale aqui, para refinar algo que já tem base.

## Erros comuns a evitar (resumo; ver `references/erros-comuns.md`)
1. **Chutômetro** como método: sem controle, sem replicabilidade, mais token e tempo.
2. **AI slop:** aceitar o padrão do modelo (roxo/azul em 2025; serifada com itálico e telas poluídas no momento da gravação).
3. **DS "engessado"** em texto/JSON/Markdown: não carrega animação nem efeito vivo.
4. **Prompt único**, simples ou gigante, com "cargo" ("aja como designer premiado"): não resolve; alta abstração e conflito entre código e estética.
5. **Print + prompt como base:** perde fonte, gradiente, animação e interação; resultado varia a cada execução (modelos são probabilísticos).
6. **Pedir a página inteira de uma vez.**
7. Culpar a ferramenta: o método deve valer em qualquer modelo/ferramenta.
8. Rodar skill sem ler: skills executam scripts na sua máquina.

## Quando chamar as skills do curso (não recriar; vêm de cópia à parte)
| Situação | Skill | Como |
|---|---|---|
| Tenho um **site baixado** (index + assets) e quero o DS | `extract-ds` | Chamar `/extract-ds` ou "use a skill extract-ds" com a pasta do site. Pergunta se o site roda por `file://` ou servidor local. **Para após o Overview e após o Components** esperando sua aprovação. Entrega `<marca>-design-system/design-system.html`. |
| Tenho **só uma imagem** (mock, print, imagem gerada por IA) e quero HTML | `img-to-html` | Chamar `/img-to-html` e passar a imagem. Pipeline com 5 gates: wireframe ASCII + plano -> fundo -> componentes e fontes -> assets restantes -> revisão final. Entrega `design-systems/<slug>/index.html` + `assets/`. Só roda se **chamada pelo nome**. Depende das skills vizinhas `to-wireframe`, `openrouter-img` (e `OPENROUTER_API_KEY`) e opcional `find-font`: confirmar instaladas. |
| Quero **ideias fora da caixa** para a tela | imagem primeiro | Gerar a interface em um modelo de imagem (GPT, Gemini, NanoBanana; confirmar), depois `img-to-html`. Fluxo recomendado pelo instrutor: **prompt -> imagem -> código**. |
| Quero só **mexer** num DS ou tokens | skill irmã `design-system-por-ia` | Fora do escopo deste curso. |

Instalar skills: copiar a pasta da skill (a que contém `SKILL.md`) para a pasta de skills do agente (`.agents/skills/` no Antigravity; `.claude/skills/` no Claude Code), abrir conversa nova e testar ("Quais skills estão disponíveis?"). Evite a pasta extra de ZIP (`skills-main/…`). Repositório do instrutor: https://github.com/rtadewald/skills (pastas `extract-ds` e `img-to-html`).

## Decisão rápida
- Tenho URL de site -> Passo 2 (downloader) -> `extract-ds` -> Passo 4.
- Tenho imagem -> `img-to-html` -> (opcional) `extract-ds` no HTML gerado -> Passo 4. (A cadeia imagem -> DS não é demonstrada nas aulas; marcar "confirmar".)
- Não tenho nada -> Passo 1 (banco ou Aura.build) ou gerar imagem -> `img-to-html`.
- Resultado ruim -> Passo 5 (travar escopo, refazer a seção) antes de culpar o modelo.

## O que o curso não cobre (dizer ao usuário se perguntarem)
- Procedimento detalhado de **recombinar** dois DSs além de mencioná-los no prompt; promessa de aulas futuras.
- Apresentações, dashboards, apps, 3D e animações como projetos completos.
- Plano para site que o Downloader não consegue baixar (só pedir à equipe e usar extensões ou imagem).
- Responsividade, publicação, acessibilidade, performance.
- Medição de qualidade; os critérios são visuais e do gosto do instrutor.

## Dúvidas "(confirmar)" que podem afetar o uso
- Nomes de modelos e versões vindos de áudio (Whisper): "Grok 4.7", "Claude Opus 5", "GPT 5.6 Sol", "NanoBanana", "Monster Templates"; grafia dos DSs do portfólio ("Finex/Fiance Aura", "Aurora", "Instagram Slides").
- Nomes dos modos de agente do Antigravity ("Review/Agent Driven Development").
- Se `to-wireframe`, `openrouter-img` e `find-font` estão disponíveis na cópia local da `img-to-html`.
- Se o Site Downloader e o banco continuam acessíveis fora da formação (são exclusivos dos alunos).
- Texto exato do prompt de "analise o site antes de recriar" (reconstruído do áudio).

## Referências (nesta skill)
- `references/erros-comuns.md` - três problemas, prompts que falham, sinais de design amador.
- `references/imagem-mais-prompt.md` - o experimento de print + prompt e a variabilidade; uso de imagem como ideação.
- `references/design-system-base.md` - por que código-fonte, o que é o DS, saída do `extract-ds`, materiais antigos.
- `references/aplicando-o-ds.md` - experimento modelo fraco x forte, prompts, receita de aplicação e recombinação.
- `references/ferramentas-e-referencias.md` - links, banco, downloader, Antigravity/Cursor/CLI, instalação de skills, modelos citados.
- `references/portfolio-vibe-design.md` - passo a passo e prompts verbatim das 5 dobras.
- `references/apostila-resumo.md` - síntese da apostila "Fundamentos do Vibe Design".

## Fontes
Caminhos relativos a `asimov-academy/`:
- `O Método para Criar Designs Absurdos com IA (Asimov)/indice.md`
- `.../01 - Onboarding/01 - O método para criar designs absurdos com IA/transcricao.txt`
- `.../01 - Onboarding/01 - O método para criar designs absurdos com IA/materiais/Apostila - Fundamentos do Vibe Design.txt` (e `.pdf`)
- `.../01 - Onboarding/01 - O método para criar designs absurdos com IA/materiais/IMPORTANTE.md`
- `.../02 - Como fazer a IA criar designs incríveis/01 - Erros comuns ao codar com AI/transcricao.txt`
- `.../02 - Como fazer a IA criar designs incríveis/02 - Image + Prompt/transcricao.txt`
- `.../02 - Como fazer a IA criar designs incríveis/03 - A base para o design system/transcricao.txt`
- `.../02 - Como fazer a IA criar designs incríveis/04 - Aplicando o DS/transcricao.txt`
- `.../03 - Ferramentas essenciais para a formação/01 - O banco de referências (e onde conseguir mais)/transcricao.txt` e `materiais/links.md`
- `.../03 - Ferramentas essenciais para a formação/02 - Usando o site Downloader 3.0/transcricao.txt` e `materiais/links.md`
- `.../03 - Ferramentas essenciais para a formação/03 - Antigravity (e outras ferramentas para AI)/transcricao.txt`
- `.../03 - Ferramentas essenciais para a formação/04 - Instalando skills do GitHub no Antigravity IDE/transcricao.txt` e `materiais/links.md`
- `.../03 - Ferramentas essenciais para a formação/05 - A skill de 1000 dólares/transcricao.txt` e `materiais/` (SKILL.md, component-formats.md, file-conversion.md, prompts antigos v2 e v3; só lidos para saber quando usar)
- `.../03 - Ferramentas essenciais para a formação/06 - A skill img-to-html/transcricao.txt` e `materiais/` (SKILL.md, README.md)
- `Portfólio com Vibe Design (Asimov)/indice.md`
- `Portfólio com Vibe Design (Asimov)/materiais-do-curso/LEIA-ME.md`
- `Portfólio com Vibe Design (Asimov)/materiais-do-curso/Portfolio com Vibe Design.zip` (somente `Prompts_para_referencia.md` lido)
- `Portfólio com Vibe Design (Asimov)/01 - Projeto completo/01 - Introdução - Portfólio com Vibe Design/transcricao.txt`
- `Portfólio com Vibe Design (Asimov)/01 - Projeto completo/02 - Projeto na prática/transcricao.txt`
