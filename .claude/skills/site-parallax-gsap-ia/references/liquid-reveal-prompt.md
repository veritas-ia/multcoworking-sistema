# Prompt "Liquid Reveal" completo (verbatim do material do curso Hover Lando Norris)

Prompt autocontido do material (https://hover-lando-norris.vercel.app/material): cole inteiro em uma IA de código, junto com as duas imagens (base + revelada). O motor é WebGL1 puro, sem dependências. Resumo e decisões do curso em `projeto-lando-hover.md`.

~~~~
================================================================================
PROMPT: EFEITO "LIQUID REVEAL" (HOVER LÍQUIDO QUE REVELA OUTRA CAMADA)
Cole este texto inteiro em qualquer IA de código (Claude, GPT, Cursor, Copilot,
Gemini...). Ele é auto-contido: não depende de nenhum repositório, biblioteca,
build tool ou sistema operacional específico.
================================================================================

## PAPEL

Você é um engenheiro de WebGL/creative coding. Implemente o efeito descrito
abaixo no projeto atual, adaptando APENAS a camada de integração (como o script
é carregado e como as URLs das imagens chegam) ao stack que já existe. O núcleo
técnico — shader, física e parâmetros — deve ser reproduzido fielmente.

## O QUE É O EFEITO

Duas imagens do mesmo enquadramento ficam empilhadas. A imagem A (base) é o que
se vê em repouso. Quando o cursor entra na área, uma "gota" de líquido orgânica
segue o ponteiro e, dentro dela, aparece a imagem B (camada revelada). A gota:

 - NÃO é um círculo duro — a borda é irregular e respira;
 - deixa um RASTRO que se funde com a cabeça (efeito metaball / lava lamp);
 - ESTICA e engrossa quando o mouse move rápido, e se contrai quando para;
 - refrata levemente a imagem na borda, como tensão superficial de água;
 - some com fade suave quando o cursor sai.

Referência estética: landonorris.com

NÃO use hover de CSS, clip-path, mask-image, canvas 2D ou blur. O efeito só
funciona de forma convincente com um fragment shader WebGL. Sem Three.js, sem
p5, sem nenhuma dependência — WebGL1 puro (`getContext('webgl')`), para máxima
compatibilidade.

## ARQUITETURA EXIGIDA

Crie 2 arquivos:

1. Um módulo com a classe `LiquidReveal` (o motor). Sem imports. TypeScript se
 o projeto usa TS, senão JavaScript puro.
2. Um componente/página que monta o markup, o CSS e instancia a classe.

A classe recebe um objeto de opções:

 {
 canvas: HTMLCanvasElement, // onde renderiza
 container: HTMLElement, // onde escuta mouse/touch e de onde tira o tamanho
 imageAUrl: string, // camada base
 imageBUrl: string, // camada revelada
 radius, edgeSoftness, noiseScale, noiseStrength, noiseSpeed,
 mouseDamping, trailDamping, refractionStrength // todos opcionais
 }

E expõe: `resize()` e `destroy()`.

--------------------------------------------------------------------------------
## 1. VERTEX SHADER (copie literalmente)
--------------------------------------------------------------------------------

attribute vec2 a_position;
varying vec2 v_uv;

void main() {
 v_uv = (a_position + 1.0) * 0.5;
 v_uv.y = 1.0 - v_uv.y;
 gl_Position = vec4(a_position, 0.0, 1.0);
}

O `v_uv.y = 1.0 - v_uv.y` é obrigatório: corrige a inversão vertical entre o
espaço de textura do WebGL e o da imagem. Sem ele a foto sai de cabeça pra baixo.

--------------------------------------------------------------------------------
## 2. FRAGMENT SHADER (copie literalmente)
--------------------------------------------------------------------------------

Gere a string do shader com um template literal interpolando a constante
TRAIL_COUNT = 24 (WebGL1 exige tamanho de array e limite de loop constantes em
tempo de compilação — não use uma variável uniform como limite do `for`).

precision highp float;

varying vec2 v_uv;

uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform vec2 u_resolution;
uniform vec2 u_image_resolution;
uniform vec2 u_trail[24]; // <-- interpolar TRAIL_COUNT
uniform float u_radii[24]; // <-- interpolar TRAIL_COUNT
uniform int u_trail_count;
uniform float u_speed;
uniform float u_time;
uniform float u_progress;
uniform float u_edge_softness;
uniform float u_noise_scale;
uniform float u_noise_strength;
uniform float u_noise_speed;
uniform float u_refraction_strength;

// --- Simplex Noise 2D — Ian McEwan, Ashima Arts (domínio público/MIT) ---
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
 const vec4 C = vec4(0.211324865405187,
 0.366025403784439,
 -0.577350269189626,
 0.024390243902439);
 vec2 i = floor(v + dot(v, C.yy));
 vec2 x0 = v - i + dot(i, C.xx);
 vec2 i1;
 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
 vec4 x12 = x0.xyxy + C.xxzz;
 x12.xy -= i1;
 i = mod289(i);
 vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
 vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
 m = m*m;
 m = m*m;
 vec3 x = 2.0 * fract(p * C.www) - 1.0;
 vec3 h = abs(x) - 0.5;
 vec3 ox = floor(x + 0.5);
 vec3 a0 = x - ox;
 m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
 vec3 g;
 g.x = a0.x * x0.x + h.x * x0.y;
 g.yz = a0.yz * x12.xz + h.yz * x12.yw;
 return 130.0 * dot(m, g);
}

