# Sistema de Reservas — Coworking

Aplicacao web para reserva das salas do coworking.
As regras de negocio e as decisoes ja fechadas estao em [CLAUDE.md](./CLAUDE.md).

## Rodar no seu computador

Precisa de: Node.js 22+, Docker Desktop aberto.

```bash
npm install          # instala tudo (so na primeira vez)
cp .env.example .env # cria seu arquivo de configuracao (so na primeira vez)
npm run db:up        # liga o banco de dados
npm run dev          # liga o site em http://localhost:3000
```

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

## Observacoes

- O banco local usa a porta **5434** (a 5432 ja esta ocupada por outro projeto nesta maquina).
- O arquivo `.env` guarda senhas e **nunca** vai para o Git. O modelo dele e o `.env.example`.
