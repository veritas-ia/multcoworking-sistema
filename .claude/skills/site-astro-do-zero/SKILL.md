---
name: site-astro-do-zero
description: >-
  Cria, publica e otimiza um site de poucas páginas com Astro (layout, componentes e páginas), publica via GitHub + Vercel + domínio próprio, melhora a velocidade (nota do Google/PageSpeed, imagens e vídeos leves, responsividade, transições), prepara o SEO (título/descrição por página, Open Graph para WhatsApp e redes, sitemap, Search Console) e instala a medição (GTM, Google Analytics, pixel da Meta, formulário que grava em planilha). Use quando o pedido for "criar site em astro", "migrar site html para astro", "publicar site na vercel", "conectar domínio", "otimizar velocidade do site", "nota do pagespeed", "seo do site astro", "prévia do link no whatsapp", "instalar gtm/pixel/analytics no site" ou "formulário do site para planilha". Baseada no curso "Construindo sites profissionais com Astro" (Asimov).
---

# Site Astro do zero (criar, publicar, acelerar, SEO e medição)

Método do curso da Asimov (conforme o curso, nov/2026): site de 3 páginas (home, catálogo, detalhe/formulário) feito pela IA em passos pequenos, publicado por GitHub + Vercel, depois otimizado, indexado e medido. O detalhe técnico está em `references/`; este arquivo é o roteiro.

Para o visual/identidade, veja a skill `design-metodo-ia` (e `design-system-por-ia`); para site em HTML puro feito com IA, `site-com-ia-do-zero`; para animação de rolagem avançada, `site-parallax-gsap-ia`. O curso não aprofunda nenhum desses temas.

## Princípios (valem para todas as etapas)

1. **Um passo por vez.** Pedir muita coisa junto faz a IA se perder (o curso repete isso em migração, responsividade e avisos do PageSpeed). Ciclo: pedir uma mudança, testar no navegador, corrigir, só então seguir.
2. **Tudo que se repete vira componente ou vai no layout.** Mudou uma vez, muda em todas as páginas; a IA edita só o componente.
3. **Medir antes e depois** (PageSpeed, WhatsApp, Analytics) no site **publicado**, não só no local.
4. **Publicar a cada etapa** com `git add .`, `git commit -am "msg"`, `git push`; a Vercel atualiza sozinha.
5. **Só afirmar o que o curso cobre.** O curso não mostra código; ele passa prompts à IA. Se algo estiver fora do curso, dizer ao usuário.

## O que o Claude faz e o que pede ao usuário

| Claude faz | Usuário faz (contas e decisões dele) |
|---|---|
| Criar/editar projeto, páginas, layout, componentes | Instalar Node.js e editor, se faltar |
| Rodar `npm run dev`, build, commits e push | Criar conta/repositório no GitHub, conta na Vercel |
| Instalar tags e eventos no código | Comprar o domínio e mexer no DNS (ou autorizar) |
| Otimizar imagens/vídeos (se houver ferramenta local) ou pedir arquivos já tratados | Criar contas GTM, Analytics, Meta e a planilha; copiar os códigos |
| Conferir resultados e propor correções | Rodar/validar PageSpeed, WhatsApp, Search Console (ou colar os resultados) |

Não instalar nada globalmente nem criar contas pelo usuário. Se o usuário já tem um projeto Astro, partir dele e pular o que já existe.

## Fluxo

### Passo 0. Entender o caso

Perguntar (ou deduzir do projeto): tipo de site, nº de páginas e intenção de cada uma (home = proposta e caminhos; catálogo/serviços = variedades e ação; contato/formulário = captura), marca, textos e imagens disponíveis, domínio, quais eventos medir. Se há HTML antigo, usar o Passo 1B.

### Passo 1A. Projeto novo

`npm create astro@latest` (template básico, instalar dependências, iniciar Git), `cd` na pasta e `npm run dev`. Estrutura: `src/pages` (rotas), `src/layouts` (moldura), `src/components` (blocos), `src/assets` (imagens otimizáveis), `public` (arquivos servidos como estão). Ver `references/estrutura-astro.md`.

### Passo 1B. Migrar site HTML existente

Copiar o HTML antigo para uma pasta separada; pedir só "transforme isso em .astro puro"; conferir que ficou idêntico; **só depois** componentizar um elemento por vez. Nunca pedir layout + componentes + todas as páginas de uma vez.

### Passo 2. Layout e componentes

1. Cabeçalho e rodapé como componentes e dentro do layout (prompt: "adapte o cabeçalho para componente e já insira no layout").
2. Botões, cards e blocos repetidos como componentes (sem inserir no layout, pois mudam de posição).
3. Ajustes de estilo direto no componente.

### Passo 3. Páginas

Criar cada página dizendo a intenção dela e o que reaproveitar; conferir navegação, indicador da página atual e formulário (pop-up ao clicar no botão; campos nome, telefone, e-mail). Ajustar o visual em tópicos numerados e com print de referência. Detalhes e prompts em `references/estrutura-astro.md`.

### Passo 4. Publicar

GitHub (repositório, `git add .` no lugar de `git add README.md` nos comandos que ele mostra) > Vercel (Add New > Project > Import > Deploy) > domínio (A `@` e CNAME `www` com os valores que a Vercel mostra; o curso também trocou para os servidores de nomes da Vercel) > fluxo de atualização com os 3 comandos. Ver `references/deploy.md`.

