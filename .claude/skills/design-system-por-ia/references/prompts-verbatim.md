# Prompts verbatim (design-system-por-ia)

Tudo abaixo vem dos materiais dos cursos da Asimov, copiado sem alterar (inclusive erros de digitação do original). O que o professor apenas disse em voz alta está na seção 5 e marcado como ditado. Os trechos entre parênteses ou com "@" são lugares onde o professor marcava arquivos na interface do editor: troque pelos seus arquivos.

## 1. Criar DS por recombinação criativa (curso "Construindo sites profissionais com IA", aula "Criando DSs", `materiais/Prompt.txt`)

Metade de cima = aberta (criatividade). Metade de baixo (depois da linha) = fechada (estrutura exigida). Em "Ul Components" o original traz "Ul" no lugar de "UI"; mantido.

```
Quero que você crie um novo design_system.html, que deverá ficar em @assets

Ele deverá ser uma combinação CRIATIVA dos seguintes design systems e arquivos:
@index.html @design-system.html @index.html @index.html

Seu novo design system deverá ser BEM baseado neste: @design-system.html (focando especialmente no lettering transparente dele e no fato ser branco). Use as demais páginas para se inspirar, pegar animações e elementos bonitos que encontrar lá.

Capriche, especialmente na primeira dobra, que deve/pode conter imagens que encontrar por lá, animações, efeitos em botoes, backgrounds, detalhes e animações de surgimento, glow...

Foque nos detalhes e crie algo fora da caixa.

No seu design system, você deve referenciar as mesmas classes CSSs e JS usadas nos arquivos apontados.

____________

Seu design system final deve conter:

1. A primeira dobra como sendo uma hero de demonstração das capacidades do design system. Capriche muito aqui.

2. Tipografia
- Font families (primary, fallback stack, monospace if any)
- Font loading strategy (local, CDN, weight ranges)
- Full type scale: h1 → h6
- body-lg / body / body-sm - captions / labels / helper text
- For each text role:
- font-family
- font-weight (numeric)
- font-size
- line-height
- letter-spacing
- text-transform

3. Sistema de cores
- Hex, RGB, HSL
- Opacity variants
- Gradient participation
- Semantic role:
- primary / secondary / accent / neutral / feedback / decorative
- Contextual usage rules:
- text / background / border / hover / active / disabled
- Contrast intent (AA / AAA if inferable)

4. Ul Components (com animações)
- For each detected component, define a full spec:
- Buttons
- Inputs
- Cards
- Navbars
- Sections
- Modals
- Badges
- Tooltips

5. Icones
6. Animações

Em todas as dobras você deve utilizar repetidamente as animações de fundo, de transição (surgimento) e as que ficam nos botões e componentes.
Também capriche no background das sessões, focando em algo elegante, com animação no fundo também, se possível.
```

## 2. Criar DS para um cliente real (curso "Modernizando Sites Antigos com Design Systems", `materiais/Prompts_Utilizados_nas_Aulas.md`, aula 1.3)

O exemplo é um escritório de advocacia; troque o segmento, as cores e o tom. O "/" do original é a pasta raiz do projeto.

### Prompt 1 (gerar ds1.html; repetir em chats separados trocando o nome do arquivo para ds2.html, ds3.html)

```
Olá.

Estou fazendo o redesign de um site para um escritório de advocacia. Gostaria que você analisasse 3 arquivos contendo design systems para mim e, baseado neles, criasse um novo design system que representasse a beleza que esses arquivos possuem em termos de efeitos, animações, detalhes, cores... mas que também fosse adequado para um escritório de advogados, onde queremos passar segurança.

O seu design system final deverá ser salvo na pasta / e deverá ter o nome de ds1.html.

Creio que você possa trabalhar o site com fundo claro e fontes puxando para o branco e opte pela fonte mais séria que encontrar. No restante, use sua criatividade para entregar o melhor DS que conseguir.

Baseie-se na estrutura que encontrar nos arquivos em questão para montar seu design system (buscando por tipografia, cores, UI components, espaçamento, animações, classes CSS e JS, bordas...) 

Aqui estão os arquivos:
```

