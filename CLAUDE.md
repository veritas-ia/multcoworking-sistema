# Sistema de Reservas — Coworking

## Contexto
Aplicação web responsiva para gestão de reservas de 3 salas de um coworking.
Substitui agenda física. Usada por clientes (área pública) e pela equipe (painel admin).

## Stack obrigatória
- Next.js 15 (App Router) + TypeScript (strict)
- PostgreSQL + Prisma
- Tailwind CSS + shadcn/ui
- Sessão própria com cookie httpOnly assinado para o painel (mesma mecânica da
  sessão de cliente da Fase 4), sem NextAuth
- date-fns-tz para datas
- node-cron para rotinas agendadas (dentro do mesmo processo)
- Evolution API para WhatsApp (chamada direta, sem intermediário)
- Vitest para testes

## Regras de negócio (fonte da verdade — nunca alterar sem pedir)
- Salas: Sala CI, Sala de Reunião, Sala Container. Agendas independentes.
- Fuso horário: America/Sao_Paulo, sempre. Guardar no banco em UTC (timestamptz).
- Horário de funcionamento padrão (editável no painel):
  seg-qui 08:00-18:00 | sex fechado | sáb 09:00-13:00 | dom fechado
- Grade de seleção: blocos de 30 minutos.
- Duração mínima: 60 minutos. Máxima: até o horário de fechamento do dia.
- Intervalo obrigatório de 30 min entre reservas da MESMA sala, simétrico (antes e depois).
- O intervalo NÃO se aplica contra abertura/fechamento: reserva pode terminar no horário de fechamento.
- Bloqueios administrativos NÃO exigem intervalo de 30 min.
- A recepção (origem ADMIN) pode lançar reserva AVULSA em dia fechado e fora do
  horário de funcionamento — é para evento pontual que a equipe sabe que vai abrir.
  O CLIENTE na área pública continua sem poder. Uma RECORRÊNCIA, porém, PULA os dias
  fechados e informa quantos pulou: uma série de meses não pode criar reservas em
  feriados e domingos sozinha.
- Proibido sobrepor reservas na mesma sala. Trava no banco, não só na aplicação.
- Cliente pode cancelar/reagendar apenas com mais de 12h de antecedência.
- Admin pode cancelar/reagendar sempre, inclusive dentro das 12h.
- Status: CONFIRMADA, REAGENDADA, CANCELADA, CONCLUIDA.
- Preço por hora configurável por sala; cálculo proporcional em blocos de 30 min.
- Sem pagamento online no MVP.
- Identificação do cliente: telefone + código de 6 dígitos via WhatsApp (válido 10 min,
  uso único, máx. 5 tentativas). Exigido para reservar e para gerenciar reservas.
- Máx. 3 reservas ativas por telefone. Limite de envio de códigos por número e por IP.
- Lembretes automáticos: 13h antes e 3h antes (mudado na Fase 10 — eram 24h e 2h).
  Cada um enviado NO MÁXIMO uma vez por reserva (registrar data/hora de envio e nunca
  reenviar). As DUAS mensagens levam o link da área "Minhas reservas", para o cliente
  cancelar ou remarcar sozinho.
- Toda mensagem de WhatsApp usa template editável no painel.

## Privacidade
- Área pública mostra apenas "disponível" / "indisponível".
- Nunca expor nome, telefone, e-mail ou motivo de bloqueio em endpoint público.
- Cliente só vê reservas do telefone que ele verificou na sessão atual.
- Sessão do cliente por cookie httpOnly, validade 30 dias.

## Identidade visual
```
--brand-yellow:  #FFC700   /* cor de marca, botões primários, destaques */
--black:         #000000   /* preto principal */
--text-primary:  #222222   /* texto principal */
--text-secondary:#555555   /* texto secundário */
--border:        #E5E5E5   /* bordas e divisórias */
--bg-secondary:  #F7F7F7   /* fundo secundário, cards */
--bg-primary:    #FFFFFF   /* fundo principal */
```
- Amarelo em botão sempre com texto preto (contraste).
- Visual limpo, alto contraste, mobile-first. A maioria dos acessos vem de Instagram e WhatsApp.

