# Como colocar o sistema no ar (EasyPanel)

Guia para publicar o Sistema de Reservas do Mult Coworking no servidor.
Escrito para ser seguido por quem **não programa**: cada passo diz o que fazer,
onde clicar e como saber se deu certo.

Endereço final: **https://sistema-mult.veritassdigital.com.br**

> **Sobre os nomes dos botões:** o EasyPanel muda um pouco de versão para
> versão. Se um botão estiver com nome diferente do que está aqui, procure a
> palavra parecida na mesma tela — a ordem dos passos continua valendo.

---

## Antes de começar

Tenha em mãos:

- [ ] acesso ao **EasyPanel** do seu VPS;
- [ ] acesso ao **painel de DNS** do domínio `veritassdigital.com.br`;
- [ ] o **endereço de IP** do VPS (o EasyPanel mostra na tela inicial);
- [ ] acesso ao repositório no GitHub: `veritas-ia/multcoworking-sistema`.

Reserve uns 40 minutos. Não precisa instalar nada no seu computador.

---

## Visão geral: o que vamos montar

São **duas peças** dentro de um mesmo projeto no EasyPanel:

| Peça | O que é | Nome sugerido |
| --- | --- | --- |
| Banco de dados | Onde ficam as reservas, salas e clientes | `banco` |
| Aplicação | O site em si | `sistema` |

A aplicação conversa com o banco por dentro do servidor — o banco **não** fica
exposto na internet, e isso é de propósito.

---

## Passo 1 — Criar o projeto e o banco de dados

1. No EasyPanel, crie um **projeto novo** chamado `mult-coworking`.
2. Dentro dele, adicione um serviço do tipo **PostgreSQL**.
3. Preencha:
   - **Nome do serviço:** `banco`
   - **Versão:** 16 (ou a mais próxima disponível)
   - **Senha:** clique em gerar uma senha forte e **guarde num lugar seguro**.
     Você vai precisar dela no Passo 4.
4. Salve e aguarde o serviço ficar verde/ativo.

### Confira o fuso horário do banco

Isto é importante e passa despercebido: **o banco tem de rodar em UTC.**

O sistema guarda todos os horários em UTC e converte para o horário de
São Paulo na hora de mostrar. Se o banco estiver noutro fuso, as reservas
aparecem com 3 horas de diferença — e o erro só aparece depois, com cliente
reclamando de horário errado.

O PostgreSQL do EasyPanel já vem em UTC por padrão. Para confirmar, abra o
**Terminal** ou o **Console** do serviço `banco` e rode:

```sh
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SHOW timezone;"
```

A resposta tem de ser `UTC`. Se não for, rode:

```sh
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ALTER DATABASE \"$POSTGRES_DB\" SET timezone TO 'UTC';"
```

> Os `$POSTGRES_USER` e `$POSTGRES_DB` são preenchidos sozinhos dentro do
> container do banco. Se der erro dizendo que estão vazios, use o usuário e o
> nome de banco que aparecem na tela do serviço.

---

## Passo 2 — Gerar a chave que protege o login do painel

O painel usa uma chave secreta para assinar o login da equipe. Sem ela o
sistema **não sobe**. Ela precisa ser diferente da que você usa no computador.

Abra o **Terminal** de qualquer serviço no EasyPanel e rode:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Vai sair uma linha embaralhada, mais ou menos assim:

```
kJ8mQx2vN7pL...
```

**Copie e guarde.** É a `ADMIN_SESSAO_SEGREDO` do Passo 4.

> Se um dia essa chave vazar, basta trocá-la: todo mundo é deslogado do painel
> na hora e as senhas continuam valendo.

---

## Passo 3 — Criar a aplicação a partir do GitHub

1. No mesmo projeto, adicione um serviço do tipo **App**.
2. **Nome do serviço:** `sistema`
3. Em **Source** (origem), escolha **GitHub** e aponte para:
   - Repositório: `veritas-ia/multcoworking-sistema`
   - Branch: `main`
   - Se o repositório for privado, o EasyPanel vai pedir para você conectar a
     conta do GitHub e autorizar o acesso.
4. Em **Build** (construção), escolha **Dockerfile**.
   - Caminho do Dockerfile: `Dockerfile` (na raiz, é o padrão)
   - Não é preciso mudar mais nada: o Dockerfile do projeto já faz tudo.

**Ainda não publique.** Antes precisamos das variáveis, no passo seguinte.

---

## Passo 4 — As variáveis de ambiente

São as configurações que o sistema lê ao ligar. Na tela do serviço `sistema`,
abra **Environment** (ou **Variáveis de ambiente**) e preencha:

