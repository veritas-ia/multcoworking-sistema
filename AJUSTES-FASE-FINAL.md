# Ajustes para a fase de revisão e polimento

Lista de pendências de acabamento anotadas durante a construção, para
revisarmos na **Fase 12 — Revisão, polimento, responsividade, Open Graph,
build de produção**.

Nada aqui é erro que impeça o uso: são acabamentos. Cada item fica registrado
com o que está acontecendo hoje, onde mexer e o que decidir.

**Estado em setembro de 2026:** os itens 1, 5, 6 e 8 estão resolvidos. Seguem
em aberto o 2 e o 3 (dependem de decisão/dado do dono), o 4 (decisão sobre
versões) e o 9 (adiado a pedido do dono). O 7 é registro de decisão, não tem
nada a fazer.

---

## 1. ~~Data em formato ISO na tela de confirmação (etapa 8)~~ — RESOLVIDO na Fase 13

**Resolvido:** a etapa 8 passou a usar `dataPorExtenso()`, igual à etapa 7.
Corrigido junto com o item 6, que era o mesmo problema em outros dois pontos.

<details><summary>Registro do que era</summary>

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

**Ver também:** o item 6 tem outros dois pontos com o mesmo problema, na
área "Minhas reservas". Vale arrumar os três de uma vez.

</details>

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

---

## 5. ~~Barra de progresso errada no reagendamento~~ — RESOLVIDO na Fase 13

**Resolvido:** `BarraDeProgresso` passou a receber o total de etapas de quem a
usa. A reserva nova passa 7; o reagendamento passa 5. O total virou campo
obrigatório do componente, então uma tela nova não consegue mais esquecer de
informá-lo — o TypeScript recusa.

<details><summary>Registro do que era</summary>

**Como está hoje:** ao remarcar uma reserva, a barra diz "Etapa 1 de 7". Mas
remarcar tem **5 etapas** (sala, dia, início, término, código), não 7. O cliente
já está identificado, então as etapas de telefone e de nome não existem nesse
fluxo.

Além do texto errado, a barra enche errado: na primeira etapa ela mostra 1/7 do
caminho quando já andou 1/5.

**Por que acontece:** o componente da barra usa uma constante fixa,
`TOTAL_DE_ETAPAS`, que vale 7 — o número de etapas da reserva nova. O fluxo de
reagendamento reaproveita a mesma barra sem poder dizer que tem outro tamanho.

**O que fazer:** deixar o total ser informado por quem usa a barra, em vez de
ser uma constante. A tela de reserva nova continua passando 7; o reagendamento
passa 5.

**Onde:**
- `src/components/reserva/pecas.tsx` — o componente `BarraDeProgresso`
- `src/components/reserva/tipos.ts` — a constante `TOTAL_DE_ETAPAS`
- quem usa: `fluxo-de-reserva.tsx` (7) e
  `src/components/minhas-reservas/reagendamento.tsx` (5, na lista `ORDEM`)

**Tamanho:** pequeno.

</details>

---

## 6. ~~Datas em formato ISO na área "Minhas reservas"~~ — RESOLVIDO na Fase 13

**Resolvido:** os dois pontos passaram a usar `dataPorExtenso()`. Varri também
o resto da área pública atrás de outros lugares montando data na mão: não
sobrou nenhum.

<details><summary>Registro do que era</summary>

**Como está hoje:** dois pontos da área mostram a data crua, como `2026-09-10`,
em vez de "quinta-feira, 10 de setembro de 2026":

