# Projeto Valentino (estúdio de perfume: parallax, borrifada, vídeo que expande, accordion, loop)

Site de exemplo: https://valentino-asimov.vercel.app (material em /material). Usa Claude Code como editor de IA (a aula 2 diz: "hoje vou utilizar o Claude Code", mas pode usar outro). Fonte do projeto: "DIN OT" (no zip do material, fechado). Paleta: roxos/violetas/ameixa e preto.

## Dobras e como cada uma foi pedida

**1. Hero com parallax de 5 camadas + produto montado em cima.**
- Gerar 5 PNGs alinhados (1 prompt, ver `imagens-videos-produto-ia`), colocar em `src/assets/parallax` numerados 1 a 5 (1 = fundo). Pedido: "Cria a primeira dobra usando um parallax. Utilize as imagens que temos em @assets/parallax."
- Erros: camadas 3 e 4 ficaram atrás da 2; a 3 ficou enorme > "A imagem 3 e 4 ficaram atrás da 2", "a imagem 3 está extremamente grande. Diminua", "pode baixar a imagem 3". O parallax saiu **reativo ao mouse** e o professor aceitou assim nesta dobra.
- Produto separado em **tampa, borrifador e frasco** (3 PNGs do mesmo tamanho, pasta `parallax/product`, P1 P2 P3): "Coloque o nosso produto em cima da imagem 3. O produto está dividido em tampa, frasco e borrifador... P1, P2, P3". Como têm o mesmo tamanho, basta empilhar para parecer um produto único.
- Falhou no tamanho: print do trecho errado + print da tela inteira + "o perfume está em tamanhos totalmente errados" + "tire tudo que está escrito na hero".

**2. Segunda dobra: frasco desce, tampa sai e borrifa o texto em partículas.**
- Prompt (feito pelo professor com o GPT; o texto exato não está nos materiais): descer o frasco, tirar a tampinha e borrifar informações na tela.
- A IA perguntou como obter o produto (não gera imagem): "reutilizar o produto que está na hero; o produto possui P1, P2 e P3".
- 1ª versão não era o desejado: "A imagem que temos na hero deve se deslocar para a segunda dobra, usando **scroll scrub**." Depois: "Tudo o que está escrito aqui deve ser escrito em partículas que saem como a borrifada do frasco." Resultado: o nome "Valentino" preenchido por partículas saindo do borrifador, com um efeito extra que ele nem tinha pedido.
- O material traz também um prompt de **imagem** dessa composição (frasco à esquerda, partículas formando título/notas à direita), útil como referência visual/layout.

**3. Terceira dobra: vídeo que expande no scroll (scroll scrub com frames).**
- Referência: anúncios de perfume (busca "Perfume Creative Ad"); GPT troca o perfume e o cenário/frutas por roxos; prompt de vídeo (GPT) > Google Flow (Elementos, 16:9, Veo 3.1 Fast).
- Converter o vídeo em frames (8 FPS, 75%, 64 imagens) e colocar em `src/assets/scroll-scrub`.
- Pedido: "Na terceira dobra do nosso site, coloque esse vídeo [...] para se expandir e ocupar 100vh [o áudio diz 'sem VH', e explica: toda a largura e toda a altura da tela]. Quero que o vídeo comece menor e se expanda até ocupar toda a tela. Utilizando as técnicas de scroll scrub. [@src/assets/scroll-scrub]"

**4. Quarta dobra: accordion de colunas (Colonnade) com as imagens dos "embaixadores".**
- Escolhido entre vários componentes: "esse aqui já me chama mais atenção, porque ele ocupa a imagem inteira na tela". Outros descartados: um com 3D, e outros que "precisam de muito mais imagens do que a gente tem".
- Imagens 9:16 em `assets/famosos` (3 pessoas). Pedido: "Crie a quarta dobra do nosso site. Utilize essas imagens... A quarta dobra deve ser esse componente: [prompt do componente]." O prompt do material está resumido em `receitas-efeitos.md` (seção Colonnade).

**5. Última dobra: loop de vídeos (45vh).** "Crie a última dobra do nosso projeto. Ela deve ser de 45vh [...] e deve rodar em loop a sequência de vídeos presentes na pasta assets/vídeos." A aula avisa que parece "bugado" porque falta o rodapé.

**6. Header, footer e design system.**
- Design system: baixar o site de referência (Dior) e o do próprio produto no site downloader; colocar em `src/designSystem`; prompt "Design System Showcase Builder" do material (gera `design-system.html` reutilizando classes, animações e estados exatos do HTML de referência; ver skill `design-system-por-ia`). O site da Dior veio como "página indisponível" e a tentativa por URL também falhou; o professor fez **só o design system do site do Valentino** (o de uma marca diferente nem faria sentido).
- "Com base nesse design system crie um rodapé e um cabeçalho para o nosso site." Erro: componente sem importar; **colar o erro de volta na IA** corrigiu.
- "Aproveite o design system para adaptar e padronizar todas as fontes do site." A IA avisou que a fonte não existia no Google Fonts: baixar manualmente, pôr em `public/fontes`, dizer "baixei a fonte. Substitua" mencionando o nome.

## Cuidados específicos

- Pessoas reais famosas como embaixadores: ver aviso em `imagens-videos-produto-ia` (direito de imagem).
- Vídeos de IA deformam frasco/logo; o professor aceitou o resultado "para fins do exemplo".
