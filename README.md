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