// Ruído orgânico multi-oitava: 3 camadas derivando em direções diferentes.
// É o que impede a borda de parecer "uma textura deslizando".
float organicNoise(vec2 p, float time) {
 float n1 = snoise(p * u_noise_scale + vec2(time * u_noise_speed * 0.5, time * u_noise_speed * 0.3));
 float n2 = snoise(p * (u_noise_scale * 2.2) - vec2(time * u_noise_speed * 0.7, -time * u_noise_speed * 0.6));
 float n3 = snoise(p * (u_noise_scale * 4.4) + vec2(-time * u_noise_speed * 0.9, time * u_noise_speed * 0.8));
 return n1 * 0.6 + n2 * 0.3 + n3 * 0.1;
}

// Smooth minimum polinomial — o coração do efeito metaball.
// Um `min()` normal faria as bolhas se encavalarem com emenda visível;
// o smin funde as formas com um "pescoço" contínuo, como líquido de verdade.
float smin(float a, float b, float k) {
 float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
 return mix(b, a, h) - k * h * (1.0 - h);
}

// SDF de cápsula entre A e B com raios variáveis (cone arredondado).
// Raios diferentes nas pontas é o que dá o afinamento natural da cauda.
float capsuleSDF(vec2 p, vec2 a, vec2 b, float ra, float rb) {
 vec2 ba = b - a;
 vec2 pa = p - a;
 float lenSq = dot(ba, ba);
 float h = lenSq > 1e-7 ? clamp(dot(pa, ba) / lenSq, 0.0, 1.0) : 0.0;
 float r = mix(ra, rb, h);
 return length(pa - ba * h) - r;
}

