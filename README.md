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

## Observacoes

- O banco local usa a porta **5434** (a 5432 ja esta ocupada por outro projeto nesta maquina).
- O arquivo `.env` guarda senhas e **nunca** vai para o Git. O modelo dele e o `.env.example`.
- Os testes (`npm test`) precisam do banco ligado (`npm run db:up`).
- O banco roda em **UTC**, sempre. Nao coloque fuso local no container:
  o driver grava os horarios adiantados e o erro fica invisivel.
- As regras de agenda sao garantidas pelo proprio PostgreSQL, nao so pelo codigo:
  ver `prisma/migrations/*_travas_de_horario/migration.sql`.
