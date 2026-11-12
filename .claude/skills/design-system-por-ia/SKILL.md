---
name: design-system-por-ia
description: "Cria um design system (DS) em HTML com IA, recombinando referências ou a partir de um site antigo, e usa esse DS como fonte da verdade para gerar páginas novas ou modernizar sites antigos. Traz o passo a passo, os prompts verbatim dos cursos da Asimov (recombinação criativa, DS para cliente, site.md com layout ASCII, organização para produção), a estrutura exigida do DS e as checagens. Use quando o pedido for 'criar design system', 'criar DS com IA', 'recombinar design systems', 'modernizar site antigo', 'redesign de site', 'gerar site a partir de design system' ou 'refazer a cara de um site de cliente'."
---

# Design system por IA

Método dos cursos "Construindo sites profissionais com IA" e "Modernizando Sites Antigos com Design Systems" (Asimov). Ideia central: a IA desenha bem quando recebe um DS rico e referências; sem eles, entrega o "site padrão de Lovable, todo branquinho, todo limpo", sem animação. O DS é um arquivo HTML que o site depois referencia.

Skills irmãs: `site-com-ia-do-zero` (fluxo de ponta a ponta, primeira dobra, deploy), `design-metodo-ia` (prompt de extração de DS, banco de referências, img-to-html), `site-parallax-gsap-ia` (parallax/GSAP). Para publicar: `site-astro-do-zero`.

Ferramentas e versões citadas (Google Antigravity, Gemini 3 Pro/3.1, Claude 4.5, Cursor, Site Downloader) são "conforme o curso (nov/2026)" e podem estar velhas. O método não depende da ferramenta: precisa de um editor com agente de IA que leia a pasta do projeto, de preferência vários chats em paralelo.

## Regras que valem em todo o fluxo

1. Uma tarefa por vez por chat. Pedir 3 DS num só prompt dá DS preguiçoso (sem animação, tipografia sem tamanhos, 4 cores, 4 ícones). Pedir um DS por chat dá DS completo.
2. Prompt aberto para criar, fechado para estruturar. Parte de cima "dá os teus pulos" (criatividade); parte de baixo lista exatamente o que o arquivo deve conter.
3. Repetir o que importa ao longo do prompt (criativo, capriche, animações, "baseado neste"). O professor trata isso como técnica de engenharia de prompt: instrução repetida não é esquecida.
4. Dizer onde caprichar. Só "capriche" não basta; nomear animações de surgimento, efeitos em botões, backgrounds, glow, detalhes.
5. Usar o melhor modelo disponível para criar o DS. Nos testes do professor (nov/2026), Gemini 3 Pro saiu mais criativo e variado que Claude 4.5 e GPT, e Claude saiu "mais simplificado". Pode ter mudado.
6. A IA erra e varia de rodada para rodada. Aceite, peça correção, e guarde checkpoint no Git a cada acerto.

## Fluxo A: criar um DS do zero por recombinação

1. Escolha 3 a 4 arquivos de referência (DS .html ou index.html de template) e um "pilar". Critério: combinar com o produto. Exemplo do curso: caneta branca -> DS branco como pilar (lettering transparente, surgimento lateral, slider), mais uma referência de animações (fade + blur in com atraso escalonado, botão que pisca no hover) e outra com muitos ícones.
   - Referência sem DS pronto: gere um DS dela com o prompt de extração (ver `design-metodo-ia`) ou, em último caso, passe o próprio `index.html` dela (o professor diz que também funciona).
2. Abra a pasta do projeto no editor com agente. O DS novo fica em `assets/`, ao lado das referências.
3. Monte o prompt a partir de `references/prompts-verbatim.md` (seção 1): troque os arquivos marcados e o texto do pilar ("BEM baseado neste"). Mantenha a linha separadora: acima, criatividade; abaixo, estrutura (ver `references/estrutura-ds.md`).
4. Rode N chats em paralelo, cada um com o mesmo prompt, nome de saída diferente (design_system_2.html, 3, 4) e, se quiser, modelos diferentes. O professor rodou 2-3 vezes por modelo; no projeto original gerou 8 DS. No Antigravity é preciso re-marcar os arquivos de referência em cada chat; ele cita que o Cursor roda várias execuções com o mesmo prompt e que, em módulos avançados da formação (fora destes cursos), mostra Claude Code/Gemini CLI para isso.
5. Abra cada resultado no navegador e avalie com as checagens de `references/estrutura-ds.md`.
6. DS bugado (estilo não carregou): no mesmo chat diga "O design ficou bugado, não parece bem formatado" e deixe a IA investigar; aceite as mudanças e reabra. Na aula, o DS 3 saiu quebrado por apontar para as classes CSS erradas e foi corrigido assim.
7. Escolha o melhor e refine com pedidos curtos no mesmo chat (ver Fluxo B, passo 5 e prompts 2 e 3). Guarde também os DS descartados: o professor os distribui como banco de opções.
8. Commit do DS escolhido. O site passa a apontar para ele; ele aponta para as referências.

## Fluxo B: modernizar um site antigo (exemplo: escritório de advocacia)