(Depois do "Aqui estão os arquivos:" o professor marca os 3 arquivos de DS.)

### Prompt 2 (refinar o DS escolhido, no mesmo chat que o gerou)

```
Gostei do (insira aqui o arquivo) mas acho que falta vida, animações, mais riqueza. Quero que você adicione mais efeitos que encontrar no (insira aqui o arquivo). Efeitos em botões, fade in e blur in no surgimento dos elementos, gradientes, animações, etc...

Deixe nosso design system mais caprichado.

Quero também que remova qualquer fonte em itálico.

Também gostaria de trocar as cores amarelas no DS por um azul (que tem mais relação com segurança/advocacia).
```

### Prompt 3 (hero)

```
Quero que dê uma boa caprichada na hero. COloque algum background (baseando-se no que viu nos DSs anteriores).
```

## 3. Site antigo para site novo (mesmo material, aula 1.4)

### Prompt 1 (arquivo intermediário site.md)

```
Estou fazendo o redesign desse site aqui (insira o index do site).

Gostaria que você me ajudasse neste processo.
Quero que você crie um arquivo intermediário que será utilizado futuramente como ponto de partida para criação do site.

Este arquivo intermediário deverá se chamar site.md e conterá, dobra a dobra, a copy presente lá, bem como uma representação simples do layout do site em ASCII.  
Por exemplo:
  
"# HERO  
copy, copy, copy ...

## layout  
(ascii layout here)

# DOBRA 2...  
..."
```

### Prompt 2 (gerar o index.html novo)

```
Ok. Analisando a estrutura presente em (insira o site.md aqui) (copy e layout), bem como imagens e assets que encontrar em (insira o index.html do site aqui), quero que crie um index.html localizando-o em / que seria um redesign deste site.

Mas, para capricharmos, use (insira o ds1.html aqui) como fonte da verdade para o design (use as mesmas cores, efeitos, transições, hero section, botões, ...) tudo que encontrar lá nesta nova página.
```

## 4. Organizar para produção (mesmo material, aula 1.5)

```
Ok. Gostaria de colocar meu site em produção, mas quero antes organizar a estrutura do projeto.

O (insira aqui o ds1.html) é apenas um arquivo de referência para o design system e poderia ser movido para dentro do (insira aqui o a pasta design_systems) (ajustando todos os caminhos que ele aponta, para que o arquivo não quebre).

(Insira aqui o novo index) é o nosso novo index. Tudo que está em (insira a pasta do site antigo aqui) poderia ser colocado em uma pasta de backup (junto dos design_systems).

Quero que você também crie uma estrutura para organizar todos os CSS, JS e assets utilizados pelo nosso novo index.
```

## 5. Falas do professor (ditado, transcrição de áudio; NÃO são material oficial)

Frases que ele disse ao agente durante as aulas, úteis como molde. A transcrição é de áudio: pontuação e algumas palavras podem estar imprecisas.

- Contraexemplo (o que NÃO fazer, para provar que pedir vários DS num só prompt dá resultado preguiçoso): "Eu quero que você crie três novos Design Systems que deverão ficar salvos em Assets. Eles deverão ter os nomes ds1.html, ds2.html, ds3.html."
- Gerar variações em chats separados: "Eu quero que você crie um novo design system, que é o design system 2, que deverá ficar na mesma pasta [...] e, claro, deve ser bem baseado nesse aqui." (repetindo a lista de arquivos de referência e trocando o número a cada chat).
- DS que saiu quebrado: "O design ficou bugado, não parece bem formatado." (resumo falado: "você entendeu o que tinha que fazer, mas produziu errado; investigue o que fez de errado").
- Refinar o DS por pedidos curtos e abertos (aula 3 do curso de modernização): "Gostei do Design System 1, mas acho que falta vida, animações, mais riqueza" seguido do pedido de efeitos de outra referência (ver Prompt 2 acima).
