# Resumo da apostila "Fundamentos do Vibe Design" (Asimov Academy, 19 páginas)

Síntese fiel por capítulo. Material do curso; tratar preços e modelos como "conforme o curso (nov/2026)". A apostila tem algumas citações de modelos mais antigas que as das aulas.

## 1. Introdução ao universo do AI Design
- Antes, sites com animações sofisticadas, tipografia elegante e layouts de alta performance exigiam agências; um projeto custava **mais de R$ 10.000 por página**. Com IA e a técnica certa, o mesmo nível é possível, inclusive para interfaces de sistemas, dashboards e apps.
- Design amador gerado por IA: padronização excessiva (roxo e rosa viraram "meme"), falta de refino (dobras óbvias, fundos simplistas, tipografia descuidada) e ausência de movimento.
- Objetivo da metodologia: recriar páginas de alta qualidade, desenvolver e adaptar estilos próprios e elevar a capacidade de front-end para gerar valor percebido.

## 2. O conceito de vibe design
- Deriva de "vibe coding" (termo atribuído a um ex-engenheiro da OpenAI): você comunica a intenção e a IA executa a parte técnica.
- O profissional passa de **executor** para **diretor/supervisor** (define diretrizes, estilo, objetivo) e **revisor** (analisa, pede ajustes, garante padrão profissional).
- Fluxo tradicional (fragmentado): UI designer no Figma (a "planta") -> dev front-end (HTML/CSS/JS, o "empreiteiro") -> dev back-end. Vibe design faz esqueleto **e** construção ao mesmo tempo.
- Sem método a IA age como "estagiário iniciante"; com a metodologia vira uma "agência profissional sênior".

## 3. Possibilidades e mercado
- Site inteiro do início ao fim em **uma ou duas horas**; padrão visual "startup gringa" (layouts limpos, modernos, de alto impacto).
- Além de landing pages: dashboards de dados e aplicativos web; exemplo de modernizar dashboards antigos e lentos.
- Design systems: manual de marca completo (fonte, cores exatas, comportamento de botões, animações) = "DNA" visual. Aprender a **extrair** DSs de sites existentes e a **recombinar** identidades.
- Foco em direção, não em escrever código; analogia do arquiteto: o segredo é encontrar e selecionar as melhores referências. Há um **banco de referências** de sites e componentes.
- Escala e diferenciação: velocidade + qualidade permitem atender mais clientes e se destacar num mercado de resultados genéricos.

## 4. Erros comuns ao codar com IA
- Prompt único (one-shot), exemplo com Lovable: "Crie uma landing page dark, com neons e animações para um app de vídeos". Resultado: sites genéricos (roxo/azul), visual amador/infantil, limpeza excessiva (vazios e falta de backgrounds).
- Por que a IA falha em front-end: é treinada na média da internet (maioria de sites simples) e escolhe o caminho mais simples para o código funcionar; a Anthropic admite dificuldade em equilibrar código e design visual avançado.
- Ilusão dos prompts complexos ("Aja como um designer de UI/UX premiado e um desenvolvedor front-end sênior…"): continua medíocre por alta abstração e conflito de prioridades.
- Segredo: **metodologia, não ferramenta** (Lovable, Bolt, Cursor, Claude). Criar um sistema "à prova de futuro", sem depender da sorte do prompt; usar referências visuais e técnicas mais precisas.

## 5. A abstração visual (imagem + prompt)
- Modelos multimodais "enxergam" imagens. Teste: mesmo print e mesmo comando para Composer (Cursor), Gemini 3 Pro e Claude Sonnet.
- Prompt: "Recrie esta página que você está vendo. Salve em um arquivo chamado index.html. Preste atenção em todos os detalhes: fontes, cores, interface (UI), componentes e gráficos. Quero uma réplica perfeita."
- Resultado: estrutura geral correta, mas perda de refino (fontes grosseiras), degradês e glow simplificados, caixas e botões menos profissionais.
- IA é **probabilística**: três execuções iguais dão três resultados diferentes.
- A imagem não basta porque a IA a "traduz" para texto interno e perde: animações, tipografia exata (nome e peso da fonte) e interações (clique, hover). Precisa-se do **DNA real** do site.

## 6. O DNA do design (design systems)
- Tratar a IA como engenheiro lendo uma planta técnica, não como artista olhando uma foto. O **código-fonte** é a referência perfeita: a IA lê o valor exato em vez de imaginar.
- Design system = documento em código com tipografia (fontes, tamanhos, pesos), paleta (códigos exatos, fundos, gradientes), componentes de UI (botões, cards, menus) e animações (surgimento, vidro, hover).
- Experimento (landing de app de vídeos, referência Aura.build): Grupo A = Gemini 3 Pro só com prints e prompts detalhados -> aceitável mas simplista, animações básicas, gradientes "duros", cópia mal feita. Grupo B = Composer (mais simples e barato) só com o arquivo de DS -> site muito mais bonito e refinado (chuva no fundo, botões com animação de água, cards com transparência).
- Conclusão: com o "DNA", até um modelo simples entrega nível sênior; o domínio de extração e aplicação de DS dá **escala e previsibilidade**.

## 7. Ferramentas de trabalho e extração
- A IA opera com mais precisão com texto (código) do que com imagem. **Banco de referências** = sites reais baixados e organizados; cada referência tem: arquivo index (HTML original), pasta de assets (imagens, ícones, fontes, CSS/JS) e DS processado.
- Mais inspiração: **Webflow.com**, **Mobbin.com** (interfaces de apps e fluxos), **Aura.build** (layouts com animações sofisticadas e visuais futuristas).
- **Site Downloader:** extensões comuns falham em sites modernos; a ferramenta do curso (1) recebe a URL, (2) cria um "navegador invisível" que simula usuário real e carrega o que só aparece ao rolar, (3) entrega uma pasta local com o código-fonte. Não baixa páginas com login.
- **Ambiente:** Cursor (avançado e pago, preferido por seniores) e Antigravity (Google; gratuito e poderoso para iniciantes; a apostila cita "Gemini 1.5 Pro", enquanto a aula fala em Gemini 3 Pro).
- **Prompt de mil dólares:** nome vem do investimento em testes e tokens. Força a IA a atuar como "organizador de padrões", proibida de redesenhar ou inventar; gera um `DesignSystem.html` a partir do código baixado, extraindo classes CSS e animações (tempo e movimento), tipografia e cores por situação e componentes de UI (cards, menus, botões). Uso: colar o prompt no ambiente, referenciar o `index.html` baixado com `@` (ou arrastar) e a IA cria o **Living Design System**. Se não ficar perfeito, o diretor pede a correção específica sem reescrever código. (Hoje esse prompt foi substituído pela skill `extract-ds`; ver `IMPORTANTE.md`.)

## Divergências entre apostila e aulas (priorize as aulas)
- A apostila fala do prompt de mil dólares; as aulas atuais usam a skill `extract-ds`.
- Modelos citados na apostila (Claude 3.5 Sonnet, Gemini 1.5 Pro, GPT-4o) são mais antigos que os das aulas (Gemini 3 Pro, Claude Sonnet 4.5 etc.).
