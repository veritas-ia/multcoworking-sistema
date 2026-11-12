# Fluxo e frases que funcionaram no editor de código com IA

Do conjunto de 5 projetos. Editores citados: Antigravity (o áudio diz "Antigraft/Antigrafting"; com Gemini), Claude Code, Cursor, Windsurf ("Insurf/Insert/Devin"). "Pode usar o que preferir; prefira um com IA embutida." Conforme o curso (nov/2026).

## Setup (todos os projetos)

1. Pasta nova > terminal > `npm create astro@latest` (o áudio fala "astro-latest") > nome do projeto > aceitar as 3 primeiras opções do assistente (a aula não detalha quais são).
2. Abrir no editor com IA. `npm run dev` e abrir o link local para ver tudo em tempo real. Base recomendada: curso de Astro da Asimov (ver também `site-astro-do-zero`).
3. Pastas dentro de `src/assets`: `videos`, `fotos`, `parallax` (camadas numeradas), `scroll-scrub`, `famosos`, `apple` (imagens extraídas), pasta do site baixado/referência, `design-system`. Fontes em `public/fonts`.
4. Nomes curtos e claros (`hero.mp4`, `atleta1.png`): ajuda você e a IA.

## Ordem de trabalho do curso (padrão repetido)

1. Referência (site da categoria + site premiado + componente pronto).
2. Design system do site de referência (site downloader + prompt "extrair design system"; skill `design-system-por-ia`).
3. Assets com IA (imagens/vídeos; skill `imagens-videos-produto-ia`).
4. Dobra por dobra: **uma seção por pedido**, mandando **print da seção de referência** + design system + "recrie exatamente essa dobra... adaptado para o meu produto".
5. Corrigir em ciclos curtos (um ou três ajustes por mensagem).
6. Revisão geral: tirar o que a marca de referência "não colocaria" (ex.: etiqueta "Scroll scrub" visível; logo da Apple no header).
7. Rodapé/cabeçalho como componentes; padronizar fontes pelo design system; auditoria final de consistência (prompt "Audit & fix" no `projeto-apple-bottle.md`).

## Frases e padrões que funcionaram (verbatim ou quase)

| Situação | Frase |
|---|---|
| Replicar uma dobra | [print] "Recrie exatamente essa mesma dobra. Quero os mesmos cards, mesmas cores, mesmos espaçamentos, porém tudo adaptado para o meu produto X." |
| Hero em vídeo | "A primeira dobra deve ser exatamente assim, como na imagem. Use o design system. Coloque o vídeo ocupando todo o background. Atente-se de usar apenas um cabeçalho." |
| Evitar imagens da IA | "Não coloque imagens. Deixe um texto padrão." (1º passo, para só montar a estrutura) |
| Framework | "Use 100% .astro." / "Crie o componente" (header, footer) |
| Altura de dobra | "Ela deve ter 150vh" (vh = % da altura da tela; 100vh = tela cheia; 45vh = menos da metade) |
| Cor exata | [ColorZilla] "O background deve ter essa cor." (hexadecimal, ex.: `#fff` = branco) |
| Seção específica | Colar o **título da seção** (a IA acha no código) e dizer "nessa dobra do atleta 1, ..." para não mexer nas outras |
| Posição na página | "Coloque abaixo do vídeo." / "O marquee deve ser antes do vídeo." |
| Posição de imagem | "Muito mais para a direita", "mais para a esquerda", "diminua levemente" (itere em passos) |
| Limpeza | "Remova o efeito de scroll da imagem / a interação com o mouse / a tag de scroll scrub" |
| Erro de build | Colar o erro de volta na IA ("faltou importar o componente") |
| Aviso de fonte | "Baixei a fonte. Substitua." (nomear a fonte e pôr em `public/fonts`) |
| Dar contexto | "Quanto mais contexto ela tem, melhor o resultado": print + design system + site de referência (link) + imagens |
| Fila | Enviar vários pedidos seguidos; ficam em fila enquanto a IA trabalha (HP) |
| Prompt com arquivo | Arrastar o `index.astro` e os assets para o chat: "Utilize o material acima." |
| Caminho de pasta | "@src/assets/scroll-scrub" (menção de pasta no Claude Code) |

## Erros típicos da IA e conserto (todos vistos nas aulas)

- Dois headers > pedir "apenas um" + dizer qual.
- Layout "com cara de IA" > mandar print da referência, não só texto.
- Vídeo deslocado/com borda > print do problema + "não deve ter paddings nem margens, sem bordas e sem sombras".
- Camadas na ordem errada > numerar e dizer "a imagem 3 e 4 ficaram atrás da 2".
- Imagem enorme > conferir proporção do arquivo (9:16 vs 16:9) antes de culpar o CSS.
- IA ignora o JSON/estilo > ser mais rigoroso e repetir; extrair só a iluminação.
- Parallax no mouse em vez de scroll > "O parallax deve ser no scroll. Aplique as técnicas de scroll scrub."
- Números zerados, textos em inglês restantes, brasão antigo > conferir a página inteira e enfileirar correções.
- Animações perdidas ao baixar o site de referência > pedir ao Claude Code para comparar com a URL original e restaurar.
- Site baixado vem "indisponível" (ex.: Dior) > tentar a URL na IA; se falhar, usar outra referência.

## Escolher boas referências (aula 2 do Apple/Venezianico)

- Referência de **categoria** (garrafa tecnológica > Apple; relógio > site da marca + Apple Watch) e referência de **efeito** (parallax em site premiado; componentes em bibliotecas).
- "Antes de pedir para criar qualquer coisa, tenha uma boa referência". É o que evita "cara de IA".
- Dá para **misturar**: header/footer/fonte de um site, foto de outro, efeito de um terceiro.
