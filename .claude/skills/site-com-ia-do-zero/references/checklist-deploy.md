# Checklist de deploy (específico do fluxo "com IA" do curso)

Fonte: módulo 3 do curso "Construindo sites profissionais com IA" e a aula de WordPress. Aqui só o que é deste fluxo (site estático HTML/CSS/JS criado por agente, versionado em Git, publicado na Vercel). Para detalhes de GitHub, Vercel, domínio, SEO, performance, medição (GTM/Analytics/Pixel) e framework, use a skill irmã `site-astro-do-zero`. Preços, telas e menus abaixo são "conforme o curso (nov/2026)".

## 1. Preparar o projeto (pedir tudo à IA; o curso não mexe em código à mão)

- [ ] Apague os design systems de teste; mantenha só o que foi usado (o professor tinha 11 no projeto).
- [ ] Mantenha o DS escolhido numa pasta de templates/referência, para consultas futuras de identidade visual. Peça: "Mova o design system para a pasta de templates e ajuste todos os imports dele para que ele siga funcionando." Abra o DS para conferir que continua estilizado.
- [ ] Peça reorganização profissional: pastas separadas para JavaScript, CSS, imagens e os frames do vídeo da hero (resultado da IA no curso), corrigir pequenos bugs.
- [ ] Reabra o `index.html` e confira: texto, animações, hero com vídeo/scroll, vídeo final. No curso a reorganização quebrou imagens e vídeo ("faz parte"); a correção foi dizer "as imagens e os vídeos não estão aparecendo no index.html" e a IA apontou para o lugar certo (cerca de 2 minutos de IA no total).
- [ ] Se estragar muito, volte com o Git (item 2).

## 2. Git (comandos que o curso usa)

| Ação | Comando ou clique |
|---|---|
| Iniciar | `git init` ou "Initialize Repository" no Source Control |
| Preparar tudo | `git add .` (o ponto = todos os arquivos alterados) |
| Checkpoint | `git commit -m "mensagem explícita"` (mensagem para uso interno; seja claro) |
| Erro "configure user.name e user.email" | `git config --global user.name "Seu Nome"` e `git config --global user.email "seu@email"` (o e-mail da conta do Git) |
| Ver linha do tempo | Git Graph (extensão): comando "View Git Graph" |
| Voltar no tempo | Git Graph: botão direito no commit -> Checkout; depois dar Checkout na ponta (main) para avançar de novo |

Prática: commit sempre que chegar a um ponto correto (hero pronta, bug resolvido, projeto reorganizado). Bug novo depois não destrói o que já estava bom. O professor avisa que essa estratégia de commit simples não é a que equipes profissionais usam (branches etc.).

## 3. GitHub

1. Conta gratuita em github.com (login rápido com Google).
2. New repository: nome (exemplo "artools-website"), sem descrição obrigatória, público ou privado (ambos servem).
3. Copie as instruções "push an existing repository" que o GitHub mostra. No curso: `git remote add origin <url>` (conecta o Git local ao repositório remoto; "origin" é o apelido), `git branch main` (o GitHub costuma mostrar `git branch -M main`; confirmar) e `git push -u origin main`.
4. Atualize a página do repositório: os arquivos aparecem. Serve também de backup.

## 4. Vercel

1. Crie conta com "Continue with GitHub" e autorize.
2. Add New Project -> importar repositório (a Vercel pede para instalar o app dela no GitHub; no curso, instalou no repositório pessoal, e há opção de todos).
3. Site estático simples: não precisa configurar nada. Clique em Deploy.
4. Sai uma URL tipo `nome-do-projeto.vercel.app`, acessível por qualquer pessoa.
5. Daqui em diante, a Vercel observa a branch `main` do GitHub e republica sozinha.

## 5. Atualizar o site no ar

Edite (por você ou pelo agente) -> `git add .` -> `git commit -m "..."` -> `git push`. Em alguns segundos a Vercel publica. O navegador pode mostrar a versão antiga em cache: hard refresh. O exemplo do curso foi apagar um ponto final do H1.

## 6. Domínio próprio

- Domínio é pago (no curso, a partir de cerca de R$ 40 por ano; busca no registro.br e em outros registradores; a maioria dos nomes já está tomada, teste variações). Quem não tem domínio livre para praticar pode usar um que já possua. O professor não comprou um novo.
- Vercel: projeto -> Domains -> adicionar o domínio (no curso, "Add Existing"), associado à versão de produção -> Save. A Vercel mostra os registros DNS pedidos.
- No registrador (no curso, Hostinger), ir em DNS/Nameservers e criar ou editar: CNAME com nome `www` apontando para o valor mostrado pela Vercel; registro tipo A com nome `@` apontando para o IP mostrado pela Vercel. Copie os valores exatos da tela da Vercel.
- Propaga em segundos ou até horas; no exemplo foi imediato.
- Custo no exemplo: só o domínio; a Vercel hospedou o site estático gratuitamente (o professor diz que o plano pago entra com projetos mais complexos).
- Quem vai atender cliente: o curso não explica troca de domínio que já está no ar com outro site (migração). Lacuna.

## 7. Se o destino for WordPress (aula de leitura guiada)

Três caminhos para usar HTML/CSS/JS gerado pela IA:

1. Bloco "HTML Personalizado" (categoria Widgets do editor de blocos): três abas HTML, CSS, JavaScript; cole cada parte na aba certa e atualize. Ideal para componentes isolados (cards, banners, formulários, pequenas seções).
2. Widget HTML do Elementor: um único campo; organize como `<style>` CSS `</style>`, depois o HTML, depois `<script>` JS `</script>` (a aula traz as tags "entre tags", o texto original perdeu os sinais; confirmar na própria aula).
3. Plugin File Manager (WP File Manager) para páginas completas: criar uma pasta simples na raiz da instalação (sem espaços, acentos ou caracteres especiais; no exemplo, "site"), enviar todos os arquivos e pastas mantendo a estrutura gerada, com `index.html` na raiz da pasta e caminhos relativos preservados (por exemplo `assets/css/style.css`). Acessar em `https://seudominio.com.br/site/`. Cuidado para não alterar ou apagar arquivos originais do WordPress.

Escolha: componentes isolados -> 1 ou 2; site completo -> 3.

## 8. Fora do escopo deste curso (ver `site-astro-do-zero` ou outro)

Responsividade, velocidade/Lighthouse, SEO, Open Graph, sitemap, Google Analytics/GTM/Pixel Meta, formulário para planilha, e-mail do domínio: não são ensinados aqui.
