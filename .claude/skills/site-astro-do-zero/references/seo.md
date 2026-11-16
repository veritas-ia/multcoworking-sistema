# SEO: cartão de visitas, Open Graph, SEO na página, sitemap e Search Console

Conforme o curso (nov/2026). O curso pede tudo à IA em linguagem natural e não mostra o código; os trechos abaixo são ilustrações do que a IA deve produzir.

## 1. Cartão de visitas: título, descrição, canonical, favicon

Conceito: o que a pessoa vê no Google e na prévia de um link (título, descrição, imagem). Se todas as páginas têm o mesmo título/descrição, buscadores e visitantes entendem pior cada página, e o ranqueamento orgânico sofre.

Regras de conteúdo:

- Título explica claramente o que existe naquela página; a descrição complementa o título.
- Não repetir palavra-chave nem prometer o que o site não entrega.
- Cada página tem função diferente, então título e descrição diferentes (home = visão geral e proposta de valor; catálogo = coleção completa; detalhe = o produto específico e a chamada para o formulário).

Passo 1, o layout recebe props (prompt do curso, adaptar a marca):

> Ajuste o componente `layout.astro` para receber as props `title`, `description` e `canonicalURL`. Crie fallbacks genéricos da marca [NOME] caso a página não envie dados. Adicione as tags title, description e o link canonical. E também os ícones.

Passo 2, cada página passa seus dados:

> Atualize as três páginas do projeto para passar as props de SEO para o layout. `index.astro`: título focado na apresentação do produto e proposta de valor, e a mesma coisa na descrição. Página 2 (catálogo): título e descrição sobre a coleção completa. Página 3 (detalhe): título focado no produto específico e na chamada para o formulário de aviso de estoque, o mesmo para a descrição.

A página de detalhe tem título dinâmico, conforme o produto escolhido.

Checagem: rodar local e navegar; a aba do navegador deve mudar de título a cada página e a cada produto.

Favicon: usar `.ico` (o curso recomenda em vez de PNG/JPEG para ficar otimizado). Converter a imagem em um conversor online gratuito, colocar em `public/` (renomear o antigo, ex.: `favicon2`) e pedir à IA: "Utilize isso como ícone das páginas." Reiniciar o servidor local para ver.

## 2. Open Graph (WhatsApp, redes sociais, Twitter/X)

Open Graph define título, descrição e imagem da prévia do link.

Prompt 1 (layout):

> Atualize o layout para aceitar a prop opcional `image`. Se a imagem não for passada, use uma imagem padrão [indicar o arquivo]. Adicione no head todas as metatags Open Graph (título, descrição, imagem, tipo website) e cards do Twitter. Converta o caminho da imagem em URL absoluta usando `Astro.site` ou `Astro.url`.

Por que URL absoluta: WhatsApp, Instagram e Twitter não entram no site para achar a imagem; precisam do endereço público direto dela.

Prompt 2 (por página):

> Passe a imagem personalizada nas três páginas. Cada página tem a própria imagem, o próprio título e a própria descrição. `index.astro`: foto do produto em destaque. Página 2: [outra foto]. Página 3: a foto do produto específico.

Ilustração do que deve sair no `<head>` (não é código do curso):

```html
<meta property="og:type" content="website" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{description}" />
<meta property="og:image" content="{URL absoluta da imagem}" />
<meta name="twitter:card" content="summary_large_image" />
```

Observações do curso:

- A imagem precisa ter boa qualidade, apresentar o projeto com clareza e funcionar em tamanhos menores e maiores. O curso não fixa dimensões (sugestão do skill, não do curso: confirmar o tamanho recomendado de imagem de prévia antes de cravar um número).
- Para `Astro.site` funcionar, o projeto precisa ter `site` definido na configuração do Astro (o curso não mostra isso; verificar `astro.config.*` e preencher com o domínio final).
- Teste: dar `git add .`, `commit`, `push`, esperar o deploy e colar o link no WhatsApp: deve aparecer imagem, título e descrição. Testar uma página por vez (home, catálogo, produto). Para Twitter, o curso usou uma extensão do Chrome chamada "Twitter Card Validator" (confirmar).
- WhatsApp e redes guardam prévia em cache; se o link já foi enviado antes, o teste pode mostrar a versão antiga (observação do skill, não do curso).

## 3. SEO dentro da página

Prompt de revisão de títulos (o curso passa nos materiais):

> Revise a hierarquia dos títulos H1, H2 e H3 nas páginas selecionadas. Garanta apenas um H1 por página contendo o assunto principal, use H2 para as seções principais, use H3 para subitens e cards dentro das seções e não pule níveis de título. Não altere o visual do site. Mantenha as classes CSS existentes.