> **A primeira linha você não inventa: copia.** Na tela do serviço `banco`, o
> EasyPanel mostra a *connection string* (endereço de conexão) já pronta, com o
> usuário, a senha e o nome do banco que ele criou. Copie a dela e acrescente
> `?schema=public` no fim. O exemplo abaixo é só para você ver o formato.

```
DATABASE_URL=postgres://USUARIO:SENHA@banco:5432/NOME_DO_BANCO?schema=public
APP_URL=https://sistema-mult.veritassdigital.com.br
TZ=America/Sao_Paulo
ADMIN_SESSAO_SEGREDO=a_chave_que_voce_gerou_no_passo_2
ADMIN_NOME=Administrador
ADMIN_USUARIO=admin
ADMIN_SENHA=escolha_uma_senha_de_pelo_menos_8_caracteres
CRON_ATIVO=true
EVOLUTION_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
```

### O que é cada uma

| Variável | O que faz | Cuidado |
| --- | --- | --- |
| `DATABASE_URL` | Endereço do banco | Copie o endereço que o EasyPanel mostra na tela do serviço `banco` e acrescente `?schema=public` no fim. O nome no meio do endereço (`banco`) é o **nome do serviço** do Passo 1 — é assim que um serviço acha o outro dentro do servidor. |
| `APP_URL` | Endereço público do site | É daqui que sai o link enviado nos lembretes de WhatsApp e a imagem que aparece quando alguém cola o link. Endereço errado **não dá erro**: o link só aparece sem imagem e o lembrete manda o cliente para o lugar errado. |
| `TZ` | Fuso do sistema | Nunca mude. Todo o sistema depende disso. |
| `ADMIN_SESSAO_SEGREDO` | Chave do login do painel | A do Passo 2. Sem ela o site não sobe. |
| `ADMIN_NOME`, `ADMIN_USUARIO`, `ADMIN_SENHA` | O primeiro acesso ao painel | Usados uma única vez, na carga inicial (Passo 7). Depois disso você cria os outros acessos pelo próprio painel. |
| `CRON_ATIVO` | Liga os lembretes automáticos | `true` em produção. Com `false`, nenhum lembrete de 13h ou 3h é enviado. |
| `EVOLUTION_*` | O WhatsApp | Deixe **vazias por enquanto**. Com elas vazias o sistema entra em *modo simulado*: tudo funciona, as mensagens ficam registradas, mas nada é enviado de verdade. Ver a seção "Ligar o WhatsApp". |

> **Atenção ao nome `EVOLUTION_URL`.** Se você escrever `EVOLUTION_API_URL` ou
> parecido, não dá erro nenhum: o sistema simplesmente fica em modo simulado
> para sempre e nenhuma mensagem sai. O sistema avisa no log quando detecta um
> nome parecido preenchido.

---

## Passo 5 — O subdomínio e o HTTPS

### 5.1 — Apontar o DNS

No painel de DNS do `veritassdigital.com.br`, crie um registro:

| Campo | Valor |
| --- | --- |
| Tipo | `A` |
| Nome | `sistema-mult` |
| Aponta para | o **IP do seu VPS** |
| TTL | o padrão (ou 300) |

Espere alguns minutos. Para conferir se já propagou, abra no navegador:
`https://dnschecker.org` e pesquise `sistema-mult.veritassdigital.com.br`.
Quando a maioria dos pontos mostrar o IP do VPS, pode seguir.

> Se você usa Cloudflare, deixe a nuvenzinha **cinza** (DNS only) na primeira
> vez. Com ela laranja, o Let's Encrypt pode não conseguir emitir o
> certificado. Depois que o HTTPS estiver funcionando, você pode ligar.

### 5.2 — Registrar o domínio no EasyPanel

1. Na tela do serviço `sistema`, abra **Domains** (Domínios).
2. Adicione o domínio: `sistema-mult.veritassdigital.com.br`
3. **Porta interna:** `3000` — é a porta em que o site escuta dentro do
   container.