void main() {
 // 1. Enquadramento "cover" — imagem preenche o canvas sem distorcer
 float canvasRatio = u_resolution.x / u_resolution.y;
 float imageRatio = u_image_resolution.x / u_image_resolution.y;

 vec2 coverScale = vec2(
 canvasRatio < imageRatio ? imageRatio / canvasRatio : 1.0,
 canvasRatio < imageRatio ? 1.0 : canvasRatio / imageRatio
 );

 vec2 uv = (v_uv - 0.5) * coverScale + 0.5;

 // Espaço corrigido por aspecto: sem isso a gota vira elipse em tela wide
 vec2 aspect = vec2(canvasRatio, 1.0);
 vec2 p = v_uv * aspect;

 // 2. Campo de distância da trilha fluida
 float d = 1e5;

 for (int i = 0; i < 23; i++) { // <-- interpolar (TRAIL_COUNT - 1)
 if (i >= u_trail_count - 1) break;
 vec2 pA = u_trail[i] * aspect;
 vec2 pB = u_trail[i+1] * aspect;
 float rA = u_radii[i];
 float rB = u_radii[i+1];

 if (rA < 0.0001 && rB < 0.0001) continue;

 float seg = capsuleSDF(p, pA, pB, rA, rB);
 d = (i == 0) ? seg : smin(d, seg, 0.045);
 }

 // 3. Respiração em repouso + deformação orgânica.
 // A respiração é atenuada pela velocidade: em movimento a forma já se
 // deforma pelo esticamento, então o "pulso" só aparece quando parado.
 float breathing = (sin(u_time * 2.2) * 0.012 + cos(u_time * 3.4) * 0.008) * (1.0 - min(u_speed * 4.0, 0.8));
 float noiseDisplacement = organicNoise(p, u_time) * u_noise_strength * (1.0 + u_speed * 0.8);

 float deformedDist = d - noiseDisplacement - breathing;

 // 4. Máscara de revelação
 float mask = 1.0 - smoothstep(-u_edge_softness, u_edge_softness, deformedDist);
 mask = clamp(mask * u_progress, 0.0, 1.0);

 // 5. Refração de menisco: só na faixa da borda (mask entre 0 e 1).
 // O produto dos dois smoothstep isola essa faixa; o gradiente do ruído
 // vira a "normal" da superfície do líquido.
 float edgeBand = smoothstep(0.0, 0.5, mask) * smoothstep(1.0, 0.5, mask);

 vec2 eps = vec2(0.01, 0.0);
 float nx = organicNoise(p + eps.xy, u_time) - organicNoise(p - eps.xy, u_time);
 float ny = organicNoise(p + eps.yx, u_time) - organicNoise(p - eps.yx, u_time);
 vec2 normalOffset = vec2(nx, ny) * u_refraction_strength * edgeBand;

 // Camadas refratam em intensidades diferentes -> sensação de profundidade
 vec2 uvA = clamp(uv + normalOffset * 0.25, 0.0, 1.0);
 vec2 uvB = clamp(uv + normalOffset * 0.7, 0.0, 1.0);

 vec4 colorA = texture2D(u_texA, uvA);
 vec4 colorB = texture2D(u_texB, uvB);

 gl_FragColor = mix(colorA, colorB, mask);
}

--------------------------------------------------------------------------------
## 3. FÍSICA DA TRILHA (roda no JS, a cada frame)
--------------------------------------------------------------------------------

Estado a manter na classe:

 TRAIL_COUNT = 24
 trailPoints: 24 objetos {x, y}, todos iniciados em {0.5, 0.5}
 trailArray: Float32Array(48) // xy intercalado, vai pra u_trail
 radiiArray: Float32Array(24) // vai pra u_radii
 targetMouse: {x, y} normalizado 0..1 relativo ao container
 currentSpeed, prevHead, currentProgress, isHovered

Loop por frame, nesta ordem exata:

 // A) Cabeça persegue o mouse (lerp exponencial)
 head = trailPoints[0]
 head.x += (targetMouse.x - head.x) * mouseDamping
 head.y += (targetMouse.y - head.y) * mouseDamping

 // B) Velocidade instantânea, suavizada (alimenta o esticamento)
 dx = head.x - prevHead.x; dy = head.y - prevHead.y
 instantSpeed = sqrt(dx*dx + dy*dy)
 currentSpeed += (instantSpeed - currentSpeed) * 0.25
 prevHead = {head.x, head.y}

 // C) Cada ponto persegue o anterior — corrente elástica.
 // O damping cresce ao longo da cauda: a ponta "alcança" mais rápido,
 // o que evita que o rastro fique preso e arrastado atrás do cursor.
 for i de 1 até 23:
 damping = min(0.55, trailDamping + (i / TRAIL_COUNT) * 0.08)
 trailPoints[i].x += (trailPoints[i-1].x - trailPoints[i].x) * damping
 trailPoints[i].y += (trailPoints[i-1].y - trailPoints[i].y) * damping

 // D) Ciclo de vida do progresso — entra rápido, sai devagar
 if (isHovered) currentProgress += (1.0 - currentProgress) * 0.16
 else currentProgress += (0.0 - currentProgress) * 0.09
 if (currentProgress < 0.0001 && !isHovered) currentProgress = 0.0

 // E) Raios afinando ao longo da cauda + expansão por velocidade
 for i de 0 até 23:
 trailArray[i*2] = trailPoints[i].x
 trailArray[i*2 + 1] = trailPoints[i].y
 t = i / (TRAIL_COUNT - 1)
 taper = pow(1.0 - t, 1.15) // 1.0 -> ~0
 speedExpansion = 1.0 + min(currentSpeed * 12.0, 0.45) // teto de +45%
 radiiArray[i] = radius * taper * speedExpansion

 // F) Enviar uniforms e desenhar 6 vértices (2 triângulos, quad full-screen)

