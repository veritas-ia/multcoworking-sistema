# Fundamentos para se orientar (sem virar aula de HTML)

Fonte: módulo 1 do curso "Construindo sites profissionais com IA". O professor deixa claro que o curso não ensina a programar: o objetivo é entender o suficiente para escrever instruções corretas, porque "a gente precisa de um certo domínio técnico sobre o assunto que a gente quer pedir ajuda para a IA". IA não faz qualquer pessoa fazer qualquer coisa.

## Site estático e as 3 linguagens

- Site estático: página sem back-end pesado (sem login, sem operações complexas); o visitante só interage com o que já foi carregado. Mesmo sites com animações grandes (exemplo dado: página de AirPods da Apple) são estáticos. É o tipo que o curso constrói.
- HTML posiciona: marca onde cada elemento fica (blocos, textos, cards, qual classe cada um usa).
- CSS estiliza: família e peso da fonte, cores, display; o HTML aponta uma classe e o CSS define como essa classe se comporta. O professor chama de linguagem de formatação.
- JavaScript dá vida: interatividade (cliques, troca de imagem, efeitos). Esta sim é linguagem de programação (lógica condicional) e roda no navegador do visitante.
- Dá para ver o código de qualquer site: botão direito -> "Exibir código-fonte" ou "Inspecionar". Útil para entender uma referência, mas é difícil de ler.
- Num projeto: um `index.html`, arquivos `.js`, uma folha `.css`.

## O que acontece quando alguém abre um site (versão simplificada)

URL digitada -> o navegador pergunta a servidores DNS (a "lista telefônica" que liga o nome ao computador que guarda o site) -> o servidor onde o site está hospedado devolve HTML, JS e CSS -> o navegador renderiza. O professor avisa que simplificou muito; serve para a intuição ao pedir coisas à IA. Hospedagem = esse computador que mantém os arquivos disponíveis mesmo com o seu desligado.

## Vocabulário para pedir à IA

- Dobra / seção: cada bloco do site (o termo "seção" aparece como sinônimo de dobra).
- Hero: a primeira dobra, a "capa". Recebe a maior parte da energia do design (o professor fala em 80% da energia; afirma que cerca de 70% dos visitantes nem chegam à segunda dobra, citando dados de mapa de calor; é afirmação dele).
- Copy: os textos do site.
- Lettering: o desenho/efeito do texto de título.
- H1, H2...: níveis de título; H1 é o texto principal.
- Fade in / blur in / slide in: surgimento do zero / desfocado que foca / deslizando. Com atraso escalonado entre elementos fica mais elegante.
- Parallax: ao rolar, elementos sobem em velocidades diferentes (podem até se sobrepor). O efeito de "vídeo que avança e volta conforme a rolagem" é o estilo Apple.
- Efeito de saída de parallax: elementos somem em momentos diferentes à medida que se rola.
- CDN: repositório público de bibliotecas JS/CSS que o site referencia por link.
- Stack: conjunto de tecnologias/bibliotecas/linguagens escolhidas.
- Index: nome padrão da página principal (`index.html`).
- Design system (DS): ver skill `design-system-por-ia`.
- Deploy / produção: colocar o site na internet com URL pública.
- Commit: o checkpoint do Git.
- Import: o caminho que o HTML usa para chamar CSS/JS/imagens; se o arquivo muda de lugar e o caminho não, quebra.
- Hard refresh: recarregar ignorando cache (Cmd+Shift+R no Mac/Linux; Shift+F5 no Windows, o professor diz "acho que").

## Os 3 princípios

1. Simplificação de instruções: uma instrução por vez. Pedir o site inteiro de uma vez, ou "copie este site", é a pior forma; a IA fica preguiçosa e tenta resolver tudo rápido. Faça bloco a bloco: primeiro toda a energia na hero; depois uma dobra por vez. Para melhorar fundo, animações ou posicionamento de uma dobra, peça só aquilo.
2. Simplificação de stack: escolha a stack mais simples (HTML + CSS + JS básicos). React, Vue, Next.js etc. aumentam arquivos e complexidade e a IA se perde, porque o contexto dela é constantemente reiniciado. Este é o motivo do projeto do curso ser HTML estático. (Se quiser um framework de site, veja `site-astro-do-zero`: é outra escolha, não ensinada neste curso.)
3. Calma com a IA: ela erra e alucina. O professor teve de pedir seis ou sete vezes a mesma coisa (uma animação circular de botão que sumiu e nunca voltou). Seguidos os dois primeiros princípios, erra menos. O site-modelo levou umas 4 a 5 horas porque ele testou muitas combinações; com direção clara é bem menos, e ainda é "infinitamente menos" que fazer do zero em código (a primeira versão de um site anterior dele levou semanas).

## Git em uma página

- Serve para fazer checkpoints do código, voltar quando a IA estraga algo e, depois, ligar com GitHub/Vercel. O curso indica um curso separado de Git/GitHub na formação (não incluído aqui).
- Instalar: site do Git (Windows precisa instalar; Ubuntu e Mac normalmente já vêm). Teste no terminal do editor: digitar `git`; se aparecer "usage: git ...", está instalado; se der "comando não encontrado", instale.
- Extensão do editor recomendada: Git Graph (mostra a linha do tempo dos commits).
- Abrir a pasta do projeto no editor, "Initialize Repository" (ou `git init`).
- Comandos usados nas aulas estão em `checklist-deploy.md`.