- Um único H1 por página (mais de um confunde os algoritmos). H1 = conteúdo principal; H2/H3/p dividem em partes.
- No exemplo do curso, a IA só trocou H4 por H3 no catálogo. A IA pode avisar ou alterar por conta própria; o usuário revisa o diff.
- Texto alternativo (`alt`) em toda imagem que transmite informação: ajuda leitores de tela e dá contexto ao buscador.
- Nome de arquivo de imagem descritivo, representando o conteúdo (errado: `pen1.webp`; certo: o nome real do modelo). Pedir à IA para renomear as imagens e atualizar as referências. Em projeto real, usar o nome real do produto; não deixar a IA inventar.
- Rotas legíveis. O nome do arquivo em `src/pages/` é a rota: `pagina-2` deve virar `catalogo`; a home fica na raiz; cada produto com o próprio nome. Prompt do curso:

> Renomeie todas as rotas para nomes que façam sentido. A primeira rota não precisa renomear. A segunda deve se chamar `catalogo`. A terceira: cada produto terá o próprio nome. Atualize automaticamente as rotas no cabeçalho e no rodapé.

Checagem: abrir `/catalogo` e cada produto; clicar nos links do cabeçalho/rodapé e dos cards (nenhum 404). Se existirem links antigos compartilhados, avisar o usuário (o curso não trata de redirecionamentos).

## 4. Sitemap, robots.txt e Search Console

Conceitos:

- `sitemap`: mapa das rotas importantes; no Astro é gerado a partir das rotas. Prompt: "Gere o nosso sitemap." O curso não nomeia a integração usada (provavelmente a oficial de sitemap do Astro; confirmar no `package.json`/`astro.config.*` o que a IA instalou). Exige `site` configurado (ver acima).
- `robots.txt`: orienta rastreadores e informa onde está o sitemap (a transcrição escreve "roberts.txt"). Se a IA não criar junto, pedir: "Crie o nosso robots.txt."

Passos:

1. Gerar sitemap e robots.txt; `git add .`, `commit -am "melhorando o SEO"`, `push`.
2. Entrar no Google Search Console, **Start Now**, informar a URL do site (o curso usou o domínio) e continuar.
3. O Google fornece um arquivo de verificação (HTML): baixar e colocar em `public/`. Subir de novo (`git add .`, `commit`, `push`).
4. Esperar o deploy (alguns minutos) e clicar **Verify** no Search Console. Verificado, abrir a propriedade.
5. Enviar o sitemap no Search Console (o curso menciona enviar o sitemap e acompanhar). Dados demoram a aparecer, é normal.

Corrigir avisos do Google: no exemplo, o PageSpeed mostrou SEO 69 com o aviso "Page is blocked from indexing". O curso colou o aviso na IA ("Corrija esse erro"), subiu a correção ("ajustes do Google") e o SEO foi a 100. O curso não diz qual era a causa. Verificar `robots.txt` (regra Disallow) e meta robots/noindex antes de afirmar (confirmar).

Nota final do exemplo: desempenho 99, acessibilidade 100, práticas recomendadas 100, SEO 100.

## 5. O que o curso NÃO cobre em SEO

Pesquisa de palavras-chave, conteúdo de blog, dados estruturados (schema), Google Meu Negócio, backlinks, redirecionamentos 301, tamanho recomendado da imagem de prévia, tempo para indexar. Se o usuário precisar, dizer que está fora do curso; para uma auditoria geral de SEO, a skill `seo` desta pasta pode ser consultada (verificar se serve ao caso).

## 6. Checklist de SEO

- [ ] Layout recebe `title`, `description`, `canonicalURL`, `image` (com fallback da marca)
- [ ] Cada página com título/descrição/imagem próprios
- [ ] `site` configurado no Astro (para URL absoluta/sitemap)
- [ ] Favicon `.ico` em `public/`
- [ ] Meta Open Graph e Twitter card; imagem por URL absoluta pública
- [ ] Um H1 por página, sem pular níveis
- [ ] `alt` em todas as imagens; nomes de arquivo descritivos
- [ ] Rotas legíveis e links do cabeçalho/rodapé atualizados
- [ ] `sitemap` e `robots.txt` publicados
- [ ] Search Console verificado e sitemap enviado
- [ ] PageSpeed: SEO conferido, avisos tratados um por vez
- [ ] Prévia testada no WhatsApp (home, catálogo, produto)
