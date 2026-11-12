# Estrutura de um projeto Astro (páginas, layout, componentes)

Tudo aqui vem do curso "Construindo sites profissionais com Astro" (Asimov), conforme o curso (nov/2026). O curso trabalha pedindo as alterações à IA, em linguagem natural, e conferindo o resultado no navegador. Não mostra o código escrito à mão.

## 1. Preparar o computador

Três coisas (a página de materiais do curso traz o passo a passo):

1. Editor de código: o curso usa o Antigravity IDE ("antigraft" nas transcrições); diz que qualquer editor serve (ex.: VS Code).
2. Node.js: baixar a versão LTS no site oficial. É a base para criar o projeto, instalar bibliotecas e rodar localmente.
3. Terminal: dentro do editor ou do sistema.

Criar o projeto (na pasta onde quer criá-lo):

```bash
npm create astro@latest
```

Respostas usadas no curso: nome do projeto (ex.: `projeto-1`), template básico (primeira opção, Enter), instalar dependências = Yes, inicializar Git = Yes.

```bash
cd nome-do-projeto
npm run dev        # roda local; abrir o link localhost mostrado no terminal
```

Se o usuário já tem Node e projeto, pular esta etapa.

## 2. O que cada pasta/arquivo faz

| Peça | Onde fica | Papel |
|---|---|---|
| Página | `src/pages/` | Cada arquivo vira uma rota (endereço). `index.astro` = página inicial. O nome do arquivo é a URL. |
| Layout | `src/layouts/` | Moldura compartilhada: cabeçalho, rodapé, `<head>` (SEO, scripts de medição). A página só traz o conteúdo próprio. |
| Componente | `src/components/` | Bloco reaproveitável: botão, card, marquee, bloco de vídeo, cabeçalho, rodapé. |
| Imagens otimizáveis | `src/assets/` | Imagens importadas pelo componente de imagem do Astro. |
| Arquivos públicos | `public/` | Servidos como estão: favicon, `robots.txt`, arquivo de verificação do Google, imagens de Open Graph. |

Ideia central: mudar uma vez no componente/layout muda em todas as páginas. O curso insiste que isso também facilita o trabalho com IA: ela edita só o componente em vez de reler a página inteira.

JavaScript: a página é leve por padrão; adicionar interatividade só nos pontos que precisam (menu mobile, validação de formulário, botão com comportamento específico).

## 3. Migrar um site HTML existente

1. Copiar os arquivos do site antigo (HTML, imagens, design system) para uma pasta separada dentro do projeto (o curso usou `site antigo`) para não misturar.
2. Passar o HTML para a IA e pedir só uma coisa: "transforme isso em .astro puro" (um único arquivo `.astro`). O curso tem um prompt nos materiais; o ponto é manter o pedido simples.
3. Conferir que o resultado visual é idêntico ao HTML.
4. Só depois, em passos separados, transformar partes em componentes (próxima seção).

Alerta do curso: não pedir à IA para criar de uma vez layouts, componentes e todas as páginas; ela se perde e o projeto fica mais bagunçado. Ir passo a passo.

## 4. Componentizar (um elemento por vez)

Prompt-base (adaptar o elemento):

- Cabeçalho/rodapé: "Adapte o nosso cabeçalho para componente e já insira no layout." Colar/anexar o arquivo `.astro` para a IA não se perder. A IA cria `Header.astro`, coloca no layout e remove o trecho embutido. Repetir com "rodapé".
- Botões: "Adapte os nossos botões para componente." Sem "insira no layout", porque botões variam de posição por página. A IA procura onde o botão estava embutido e troca pelo componente.
- Cards: "Na dobra que temos essa frase, temos também alguns cards. Transforme-os em componentes." (colar o trecho de texto que identifica a seção).

Depois de componentizado, ajustes de estilo vão direto no componente. Exemplos do curso: "Diminua as bordas arredondadas dos botões", "Remova as sombras do botão". A IA nem abre a página, edita só `Botao.astro`, e muda em todas as páginas.

Resultado esperado: o arquivo da página encolhe a cada componentização. Se a IA criar componentes extras sem pedir (ex.: marquee), tudo bem, ficam reutilizáveis.

## 5. Criar páginas novas

- Pedir "uma segunda página do site em branco" para ver o layout funcionando (cabeçalho e rodapé aparecem sozinhos, o meio é o conteúdo). Rota de teste: `/pagina-2` (renomear depois, ver `seo.md`).
- Dizer a intenção da página. Exemplo do catálogo: "página de catálogo de produtos. Adicione 9 cards de 9 canetas diferentes. Todas têm título, alguma informação útil e um botão de avise-me. Use o mesmo botão que já temos."
- Não precisa mandar reutilizar: a IA lê `src/components/` e reaproveita o que existe (o curso viu isso na página 3).
- Link de produto: card do catálogo leva à página de detalhes; cabeçalho com navegação e indicador visual da página atual.

## 6. Ajustar o visual com a IA (método do curso)

- Pedir em tópicos numerados, vários ajustes pequenos e específicos na mesma mensagem (ex.: "1. Diminua a altura da dobra. 2. Apenas uma linha de marquee. 3. Diminua a velocidade. 4. Quero outra fonte, mais luxuosa.").
- Descrever medidas relativas: "altura 50% maior que a do marquee", "70% maior", "diminua margens e paddings".
- Quando o resultado não é o desejado, procurar um site de referência, tirar print do trecho e enviar à IA: "Quero assim, porém alinhado à esquerda e sem bordas arredondadas".
- Reduzir "cara de IA": "Siga o mesmo padrão visual e o mesmo minimalismo das demais páginas. Não use bordas arredondadas demais."
- Consistência: "Mantenha sempre a mesma fonte das outras dobras."
- Para formulário: "Não abra o formulário imediatamente" (abre em pop-up ao clicar no botão); campos na ordem nome, telefone, e-mail.
- Cabeçalho: logo minimalista (ícone e nome), tirar botão de carrinho se não faz sentido, indicador da página atual.
- Seções criadas no curso na home: primeira dobra (proposta: título e subtítulo claros), cards, marquee infinito de palavras (fundo 100% preto, fonte cursiva/luxuosa, uma linha, lento), bloco de vídeo sem overlay e mais baixo, tabela de ficha técnica (só característica + número, alinhada à esquerda, sem bordas arredondadas, fundo preto).
- O curso chama seção de "dobra". Primeira dobra = o que aparece ao abrir o site.

## 7. Boas práticas que o curso repete

- Prompts não precisam ser perfeitos, mas precisam ser pequenos: uma mudança por vez, testar, pedir correção, testar de novo.
- Reaproveitar o projeto como base para clientes: trocar textos, imagens e botões.
- Para visual/identidade, ver a skill `design-metodo-ia`; para sites em HTML puro com IA, a skill `site-com-ia-do-zero`; para animações de rolagem avançadas, `site-parallax-gsap-ia` (skills irmãs; o curso não cobre esses temas em profundidade).
