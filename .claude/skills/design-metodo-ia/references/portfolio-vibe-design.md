# Projeto: portfólio com vibe design

Fontes: curso "Portfólio com Vibe Design" (intro + "Projeto na prática", 36 min) e `Prompts_para_referencia.md` (dentro do zip de materiais do projeto). Conforme o curso (nov/2026).

## Resumo do projeto
Página de portfólio de 5 dobras construída do zero, **sem escrever código**, com o modelo gratuito do Antigravity (Gemini Flash, sem cartão) e o Claude só para gerar o texto. Pessoa fictícia: Lucas Petry, analista de dados (Nubank, Google, Asimov). Resultado: botão com hover/animação diferente, animação de scroll, cards de projeto com efeito 3D no hover, depoimentos em rolagem horizontal infinita, contato no final. Pacote do projeto: pasta `Portfolio` (index.html, style.css, assets com logo e foto) + `Prompts_para_referencia.md`.

## Passo a passo (decisões do instrutor)
1. **Definir o que é a página e o conteúdo antes do design.** Pedir ao Claude um texto simples (o capricho é estético, não de copy). Estrutura pedida (descrita em aula, não verbatim):
   - Dobra 1 (Hero): foto, headline, subheadline, botão que leva à dobra 2.
   - Dobra 2: quase um currículo, linha do tempo de empresas.
   - Dobra 3: principais projetos.
   - Dobra 4: quatro depoimentos.
   - Dobra 5: chamada final com contatos.
2. **Escolher referências** no banco (ele já tinha pré-selecionado por gosto: animações de botão, hierarquia, azul contra preto, fundo animado, cards amarelo/preto). Abrir cada referência **no Antigravity** (clique direito, abrir com) e usar os **arquivos de DS** do banco.
3. **Misturar referências:** a primeira dobra usa **dois DSs** (um de finanças/IA escuro com azul e fundo animado, e um dashboard). Nomes dos arquivos no zip: `design-system-fiance-aura.html` e `index-cool-dashboard.html`; para cards da dobra 3, `index-instagram-slide.html`. (Na fala: "Finex", "Aurora", "Instagram Slides"; grafias a confirmar.)
4. **Construir uma seção por vez** e sempre travar o escopo ("não faça mais nenhuma seção", "não modifique nada nas seções 1 e 2"). Razão do instrutor: pedir a página inteira obriga a IA a fazer tarefas em paralelo e piora o resultado; travar o escopo evita alucinações (fonte desnecessária) e evita que a seção nova quebre as anteriores.
5. **Plano de implementação:** o Antigravity gera um plano antes de executar; para página estática o instrutor o considera simples e padrão, mas confiável. Dar "Accept" nas mudanças.
6. **Iterar com bugs reais.** O instrutor mostra que o primeiro resultado vem com bug (foto não carrega, header deslocado, fundo sem vida). Rotina: relatar o bug (com **print** quando necessário), pedir correção pontual, atualizar a página no navegador **ele mesmo** (pediu para o agente não abrir o navegador a cada mudança), aceitar a mudança.
7. **Quando a seção insiste em bugar**, mandar **apagar a seção e refazer do zero** ("Apague toda a seção 2 do arquivo e refaça do zero"). Se a IA estragar uma seção anterior, pedir "volte o código para o anterior" e reforçar o travamento de escopo.
8. **Variar fundos:** exigir que cada seção tenha **fundo diferente** das outras ("não repita o background da seção 1").
9. **Pedir "mais vida"** quando a primeira versão é genérica: animação, hover, destaque diferente nos cards, outras cores/formas; ou citar um DS de referência para os cards ("use como referência de cards o @index-instagram-slide"). A dobra 3 só ficou boa depois de uma mudança "radical" pedida em texto ("pense em novas cores, outras formas de mostrar esse card").
10. **Refino final em lote**, sempre com "não mude mais nada": botão da seção 1 diferente do outro botão; botão funcional levando à seção certa; remover botão "conhecer mais" não funcional; logos das empresas na linha do tempo (a IA não achou o logo de uma empresa; o instrutor colocou o arquivo na pasta do projeto e avisou o caminho); títulos em português; títulos centralizados ao centro da página; trocar o roxo das seções 4 e 5 pelo azul da identidade; centralizar CTA e deixar botão visível.
11. **Imagens:** pedir **busca no Unsplash** para ilustrar (projetos, fotos de pessoas nos depoimentos) e **"não gere nenhuma imagem"**. Arquivos locais precisam estar dentro da pasta do projeto e a IA precisa ter acesso à pasta.

## Prompts verbatim (do zip `Prompts_para_referencia.md`)

**Primeira dobra**
```
Crie uma landing page baseada na referência desses dois design systems.
Vamos começar pela primeira seção. Não faça mais nenhuma seção por enquanto.

Design system de referências:

@design-system-fiance-aura.html
@index-cool-dashboard.html

O texto que irá na primeira seção, com um espaço à direita para
colocar uma foto do Lucas Petry.

Headline: Dados que explicam.
Decisões com impacto.

Subtítulo: Eu ajudo a transformar dados brutos em repostas claras
para negócios que não têm tempo a perder.
```

