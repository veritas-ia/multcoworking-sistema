# Sistema de Reservas — Coworking

Aplicacao web para reserva das salas do coworking.
As regras de negocio e as decisoes ja fechadas estao em [CLAUDE.md](./CLAUDE.md).

## Rodar no seu computador

Precisa de: Node.js 22+, Docker Desktop aberto.

```bash
npm install          # instala tudo (so na primeira vez)
cp .env.example .env # cria seu arquivo de configuracao (so na primeira vez)
npm run db:up        # liga o banco de dados
npm run db:migrate   # cria as tabelas (so na primeira vez e quando o schema mudar)
npm run db:seed      # carrega salas, horarios, mensagens e o admin
npm run dev          # liga o site em http://localhost:3000
```

Antes do `db:seed`, abra o `.env` e preencha `ADMIN_SENHA` com a senha que voce
quer usar no painel.

Para desligar o banco: `npm run db:down`.

## Comandos disponiveis

| Comando             | O que faz                                      |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Liga o site em modo desenvolvimento             |
| `npm run predev`    | Confere se a porta 3000 esta livre (roda sozinho)|
| `npm run build`     | Gera a versao de producao                       |
| `npm start`         | Roda a versao de producao ja gerada             |
| `npm test`          | Roda os testes automatizados                    |
| `npm run test:watch`| Roda os testes e fica observando alteracoes     |
| `npm run lint`      | Procura problemas de estilo no codigo           |
| `npm run typecheck` | Confere os tipos do TypeScript                  |
| `npm run db:up`     | Liga o banco de dados (Docker)                  |
| `npm run db:down`   | Desliga o banco de dados                        |
| `npm run db:migrate`| Aplica as mudancas de estrutura no banco        |
| `npm run db:seed`   | Carrega os dados iniciais (pode repetir)        |

## A tela de reserva (Fase 5)

O site abre direto no fluxo de reserva, em 8 telas: sala, dia, horario de
inicio, horario de termino, WhatsApp, nome, conferencia e confirmacao.

### Abrir no computador

Com o `npm run dev` rodando, abra:

    http://localhost:3000

### Abrir ja com uma sala escolhida (QR Code e link do Instagram)

Basta acrescentar `?sala=` com o apelido da sala. O cliente cai direto na
escolha do dia, com a sala ja marcada:

    http://localhost:3000/?sala=sala-ci
    http://localhost:3000/?sala=sala-de-reuniao
    http://localhost:3000/?sala=sala-container

Se o apelido estiver errado, a tela simplesmente comeca do zero, pedindo a sala.
Em producao troque `http://localhost:3000` pelo endereco do site.

### Testar no celular, pela rede local

1. Deixe o computador e o celular **na mesma rede Wi-Fi**.
2. Rode `npm run dev`. No terminal aparecem duas linhas:

       - Local:        http://localhost:3000
       - Network:      http://192.168.x.x:3000

3. No navegador do celular, digite o endereco da linha **Network**
   (o numero muda a cada rede; use o que aparecer no seu terminal).

Se nao aparecer nada no celular, quase sempre e uma destas tres coisas:

- o celular esta no 4G/5G em vez do Wi-Fi;
- o Wi-Fi tem "isolamento de clientes" ligado (comum em rede de predio e de
  cafe) — nesse caso teste com o roteador de casa;
- o firewall do macOS pediu permissao para o Node e a resposta foi "negar".
  Ajuste em Ajustes do Sistema > Rede > Firewall.

O codigo de 6 digitos **nao chega no WhatsApp** enquanto o `EVOLUTION_URL`
estiver vazio: ele aparece no terminal do `npm run dev`. Deixe o terminal
visivel enquanto testa no celular.

## WhatsApp em modo simulado

Enquanto `EVOLUTION_URL` estiver vazia no `.env`, **nenhuma mensagem e enviada
de verdade**. O texto aparece no terminal onde o `npm run dev` esta rodando,
dentro de uma moldura, incluindo o codigo de verificacao de 6 digitos.

E assim que voce testa o sistema inteiro sem gastar WhatsApp.

## Minhas reservas (Fase 6)

O cliente entra em `http://localhost:3000/minhas-reservas` (tem link no topo da
tela de reserva e na confirmacao). Se ainda nao tiver sessao, ele confirma o
telefone pelo WhatsApp — a mesma tela da Fase 5.

La ele ve as proximas reservas e o historico, e pode **remarcar** ou **cancelar**
enquanto faltarem mais de 12 horas para o inicio. Passou disso, os botoes ficam
travados com a explicacao e a orientacao de falar com a recepcao.

**Cancelar e remarcar sempre pedem um codigo novo do WhatsApp**, mesmo com a
sessao de 30 dias valida. E decisao do CLAUDE.md: sao acoes que nao tem volta.

### Testar as duas situacoes (mais de 12h e menos de 12h)

```bash
npm run reservas-de-teste -- "(11) 91234-5678"
```

O comando cria duas reservas para esse telefone:

- uma daqui a alguns dias — **mais de 12h**, com os botoes liberados;
- outra ainda hoje — **menos de 12h**, com os botoes travados.