## Como trabalhar comigo
- O dono do projeto NÃO programa. Explique decisões em português simples, sem jargão.
- Antes de implementar qualquer fase, apresente um plano curto e espere aprovação.
- Faça uma coisa por vez. Não antecipe funcionalidades de fases futuras.
- Toda regra de disponibilidade precisa ter teste automatizado.
- Nunca use `any` no TypeScript. Nunca deixe `console.log` no código final.
- Commits pequenos, em português, no formato `feat: ...`, `fix: ...`, `chore: ...`.
- Se uma regra de negócio estiver ambígua, PERGUNTE. Não invente.
## Publicação
- Produção: EasyPanel em VPS Hostinger (servidor fixo, ligado 24/7). node-cron é permitido.

## Decisões confirmadas (fonte da verdade — não reabrir sem pedir)

### Horários e disponibilidade
- Bloqueio administrativo é espaço ocupado puro: o intervalo de 30 min só existe entre DUAS reservas de cliente. Uma reserva pode começar no minuto exato em que um bloqueio termina, e vice-versa.
- Duração máxima da reserva: configurável por sala. Padrões no seed: Sala de Reunião 2h; Sala Container e Sala CI liberadas (até o fechamento do dia). Editável pela equipe no painel.
- Antecedência mínima para reservar: 1 hora (configurável). Antecedência máxima: 60 dias à frente (configurável).
- Feriados: tratados como bloqueio de dia inteiro criado pela equipe. Sem calendário automático no MVP.
- Ao mudar o horário de funcionamento, o sistema NÃO apaga reservas existentes: mostra na tela quais reservas ficaram fora do novo horário e deixa a equipe decidir uma a uma.
- Horário de funcionamento só aceita minutos :00 ou :30.
- Bloqueio criado em cima de reserva existente: mostrar as reservas afetadas e obrigar a equipe a cancelar ou remarcar cada uma antes de confirmar o bloqueio.

### Cancelamento, reagendamento e status
- A janela de 12h conta a partir do início da reserva, em America/Sao_Paulo.
- Ao reagendar, o novo horário também precisa estar a mais de 12h de distância — para o cliente. Para a equipe, não.
- REAGENDADA: a reserva continua sendo a MESMA (mesmo identificador), muda de horário e fica marcada como REAGENDADA, guardando histórico das alterações.
- CONCLUIDA: marcada automaticamente pela rotina agendada quando o horário de término passa e a reserva ainda estava confirmada.
- "3 reservas ativas por telefone" conta apenas CONFIRMADA e REAGENDADA com início no futuro. Canceladas e concluídas não contam.

### Verificação por WhatsApp
- Limites de envio de código: 1 por minuto por número, 5 por hora por número, 20 por hora por IP.
- Após 5 tentativas erradas: o código morre na hora e o número fica 15 min sem poder pedir outro.
- Telefone sempre guardado em formato internacional (+55 + DDD + celular de 9 dígitos), validado. Mesma pessoa nunca vira dois clientes por formatação diferente.
- Dados na reserva: apenas nome e telefone. NÃO coletar e-mail no MVP (deixar o campo fora do formulário e do schema). Se o texto de alguma fase mencionar e-mail, ignorar — esta decisão prevalece.
- Sessão do cliente: cookie de 30 dias vale para VER as próprias reservas e para RESERVAR. Para CANCELAR ou REAGENDAR, exigir um código novo do WhatsApp na hora (ação destrutiva).

### Preço e mensagens
- Preço é informativo no MVP ("valor estimado"), sem pagamento online. O valor fica congelado na reserva no momento da criação; aumento futuro de preço não altera reservas antigas.
- Lembrete cujo horário já passou no momento da criação não é enviado; fica registrado como "não aplicável".
- Ao reagendar, os campos de lembrete são zerados e os lembretes valem para o novo horário. A regra "uma vez só" passa a valer por horário agendado, não por reserva na vida toda.
- Sete templates de mensagem editáveis no painel: código de verificação, reserva confirmada, série confirmada, reserva cancelada, reserva reagendada, lembrete 13h, lembrete 3h. Variáveis permitidas: {{nome}}, {{sala}}, {{data}}, {{inicio}}, {{fim}}, {{valor}}, {{codigo}} e, só na série, {{dias}}, {{periodo}} e {{quantidade}}, e só nos lembretes, {{link}}. O texto de cancelamento não distingue se foi o cliente ou a equipe que cancelou.
- Criar uma série recorrente manda UMA mensagem só, resumindo a série (sala, dias da
  semana, horário, período e quantas datas) — não uma por ocorrência. Uma série de dois
  meses mandaria ~17 mensagens seguidas, que parece defeito para o cliente e arrisca o
  limite de rajada do WhatsApp. Os LEMBRETES (13h e 3h) continuam individuais, um por
  ocorrência.