IMPORTANTE — no `mouseenter` e no `touchstart`, colapse TODOS os 24 pontos da
trilha na posição de entrada do cursor. Se não fizer isso, a trilha "chicoteia"
da última posição conhecida até o cursor, criando um risco atravessando a tela.

--------------------------------------------------------------------------------
## 4. PARÂMETROS PADRÃO (calibrados — use estes)
--------------------------------------------------------------------------------

 radius 0.075 // raio base, fração da altura do container
 edgeSoftness 0.024 // suavidade da borda
 noiseScale 2.8 // frequência das ondulações
 noiseStrength 0.035 // amplitude da deformação
 noiseSpeed 0.65 // velocidade da animação do ruído
 mouseDamping 0.22 // resposta da cabeça ao cursor
 trailDamping 0.42 // viscosidade da cauda
 refractionStrength 0.012 // distorção na borda
 smin k 0.045 // suavidade da fusão entre segmentos

Raio responsivo, aplicado dentro do `resize()`:
 largura < 768px -> radius = 0.095
 largura < 1200px -> radius = 0.082
 senão -> radius = 0.072

Ajustes de gosto:
 gota maior -> radius up
 cauda mais longa -> trailDamping down (ex.: 0.30)
 mais viscoso -> mouseDamping down (ex.: 0.12)
 borda mais caótica-> noiseStrength up / noiseScale up
 borda mais nítida -> edgeSoftness down (ex.: 0.012)

--------------------------------------------------------------------------------
## 5. SETUP WEBGL — CHECKLIST
--------------------------------------------------------------------------------

 - getContext('webgl', { alpha: false, antialias: true, depth: false,
 stencil: false, powerPreference: 'high-performance',
 preserveDrawingBuffer: false })
 - Se retornar null: logar aviso e exibir a imagem A estática como fallback.
 - Quad full-screen: Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1])
 - Cachear TODAS as uniform locations uma vez após o link. Nunca chamar
 getUniformLocation dentro do loop de render.
 - Texturas: uma por imagem, via `new Image()` com `crossOrigin='anonymous'`.
 Parâmetros obrigatórios: CLAMP_TO_EDGE em S e T, LINEAR em MIN e MAG.
 Sem isso, imagens de dimensão não-potência-de-2 renderizam pretas em
 WebGL1. NÃO chame generateMipmap.
 - u_texA -> unidade 0, u_texB -> unidade 1 (gl.uniform1i uma vez no init).
 - Guarde naturalWidth/naturalHeight da imagem A -> u_image_resolution.
 - Só renderize quando AMBAS as texturas terminarem de carregar.
 - resize(): canvas.width = clientWidth * dpr, onde
 dpr = Math.min(window.devicePixelRatio || 1, 2) // teto de 2 protege 4K
 Depois gl.viewport(0, 0, canvas.width, canvas.height).
 Dispare via ResizeObserver no container (fallback: window resize).

--------------------------------------------------------------------------------
## 6. EVENTOS, ACESSIBILIDADE E LIMPEZA
--------------------------------------------------------------------------------

 - Escute no CONTAINER, não no canvas, e sempre com { passive: true }:
 mousemove, mouseenter, mouseleave, touchstart, touchmove, touchend.
 - Coordenadas: use getBoundingClientRect() do container e clampe em 0..1.
 - Touch: touchstart = enter, touchend = leave (mesma lógica de colapso).
 - prefers-reduced-motion: reduce -> noiseSpeed 0.1, noiseStrength 0.01,
 mouseDamping 0.35. O efeito continua funcionando, só fica calmo.
 - <noscript> com <img> da imagem A, cobrindo a área.
 - aria-label descritivo no canvas.
 - destroy(): cancelAnimationFrame, desconectar o ResizeObserver, remover
 TODOS os listeners, deletar as duas texturas e o programa. Chame no
 unmount do framework (useEffect cleanup / onDestroy / astro:before-swap).