Ele respeita o horario de funcionamento e nao encosta em horario ja ocupado.
Se voce rodar num dia fechado ou muito tarde, ele avisa que a de "menos de 12h"
nao coube e explica por que.

Depois e so abrir `/minhas-reservas`, confirmar aquele telefone e comparar os
dois cartoes. O codigo de 6 digitos aparece no terminal do `npm run dev`.

## Painel administrativo (Fase 7)

O painel fica em `http://localhost:3000/admin` e e protegido por login.

### Criar seu primeiro usuario

```bash
npm run criar-admin
```

Ele pergunta o nome completo, o **nome de usuario** (e por ele que voce entra,
nao por e-mail) e a senha, duas vezes. A senha nao aparece na tela enquanto voce
digita. Minimo de 8 caracteres.

Rode o mesmo comando quantas vezes quiser para criar outros usuarios da equipe.
Todos tem o mesmo nivel de acesso.

**Nao ha recuperacao de senha por e-mail.** Se alguem esquecer a senha, outro
administrador cria um usuario novo para essa pessoa.

### A chave que assina o login

O painel precisa de `ADMIN_SESSAO_SEGREDO` no `.env`, com no minimo 32
caracteres. Sem ela o painel nao sobe. Para gerar a sua:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Em producao use uma chave **diferente**. Trocar essa chave desloga todo mundo do
painel na hora — e a ferramenta de emergencia caso ela vaze.

### Testar o login e a protecao

1. **Sem estar logado**, abra `http://localhost:3000/admin`.
   Voce deve cair na tela de login.
2. Tente entrar com a **senha errada**: aparece "Usuario ou senha incorretos".
   Errando 5 vezes, o usuario fica travado por 15 minutos.
3. Entre com a **senha certa**: voce vai para o painel, com seu nome no topo.
4. Clique em **Sair** e tente `/admin` de novo: volta para o login.

Para conferir que a API tambem esta protegida, com o servidor no ar:

```bash
curl -i http://localhost:3000/api/admin/eu | head -1
```

Sem login isso responde `401`, e nao a pagina de login — porque redirecionar uma
chamada de programa so atrapalharia.

### As duas sessoes nao se misturam

A sessao do **cliente** (area publica, 30 dias) e a do **admin** (painel, 12
horas) usam cookies com nomes diferentes e verificadores diferentes. Estar
logado como cliente nao abre o painel, e estar logado no painel nao da acesso as
reservas de nenhum cliente. Ha teste automatizado garantindo isso nos dois
sentidos.

## Quando o site nao abre

Quase sempre e uma destas tres coisas, nesta ordem.

### 1. Sobrou um servidor antigo aberto

E de longe a causa mais comum. Dois `npm run dev` no mesmo projeto avisam
"Port 3000 is in use", um deles pula para a porta 3001 — e os dois continuam
escrevendo na MESMA pasta `.next`, se atrapalhando. O site passa a falhar sem
motivo aparente: uma hora abre, outra hora a tela fica girando para sempre.

O projeto agora barra isso sozinho: o `npm run dev` para e explica o que fazer.
Para resolver na mao:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN   # ve quem esta segurando a porta
pkill -f "next dev"                 # fecha todos os servidores do projeto
npm run dev                         # sobe um so, limpo
```

**Regra que evita o problema:** um `npm run dev` de cada vez. Antes de fechar
o terminal, pare o servidor com `Ctrl+C` — fechar a janela nem sempre mata o
processo.

### 2. O banco esta desligado

```bash
npm run db:up          # liga
docker compose ps      # tem de aparecer "Up ... (healthy)"
```

### 3. A pasta de build ficou corrompida

Acontece quando um `npm run build` roda com o `npm run dev` aberto, ou depois
do caso 1. Sintoma tipico: erros estranhos no terminal, como
`TypeError: a[d] is not a function`.

```bash
pkill -f "next dev"
rm -rf .next
npm run dev
```

### Erro "Class extends value undefined" ao subir o servidor

Se aparecer algo como
`TypeError: Class extends value undefined is not a constructor or null`
apontando para `node_modules/next/dist/bin/next`, a pasta `node_modules` esta
incompleta. Isso acontece quando ela e apagada ou reinstalada **com o servidor
rodando**.

```bash
pkill -f "next dev"                    # PRIMEIRO feche o servidor
rm -rf node_modules package-lock.json
npm install
npm run dev
```

**Nunca rode `npm install` com o `npm run dev` aberto.**

## Observacoes

- O banco local usa a porta **5434** (a 5432 ja esta ocupada por outro projeto nesta maquina).
- O arquivo `.env` guarda senhas e **nunca** vai para o Git. O modelo dele e o `.env.example`.
- Os testes (`npm test`) precisam do banco ligado (`npm run db:up`).
- O banco roda em **UTC**, sempre. Nao coloque fuso local no container:
  o driver grava os horarios adiantados e o erro fica invisivel.
- As regras de agenda sao garantidas pelo proprio PostgreSQL, nao so pelo codigo:
  ver `prisma/migrations/*_travas_de_horario/migration.sql`.