4. Ligue a opção de **HTTPS / SSL** (Let's Encrypt).

O EasyPanel pede o certificado sozinho. Leva de alguns segundos a poucos
minutos. Se falhar, quase sempre é DNS que ainda não propagou: espere e tente
de novo.

---

## Passo 6 — Publicar pela primeira vez

1. Na tela do serviço `sistema`, clique em **Deploy**.
2. Acompanhe o log da construção. Ela demora **de 3 a 6 minutos** na primeira
   vez — o servidor está baixando e montando tudo. Nas próximas é mais rápido.
3. Quando terminar, o serviço fica verde.

### O que acontece sozinho quando o site sobe

Antes de atender qualquer visita, o sistema **cria e atualiza as tabelas do
banco**. Você vai ver no log:

```
→ Aplicando migracoes do banco...
All migrations have been successfully applied.
→ Migracoes em dia. Subindo o site...
```

Isso acontece a cada publicação e é seguro: o comando só aplica o que ainda
não foi aplicado. **Se essa etapa falhar, o site não sobe** — é de propósito.
Um site no ar com o banco em versão errada mostra erro para o cliente no meio
da reserva, o que é pior do que ficar dois minutos fora com o motivo escrito
no log.

### Configurar a verificação de saúde

Ainda na tela do serviço, procure **Health Check** (ou "Verificação de saúde")
e preencha:

| Campo | Valor |
| --- | --- |
| Caminho | `/api/saude` |
| Porta | `3000` |

Assim o EasyPanel reinicia o sistema sozinho se ele travar. Essa rota confere
também se o **banco** está respondendo, e não só se a página abre.

---

## Passo 7 — A carga inicial (só na primeira vez)

O banco está criado, mas vazio: sem salas, sem horário de funcionamento, sem
as mensagens de WhatsApp e sem ninguém que consiga entrar no painel.

Na tela do serviço `sistema`, abra o **Terminal** (ou **Console**) e rode:

```sh
npx prisma db seed --config prisma7.config.ts
```

Deve aparecer algo assim:

```
  - 3 salas
  - 7 dias de horário de funcionamento
  - 5 parâmetros de configuração
  - 7 modelos de mensagem
  - admin "admin" criado
🌱  The seed command has been executed.
```

Isso carrega:

- as três salas (Sala CI, Sala de Reunião, Sala Container) com os preços
  iniciais;
- o horário de funcionamento padrão (seg-qui 08:00–18:00, sáb 09:00–13:00,
  sex e dom fechados);
- as sete mensagens de WhatsApp;
- os parâmetros (duração mínima, prazo de cancelamento, antecedências);
- **o primeiro acesso ao painel**, com o usuário e a senha que você colocou em
  `ADMIN_USUARIO` e `ADMIN_SENHA`.

> **Rode este comando uma vez só.** Rodar de novo não estraga nada — ele não
> sobrescreve o que a equipe já ajustou no painel —, mas também não é
> necessário.

### Depois de entrar, troque a senha

1. Abra `https://sistema-mult.veritassdigital.com.br/admin`
2. Entre com o usuário e a senha de `ADMIN_USUARIO` / `ADMIN_SENHA`.
3. Vá em **Configurações → Usuários → Minha senha** e troque por uma senha só
   sua.
4. Crie os acessos da equipe na mesma tela.

Depois disso, **apague o valor de `ADMIN_SENHA`** das variáveis de ambiente
(deixe em branco). Ela não é mais usada, e senha parada em variável é senha
guardada à toa.

---

## Passo 8 — Conferir se está tudo certo

Abra cada um destes endereços no navegador:

| Endereço | O que você deve ver |
| --- | --- |
| `https://sistema-mult.veritassdigital.com.br` | A tela de reserva, com o cadeado de HTTPS na barra |
| `.../api/saude` | `{"estado":"ok","banco":"ok"}` |
| `.../minhas-reservas` | A tela que pede o telefone |
| `.../admin` | A tela de login do painel |

E faça este teste de verdade, do começo ao fim:

- [ ] **No celular**, abra o site e faça uma reserva completa. É onde a maioria
      dos seus clientes vai entrar.
- [ ] Cole o link do site numa conversa de WhatsApp e confira se aparece o
      **cartão amarelo com o nome "Mult Coworking"**. Se aparecer um retângulo
      cinza, o `APP_URL` está errado.
- [ ] Entre no painel e veja a reserva que você acabou de fazer na agenda.
- [ ] Em **Configurações**, confira se as salas e o horário estão certos.

---

## Ligar o WhatsApp de verdade

Enquanto `EVOLUTION_URL` estiver vazia, o sistema funciona normalmente mas
**não envia mensagem nenhuma** — nem código de verificação, nem confirmação,
nem lembrete. As mensagens ficam registradas no banco como se tivessem sido
enviadas.

Isso é útil para conferir tudo com calma. Quando quiser ligar de verdade:

1. Tenha a Evolution API rodando com uma instância conectada ao número do
   coworking.
2. Preencha as três variáveis no serviço `sistema`:
   - `EVOLUTION_URL` — o endereço da sua instância
   - `EVOLUTION_API_KEY` — a chave de acesso
   - `EVOLUTION_INSTANCE` — o nome da instância
3. Reinicie o serviço.
4. **Teste com o seu próprio número**: peça um código de verificação no site e
   veja se chega.

> Sem o WhatsApp ligado, **o cliente não consegue concluir uma reserva** pelo
> site, porque a identificação depende do código. A recepção continua podendo
> lançar reservas pelo painel normalmente.

---

## Publicar uma versão nova

Quando houver mudanças no código:

1. As mudanças chegam ao GitHub (branch `main`).
2. No EasyPanel, na tela do serviço `sistema`, clique em **Deploy**.
3. Acompanhe o log até o fim.

As tabelas do banco são atualizadas sozinhas, como no Passo 6. **Nenhuma
reserva é perdida.**

Se quiser que a publicação seja automática a cada mudança no GitHub, ative o
**Auto Deploy** (webhook) na tela do serviço. Recomendo deixar manual no
começo: você escolhe a hora de publicar, e não no meio do movimento.

---

## Backup do banco

**Isto não é opcional.** As reservas do coworking vivem só ali.

### Backup automático pelo EasyPanel

O EasyPanel tem backup embutido para serviços de banco de dados. Na tela do
serviço `banco`, procure **Backups** e configure:

- **Frequência:** diária
- **Destino:** um armazenamento externo (S3, Backblaze ou similar)
- **Retenção:** pelo menos 7 dias

> Backup guardado **no mesmo VPS** não é backup. Se o servidor morrer, morre
> junto. Configure um destino de fora.

### Backup manual (para fazer agora mesmo)

No **Terminal** do serviço `banco`:

```sh
pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > /tmp/backup-$(date +%F).sql
```

Depois baixe o arquivo pelo gerenciador de arquivos do EasyPanel.

### Restaurar um backup

```sh
psql -U "$POSTGRES_USER" "$POSTGRES_DB" < /tmp/backup-2026-09-04.sql
```

> Restaurar **substitui** o que está no banco. Faça um backup do estado atual
> antes, mesmo que ele pareça quebrado.

---

## Quando algo der errado

### O serviço não sobe / fica reiniciando

Abra o **log** do serviço `sistema` e procure a primeira linha de erro.

| O que aparece no log | O que é | O que fazer |
| --- | --- | --- |
| `ADMIN_SESSAO_SEGREDO ausente ou curto demais` | A chave do Passo 2 não foi preenchida, ou tem menos de 32 caracteres | Gere de novo e preencha |
| `DATABASE_URL nao configurada` | Faltou a variável do banco | Confira o Passo 4 |
| `Can't reach database server` | O endereço do banco está errado, ou o serviço do banco está parado | Confira se o nome do serviço no meio do `DATABASE_URL` é o mesmo do Passo 1 |
| Erro durante `Aplicando migracoes` | O banco recusou uma alteração | Copie a mensagem inteira e mande para quem cuida do código. **Não** apague o banco |

### O site abre mas dá erro ao reservar

Abra `.../api/saude`. Se a resposta for `{"estado":"erro","banco":"erro"}`,
o problema é a conexão com o banco, não o site.

### O link no WhatsApp aparece sem imagem

O `APP_URL` está diferente do endereço real do site. Confira se está escrito
exatamente `https://sistema-mult.veritassdigital.com.br`, **sem barra no fim**,
e reinicie o serviço.

### Os lembretes não chegam

Confira, nesta ordem:

1. `CRON_ATIVO` está como `true`?
2. `EVOLUTION_URL` está preenchida? (vazia = modo simulado, nada é enviado)
3. No log do serviço, ao subir, deve aparecer:
   `[rotinas] ligadas: lembretes de 5 em 5 min, faxina as 4h`

### O HTTPS não é emitido

Quase sempre é DNS. Confira em `https://dnschecker.org` se
`sistema-mult.veritassdigital.com.br` já aponta para o IP do VPS. Se você usa
Cloudflare, deixe a nuvenzinha cinza até o certificado sair.

---

## Quando trocar para o domínio final do cliente

O sistema foi feito para que essa troca seja simples:

1. Aponte o novo domínio (registro `A`) para o IP do VPS.
2. No EasyPanel, adicione o novo domínio ao serviço `sistema`, com HTTPS.
3. Mude a variável `APP_URL` para o novo endereço.
4. Reinicie o serviço.

**Não esqueça o passo 3.** Sem ele, os lembretes de WhatsApp continuam
mandando os clientes para o endereço antigo, e o cartão do link para de
mostrar a imagem — sem erro nenhum na tela.

---

## Anexo: o que a imagem tem dentro

Para quem cuida do código, um resumo do que o `Dockerfile` monta:

- **Etapa 1** baixa as dependências.
- **Etapa 2** gera o cliente do banco para o Linux do servidor e constrói o
  site.
- **Etapa 3** é a única que vai para o servidor: Node 22, o pacote enxuto do
  Next (`standalone`), as ferramentas de banco (Prisma, tsx, dotenv, bcryptjs)
  e as migrações. Roda como usuário sem privilégios, na porta 3000.

Imagem final: cerca de 520 MB.

O `docker-entrypoint.sh` aplica as migrações e só então inicia o site.
