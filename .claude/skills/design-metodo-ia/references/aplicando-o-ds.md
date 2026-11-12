# Aplicando o design system

Fontes: aula 02-04 "Aplicando o DS", apostila cap. 6 e 7, aula 03-03 (@ no Antigravity) e projeto do portfólio. Conforme o curso (nov/2026).

## Experimento: modelo ruim + técnica certa x modelo bom + técnica errada
Referência: página do Aura.build com efeito de chuva e botão com animação (no pacote do curso, "Lumina Video", já com DS gerado). Tarefa: landing page de um app de criação de vídeos com IA.

| | Modelo | Insumo | Resultado |
|---|---|---|---|
| A | Gemini 3 Pro (bom em design) | só prints + prompt detalhado + descrição dos efeitos | Bom para o insumo, mas simplificado: chuva sem diagonal, gradiente invertido, glow "duro", fonte itálica inventada, animação de entrada parcial. |
| B | Composer (fraco) | só o arquivo de DS | Replicou botão com linhas animadas, botão efeito água, vídeo de vidro, chuva de fundo, cards com animação de entrada, cards de depoimento, tudo "do cerne do código". Falhou em um gradiente e no pricing. |

Conclusão do curso: o DS reduz a variabilidade e deixa qualquer modelo consistente. Nas aulas seguintes o curso usa modelos melhores (Gemini, Claude), com resultado ainda melhor.

## Prompts (verbatim das aulas; lembrar que vêm de áudio, texto pode variar)

**Grupo A (técnica "print"):**
> Crie para mim uma landing page de um aplicativo de criação de vídeos com a IA. Crie um design muito bonito baseado nesse print que estou te passando. Salve o projeto em um novo arquivo chamado newsite.html. Capriche!

Complementado com descrições do que o print não mostra: botões com linhas de animação que passam levemente; efeito de chuva; animação de surgimento ao trocar de dobra.

**Grupo B (técnica DS):** o instrutor apagou a maior parte do prompt e marcou o DS com a menção ao arquivo:
> Crie uma landing page de um aplicativo de criação de vídeos com a IA. Utilize este Design System como referência para seu projeto. [menção ao arquivo do DS]
> Use as animações, tipografia, cores, botões. Tudo o que encontrar nesse arquivo, para que nosso site fique tão bonito quanto este.

Salvar em arquivo novo (ex.: `newsite-composer.html`) para comparar lado a lado.

## Receita para aplicar um DS (derivada das aulas)
1. **Chat/conversa novo** no agente, com o DS (pasta `design-system.html` + assets) dentro do projeto.
2. **Mencionar o arquivo do DS** (`@arquivo` no Antigravity/Cursor, que é o que o curso mostra; o curso não demonstra o equivalente no Claude Code, onde o natural é citar o caminho do arquivo). O `@` serve para apontar o que a IA deve ler.
3. **Dizer o produto/conteúdo** (o que a página é) e o **arquivo de saída** novo.
4. **Mandar usar do DS**: animações, tipografia, cores, botões e o que mais interessa. Quanto mais curto o resto do prompt, mais o DS manda.
5. Se for o caso, **apontar** o que pegar de cada DS ("use o botão do DS X"; "use os cards do DS Y"). É assim que o curso faz recombinação na prática (ver `portfolio-vibe-design.md`).
6. **Uma seção por vez** e iterar com correções pontuais (ver SKILL.md, passo 5).
7. Conferir no navegador; mandar **print** do erro quando a IA não entender ("você errou aqui").

## Aplicar ou recombinar?
- **Aplicar:** um DS, conteúdo novo.
- **Recombinar** (apostila e aulas 01-01/01-03): misturar elementos de DSs diferentes ("gostei do botão deste e do fundo daquele"; "lettering deste com as cores daquele") para criar identidade nova. No projeto do portfólio foram dois DSs de referência (um escuro tipo fintech/IA e um dashboard) + um terceiro só para os cards.

## Escopo do que o curso mostra
Só landing pages e página de portfólio em HTML estático. Apresentações, dashboards, apps, animações e 3D aparecem como metas do método, sem passo a passo nestas aulas. Responsividade, deploy e SEO não são tratados.