Checagem: as 3 páginas abrem no endereço da Vercel e no domínio, no computador e no celular.

### Passo 5. Velocidade

1. Medir no PageSpeed (anotar desempenho, acessibilidade, práticas recomendadas, SEO; mobile e computador).
2. Responsividade: testar celular/tablet e redimensionar a janela; corrigir um problema por vez (ex.: menu mobile que não abre).
3. Imagens: tamanho de exibição com folga (ex.: 415 px exibidos, 750 px guardados), qualidade 75-85%, WebP; trocar `<img>` pelo componente Image do Astro (fotos em `src/assets`); primeira dobra com `loading="eager"` e `fetchpriority="high"`.
4. Vídeos: comprimir antes (exemplo do curso: cerca de 50% menor sem perda visível).
5. `transition:persist` em cabeçalho/rodapé e `ClientRouter` no `<head>` do layout; poucas animações.
6. Commit/push, medir de novo e comparar.

Referência do curso (site simples): mobile 18 para 100 em desempenho, acessibilidade 29 para 100, práticas 73 para 100; computador 34 para 99. Não prometer a mesma nota em outro projeto. Detalhes em `references/performance.md`.

### Passo 6. SEO

1. Layout aceita `title`, `description`, `canonicalURL` e `image` (com fallbacks da marca); cada página passa os próprios (título/descrição/imagem distintos; detalhe dinâmico).
2. Favicon `.ico` em `public/`.
3. Open Graph + Twitter card, com URL absoluta da imagem (`Astro.site`/`Astro.url`; requer `site` configurado). Testar colando o link no WhatsApp após o deploy.
4. Na página: um único H1, H2/H3 sem pular níveis, `alt` em imagens, nomes de arquivo descritivos, rotas legíveis (ex.: `/catalogo`, não `/pagina-2`) com links do cabeçalho/rodapé atualizados.
5. Sitemap + `robots.txt`; Search Console (verificação por arquivo em `public/`, depois enviar o sitemap).
6. Rodar PageSpeed de novo e tratar cada aviso de SEO, um de cada vez.

Ver `references/seo.md`.

### Passo 7. Medição

1. GTM: usuário cria conta/contêiner Web e cola os dois blocos de código; Claude instala no layout.
2. Google Analytics: usuário cria conta/propriedade/fluxo Web e cola as instruções de instalação; Claude instala. Evento de clique no botão principal (ex.: Avise-me) com o nome do produto.
3. Pixel da Meta: o curso só cobre os **eventos** do pixel (mesmo botão do Analytics). A instalação do pixel base não está nas transcrições (aula duplicada): ver `references/tracking.md`.
4. Formulário para planilha: Google Sheets (colunas Data, Nome, Telefone, E-mail) + Apps Script publicado como Web App (executar como o dono, acesso para qualquer pessoa); a IA liga o formulário à URL.
5. Testar tudo no site publicado (até 48 h para o Analytics).

Ver `references/tracking.md`.

### Passo 8. Entrega ao usuário

Resumir: endereço final, notas do PageSpeed antes/depois, o que foi medido, o que ficou pendente e onde estão as contas (GitHub, Vercel, domínio, GTM, Analytics, Meta, planilha). Se o site é de cliente, trocar textos, imagens e botões do projeto-base em vez de recomeçar.

## Checagens finais

- [ ] 3 páginas com intenção clara, reaproveitando layout e componentes
- [ ] Publicado na Vercel e no domínio; atualização por push funcionando
- [ ] PageSpeed medido antes e depois, mobile e computador
- [ ] Título, descrição, imagem e rota próprios por página; um H1; `alt`; sitemap e `robots.txt`; Search Console verificado
- [ ] Prévia do link testada no WhatsApp
- [ ] GTM, Analytics e pixel instalados; evento de clique e formulário testados no site publicado

## O que o curso não cobre (avisar o usuário)

Código escrito à mão (só prompts); blog/coleções de conteúdo do Astro; páginas dinâmicas além do que a IA gera; SEO avançado (palavras-chave, schema, redirecionamentos); LGPD/consentimento de cookies; instalação do pixel base da Meta; remarketing e conversões de anúncio; segurança/spam do formulário; rollback e branches. WordPress e construtores prontos aparecem só no título da aula 02, sem comparação na transcrição.

## Fontes

Caminhos relativos à pasta `asimov-academy`, base `Construindo sites profissionais com Astro (Asimov)/`. Cada aula é `<módulo>/<aula>/transcricao.txt`; o mapa está em `indice.md`.

- Estrutura e migração: `01 - Uma nova forma de criar sites/` aulas 01, 02, 03, 04 e 05; `02 - Construindo nosso site/` aulas 01 a 05.
- Publicação: `03 - Colocando o site no ar/` aulas 01 a 04.
- Velocidade: `04 - Velocidade o site que carrega num piscar/` aulas 01 a 05.
- SEO: `05 - Preparando o site para aparecer no Google/` aulas 01 a 04.
- Medição: `06 - Medindo cada visitante/` aulas 01 a 05 (a 03, "Instalando o pixel da Meta", repete a transcrição da 02).
- Materiais: `materiais-do-curso/LEIA-ME.md` e `Pagina de materiais do curso (arttools2.com.br).md` (só o passo a passo de ambiente; prompts e códigos completos estão nos zips não abertos).

Detalhes por tema: `references/estrutura-astro.md`, `references/deploy.md`, `references/performance.md`, `references/seo.md`, `references/tracking.md`.
