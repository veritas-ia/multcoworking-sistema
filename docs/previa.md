# A prévia: uma cópia do sistema para mostrar antes de publicar

> Escrito para quem vai clicar no EasyPanel. Não precisa saber programar.

A partir da versão 2.0 (financeiro e empório), tudo novo é construído primeiro
numa **cópia** do sistema. O dono olha, aprova, e só então aquilo entra no
sistema de verdade.

São dois sites iguais no ar ao mesmo tempo. É isso que torna a prévia útil — e
é isso que a torna perigosa, se montada errada.

---

## O perigo, em uma frase

**A prévia é idêntica ao sistema real.** Com as duas abas abertas, alguém lança
a reserva de um cliente na prévia, ela nunca chega na agenda de verdade, e o
cliente aparece no dia sem sala.

Três avisos impedem isso, e já estão no código:

- uma **faixa preta** no topo de toda página, pública e do painel;
- **"PRÉVIA ·"** na frente do título da aba — a barra de abas é justamente onde
  a faixa não aparece;
- a prévia **não entra no Google**, nem as páginas públicas.

Os três só aparecem quando a variável `AMBIENTE` vale `previa`. **Se você
esquecer essa variável, nada disso dá erro:** a prévia sobe funcionando
perfeitamente, só que indistinguível do sistema real. É o erro mais fácil de
cometer aqui.

---

## As diferenças entre os dois

| | Sistema real | Prévia |
| --- | --- | --- |
| Serviço no EasyPanel | `multcoworking-app` | `multcoworking-previa` |
| Endereço | `multcoworking.veritassdigital.com.br` | `previa-multcoworking.veritassdigital.com.br` |
| Branch do GitHub | `main` | `previa` |
| Banco de dados | `multcoworking-db` | **`multcoworking-previa-db`, serviço próprio** |
| `AMBIENTE` | vazio | `previa` |
| `CRON_ATIVO` (rotinas) | `true` | **`false`** |
| `EVOLUTION_*` (WhatsApp) | preenchidas | **vazias** |
| `CLOUDINARY_*` (fotos) | preenchidas | **vazias** |
| `ADMIN_SESSAO_SEGREDO` | a de produção | **outra, diferente** |

### Por que cada trava existe

- **Banco separado.** Mexer na prévia nunca pode encostar numa reserva de
  verdade. É a trava mais importante de todas.
- **`CRON_ATIVO=false`.** Com a cópia dos dados reais dentro, as rotinas da
  prévia mandariam lembrete, confirmação e convite de avaliação **para os
  clientes de verdade** — porque os telefones na cópia são os reais.
- **`EVOLUTION_*` vazias.** Segunda camada da mesma proteção: mesmo que alguém
  clique em "enviar" numa tela, o sistema entra em modo simulado, registra a
  mensagem e **não envia nada**.
- **`CLOUDINARY_*` vazias.** Esta quase passa batido: as fotos das salas ficam
  num serviço de fora. Com a mesma credencial, apagar uma foto na prévia
  **apagaria o arquivo de verdade**, e ela sumiria do site real. Vazias, as
  fotos que já existem continuam aparecendo e só o envio de novas fica
  desligado.
- **Chave do painel diferente.** O login de um não vale no outro, e trocar a
  chave da prévia não desloga ninguém do sistema real.

---

## Passo 1 — O banco da prévia

1. No EasyPanel, **no projeto `automacoes`** (o mesmo onde já estão o
   `multcoworking-app` e o `multcoworking-db`), adicione um serviço do tipo
   **PostgreSQL**.
2. **Nome do serviço:** `multcoworking-previa-db`
3. **Versão:** a mesma do banco de produção (16).
4. **Senha:** gere uma forte e guarde.
5. Salve e espere ficar verde.

> **Serviço novo, e não um banco a mais dentro do de produção.** Assim não
> existe nenhum caminho, nem por engano de digitação, que leve a prévia a
> escrever na agenda de verdade.

### Os nomes dos serviços, e por que seguir o padrão

O projeto `automacoes` já tem vários sistemas dentro, inclusive uma prévia de
outro projeto (`shexpress-previa`). Então o padrão já existe: o nome do sistema,
com `-previa` no fim.

| | Produção | Prévia |
| --- | --- | --- |
| Aplicação | `multcoworking-app` | `multcoworking-previa` |
| Banco | `multcoworking-db` | `multcoworking-previa-db` |

**Isto não é só organização.** Dentro do servidor, um serviço acha o outro por
um endereço que é o **nome do projeto + o nome do serviço**: o banco de
produção é `automacoes_multcoworking-db`. É esse nome que vai no meio do
`DATABASE_URL` do Passo 4, e é o ponto onde um erro de uma letra ligaria a
prévia no banco de verdade.

---

## Passo 2 — A chave do login da prévia

Precisa ser **diferente** da de produção, com pelo menos 32 caracteres. Para
gerar uma, na VPS:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Guarde o resultado: é o `ADMIN_SESSAO_SEGREDO` do Passo 4.

---

## Passo 3 — A aplicação

1. No mesmo projeto `automacoes`, adicione um serviço do tipo **App**.
2. **Nome do serviço:** `multcoworking-previa`
3. Em **Source**: GitHub, repositório `veritas-ia/multcoworking-sistema`,
   branch **`previa`** ← *é aqui que a maioria erra; não é `main`*.
4. Em **Build**: Dockerfile, caminho `Dockerfile`.

**Não publique ainda.**

---

## Passo 4 — As variáveis de ambiente

Na tela do serviço `multcoworking-previa`, em **Environment**:

> **A primeira linha você copia, não inventa.** Na tela do serviço
> `multcoworking-previa-db`, o EasyPanel mostra o endereço de conexão pronto,
> com usuário, senha e nome do banco que ele criou. O formato é igual ao da
> produção, trocando só o nome do serviço:
> `postgres://USUARIO:SENHA@automacoes_multcoworking-previa-db:5432/NOME?sslmode=disable&schema=public`

```
DATABASE_URL=<o endereço do serviço multcoworking-previa-db>?sslmode=disable&schema=public
APP_URL=https://previa-multcoworking.veritassdigital.com.br
TZ=America/Sao_Paulo
AMBIENTE=previa
ADMIN_SESSAO_SEGREDO=<a chave do Passo 2>
CRON_ATIVO=false
EVOLUTION_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

**Confira três coisas antes de salvar**, porque nenhuma delas dá erro se
estiver errada:

1. o `DATABASE_URL` tem **`multcoworking-previa-db`** no meio, e não
   `multcoworking-db`. Esta é a linha mais perigosa do arquivo: errada, a
   prévia escreve na agenda de verdade e nada avisa;
2. `AMBIENTE=previa`, escrito assim;
3. `CRON_ATIVO=false`.

---

## Passo 5 — O endereço

Igual ao do sistema real, no mesmo lugar:

1. No seu provedor de DNS, crie um `CNAME` (ou `A`, igual ao que você usou no
   original) para `previa-multcoworking`.
2. No EasyPanel, na aba **Domains** do serviço `multcoworking-previa`,
   registre o domínio e peça o certificado HTTPS.

---

## Passo 6 — Carregar a cópia dos dados, ANTES de publicar

**A ordem aqui é regra, não preferência.** Ao subir, o sistema aplica as
migrações sozinho e cria todas as tabelas vazias. Se você publicar primeiro e
só depois tentar carregar a cópia, o carregamento **falha**: ele tenta criar
tabelas que já existem.

Carregando antes, dá tudo certo de uma vez: a cópia já traz as tabelas, os
dados **e o registro de quais migrações estavam aplicadas**. Quando o site
subir, ele vê que não falta nenhuma e simplesmente começa a atender — já com as
199 reservas dentro.

O arquivo da cópia está na VPS, em `/root/backups/`. **Me avise quando o
`multcoworking-previa-db` estiver verde e eu carrego.**

Se preferir fazer você mesmo, é um comando só na VPS:

```
docker exec -i $(docker ps --format '{{.Names}}' | grep automacoes_multcoworking-previa-db) \
  psql -U <usuario> -d <banco> < /root/backups/multcoworking-<data>-para-previa.sql
```

### O login da prévia é o mesmo do sistema real

Os usuários do painel vêm dentro da cópia, com a senha de sempre. Por isso a
prévia **não precisa** das variáveis `ADMIN_NOME`, `ADMIN_USUARIO` e
`ADMIN_SENHA`: elas só servem para a carga inicial, que o deploy não roda.

A chave `ADMIN_SESSAO_SEGREDO` é outra coisa e **continua obrigatória** — sem
ela o site não sobe. Ela ser diferente da de produção só significa que você
faz login nos dois separadamente.

### Se você já publicou antes de carregar

Não tem problema, mas aí o banco precisa ser esvaziado primeiro. Na VPS:

```
docker exec -i $(docker ps --format '{{.Names}}' | grep automacoes_multcoworking-previa-db) \
  psql -U <usuario> -d <banco> -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
```

Depois rode o comando de carregar. **Confira duas vezes que o container é o da
prévia** antes de apertar Enter: este comando apaga tudo que estiver no banco
que você apontar.

---

## Passo 6b — Publicar

Clique em **Deploy** no serviço `multcoworking-previa` e acompanhe o log. Você
deve ver "Aplicando migracoes do banco" e, logo depois, o site subindo. Se a
migração falhar, o site **não** sobe de propósito — o motivo fica escrito no
log.

---

## Passo 7 — Conferir se as travas pegaram

Abra a prévia e olhe **três coisas**:

- [ ] a faixa preta escrito **PRÉVIA** no topo da página;
- [ ] o título da aba começando com **"PRÉVIA ·"**;
- [ ] abra `previa-multcoworking.veritassdigital.com.br/robots.txt` — tem de
      dizer `Disallow: /`.

Se faltar qualquer uma, **pare**: a variável `AMBIENTE` não chegou no serviço.

---

## O dia a dia

### Mostrar uma novidade para o dono

Tudo que for construído na versão 2.0 vai para a branch `previa`. Cada vez que
algo novo fica pronto, é um **Deploy** no serviço `multcoworking-previa` — o
sistema real não muda em nada.

### Quando o dono aprovar

Aí a branch `previa` entra na `main`, e o sistema real recebe a novidade pelo
deploy de sempre (`docs/deploy.md`, seção "Publicar uma versão nova").

### Atualizar os dados da prévia

Com o tempo a cópia fica velha — ela não recebe as reservas novas. Quando isso
atrapalhar a demonstração, é só refazer a cópia: mesmo comando do Passo 6.

---

## O que nunca fazer na prévia

- **Não ligue `CRON_ATIVO`.** Os telefones na cópia são os dos clientes de
  verdade.
- **Não preencha as variáveis do WhatsApp.**
- **Não preencha as do Cloudinary.** Apagar uma foto lá apaga a foto do site
  real.
- **Não aponte o `DATABASE_URL` para o banco de produção**, nem "só para
  conferir um número".
