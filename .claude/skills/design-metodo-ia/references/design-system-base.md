# A base do método: design system em HTML

Fontes: aula 02-03 "A base para o design system", aula 01-01, apostila cap. 6 e 7, aula 03-05 (skill extract-ds) e materiais antigos da aula 05. Conforme o curso (nov/2026).

## A ideia central
Um site é descrito de forma perfeita pelo seu **código-fonte** (HTML, CSS, JS), que é texto, e modelos de linguagem trabalham bem com texto estruturado. Quando a IA lê o código da referência, deixa de adivinhar cor, fonte e animação: lê o valor exato. Prints e descrições passam por uma tradução com perda (ver `imagem-mais-prompt.md`).

Mas copiar o site não é o objetivo. O objetivo é **extrair o DNA** (um design system) e usá-lo para criar **outra** coisa.

## O que é o design system neste método
- Um arquivo/pasta **em HTML** que funciona como "DNA visual" do site: uma página viva, não um JSON ou Markdown.
- Conteúdo: tipografia (fontes, pesos, tamanhos por nível de título, uso), paleta (códigos exatos, fundos, gradientes), bordas, superfícies/cards, componentes de UI (botões, cards, menus), animações (surgimento, vidro, hover), espaçamento.
- Por que HTML e não texto: um botão com borda animada, um fundo de chuva ou um efeito de scroll só existem como CSS/JS. Em HTML você também **vê** a mudança ao trocar uma cor.
- O próprio instrutor diz que não há definição única de DS na internet; esta é a que ele considera melhor para trabalhar com IA.

## Efeito comprovado nas aulas
- Aula 02-03: o Composer (modelo "ruim" em design) recria uma dobra a partir do print **mais o site-fonte** e fica muito melhor que só com o print. Instrução usada (reconstruída do áudio; confirmar texto exato):
  > Recrie esta dobra para mim, mantendo todas as animações, efeitos, botões, etc. Quero uma cópia perfeita, que deve ser salva no arquivo index.html.
  >
  > Mas antes de criar o site, quero que analise no detalhe este site aqui. Foi dele que retirei a dobra que te passei no print. Se você analisá-lo, tem tudo o que precisa para criar a dobra: tipografia, cores, espaçamento, componentes, UI, gradientes, tudo. Utilize a mesma folha de estilos dele para criar nosso index7.html, uma cópia exata. Seja cuidadoso ao analisar.
  Ressalva do próprio instrutor: isso é cópia; o ponto é reduzir variabilidade, e o uso real é criar **algo novo** a partir do DS.
- Aula 02-04 e apostila: modelo fraco + DS vence modelo forte + prints. Ver `aplicando-o-ds.md`.

## Como se chega ao DS (cadeia do método)
1. **Referência**: site bonito (banco de referências ou outros; ver `ferramentas-e-referencias.md`).
2. **Captura**: baixar o site com o Site Downloader (o curso fornece; funciona como "navegador invisível" que carrega inclusive o que só aparece ao rolar). Resultado: `index.html` + `assets/`.
3. **Extração**: transformar o site baixado em DS usando a skill **`extract-ds`**. Alternativa quando só há imagem: skill **`img-to-html`**.
4. **Estrutura de cada referência no banco**: arquivo index (HTML original), pasta de assets (imagens, ícones, fontes, CSS/JS) e o DS processado (apostila cap. 7). Os do banco do curso vêm pré-processados para gastar o mínimo de tokens.

## O que a skill extract-ds produz (resumo; a skill é copiada à parte, não recriar)
- Chamada: `/extract-ds` (ou pedir "use a skill extract-ds…") apontando a pasta do site. Cria `<nome-da-marca>-design-system/design-system.html` ao lado do site.
- Fluxo com **duas aprovações**: (1) **Overview**, uma cópia funcional da página com texto de marketing trocado por Lorem Ipsum, mantendo as animações principais; o agente pára e você valida visualmente; (2) **Components**, só depois da aprovação, decompõe o que existe no Overview.
- Preflight: decide se o site abre por `file://` ou exige servidor local; se exigir, pergunta se quer adaptar para `file://` (mais lento, DS final mais prático).
- Grupos do catálogo (aula 05 + `component-formats.md`): tipografia (tamanhos desktop/tablet/celular, peso, família), cores por função, backgrounds, superfícies (cards), ícones, componentes completos (movimento/animação, navegação, formulários, gráficos, feedback, mídia). Regra: **só entra o que foi observado na página original; nada é inventado**.
- Na gravação: ~3 min até o Overview, ~8 min com correção, processo completo mais demorado; o instrutor disse que a versão entregue é mais eficiente. Tempos de uma gravação, não garantia.
- Follow-up de exemplo na aula (a navbar saiu preta e o original era translúcido): "A navbar não está 100% condizente, já que no original ela era translúcida." Mensagem do instrutor: IAs são imprecisas, por isso o **check visual ao longo do processo** é bom.

## Materiais antigos (não usar; só contexto)
O `IMPORTANTE.md` do curso diz que estes não são mais usados:
- "Prompt de $1.000 - Extract HTML Design System" (v2): prompt que cria um `design-system.html` com seções Hero (clone exato, texto adaptado), Typography, Colors & Surfaces, UI Components, Layout & Spacing, Motion & Interaction, Icons. Regras: não redesenhar, reusar classes e animações exatas, não incluir o que não existe.
- "Extract HTML Design System v3": prompt que extrai CSS/JS inline para arquivos, classifica SVGs (Lucide, currentColor, cores fixas) e reescreve o `design-system.html` mais enxuto, com traduções para PT-BR e `STACK.md`.
Substitutos atuais: a skill `extract-ds` e o banco `ds.asimov.academy`.

## Dica de qualidade herdada da apostila
IAs são probabilísticas e podem errar na primeira extração. Papel do "diretor" é pedir correção **pontual** ("a navbar deveria ser translúcida"), nunca reescrever código à mão.

## Fora do escopo do curso
- Como "recombinar" dois DSs em um terceiro: o curso promete aulas futuras ("recombinar entre si"); neste material aparece apenas na prática do portfólio (usar dois DSs via menção ao arquivo e dizer o que pegar de cada um). Para organizar DSs e tokens por conta própria, ver a skill irmã `design-system-por-ia`.
- Apresentações, animações, 3D e apps: citados como possibilidade, sem aula aqui.
