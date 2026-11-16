# Imagem + prompt (e por que não basta)

Fontes: aula 02-02 "Image + Prompt", apostila cap. 5, aula 01-01 e aula 03-06 (img-to-html). Conforme o curso (nov/2026).

## A técnica
Multimodalidade: o modelo "enxerga" imagens. Em vez de descrever o site só com palavras, você manda um print do que admira e pede para recriar.

## Experimento do curso
Print de um site moderno (seção principal em card com bordas arredondadas, lettering e pricing fora do padrão, segunda dobra bonita), mesmo prompt, vários modelos. Modelos usados na gravação: Composer (modelo pequeno do Cursor), Gemini 3 Pro, Claude Sonnet 4.5. Também Gemini 3 Flash três vezes seguidas.

**Prompt verbatim (versão da apostila):**
> Recrie esta página que você está vendo. Salve em um arquivo chamado index.html. Preste atenção em todos os detalhes: fontes, cores, interface (UI), componentes e gráficos. Quero uma réplica perfeita.

Na aula falada: "Recrie esta página que você está vendo. E salve aí um arquivo chamado index.html. Preste atenção em todos os detalhes. Fontes, cores, UI, componentes, gráficos, tudo. Quero uma réplica perfeita." Cada modelo salvou em um arquivo diferente (index, index 2, index 3).

## Resultados observados
- Estrutura geral certa (menu, textos, seções), mas "cópia mal feita".
- Fontes diferentes (mais grosseiras), degradês e brilhos simplificados, caixas e botões menos refinados.
- Composer e Claude Sonnet ficaram simples; Gemini um pouco melhor, ainda longe do original.
- **Variabilidade:** o mesmo modelo (Gemini 3 Flash), a mesma imagem e o mesmo prompt, três vezes, deram três resultados diferentes (fonte fina ou grossa, botão azul ou roxo). Modelos são probabilísticos.
- Com animações ou efeitos, a imagem estática não transmite nada.

## Por que a imagem não basta
A IA traduz a imagem internamente para tokens/descrição em texto e depois codifica. Nessa tradução se perdem: (1) animações; (2) tipografia exata (nome da fonte, peso); (3) interações (clique, hover); (4) nuances de cor e gradientes. A imagem vale como guia de layout, mas não captura "a alma" nem o refino técnico.

## Conclusão do curso
Print + prompt é "OK" e melhor que texto puro, porém **insuficiente** como base. Falta o "DNA real" do site, que é o código-fonte (ver `design-system-base.md`).

## Onde a imagem volta a ter valor (aula 03-06, mais recente)
O instrutor reposiciona a imagem em outro papel: **ideação criativa**, não cópia. Quando a IA gera uma imagem da interface, não fica presa ao HTML e explora composição, inclinação e hierarquia. O fluxo vira **prompt -> imagem -> código**. O problema que sobra é imagem -> código (modelos erram, demoram 20 a 30 min, oscilam), e a skill `img-to-html` resolve isso em camadas com aprovação. Ver `ferramentas-e-referencias.md` (seção skills) e a seção "Quando usar img-to-html" no SKILL.md.

Modelos de imagem citados para gerar a tela ou os assets: modelo de imagem do GPT, do Gemini, "GPT Image 2" e "NanoBanana" (grafia a confirmar; o SKILL.md da skill diz GPT Image 2 via OpenRouter).

## Regra prática
- Tem **site de referência** (URL/arquivo)? Use o caminho do código (Site Downloader + `extract-ds`).
- Tem **só uma imagem** (mock, print ou imagem gerada)? Use `img-to-html`, nunca "recrie isto" em uma tacada.
- Print só entra como **complemento** (mostrar qual dobra você quer) quando há DS junto, ou para apontar um erro na iteração ("você errou aqui").
