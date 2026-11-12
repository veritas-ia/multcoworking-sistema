# Prompts do fluxo (ditados nas aulas)

Atenção: o professor prometeu os prompts do vídeo e do site como material, mas o único arquivo de prompt incluído é o `Prompt.txt` do design system (verbatim em `design-system-por-ia/references/prompts-verbatim.md`). Tudo abaixo vem da fala das aulas (legenda de áudio) e foi apenas limpo de tropeços; o sentido é fiel. Trocar o que está entre colchetes.

## 1. Prompts para a IA de texto montar prompts de mídia (vídeo hero)

Frame inicial (anexar a foto):
> Crie para mim um prompt, para eu passar para outra IA de geração de imagem. Quero que [o produto] esteja no ar, com fundo branco, em destaque, boa iluminação. Vou utilizar isso como o frame inicial de um vídeo, que irá para o site de vendas dele. É importante que o fundo seja branco e que ele se destaque.

(O professor escreveu "IA de geração de vídeo" e a IA seguiu mesmo assim; o prompt funcionou.)

Frame final:
> Excelente. Agora crie o prompt para o frame final do vídeo que criaremos. [O produto] deve estar [na vertical escrevendo num caderno Moleskine já parcialmente preenchido].

Correção de enquadramento:
> A foto gerada mostra apenas um pedaço do produto. Quero que o produto inteiro apareça, com todos os seus detalhes. [O produto] não pode ser cortado pelo frame.

Transição:
> Agora crie um prompt para uma IA de vídeo animar e fazer a transição do primeiro frame ao último frame. Este vídeo será usado em uma hero de um site. Estamos dirigindo um comercial.

## 2. Prompt para a IA de texto montar o prompt da hero (anexar print de referência)

Esqueleto fiel à fala (corrigi "rolo para cima" para "rolo para baixo"):

> Gostaria de ajuda para criar um prompt para um agente de IA que vai criar um site para mim. Quero que ele crie um index.html contendo uma hero apenas, de venda de [produto]. Estou enviando um print com uma referência de layout que eu gostaria que meu site tivesse: [lettering ao lado, botões abaixo, detalhes à direita]. Quero que ele modele o layout desta imagem, mas a identidade geral está no design system. Possuo dois arquivos importantes: um design_system.html, que contém regras de tipografia, cores, layouts e animações, que ele deve usar para a estética do site; e um vídeo, com o qual quero um efeito de parallax estilo site da Apple: à medida que eu rolo para baixo o vídeo avança, e quando eu subo o vídeo volta. Mande ele caprichar nos detalhes e nas animações. Pense sobre possíveis bibliotecas de JavaScript e CSS que poderiam ser utilizadas via CDN para fazer o que eu quero da melhor forma possível.

O que o prompt devolvido pela IA continha (use como checklist do que o prompt final deve ter): papel ("front-end motion designer sênior"); tarefa (site estático com apenas uma hero, para vender [produto]); arquivos disponíveis (DS e vídeo) e o que cada um fornece; entregável (um `index.html`, CSS embutido permitido, bibliotecas permitidas, acabamento "pixel polished", micro animações, transições, hover states, scroll); objetivo visual e layout de referência descritos posição por posição; regras de design (DS como fonte da verdade, extrair tipografia, paleta, tamanhos, pesos, tokens CSS; estética clean, premium, high-tech, estilo Apple); funcionalidade do vídeo (ver `video-hero-scroll.md`); bibliotecas recomendadas, evitando frameworks grandes e dependências desnecessárias, performance como prioridade; conteúdo.

Como enviar ao agente: novo chat, melhor modelo disponível (é onde vai a maior parte da energia), marcar o DS (`@design_system`) e o vídeo. Rodar 2 ou 3 execuções em paralelo, cada uma salvando em um arquivo (index1, index2...), e continuar só na melhor.

Por que passar pela IA de texto antes: ela descreve melhor o layout visto no print (posições, nomes de componentes) e sugere tecnologias que o usuário não saberia nomear; o professor usa a IA "para me ajudar a descrever para outra IA o que eu quero".

## 3. Dobras seguintes (falas do professor ao agente)

Dobra com referência (print do Aura.build ou de outro site; no exemplo, modelando só a estrutura mesmo com site preto):
> Agora vamos construir a nossa segunda dobra. Gostaria que você utilizasse o layout desta imagem de referência, mas use a nossa identidade visual para montar isso. Você pode, inclusive, fazer uma nova foto usando a foto [do produto] como referência para colocar nesta dobra. Fale dos benefícios [do produto] ser tecnológico. Use termos específicos e que agregam muito valor. Seja criativo e bem apelativo. Faça uma dobra linda com animações de entrada e saída, capricho, o máximo que puder.

Correção quando saiu invisível ou na cor errada:
> Nada está aparecendo. Nosso site tem identidade visual branca. Era apenas para modelar o layout: inspirar, mas respeitar nosso DS.
> Ainda assim os elementos estão invisíveis.

Refino (pedir duas ou três vezes, sem mexer no resto):
> Detalhes, animações, background, pequenos efeitos. Quero um polimento agora desta segunda dobra. Lembre-se do design system. (marcando o DS de novo)
> Algum background para dar textura, transição, detalhes, pequenas animações. Seja criativo e pense como o site poderia ficar mais bonito.

Dobra sem referência (deixar a IA decidir):
> Monte agora uma terceira dobra com o que você julgar que faça mais sentido. Faça ela bem caprichada, dê o seu máximo.

Dobra com efeito de outra referência nomeada:
> Faça uma quarta dobra que contenha o vídeo no fundo, algum box com efeito de glow destacando algo que você julgar importante e relevante. [marcar o arquivo de animações que tem o glow]

Planejamento (estratégia de refletir com a IA):
> Que seções você colocaria se fosse fazer esse meu site do zero? Um plano de ação, descreva brevemente cada uma delas.

## 4. Prompts de organização para deploy (professor ao agente)

> Mova o design system para a pasta de templates e ajuste todos os imports dele para que ele siga funcionando.
> Você poderia fazer uma reorganização no meu projeto para que ele fique mais profissional, pronto para o deploy? Estrutura de pastas correta, ajustar pequenos bugs.
> As imagens e os vídeos não estão aparecendo no index.html. É só uma questão de apontar para o lugar certo.

Para o fluxo de modernização de site existente, ver o prompt verbatim de organização em `design-system-por-ia/references/prompts-verbatim.md`.
