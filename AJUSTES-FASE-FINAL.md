# Ajustes para a fase de revisão e polimento

Lista de pendências de acabamento anotadas durante a construção, para
revisarmos na **Fase 12 — Revisão, polimento, responsividade, Open Graph,
build de produção**.

Nada aqui é erro que impeça o uso: são acabamentos. Cada item fica registrado
com o que está acontecendo hoje, onde mexer e o que decidir.

---

## 1. Data em formato ISO na tela de confirmação (etapa 8)

**Como está hoje:** a tela de confirmação mostra a data como `2026-09-10`,
o formato que o sistema usa por dentro. A tela de conferência (etapa 7),
uma tela antes, mostra a mesma data como "quinta-feira, 10 de setembro de
2026". O cliente vê os dois formatos diferentes em sequência.

**Por que acontece:** a etapa 7 formata a data com `dataPorExtenso()`, mas a
etapa 8 mostra direto o que a API devolveu, sem formatar.

**O que fazer:** padronizar a etapa 8 no formato brasileiro por extenso,
igual à etapa 7.

**Onde:**
- `src/components/reserva/etapa-confirmacao.tsx` — a linha `rotulo="Dia"`
- a função `dataPorExtenso()` já existe em `src/components/reserva/datas.ts`
  e já tem teste; é só usá-la

**Tamanho:** pequeno, uma linha.

---

## 2. "Código da reserva" mostra o identificador interno

**Como está hoje:** a tela de confirmação mostra o identificador do banco,
um UUID de 36 caracteres (`01a0624b-5f2f-...`). É impossível de ditar por
telefone, difícil de anotar e não significa nada para o cliente.

**Por que está assim:** foi uma escolha minha na Fase 5, sem apoio de regra
de negócio. Cheguei a considerar mostrar só um pedaço do código, mas
**os primeiros caracteres de um UUID v7 não são únicos** — eles vêm do
relógio e só mudam a cada ~49 dias, então vários clientes teriam o "mesmo
número". Preferi mostrar o identificador inteiro a inventar um número que
poderia se repetir.

**O que decidir (uma das duas):**

- **(a) Criar um número curto de verdade.** Algo como `MC-4827` ou 6 dígitos,
  guardado numa coluna própria da reserva, único, gerado na criação. Serve
  para o cliente ditar no telefone e para a equipe achar a reserva no painel
  (Fase 8). Custa uma migração no banco e uma regra de geração.

- **(b) Tirar o código da tela.** Na Fase 6 o cliente entra em "Minhas
  reservas" com telefone + código do WhatsApp — ele nunca precisa digitar o
  identificador da reserva em lugar nenhum. Se a equipe também achar a
  reserva pelo telefone do cliente no painel, o código é peso morto.

**Pergunta que decide:** quando um cliente liga para o coworking, a equipe
procura a reserva **pelo telefone dele** ou por um número de reserva? Se for
pelo telefone, a opção (b) resolve sem custo nenhum.

**Onde:**
- `src/components/reserva/etapa-confirmacao.tsx` — o bloco "Código da reserva"
- se for a opção (a): coluna nova em `prisma/schema.prisma` (modelo `Reserva`)
  + migração + o campo na resposta de `src/app/api/publico/reservas/route.ts`

**Tamanho:** (a) médio, mexe no banco. (b) pequeno, remove um bloco.

---

## 3. Capacidade das salas não está preenchida (anotado na Fase 5)

**Como está hoje:** os cartões de sala da etapa 1 mostram nome e preço por
hora, mas não a capacidade. O campo existe no banco desde a Fase 2 e nunca
foi preenchido — a carga inicial não define capacidade nenhuma.

**O que falta:** os números. Quantas pessoas cabem na Sala CI, na Sala de
Reunião e na Sala Container. Não inventei os valores.

**Observação:** a tela já está pronta para isso. Assim que houver o dado, o
cartão passa a mostrar "até N pessoas" sozinho, sem mexer no código. Na
Fase 11 o campo vira editável no painel.

**Onde:** `prisma/seed.ts` (lista `SALAS`) para os valores iniciais.

**Tamanho:** pequeno, depende só da informação.

---

## 4. Vulnerabilidades do `npm audit` (anotado na Fase 5)

**Como está hoje:** `npm audit` acusa 6 vulnerabilidades (1 moderada, 5 altas),
todas em dependências de **build**, nenhuma exposta no site em produção:

- `mysql2`, que vem junto do Prisma e nem é usado (o banco é PostgreSQL)
- `postcss`, empacotado dentro do Next, roda só na hora de gerar o CSS

**Por que não foi corrigido:** `npm audit fix --force` quebraria o projeto —
ele quer rebaixar o Prisma da 7.10 para a 6.19 e subir o Next da 15 para a 16.
Os dois contrariam a stack fixada no CLAUDE.md.

**O que fazer:** reavaliar na Fase 12/13, junto com o preparo de produção,
quando fizer sentido decidir sobre atualização de versões.

**Tamanho:** decisão, não código.