1. Baixe o site antigo inteiro (index + assets) para uma pasta do projeto. O curso usa o Site Downloader da Asimov (sd.asimov.academy), que é de outro curso da formação. O professor escolheu um site funcional mas visualmente datado e reaproveitou as mesmas imagens.
2. Escolha 3 DS de referência coerentes com o cliente. No exemplo: majoritariamente claros (um com lettering moderno e poucas animações, um "Jane Labs" (confirmar) usado antes no curso, um não escuro com ideias de animação/slides). O banco de referências foi reorganizado em pastas de temas escuros, claros e componentes (vem do curso 1 da formação; o professor sugere baixar de novo se a sua cópia for antiga, porque o banco foi atualizado).
3. Gere ds1, ds2, ds3 em chats paralelos (prompt 1 de `references/prompts-verbatim.md`, seção 2), com o melhor modelo. Aqui o prompt é propositalmente aberto, para usar a criatividade; o professor nomeia o segmento e o sentimento ("passar segurança") e pede "fundo claro, fonte mais séria que encontrar". Lembre-o de buscar tipografia, cores, componentes, espaçamento, animações, classes CSS/JS e bordas, porque arquivos de referência passam de mil linhas e a IA ignora detalhes se não for lembrada.
4. Antes de mexer: `git init`, `git add .`, `git commit -m "checkpoint inicial"` para poder voltar.
5. Escolha a melhor base (no exemplo, ds1) e refine, nos prompts 2 e 3: mais vida e animações copiadas de uma referência nomeada, fade in e blur in no surgimento, gradientes, remoção de itálico, troca de amarelo por azul (segurança), background na hero. Apague os DS não usados do projeto.
6. Gere primeiro o arquivo intermediário `site.md` (prompt 1, seção 3): copy dobra a dobra mais um layout em ASCII de cada dobra. Motivo do professor: indo direto do site antigo para o novo, a IA "costuma alucinar e inclusive trocar o texto". Use um modelo leve, é tarefa simples.
7. Gere o `index.html` novo (prompt 2, seção 3) a partir de `site.md` + imagens/assets do site antigo, tratando o DS como "fonte da verdade" (mesmas cores, efeitos, transições, hero, botões). No exemplo saiu em 3-4 minutos, tudo de uma vez, por ser site simples. Para sites maiores o curso recomenda dobra a dobra: 2-3 versões da hero, aprovar, depois a próxima dobra.
8. Compare novo x antigo lado a lado e itere em pedidos pequenos (no exemplo: rosto do advogado ficou escuro e escondido; ajustar canto, animações, cores).
9. Organize para produção (prompt da seção 4): DS para uma pasta `design_systems` com caminhos corrigidos, site antigo para uma pasta de backup junto, e estrutura para CSS, JS e assets do index novo. Teste abrindo o index depois da mudança, porque mover arquivos pode quebrar apontamentos.
10. Publicação: ver `site-com-ia-do-zero` (referência de deploy) e `site-astro-do-zero`.

### Se o site antigo é WordPress/Elementor/Wix

Recomendação do professor: não adapte o site antigo; recrie uma instalação do zero, só com os arquivos necessários e publique (ele aponta para o módulo de deploy do curso anterior, feito com Vercel). Motivo: esses construtores carregam muito código próprio que não se adapta bem. O curso diz que mais de 30% da web é WordPress. Ele não ensina, nestas aulas, como trocar o site que já está no ar pelo novo (DNS, redirecionamentos, migração de conteúdo): é lacuna.

## Como usar o DS para gerar uma página

- Marque o DS no chat como fonte da verdade e diga o que é só layout: prints de referência servem para modelar a estrutura, nunca para a identidade (o DS cuida disso).
- Peça uma dobra por vez (detalhes em `site-com-ia-do-zero`).
- A cada poucos pedidos, remarque o DS para a IA lembrar das classes e animações.

## Limites e lacunas (o curso não cobre)

- Responsividade/mobile do DS e do site: não ensinado nestas aulas.
- Tokens exportáveis, teste de acessibilidade, documentação do DS fora do HTML: não ensinados.
- Módulo 2 do curso de modernização (sites com vários links, baixados por inteiro): citado na abertura, mas as aulas transcritas só trazem o módulo 1 (página estática).
- O site antigo do exemplo é de terceiros e serviu só de demonstração. Para trabalho real, o curso sugere oferecer o serviço a clientes com sites antigos; use o site do próprio cliente (isto é cuidado nosso, não do curso).

## Dúvidas (confirmar)

- "Jane Labs", "DigitalArchitect.Auro.Build" (provavelmente aura.build), "Gemini Animations", "Instagram Slides": nomes de arquivos de referência ouvidos em áudio; confirmar nomes exatos no banco de referências.
- O modelo citado no curso de modernização é "Gemini 3.1 High"; no curso de sites é "Gemini 3 Pro". Confirmar qual era o rótulo real.
- Prompt de $1.000 ("Extract HTML Design System"): está no curso "Fundamentos do Vibe Design", não nestes materiais.

## Fontes (relativas a asimov-academy)

- `Construindo sites profissionais com IA (Asimov)/02 - Criando um site incrível do zero com IA/02 - Criando DSs/transcricao.txt` e `.../materiais/Prompt.txt`
- `Construindo sites profissionais com IA (Asimov)/01 - Princípios e ferramentas fundamentais/02 - Quais ferramentas/transcricao.txt` e `.../04 - Os 3 princípios fundamentais/transcricao.txt`
- `Construindo sites profissionais com IA (Asimov)/02 - Criando um site incrível do zero com IA/05 - Explorando estratégias alternativas/transcricao.txt`
- `Modernizando Sites Antigos com Design Systems (Asimov)/01 - Curso completo/` aulas 01 a 05 (transcricao.txt) e `03 - Criando nosso design system/materiais/Prompts_Utilizados_nas_Aulas.md`
- `Modernizando Sites Antigos com Design Systems (Asimov)/materiais-do-curso/LEIA-ME.md`
