# Velocidade: PageSpeed, responsividade, imagens, vídeos, transições

Conforme o curso (nov/2026). Métricas e nomes de ferramentas externas podem mudar.

## 1. Medir primeiro (PageSpeed Insights)

- Ferramenta do Google (PageSpeed Insights): colar a URL do site publicado e analisar. Medir no site publicado, não só no seu computador, porque o seu navegador tem cache e a sua conexão é boa.
- O Google observa sinais de experiência (Core Web Vitals): tempo para abrir a página, resposta rápida à interação e estabilidade visual (elementos não pulam de lugar durante o carregamento).
- Notas lidas: Desempenho, Acessibilidade, Práticas recomendadas, SEO, em mobile e computador.
- Medição inicial do curso (site sem otimização): desempenho 18 (mobile) e 34 (computador), acessibilidade 29, SEO 40.
- Regra do curso: NÃO colar todos os avisos do relatório de uma vez na IA; ela se perde. Corrigir por categoria, uma de cada vez, e medir de novo.

Ordem usada: responsividade, imagens/vídeos, transições/carregamento, medir de novo, depois SEO (ver `seo.md`).

## 2. Responsividade

1. Abrir o site no celular e no tablet (ou simular). Procurar quebras. Exemplo do curso: no celular o cabeçalho virava um menu, mas clicar no menu não fazia nada.
2. Pedir a correção, uma por vez: "Faça o menu responsivo para mobile."
3. Redimensionar a janela do navegador aos poucos para achar o ponto onde o layout quebra.
4. Extensão do Chrome citada: "Mobile Simulator" (confirmar o nome exato), para testar dispositivos (iPhone XR, Galaxy A12, iPad Air).
5. Método: testar, achar o erro, pedir à IA, verificar. Evitar mandar várias correções juntas.

## 3. Imagens

Princípio: não guardar imagem maior do que o espaço em que aparece, e não comprimir até estragar. Equilibrar bonito e rápido.

Passos:

1. Conferir dimensões: no exemplo, a imagem era 1024x1024 e aparecia com 415 px.
2. Redimensionar com margem de segurança: 750x750 (não 415).
3. Compressão leve: qualidade 75 a 85% (o curso ficou com 85%); em valores muito baixos a qualidade fica ruim. Resultado do exemplo: 658 KB para 52 KB (92% mais leve).
4. Formato: WebP (converter JPG/PNG para WebP). O curso usou sites gratuitos de redimensionamento (a transcrição escreve "escoche", provavelmente Squoosh; confirmar) e de conversão JPG para WebP.
5. Colocar o arquivo novo no projeto e pedir: "Substitua essa imagem por essa."
6. Fazer isso com todas as imagens do site. Imagem que realmente precisa de 1000 px não deve ser reduzida a 500 px.

Prompts do curso (estão nos materiais da aula):

- "Substitua as tags img nativas pelo componente Image do Astro (`astro:assets`), importando a foto de `src/assets`."
- "Ajuste as imagens principais da primeira dobra para ter `loading="eager"` e `fetchpriority="high"`." (as imagens da primeira dobra carregam antes das demais; as demais ficam no padrão do componente)

Ilustração mínima do que a IA deve gerar (não é código mostrado no curso):

```astro
---
import { Image } from 'astro:assets';
import hero from '../assets/caneta-preta.webp';
---
<Image src={hero} alt="Caneta preta fosca sobre a bancada" loading="eager" fetchpriority="high" />
```

## 4. Vídeos

- Vídeo costuma pesar mais que foto. Comprimir antes de usar.
- Ferramenta do exemplo: compressor web baseado em ffmpeg (a transcrição escreve "ffmpeg-web-cli"; confirmar o endereço). Escolher o vídeo, **Compress**: sozinho já ficou 43% menor (3,6 MB de origem); com o parâmetro em 29 ficou 49% menor. Mais compressão, pior qualidade; parar quando o olho não percebe diferença.
- Colocar o vídeo novo no projeto e pedir: "Substitua esse vídeo por esse novo mais leve." A IA reportou de 3,75 MB para 1 MB (o número não bate com os 49% falados; tratar como ordem de grandeza).
- Vídeo de fundo em bloco menor e sem overlay escuro foi uma decisão de design do curso, não de performance.

## 5. Transições e carregamento (recursos do Astro)

1. `transition:persist` nos elementos que se repetem em todas as páginas e não devem piscar ao trocar de página: cabeçalho e rodapé. Prompt: "Coloque `transition:persist` em elementos que não devem piscar toda hora que troca de página, como cabeçalho e rodapé."
2. Componente `ClientRouter` do Astro no `<head>` do layout principal: navega sem recarregar a página inteira e não recarrega o que já foi carregado. Prompt: "Adicione o componente ClientRouter do Astro no head do layout principal."

```astro
---
import { ClientRouter } from 'astro:transitions';
---
<head>
  <ClientRouter />
</head>
```

(Ilustração; o curso só mostra o prompt e o nome do componente.)

3. Animações: a regra do curso é pouca animação. Efeito demais deixa o site pesado e confunde. Foi usado um único efeito, nos títulos, trocando um fade por uma animação de digitação ("text type") copiada de uma biblioteca de componentes (a transcrição escreve "React Beats", provavelmente ReactBits; confirmar). Prompt: copiar o prompt do componente e pedir "No título da segunda dobra, utilize essa animação usando apenas Astro."
4. Aviso a repassar ao usuário: com `ClientRouter`, scripts de página (menu mobile, tags, eventos de clique) podem precisar de cuidado ao navegar sem recarregar. O curso não cobre isso; se algo parar de funcionar após ativar, testar e investigar.

## 6. Rodada final

1. `git add .` / `git commit -am "otimizando o site"` / `git push`.
2. Esperar a Vercel atualizar e rodar o PageSpeed no endereço no ar.
3. Resultados do curso:

| | Antes | Depois |
|---|---|---|
| Mobile desempenho | 18 | 100 |
| Mobile acessibilidade | 29 | 100 |
| Mobile práticas recomendadas | 73 | 100 |
| Computador desempenho | 34 | 99 |
| Computador acessibilidade | 29 | 100 |
| Computador práticas recomendadas | 73 | 100 |

SEO quase não mudou nessa etapa (ver `seo.md`; chegou a 100 depois dos ajustes de SEO).

Os resultados do curso são de um site simples de 3 páginas, com poucas imagens; não prometer a mesma nota em outro projeto.

## 7. Checklist de performance

- [ ] Medido no site publicado, mobile e computador, com notas anotadas
- [ ] Menu e layout testados em celular e tablet
- [ ] Imagens no tamanho de exibição (com margem), WebP, qualidade 75-85%
- [ ] `<img>` trocadas pelo componente Image do Astro, fotos em `src/assets`
- [ ] Imagens da primeira dobra com loading eager e fetchpriority high
- [ ] Vídeos comprimidos
- [ ] `transition:persist` em cabeçalho/rodapé e `ClientRouter` no layout
- [ ] No máximo uma animação decorativa
- [ ] Nova medição e comparação antes/depois