1. a faixa verde de aviso depois de remarcar ("Reserva remarcada para
   2026-09-10, 14:00 às 15:00...");
2. a descrição da tela que pede o código para **cancelar** ("Sala CI,
   2026-09-10, 10:00 às 11:00").

**Correção do que foi relatado:** o **cartão de reserva já está certo** — ele usa
`dataPorExtenso()` e mostra a data por extenso. Conferi no código antes de
anotar. O problema está só nos dois pontos acima, que montam o texto na mão.

**O que fazer:** usar `dataPorExtenso()` nos dois, como o cartão e o resumo do
reagendamento já fazem.

**Onde:**
- `src/components/minhas-reservas/area-do-cliente.tsx` — a mensagem de sucesso
  do reagendamento e a descrição passada ao pedido de código do cancelamento

**Ver também:** o item 1 é o mesmo problema na tela de confirmação da Fase 5.
São três pontos no total; vale arrumar todos juntos e, de quebra, procurar se
sobrou algum outro.

**Tamanho:** pequeno.

</details>

---

## 7. Por que o painel NÃO usa Auth.js (decidido na Fase 7)

**Não é uma pendência — é o registro de uma decisão**, para ninguém "corrigir"
isso mais tarde achando que foi esquecimento.

**O que aconteceu:** o CLAUDE.md original mandava usar Auth.js (NextAuth) no
painel. Na hora de instalar, os dois caminhos possíveis eram ruins:

- `next-auth@4` (estável) é da era do Pages Router. Com Next 15 + App Router
  funciona mal, principalmente no middleware — que é exatamente onde a proteção
  das rotas precisa acontecer.
- `next-auth@5` (o Auth.js de verdade para App Router) **só existe em beta**, e
  há bastante tempo. Seria uma dependência beta no alicerce do painel.

**O que foi feito:** sessão própria, com cookie httpOnly assinado — a mesma
mecânica da sessão de cliente da Fase 4, que já estava aprovada e funcionando.
Zero dependência nova. O CLAUDE.md foi atualizado para refletir isso.

**Como funciona, em uma linha:** o cookie do painel guarda um bilhete assinado
com uma chave secreta; o porteiro (middleware) confere a assinatura sem precisar
do banco, e cada página do painel confere de novo, aí sim no banco, se o usuário
ainda existe.

**O que revisar na Fase 13 (deploy):**

- gerar um `ADMIN_SESSAO_SEGREDO` **diferente** do usado em desenvolvimento e
  guardá-lo no EasyPanel — trocar essa chave desloga todo mundo na hora, o que é
  a ferramenta de emergência caso ela vaze;
- decidir se vale reavaliar o Auth.js quando a v5 sair de beta. Hoje **não há
  motivo prático** para trocar: o que existe funciona, tem teste e não depende
  de ninguém.

**Uma limitação conhecida, e por que ela é aceitável:** como o bilhete é
assinado em vez de guardado no banco, não dá para "cancelar" um cookie
específico antes de ele vencer. Na prática: sair do painel apaga o cookie do
navegador, um usuário apagado perde o acesso na tela seguinte (a conferência no
banco pega isso), e o bilhete vence sozinho em 12 horas. Para um painel de
equipe pequena, é troca justa. Se um dia precisar derrubar todas as sessões de
uma vez, basta trocar o `ADMIN_SESSAO_SEGREDO`.

**Tamanho:** decisão registrada, nada a fazer agora.

---

## 8. ~~Volume de WhatsApp numa série longa~~ — RESOLVIDO na Fase 9

> **RESOLVIDO.** O dono do projeto escolheu a opção (a): uma mensagem só,
> resumindo a série. Implementado com um template novo (`serie_confirmada`) e as
> variáveis {{dias}}, {{periodo}} e {{quantidade}}. Os lembretes de 24h e 2h
> continuam individuais por ocorrência. Há teste garantindo que 8 reservas geram
> exatamente 1 mensagem. O registro abaixo fica como histórico da decisão.

**Como era antes:** cada ocorrência de uma série disparava a mensagem de
confirmação, como o texto original da Fase 9 pedia. Uma série de terça e quarta por dois
meses cria ~17 reservas — e manda **~17 WhatsApps seguidos** para a mesma pessoa,
em poucos segundos.

**Por que isso preocupa:**

- para o cliente parece defeito do sistema, não capricho;
- a Evolution API (e o próprio WhatsApp) costuma limitar rajadas de mensagens
  para o mesmo número; parte pode falhar ou o número pode ser penalizado;
- o custo por mensagem, se houver, multiplica.

**Foi implementado como estava escrito** — a instrução era explícita — e depois
corrigido pela decisão do dono. As três saídas consideradas eram:

- **(a) Uma mensagem só, resumindo a série:** "sua reserva de terça e quarta,
  das 9h às 10h, está confirmada de 06/10 a 30/11 (17 datas)". Exigiria um
  template novo no painel.
- **(b) Mensagem por ocorrência, mas espaçadas** (uma a cada X segundos, em fila).
  Não resolve o incômodo do cliente, só o risco técnico.
- **(c) Deixar como está**, se as séries forem raras e curtas.

**Escolhida: (a).** O CLAUDE.md foi atualizado — passou de seis para sete
templates, e a regra da mensagem única ficou registrada junto.

**Onde ficou:** `src/app/api/admin/recorrencias/route.ts`.

---

## 9. O LogMensagem não guarda o texto enviado (anotado na Fase 9)

**Como está hoje:** cada envio de WhatsApp vira uma linha em `LogMensagem` com
**quem** recebeu, **qual template** foi usado, **quando**, se deu certo e o erro
em caso de falha. O **texto exato** que o cliente leu não é guardado.

**Por que isso incomoda:** os templates são editáveis no painel (Fase 11). Se a
equipe mudar o texto de "reserva confirmada" hoje, não há como saber depois o que
foi enviado na semana passada. Num atrito com cliente — "vocês me mandaram outro
horário" — não existe prova.

**Descoberto onde:** escrevendo o teste da mensagem única da série. Para conferir
o conteúdo, o teste precisou remontar a mensagem a partir do modelo do banco, em
vez de simplesmente ler o que foi enviado.

**O que fazer, se for o caso:** uma coluna `texto` em `LogMensagem`, preenchida
no envio. Custa uma migração e um campo a mais por mensagem — barato em espaço,
já que as mensagens são curtas.

**A decidir:** vale guardar? Se sim, por quanto tempo — a rotina de limpeza da
Fase 10 poderia apagar logs antigos depois de X meses, para a tabela não crescer
para sempre.

**Onde:** `prisma/schema.prisma` (modelo `LogMensagem`) e `src/lib/whatsapp.ts`
(a função que grava o log).

**Tamanho:** pequeno.

**NÃO implementar agora** — decisão adiada para a revisão, a pedido do dono.

