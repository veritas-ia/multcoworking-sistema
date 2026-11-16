# Vídeo de fundo da hero, controlado pela rolagem

Fonte: aulas "Criando o nosso vídeo com Whisk e Google Flow", "Criando a primeira dobra a partir do DS" e o aviso "Whisk migrou para o Flow". Etapa opcional: serve a sites que vendem um produto com o efeito "estilo Apple", em que rolar a página avança e volta o vídeo.

## Aviso de ferramenta (conforme o curso, nov/2026)

O material do curso avisa que o Whisk migrou para o Flow e que, a partir de 30/04/2026, o Whisk deixa de existir. Gere as imagens dentro do próprio Flow; o aviso também cita "outras plataformas gratuitas" do curso "Gerando Imagens Profissionais com IA", que não está neste material. As aulas foram gravadas com Whisk + Flow + Veo 3.1; os menus podem ter mudado.

## Etapa 1: imagens do primeiro e último frame

1. Tenha uma foto simples do produto (no curso, foto de celular de uma caneta branca). A foto é só o ponto de partida.
2. Peça a uma IA de texto (o professor usou GPT; diz que serve qualquer uma, inclusive gratuita) um prompt melhorado para o gerador de imagem. Dê a foto e o objetivo: produto no ar, fundo branco, em destaque, boa iluminação, será o frame inicial de um vídeo para o site de vendas. Frase dele, ditada (ver `prompts-do-fluxo.md`).
3. Gere no gerador de imagens (Whisk, hoje Flow). Ele devolve 2 versões. Se vier errado, descreva o erro ("a foto mostra só um pedaço da caneta, quero a caneta inteira com todos os detalhes"; "a caneta não pode ser cortada pelo frame").
4. Repita para o frame final (no curso: caneta na vertical escrevendo num caderno Moleskine já parcialmente preenchido). Pode escolher uma imagem que não é a que você pediu mas ficou melhor.

## Etapa 2: animar no Flow

1. No Flow, trocar o modo para "frames para vídeo" (não usar a parte de texto).
2. Subir a imagem inicial e a final; cortar bordas escuras que o gerador deixa.
3. Pedir à IA de texto o prompt da transição: "agora crie um prompt para uma IA de vídeo animar e fazer a transição do primeiro frame ao último. Este vídeo será usado em uma hero de um site." Cole no Flow.
4. Modelo: Veo 3.1 versão qualidade (há também a Fast; o professor achou o Veo 2 pior). Gerar 2 vídeos, formato paisagem 16:9. Leva 1 a 2 minutos.
5. Escolha o melhor (física e aparência). Os resultados variam a cada rodada (modelos estocásticos); no curso o vídeo gratuito tem resolução limitada e artefatos típicos de IA; 4K exige upgrade pago do Flow; Sora 2 e Veo 3 são citados como opções melhores se quiser qualidade maior. Baixe a versão ampliada.
6. O vídeo gerado tem áudio, mas na hero ele fica sem som (muted).
7. Guarde os dois vídeos na pasta do projeto; trocar de um para outro depois é fácil.

Tempo citado: cerca de 30 minutos de trabalho para o vídeo.

## Etapa 3: comportamento da hero (o que o prompt intermediário deve pedir)

A IA de texto, dado o print de layout, o DS e o vídeo, descreveu a funcionalidade assim (resumo fiel da aula; os números foram ouvidos em áudio):

- hero com área de rolagem maior que a tela (algo como 180 a 240 vezes a altura da tela; "180x240xview-height" na transcrição, confirmar) e um container sticky que prende o vídeo;
- vídeo muted e playsinline; a rolagem controla o tempo atual do vídeo, de 0 até a duração (rolar para baixo avança, subir volta);
- evitar frameworks grandes e dependências desnecessárias; performance é prioridade; sugerir bibliotecas JS/CSS via CDN adequadas.

Problemas reais encontrados e como foram resolvidos (sempre um pedido por vez):

| Sintoma | Pedido |
|---|---|
| Vídeo pequeno, não ocupa a tela | "Eu gostaria que o vídeo ocupasse toda a tela na primeira dobra, que ele fosse a peça central." |
| Vídeo travando | "O meu vídeo não está fluido o suficiente. Seria possível implementarmos alguma outra stack de tecnologias que performasse melhor, mais fluida?" A IA trocou a técnica e ficou fluido em cerca de 30 s. Na aula de deploy aparece uma pasta com os "frames do vídeo", sugerindo que a solução usou sequência de frames (confirmar). |
| Texto no centro, quer à esquerda e compacto | Mandar o print da referência: "O texto deveria ficar à esquerda mais compacto, conforme esta referência." |
| Espaçamento vertical grande no H1 | "Apenas o tamanho da fonte e o espaçamento vertical entre as linhas está muito grande, especificamente no H1. Olhe novamente a referência, olhe como o H1 é mais compacto que o nosso." |
| Sumiram os efeitos de entrada/saída | Pedir fade in, blur in e blur out, elementos saindo em momentos diferentes (efeito de saída de parallax) e mandar usar de novo as animações e classes do DS. |
| Texto some/ilegível; elemento de scroll sobre os botões | Descrever o sintoma e pedir correção; no exemplo o professor aceitou o resultado "quase" e seguiu. |

Dica do professor: depois de aceitar as mudanças, faça hard refresh do navegador para ver o resultado real.

## Parallax e animações avançadas

Este curso só usa o essencial. Para parallax e animação de rolagem com biblioteca dedicada, veja a skill irmã `site-parallax-gsap-ia`.
