# Medição: GTM, Google Analytics, pixel da Meta e formulário para planilha

Conforme o curso (nov/2026). Menus do Google e da Meta mudam com frequência; confirmar na tela. O curso passa as instruções copiadas de cada ferramenta para a IA instalar no código, sem mostrar o código.

Divisão de trabalho: o usuário cria as contas e copia os códigos (login, permissões, pagamentos são dele); o Claude coloca os códigos no projeto, sobe e confere.

## 1. Google Tag Manager (GTM)

Papel: central de etiquetas (tags) que organiza as medições.

1. Usuário entra no Google Tag Manager e cria conta: nome da empresa/projeto, país Brasil; contêiner com o nome/endereço do site; plataforma **Web**; aceitar termos. No curso, o primeiro nome tentado deu "permissão negada" e funcionou com `www.` + domínio (a transcrição não explica; se acontecer, tentar o endereço com `www`).
2. O GTM mostra dois blocos de código para instalar (um no `<head>`, outro logo após `<body>`; o curso diz "copiar tudo"). O usuário cola os dois na conversa.
3. Claude pede à IA/instala no **layout principal** (`layout.astro`), assim a tag entra em todas as páginas. Checar no código que os dois blocos estão no layout e não duplicados nas páginas.

Importante com `ClientRouter` (ver `performance.md`): scripts no layout podem se comportar diferente quando a navegação não recarrega a página. O curso não trata disso; testar os eventos em navegação entre páginas.

## 2. Google Analytics

1. No GTM, na conta do projeto, conectar ao Google Analytics (o curso clica no nome do contêiner e escolhe Analytics). Criar conta do Analytics: nome da conta, nome da propriedade, fuso/país Brasil, moeda Real, categoria e tamanho da empresa (valores genéricos no curso: "Outros", "Small"), objetivo (o curso escolheu entender o que o usuário faz no site; há também gerar leads e engajamento).
2. Plataforma **Web**: URL do site e nome do fluxo de dados.
3. Abrir o fluxo, **Get Tagging Instructions** (instruções de instalação) e copiar o código.
4. Colar para a IA: "Configure corretamente agora para funcionar com o Google Analytics" + o código. O curso não esclarece se o gtag fica direto no layout ou dentro do GTM (confirmar no código gerado e evitar medir duas vezes).
5. Subir (`git add .`, `git commit -am "ajustando tag manager"`, `git push`) e esperar o deploy.
6. Verificar em tempo real: no Analytics, Home/tempo real mostra usuários ativos. Teste do curso: abrir o site no computador, depois no celular, e o contador sobe de 1 para 2. Pode mostrar a cidade do visitante.
7. Se não aparecer na hora: pode levar até 48 horas; se mesmo assim não funcionar, reinstalar.

### Evento de clique em botão

Pedido à IA, citando a página: "Coloque uma medição quando alguém clicar no botão Avise-me na tela de detalhes [do produto]." O evento leva o nome do produto como parâmetro (no teste, o Analytics mostrou o evento e o parâmetro com o nome da caneta clicada, ex.: `Product Name`). Subir (`commit` "medindo o botão de avise-me"), clicar no site publicado e conferir no Analytics. O curso diz que isso é útil para anúncios no Google Ads.

Ilustração do tipo de código (não é do curso):

```js
// clique no botão de aviso
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({ event: 'avise_me_click', product_name: nomeDoProduto });
```

## 3. Pixel da Meta

Lacuna: a aula "Instalando o pixel da Meta" (06 - Medindo cada visitante/03) está com a transcrição idêntica à do Google Analytics (provável erro de captura da legenda). Portanto o curso, como transcrito, não traz a instalação do código base do pixel (criação do pixel no Gerenciador de Eventos, onde colar o código). A aula seguinte já parte do pixel instalado. Para instalar, orientar o usuário a pegar o código/ID no Gerenciador de Eventos da Meta e instalar no layout (ou como tag no GTM); validar na prática (confirmar com o vídeo da aula original).

O que a aula 04 mostra (configurar eventos do pixel):

1. No Gerenciador de Eventos da Meta, **Configurar eventos** > adicionar o site (informar com `https://`) > **Adicionar eventos**; o site abre com a ferramenta.
2. Clicar no botão a medir (ex.: Avise-me) e marcar que o evento deve ser ativado. A ferramenta detectou o evento do botão (a transcrição escreve "SubscribedButtonClick"; confirmar o nome).
3. Prompt ao Claude/IA: "Configure o botão de Avise-me para funcionar como um evento no Meta Pixel, assim como já funciona no Analytics."
4. Subir (`commit` "ajustando o pixel") e esperar o deploy.
5. Verificar: recarregar o site com a ferramenta, clicar em Avise-me e ver os eventos detectados (o curso viu três eventos, um deles o clique do botão).

Regra: os mesmos eventos devem existir no Analytics e no pixel (mesmo botão, mesmas ações), para comparar com as campanhas.

## 4. Conferência (checklist "está funcionando de verdade")

- [ ] Tag Manager instalado no layout (todas as páginas)
- [ ] Analytics mostra visitante em tempo real (teste no celular)
- [ ] Evento do botão aparece no Analytics com o nome do produto
- [ ] Pixel da Meta instalado; evento do botão detectado pela ferramenta da Meta
- [ ] Formulário grava na planilha (seção seguinte)
- [ ] Testes feitos no site publicado, não só no local
- [ ] Esperar até 48 h antes de concluir que algo falhou no Analytics

## 5. Formulário direto para uma planilha (Google Sheets + Apps Script)

Fluxo do curso (o código do Apps Script e o do formulário estão nos materiais da aula, não nas transcrições; foi gerado por IA e é adaptável):

1. Criar a planilha no Google Sheets com colunas: **Data** (guarda também o horário), **Nome**, **Telefone**, **E-mail**. Adaptar as colunas ao formulário do projeto (sobrenome, sem telefone etc.).
2. **Extensões > Apps Script**, apagar o código em branco e colar o código que recebe os dados e grava uma linha na planilha. Sem o código do curso, pedir à IA para gerar um script que receba os campos do formulário e adicione uma linha com data/hora.
3. **Implantar (Deploy) > Nova implantação > App da Web (Web App)**; descrição (ex.: "coletar dados do form"); executar como **eu mesmo**; acesso para **qualquer pessoa** (para coletar dados de qualquer visitante); implantar; autorizar acesso, continuar.
4. Copiar o ID e a URL do web app.
5. Dar à IA: o código do Apps Script, o ID/URL, o código do formulário do site, e "Faça o formulário funcionar corretamente". A IA liga o formulário à URL.
6. Subir (`commit` "integrando tabela") e testar no site publicado: preencher nome, telefone e e-mail e enviar; a linha deve aparecer na planilha em tempo real (teste do curso: enviado e visível em cerca de 1 minuto).

Observações do skill (não são do curso): a URL do web app fica pública no código do site, então qualquer pessoa pode enviar dados para ela; pensar em spam/validação se o formulário for para cliente. O curso não trata de LGPD/consentimento, mensagem de sucesso/erro nem de enviar o lead para CRM; se o usuário precisar disso, é trabalho fora do curso (ex.: integrações de automação).

## 6. Pendências a confirmar com o usuário antes de começar

- Qual Analytics/GTM/pixel ele já tem (IDs) ou se quer criar do zero
- Quais botões/ações medir (eventos) e com que nomes
- Campos do formulário e para onde vão os dados
