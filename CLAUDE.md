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
- Mensagem de avaliação: enviada 1 hora DEPOIS do término da reserva, com o link do
  Google Meu Negócio. Mesma mecânica dos lembretes (uma vez só, marcar antes de
  mandar). Sem o link cadastrado no painel, ela simplesmente não é enviada.
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
- Oito templates de mensagem editáveis no painel: código de verificação, reserva confirmada, série confirmada, reserva cancelada, reserva reagendada, lembrete 13h, lembrete 3h e convite para avaliar. Variáveis permitidas: {{nome}}, {{sala}}, {{data}}, {{inicio}}, {{fim}}, {{valor}}, {{codigo}} e, só na série, {{dias}}, {{periodo}} e {{quantidade}}, e só nos lembretes e no convite para avaliar, {{link}} — que nos lembretes é a área "Minhas reservas" e no convite é o Google. O texto de cancelamento não distingue se foi o cliente ou a equipe que cancelou.
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

### Decisões da Fase 11 (configurações no painel)
- Salas podem ser CRIADAS no painel, nunca EXCLUÍDAS. Editar (nome, capacidade,
  preço, duração máxima, ordem) e ligar/desligar valem para todas. Excluir uma sala
  deixaria as reservas antigas sem sentido. Desligar tira a sala do site sem tocar
  nas reservas já marcadas, e a última sala ativa não pode ser desligada.
  O endereço da sala no site (slug) nasce do nome na criação e NUNCA muda depois:
  é ele que está nos QR codes impressos.
- O intervalo de 30 min entre reservas NÃO é editável no painel: aparece só para
  leitura. É integridade da agenda, garantida por uma trava do próprio Postgres, e
  o banco lê esse número no momento de gravar cada reserva — mudá-lo deixaria as
  reservas antigas com a folga velha e as novas com a folga nova. Trocar exige
  alteração no sistema, recalculando as reservas futuras junto.
- Os limites de envio do código de WhatsApp (1/min e 5/h por número, 20/h por IP,
  5 tentativas, bloqueio de 15 min, validade de 10 min) ficam no código e aparecem
  no painel apenas para leitura. São freios contra abuso, não preferência
  comercial: afrouxá-los por engano abriria a porta para alguém torrar a conta de
  WhatsApp do coworking. Ficam visíveis para a equipe entender o que aconteceu
  quando um cliente diz que o código não chega.
- Usuários do painel: listar, criar, trocar a própria senha (exigindo a senha
  atual), redefinir a senha de OUTRO admin (sem a senha antiga — é o caso de quem
  esqueceu a dela) e ligar/desligar acesso. Desligar em vez de excluir, porque
  bloqueios e feriados guardam quem os criou. Quem é desligado perde o acesso na
  hora, mesmo com o cookie ainda no prazo. Ninguém desliga o próprio acesso.

### Categoria de profissão e relatórios
- Toda reserva guarda a **categoria de profissão** do cliente: Marketing, Jurídico,
  Contábil, Área da Saúde ou Outros. O campo se chama `profissao` no banco — `categoria`
  já é de "hora ou diária" e as duas coisas não podem se misturar.
- É **obrigatório** nas três portas que criam reserva: site, recepção e série recorrente.
  A série pergunta uma vez e todas as ocorrências nascem com a resposta.
- A coluna aceita nulo **de propósito**: quem cobra a obrigatoriedade é a aplicação. As
  reservas anteriores ao campo nunca foram perguntadas, e preencher um valor agora seria
  inventar informação que o cliente não deu. No relatório elas aparecem como
  "Não informado".
- A profissão **não entra** em preço, disponibilidade nem em nenhuma regra da agenda.
  Serve só ao relatório. No reagendamento ela viaja com a reserva, sem perguntar de novo.
- **Dashboard de relatórios** em `/admin/relatorios`: total do período com variação,
  evolução no tempo, dias da semana (barras horizontais), salas, horários, situação das
  reservas e área de atuação.
- O dashboard é **só leitura**: não existe rota de escrita nele, e nada ali altera reserva,
  sala ou configuração.
- **Sem faturamento, receita ou valor em lugar nenhum** — decisão do dono. A garantia não é
  esconder na tela: a consulta traz uma lista fechada de campos e `valor` não está nela.
  Há teste procurando o valor dentro da resposta.
- Uma reserva entra no período quando **o horário dela** cai ali, em qualquer situação
  (confirmada, cancelada, concluída ou remarcada). O gráfico por situação mostra a divisão.