--------------------------------------------------------------------------------
## 7. MARKUP E CSS
--------------------------------------------------------------------------------

 <div id="liquid-hero" style="position:relative; width:100%; height:100vh; overflow:hidden">
 <canvas id="liquid-canvas" style="position:absolute; inset:0; width:100%; height:100%; display:block"></canvas>
 <div id="hero-content" style="position:relative; z-index:2; pointer-events:none"> ... </div>
 </div>

O overlay de conteúdo PRECISA ter `pointer-events: none`, senão ele engole o
mousemove e a gota congela ao passar por cima de textos.

Sugestão de UI (opcional): um hint "MOVA O CURSOR PARA REVELAR" centralizado,
que faz fade para opacity 0 no mouseenter e volta a 0.75 no mouseleave.

--------------------------------------------------------------------------------
## 8. INTEGRAÇÃO POR STACK
--------------------------------------------------------------------------------

 HTML puro : <script type="module"> importando o arquivo do motor; as URLs
 das imagens são caminhos comuns ('/img/a.jpg').
 Astro : bloco <script> no componente (roda no cliente por padrão);
 importe as imagens e passe `img.src`. Limpe em astro:before-swap.
 React/Next : useEffect com refs para canvas e container; instancie na
 montagem, chame destroy() no cleanup. Em Next, `import img from
 '...'` dá um objeto — use `img.src`. Componente "use client".
 Vue/Nuxt : onMounted / onBeforeUnmount, template refs.
 Svelte : onMount retornando a função de cleanup.
 Vanilla+bundler: qualquer um serve; não há dependências para instalar.

As imagens podem vir de /public, de import do bundler ou de URL remota. Se
forem remotas, o servidor precisa mandar CORS liberado, ou a textura falha.

--------------------------------------------------------------------------------
## 9. ARMADILHAS CONHECIDAS (leia antes de debugar)
--------------------------------------------------------------------------------

 - Tela preta -> texturas sem CLAMP_TO_EDGE/LINEAR, ou render
 começando antes do load das imagens.
 - Imagem invertida -> faltou o flip de v_uv.y no vertex shader.
 - Gota elíptica -> faltou multiplicar as coordenadas por `aspect`.
 - Emenda entre bolhas -> usou min() em vez de smin().
 - Borda serrilhada -> edgeSoftness baixo demais para o DPR da tela.
 - Risco atravessando -> não colapsou a trilha no mouseenter.
 - Gota travando -> overlay sem pointer-events: none.
 - Imagem esticada -> lógica do coverScale invertida.
 - Erro de compilação -> usou uniform como limite de `for` (proibido em
 WebGL1); o limite tem que ser literal constante.
 - Borrado no Retina -> esqueceu de multiplicar o canvas pelo DPR.

--------------------------------------------------------------------------------
## 10. CRITÉRIOS DE ACEITE
--------------------------------------------------------------------------------

 [ ] Em repouso nenhuma gota aparece; a imagem A ocupa a tela sem distorção.
 [ ] Ao entrar com o cursor, a revelação surge NA posição do cursor, sem risco.
 [ ] Movendo devagar: a gota é redonda-orgânica, com borda ondulando e pulsando.
 [ ] Movendo rápido: forma-se uma cauda contínua que afina até sumir, mais
 grossa que em repouso — e sem emenda visível entre os segmentos.
 [ ] Parando: a cauda alcança a cabeça e se funde numa gota só.
 [ ] Saindo: fade suave, mais lento que a entrada.
 [ ] Borda mostra distorção sutil da imagem (menisco), sem halo branco.
 [ ] 60 fps estável em tela cheia.
 [ ] Funciona em toque no mobile.
 [ ] Redimensionar a janela não distorce nem borra.
 [ ] Sem erros no console; sem vazamento de rAF ao desmontar.

================================================================================
Entregue os arquivos completos e funcionais, com as imagens de exemplo
apontadas para caminhos que existam no projeto. Se as duas imagens ainda não
existirem, use dois placeholders de mesma proporção e avise onde trocá-los.
================================================================================
~~~~
