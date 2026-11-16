# Projeto Hover Lando Norris (hover líquido que revela uma segunda imagem)

Site de exemplo: https://hover-lando-norris.vercel.app. Aula única (~5 min). O título diz "Astro e CSS", mas **o efeito não é CSS**: o material proíbe explicitamente `hover` de CSS, `clip-path`, `mask-image`, canvas 2D ou blur e exige um **fragment shader WebGL** (WebGL1 puro). Astro é só o projeto que hospeda.

## O que o efeito faz

Duas imagens do mesmo enquadramento empilhadas: A (base, a que se vê em repouso) e B (revelada). O cursor vira uma "gota" orgânica que revela B, deixa um rastro que funde com a cabeça (metaball), estica quando o mouse corre, refrata levemente na borda e some com fade quando o cursor sai. Referência estética: landonorris.com.

## Fluxo da aula

1. GPT: gerar as 2 imagens. Foto de base (selfie ou outra) + imagem do que muda (capacete de robô). A segunda deve mudar o que quiser (máscara, roupa, fundo). O prompt exato **não está na página de materiais** (a aula diz que estaria); correção feita na aula: "Coloque uma armadura futurista em mim e a máscara deve cobrir os cabelos."
2. `npm create astro` (o áudio diz sem `@latest`), nome `mascara`, aceitar as 3 opções.
3. Colocar as duas imagens em `src/assets` (fundo = `background`, camada revelada = `overlay`; o "background" cobre toda a primeira dobra e o "overlay" aparece dentro da gota).
4. Colar as duas imagens + o prompt do material (o do arquivo `liquid-reveal-prompt.md`). A IA gera o `LiquidHero` e o shader.
5. Rodar `npm run dev`. O primeiro resultado funcionava, mas era duro. **Iteração**: print do site + link do site de referência + "quero que o hover seja mais fluido, mais leve, menor e deixe um rastro maior. Quero um hover bem líquido." Ficou bem mais fluido.
6. Trocar imagens para outros pares (o professor gerou outras duplas: jogador de camisa amarela/azul; Peter Parker/Homem-Aranha). Funciona bem quando o fundo também muda entre as duas.
7. Ajuste de posição do olho: o problema era a imagem gerada, não o efeito.

## Parâmetros calibrados do material (para ajustar "gosto")

`radius 0.075` (fração da altura), `edgeSoftness 0.024`, `noiseScale 2.8`, `noiseStrength 0.035`, `noiseSpeed 0.65`, `mouseDamping 0.22`, `trailDamping 0.42`, `refractionStrength 0.012`, `smin k 0.045`, `TRAIL_COUNT = 24`. Raio responsivo: <768px 0.095; <1200px 0.082; senão 0.072.
- gota maior: subir `radius`; cauda mais longa: baixar `trailDamping` (ex.: 0.30); mais viscoso: baixar `mouseDamping` (0.12); borda mais caótica: subir `noiseStrength`/`noiseScale`; borda mais nítida: baixar `edgeSoftness` (0.012).
- `prefers-reduced-motion`: noiseSpeed 0.1, noiseStrength 0.01, mouseDamping 0.35.

## Armadilhas do material (as que mais dão tela quebrada)

Tela preta: textura sem `CLAMP_TO_EDGE`/`LINEAR` ou render antes do load. Imagem invertida: faltou o flip de `v_uv.y`. Gota elíptica: faltou multiplicar por `aspect`. Emenda entre bolhas: `min()` em vez de `smin()`. Risco atravessando a tela: não colapsar a trilha no `mouseenter`. Gota travando: overlay de conteúdo sem `pointer-events: none`. Retina borrado: esqueceu o DPR (teto 2). Imagem remota sem CORS falha. O limite do `for` no shader precisa ser constante literal. Limpeza no Astro: `astro:before-swap`.

## Critérios de aceite (resumo)

Repouso sem gota e imagem A sem distorção; ao entrar, revelação na posição do cursor sem risco; devagar = gota orgânica que respira; rápido = cauda contínua que afina; parando = cauda funde; saindo = fade mais lento que a entrada; 60 fps; funciona em toque; resize sem distorção; sem erros de console/vazamento de rAF.