- O período de comparação tem sempre o **mesmo número de dias** do atual, colado antes.
  Sem isso, fevereiro "cairia" só por ter menos dias que janeiro.
- Todo agrupamento (dia, dia da semana, hora) é feito no **relógio de São Paulo**, e não no
  banco. Agrupando em UTC, uma reserva de segunda às 21h apareceria como terça no
  relatório e discordaria da agenda.
- Os gráficos são feitos em **SVG e CSS, sem biblioteca**: a stack do CLAUDE.md não tem
  nenhuma, e as formas são simples o bastante. Todo gráfico escreve o número por extenso
  ao lado — nenhuma informação depende só do desenho.

### Mensagem de avaliação (1 hora após o término)
- Oitavo template, `avaliacao_pos_uso`: agradecimento pelo uso + convite para avaliar
  no Google. Variáveis: {{nome}}, {{sala}}, {{data}} e {{link}}.
- Nesta mensagem o {{link}} é o do **Google Meu Negócio**, e não o da área "Minhas
  reservas" como nos lembretes. Cada mensagem tem a sua lista de variáveis, então o
  mesmo nome pode valer coisas diferentes sem confundir o sistema.
- O link mora em **Configurações → Mensagens**, num campo próprio — não escrito dentro
  do texto. Assim a equipe cola uma vez e não precisa repetir se reescrever a mensagem.
- **Sem o link cadastrado, a rotina não envia e não marca nada.** Pedir avaliação sem
  dizer onde avaliar só gasta a paciência do cliente. No dia em que o link for
  preenchido, as reservas antigas já estarão fora da janela e viram "não aplicável" —
  ninguém leva uma enxurrada de convites atrasados.
- Roda no mesmo agendador dos lembretes, de 5 em 5 minutos, com a mesma janela de
  tolerância de 15 minutos e a mesma idempotência: **marcar primeiro, mandar depois**.
- Vale para **qualquer status menos CANCELADA** — e isso inclui CONCLUIDA, de propósito.
  Uma hora depois do término a reserva **já é** CONCLUIDA, porque a rotina de marcar
  concluídas roda na mesma passada. Filtrar por CONFIRMADA/REAGENDADA aqui faria a
  consulta nunca achar nada, e ninguém receberia a mensagem — sem erro nenhum aparecer.
- Ao reagendar, o campo é zerado junto com os lembretes: a avaliação passa a valer para
  o novo término.

### Fotos das salas (carrossel)
- Cada sala aceita até **5 fotos**, enviadas em Configurações → Salas e mostradas ao
  cliente num carrossel, no cartão da sala, antes de reservar.
- Os arquivos ficam no **Cloudinary**; o banco guarda só a referência (`public_id`,
  endereço e ordem). O `public_id` é o que permite apagar o arquivo de lá depois.
- **O upload passa pelo servidor.** O API Secret nunca vai ao navegador: a tela manda o
  arquivo para a nossa rota, e a rota assina o pedido. Quem tem esse segredo apaga tudo.
- Credenciais em variáveis de ambiente (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`). **Vazias é um estado normal, não um erro:** o painel avisa
  que o envio está indisponível, as fotos que já existem continuam aparecendo, e todo o
  resto do sistema funciona.
- Sem biblioteca do Cloudinary nem de carrossel: a API deles é um POST assinado, feito
  com `fetch` e a criptografia do próprio Node; o carrossel é rolagem com encaixe
  (`scroll-snap`), que o celular e o tablet já fazem nativamente.
- O redimensionamento é pedido ao próprio Cloudinary pelo endereço
  (`f_auto,q_auto,w_800`) — o celular baixa uma imagem de celular.
- Validação no **servidor**: só JPG, PNG ou WEBP, até 5 MB por arquivo, no máximo 5 por
  sala. A tela também confere, mas só para avisar cedo.
- Remover a foto no painel **apaga também no Cloudinary**. Se o Cloudinary recusar, a
  foto sai do site mesmo assim e a tela avisa que o arquivo pode ter ficado lá: uma
  instabilidade não pode deixar no ar uma foto que a equipe quer fora.
- **Sala sem foto não mostra carrossel nem espaço vazio** — o cartão fica como sempre foi.
- A reordenação no painel é por botões de mover, e não arrastando: arrastar é ruim no
  tablet, que é onde a recepção mexe, e não funciona pelo teclado.

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