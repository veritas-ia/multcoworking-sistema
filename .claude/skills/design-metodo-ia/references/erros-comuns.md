# Erros comuns ao criar design com IA

Fonte: aulas "O método…" (01) e "Erros comuns ao codar com AI" (02-01), apostila (caps. 4 e 5). Tudo "conforme o curso (nov/2026)": os vícios dos modelos mudam a cada geração.

## Os três problemas que o método quer evitar (aula de abertura)

| Problema | O que é | Por que acontece | Como o método responde |
|---|---|---|---|
| **Chutômetro** | Pedir um site, ver o resultado, pedir ajuste, estragar outro elemento, repetir até "gostar". | Sem processo: não é replicável, gasta mais token e tempo, e você não tem controle. | Processo fixo (referência, DS, aplicação). O chutômetro só serve para **refinar** algo já criado, nunca como base. |
| **AI slop** | Designs com a "assinatura" do modelo. Em 2025: roxo e degradê azul-roxo. No momento da gravação: fonte serifada com itálico; telas poluídas (vício atribuído ao Claude). | Modelos são estatísticos e seguem o caminho mais provável. Cada geração tem padrões novos. | Guiar a IA com um DS real para ela fugir do padrão. O curso diz que as próximas gerações terão outros vícios; o método não depende do vício atual. |
| **Design systems "engessados"** | DS em texto/JSON/Markdown (fonte, cor, borda, espaçamento em frases). | Texto descreve fonte, cor e borda, mas não um botão com borda animada, um fundo animado ou um efeito de scroll. | **Design system em HTML** (vivo, com CSS e JS), peça central do método. |

## Erros específicos (aula 02-01 e apostila cap. 4)

1. **Prompt único (one-shot) simples.** Exemplo da aula, no Lovable: "Crie para mim uma landing page de um aplicativo para criação de vídeos com a IA. Eu quero um design dark, com neons, efeito de vidro, animações e background com efeitos legais. Capriche!" Resultado: roxo com degradê azul, animações amadoras, aparência "infantil", neon fraco, dobras limpas demais (seções vazias de fundo; a animação só apareceu porque foi pedida).
2. **Prompt único elaborado.** Pedir a um chat para "melhorar o prompt" (prompt dado: "Crie um prompt para mim para construir uma página de um SaaS de criação de vídeos com a IA. Quero um design dark, tech e bonito, com animações e backgrounds. Capriche."). Volta com cargos ("award winning UI UX designer", "senior front-end developer") e tudo em texto. Resultado igual: azul para roxo, imagem com cara de IA e letras erradas, botões sem graça, segunda dobra limpa demais. **Mais texto não resolve.**
3. **Por que o prompt falha** (duas razões da apostila): (a) alta abstração: converter texto em código funcional **e** deslumbrante é tarefa pesada demais; (b) conflito de prioridades: a IA cuida do código funcionar e sacrifica a estética. Analogia da apostila: pedir ao pedreiro que desenhe a planta, escolha a decoração e construa a casa só com uma descrição falada.
4. **Achar que o problema é a ferramenta.** O curso diz que trocar Lovable por Bolt, Cursor ou Claude muda o resultado, mas o que se quer é uma metodologia que **não dependa do modelo nem da ferramenta**, porque os modelos são atualizados todo dia e às vezes pioram em design.
5. **Print + prompt como base** (aula 02-02): ver `imagem-mais-prompt.md`. É "OK", mas insuficiente.
6. **Pedir a página inteira de uma vez** (aula do portfólio): a IA faz várias tarefas em paralelo e o resultado piora. Ver `portfolio-vibe-design.md`.
7. **Modelo bom + técnica errada** perde para **modelo fraco + técnica certa** (experimento da apostila: Gemini 3 Pro só com prints x Composer só com o DS; o Composer ganhou).

## Sinais de design amador (apostila cap. 1)
- Padronização excessiva (roxo e rosa).
- Falta de refino: dobras muito óbvias, fundos simplistas, pouco cuidado com tipografia.
- Ausência de movimento: sem animações fluidas nem elementos que guiem o olhar.
- Limpeza excessiva, com grandes vazios e sem elementos de fundo que deem profundidade.

## Quando o chutômetro é válido
Refinar uma seção já boa: "troque esta cor", "centralize o título", "tire este botão". Dentro do método isso é a etapa de iteração, com escopo travado (ver `portfolio-vibe-design.md`).

## O que o curso não cobre aqui
- Medição objetiva de "qualidade de design"; os critérios são visuais e de gosto do instrutor.
- O artigo da Anthropic sobre a skill de front-end citado em aula: o instrutor o considerou "bem fraco"; a aula não detalha o conteúdo.