**Segunda seção**
```
Beleza, agora vamos para a segunda seção. 
Não faça nenhuma modificação na primeira seção.

A ideia da segunda seção é mostrar uma 
linha do tempo, precisa ter um animated scroll
para dar um efeito elegante.

Lembre-se de manter os cards de cada empresa com o nome da empresa em
destaque, embaixo a descrição e o ano precisa estar fora, mais próximo da linha.
Mantenha os cards próximos 

Headline: De números a estratégia: uma 
trajetória construída com grandes 
empresas.

Linha do tempo:
2020 - Nubank
Analista de dados no time de crédito. Primeiro contato com dados
em escala: milhões de transações, decisões em tempo real, cultura
orientada a evidência.

2022 - Google
Integrou o time de analytics de porduto. Trabalhou com métricas
de engajamento e retenção, desenvolvendo modelos preditivos
usados por squads de produto globais.

2024 - Asimov Academy
Lidera projeto de análise e automação para uma das
principais edtechs de tecnologia do Brasil. Foco em
performance de campanhas, comportamento de alunos e
decisões de negócio baseadas em dados.
```

**Terceira seção**
```
Agora vamos para a seção 3, é muito importante que seja outro background, 
não pode ser o mesmo da seção 1 ou da seção 2.

A ideia é ser uma seção dedicada aos projetos reais que a pessoa executou, 
busque imagens no Unsplash para ilustrar cada projeto de forma real. 
Não gere nenhuma imagem, apenas busque no unsplash. O texto é este abaixo:

Projetos que eu já criei

1. Dashboard de Performance Comercial
Nubank · 2021
Centralizou métricas de vendas e inadimplência em um painel único.

2. Análise de Churn de Clientes
Nubank · 2021
Identificou os principais fatores de cancelamento em uma base de 500 mil usuários.

3. Modelo de Segmentação de Usuários
Google · 2022
Criou clusters comportamentais para personalização de produtos.
```
Depois que o layout da seção 3 ficou certo:
```
perfeito, atenção: não modifique nada nas seções 1 e 2.
Quero apenas que modifique o estilo dos cards na seção 3
e coloque ela um pouco mais para cima, pq está muito distante da seção 2.

Use como referência de cards o @index-instagram-slide.html
```

**Quarta seção**
```
Show de bola, não modifique nada nas seções 1,2 e 3...
e vamos para a 4.

A idéia é colocar depoimentos de uma forma incomun... elegante, com
efeitos de animação e scroll automático, dos depoimentos passando...
O texto é este:

Pessoas com quem trabalhei

[ Coloque aqui os depoimentos ]
[ Nome da pessoa - "depoimento" - Função da pessoa, empresa ]
```
Depois que a IA acertou:
```
show.. não altere absolutamente nada nas outras seções. Coloque
mais elegancia nos cards, coloque glass morphism, torne-os transparentes 
contra o fundo escuro  para dar uma sensação futurística.
```

**Quinta seção**
```
Perfeito... Não mude nada nas seções 1,2,3 e 4... e apenas crie uma seção 5.
Garanta que não vai haver nenhuma sobreposição.

Headline: Seu próximo projeto pode ser guiado por dados.

Subtítulo: Se você tem perguntas que seus dados ainda não
responderam, é aqui que a conversa começa. 

Fale com Lucas e descubra que está escondido nos números da sua empresa.

[Botão: Entrar em contato]
```

## Follow-ups usados em aula (do áudio; aproximados)
- Foto sem vida: pedir animação na foto, ícones de ferramentas (Python etc.) ao redor "de forma delicada e elegante", borda mais chamativa, título em duas linhas (diminuir fonte se necessário).
- Botão: "modificar o botão Ver projetos para ficar mais parecido com a referência" citando o DS (o botão do DS tinha animação que diferenciava a página).
- Fundo: "colocar uma animação de background conforme a referência". Quando a IA disse que fez e nada mudou, o instrutor mandou print.
- Linha do tempo bugada: cards lado a lado da linha (esquerda/direita alternando), linha mais grossa e com preenchimento chamativo; outro background na seção 2.
- Último ajuste de cor: trocar o roxo das seções 4 e 5 pelo azul usado na página.

## Lições do instrutor (final da aula)
- O resultado depende do **olhar de quem dirige**: a IA às vezes entrega algo sem sentido para o seu objetivo.
- Saber **ir e voltar** e lidar com bugs faz parte do processo; em nenhum momento ele mexeu em código.
- Houve problemas de acesso a arquivos (foto/logo não encontrados): salvar o arquivo na pasta do projeto e informar o caminho.

## Adaptar para um portfólio real
O curso orienta usar dados reais, texto mais completo ("você pode fazer um portfólio de um jeito, outros de outro"). O número e a ordem das dobras são escolha do exemplo, não regra. O curso não cobre publicação, SEO nem responsividade do portfólio.