### Bloqueios e recorrências (Fase 9)
- Bloquear várias salas de uma vez (feriado) cria um bloqueio por sala, todos no mesmo
  grupo. Na hora de remover, a equipe escolhe "só desta sala" ou "o feriado inteiro".
- Bloqueio sobre reserva ativa é recusado: o sistema mostra as reservas afetadas e
  exige que cada uma seja cancelada ou remarcada antes. É tudo ou nada — não existe
  bloquear metade do feriado.
- Recorrência é sempre por DIA DA SEMANA, nunca por dia do número do mês. Frequências:
  toda semana, a cada 2 semanas, ou uma vez por mês escolhendo "primeira/segunda/
  terceira/última [dia da semana]". Data de início e de fim são obrigatórias.
- Uma série pode ter VÁRIOS dias da semana ao mesmo tempo (ex.: terça e quarta).
- Ocorrência que esbarra em horário ocupado é pulada, nunca derruba a série. No fim
  sai um relatório do que entrou e do que ficou de fora, com o motivo.
- Cada ocorrência é uma reserva normal ligada à série. Dá para cancelar uma só ou a
  série inteira — o sistema pergunta qual.
- O que a recepção NUNCA contorna, nem avulso nem em série: sobreposição de horário e
  o intervalo de 30 min entre reservas. Isso é integridade da agenda, garantida pelo
  próprio PostgreSQL.

### Rotinas automáticas (Fase 10)
- Lembretes de 13h e 3h, com janela de tolerância de 15 minutos para cada lado. A
  rotina roda de 5 em 5 minutos; a faxina diária, às 4h de São Paulo.
- Idempotência é MARCAR PRIMEIRO, MANDAR DEPOIS: a marcação é um UPDATE condicional
  que só o primeiro consegue aplicar. Se o envio falhar depois disso, o lembrete não
  sai — na dúvida é melhor faltar do que mandar duas vezes.
- Três estados por lembrete: enviado (data preenchida), não aplicável (o horário já
  tinha passado quando a reserva foi criada) e pendente.
- A faxina apaga códigos de verificação e tentativas de login com mais de 24h, e
  sessões de cliente vencidas. NÃO apaga LogMensagem — está em aberto se o texto das
  mensagens será guardado para auditoria.
- node-cron roda no mesmo processo do site, ligado pelo `instrumentation.ts`. Fica
  desligado por padrão; só liga com CRON_ATIVO="true".

### Painel
- Um único nível de acesso (admin). Vários usuários possíveis. O primeiro é criado por um comando de instalação. Sem recuperação de senha por e-mail no MVP: a troca é feita por outro admin.

## Roteiro de construção — 13 fases
Construir uma fase por vez. Não antecipar funcionalidade de fase futura. Cada fase termina com teste e commit.

- Fase 0 — Alinhamento (resumo, dúvidas, riscos). Sem código.
- Fase 1 — Esqueleto: Next.js 15, TypeScript, Tailwind, shadcn/ui, cores da marca, docker-compose com Postgres, Prisma, Vitest, git, página inicial.
- Fase 2 — Banco de dados: schema Prisma (Sala, HorarioFuncionamento, Reserva, CodigoVerificacao, SessaoCliente, TemplateMensagem, LogMensagem, Bloqueio, Recorrencia, Usuario, Configuracao); exclusion constraints em SQL (sobreposição + intervalo de 30 min); seed.
- Fase 3 — Motor de disponibilidade (módulo puro, sem UI) com testes exaustivos. Fase mais crítica.
- Fase 4 — API pública + cliente Evolution + verificação por código.
- Fase 5 — Interface pública de reserva (mobile-first, verificação embutida na etapa 5).
- Fase 6 — Área "Minhas reservas" (cancelar/reagendar com código novo).
- Fase 7 — Login do painel admin (sessão própria assinada, sem NextAuth).
- Fase 8 — Agenda administrativa (dia/semana/mês, criar/editar/cancelar).
- Fase 9 — Bloqueios administrativos e reservas recorrentes.
- Fase 10 — Rotinas internas com node-cron: lembretes 13h e 3h, marcar concluídas, limpeza. Idempotência obrigatória.
- Fase 11 — Configurações no painel (preços, salas, horários, parâmetros, políticas, templates).
- Fase 12 — Revisão, polimento, responsividade, Open Graph, build de produção.
- Fase 13 — Deploy no EasyPanel: Dockerfile standalone, migração, healthcheck, backup, docs/deploy.md.