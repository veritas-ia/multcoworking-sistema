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
- SEM intervalo obrigatório entre reservas da MESMA sala (era 30 min até set/2026).
  Uma reserva pode começar no minuto exato em que a outra termina. O único horário
  que some antes de uma reserva é a meia hora imediatamente anterior — e some por
  SOBREPOSIÇÃO, não por folga: com 1h de duração mínima, começar ali obrigaria a
  invadir a reserva seguinte.
- Proibido sobrepor: isso continua garantido pelo próprio PostgreSQL.
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
- Limite de reservas futuras por telefone: **desligado desde 16/10/2026** (era 3).
  O número virou parâmetro editável no painel; ver "Limite de reservas por telefone".
  Limite de envio de códigos por número e por IP continua valendo.
- Mensagem de avaliação: enviada 1 hora DEPOIS do término da reserva, com o link do
  Google Meu Negócio. **UMA VEZ POR CLIENTE, na vida toda** (mudado em 23/10/2026 —
  era uma vez por reserva). Sem o link cadastrado no painel, ela simplesmente não é
  enviada.
- **JANELA DE SILÊNCIO: nenhuma mensagem automática entre 21h e 8h** (editável no
  painel, desde 26/10/2026). Ver "Janela de silêncio".
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
- Bloqueio administrativo é espaço ocupado puro. Uma reserva pode começar no minuto exato em que um bloqueio termina, e vice-versa — hoje isso vale entre quaisquer dois compromissos, já que o intervalo entre reservas é zero.
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
- O limite de reservas por telefone (quando ligado) conta apenas CONFIRMADA e REAGENDADA com início no futuro. Canceladas e concluídas não contam. Hoje está em zero — ver "Limite de reservas por telefone".

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
- Dez templates de mensagem editáveis no painel: código de verificação, reserva confirmada, série confirmada, reserva cancelada, reserva reagendada, lembrete 13h, lembrete 3h e convite para avaliar. Variáveis permitidas: {{nome}}, {{sala}}, {{data}}, {{inicio}}, {{fim}}, {{valor}}, {{codigo}} e, só na série, {{dias}}, {{periodo}} e {{quantidade}}, e só nos lembretes e no convite para avaliar, {{link}} — que nos lembretes é a área "Minhas reservas" e no convite é o Google. O texto de cancelamento não distingue se foi o cliente ou a equipe que cancelou.
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
- O que a recepção NUNCA contorna, nem avulso nem em série: sobreposição de horário.
  Isso é integridade da agenda, garantida pelo próprio PostgreSQL.

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
- O intervalo entre reservas (hoje ZERO) NÃO é editável no painel: aparece só para
  leitura. O banco lê esse número no momento de gravar cada reserva e o congela na
  linha — mudá-lo deixaria as reservas antigas com a folga velha e as novas com a
  folga nova. Trocar exige migração, recalculando as reservas já marcadas junto.
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

### Intervalo entre reservas: ZERO (mudado em 28/09/2026)
- **Decisão do dono: acabou a folga obrigatória de 30 min entre duas reservas da
  mesma sala.** O parâmetro `intervaloMinutos` passou de 30 para 0. Motivo: a folga
  queimava meia hora vendável antes e depois de cada reserva, e a equipe prefere
  encaixar clientes colados a proteger o tempo de arrumação.
- O que continua PROIBIDO é a sobreposição de verdade, garantida pela exclusion
  constraint `ocupacao_sem_sobreposicao` — dois clientes no mesmo horário na mesma
  sala segue impossível, e a trava é do banco, não da aplicação.
- Com uma reserva das 10:00 às 11:00: o 09:00 fica LIVRE (encosta, não invade), o
  09:30 fica BLOQUEADO (com 1h de mínimo, iria até 10:30 e invadiria) e o 11:00 fica
  LIVRE. A duração mínima continua 60 minutos — não foi tocada.
- A trava `ocupacao_intervalo_entre_reservas` **continua existindo** de propósito. Com
  folga zero ela vira uma cópia da trava de sobreposição restrita a reservas: não
  atrapalha e não custa nada. Se um dia a folga voltar, basta mudar o número em
  `configuracoes` — sem mudança de estrutura.
- A migração `20260928100000_intervalo_entre_reservas_zero` **recalcula as reservas
  já existentes**. Sem isso a mudança valeria só para reserva nova: o período
  esticado é calculado pelo gatilho na hora de gravar e fica congelado na linha, então
  as reservas antigas continuariam carregando a folga de 30 min.

### Preço da Sala de Reunião (regra definitiva — 07/10/2026)
- O preço tem **duas dimensões ao mesmo tempo**: a faixa de horário e o tamanho do
  grupo. As duas valem nas duas faixas.

  | Por hora | 1 a 4 pessoas | 5 a 10 pessoas |
  |---|---|---|
  | até as 18h | R$ 40 | R$ 75 |
  | após as 18h | R$ 75 | R$ 95 |

- **Diária** (8h às 18h, valor fechado): 1 a 5 pessoas R$ 350; 6 a 10 pessoas R$ 450.
- **O CORTE DE PESSOAS É DIFERENTE ENTRE OS DOIS MODOS, de propósito.** Por hora o
  pulo é entre 4 e 5 (`pessoasParaGrupo` = 4); na diária é entre 5 e 6
  (`pessoasParaGrupoDiaria` = 5). São duas colunas separadas e **não podem ser
  unificadas**: com um corte só, a diária de 5 pessoas sairia por R$ 450. Há teste
  cobrindo exatamente essa fronteira.
- Reserva que **cruza as 18h**: cada faixa é cobrada pelo preço dela, já com o tamanho
  do grupo aplicado **dentro** da faixa, e os pedaços são somados. Exemplo confirmado
  pelo dono: 5 pessoas das 17h às 20h = 1h × R$ 75 + 2h × R$ 95 = **R$ 265**.
- Até set/2026 o tamanho do grupo só era consultado **à noite**, e de dia o preço não
  variava. Era um defeito, corrigido na migração
  `20261007100000_preco_de_grupo_tambem_de_dia`.
- **Capacidade: 10 pessoas.** O servidor recusa 11 nas três portas que criam reserva, e
  **a recepção também não contorna** — não é regra comercial, é o tamanho físico da
  sala. O número vem da coluna `capacidade`, que já é editável no painel e é a mesma
  que o site mostra ("até 10 pessoas"): o que a equipe anuncia e o que o sistema barra
  nunca discordam. Sala com capacidade em branco não tem teto.
- **Sala Privativa e Sala Container não mudaram**: continuam sem preço de grupo, sem
  diária e sem teto de pessoas. A faixa noturna de R$ 75 delas segue intacta.
- Os seis preços e os dois cortes são **editáveis em Configurações → Salas**. O preço
  de dia para grupo aparece para toda sala (em branco = o tamanho não muda o preço de
  dia, mesmo padrão do preço de noite para grupo); os dois campos da diária de grupo
  só aparecem quando a sala aceita diária.
- **Validações de coerência ao salvar**, no servidor e também na tela: preço de grupo
  não pode ser menor que o preço base da mesma faixa, nenhum preço negativo, **os dois
  cortes de pessoas precisam ser inteiros de 1 a 10** (são pessoas numa sala, não num
  auditório: um corte acima disso nunca seria alcançado e viraria preço de grupo que
  não pega nunca), e preço de grupo sem o corte correspondente (ou vice-versa) é
  recusado — seria meia regra, que a tela não saberia aplicar.
- **Editar preço NÃO retroage.** O fluxo de salvar sala faz apenas `prisma.sala.update`
  e não encosta na tabela de reservas. O valor fica congelado na reserva no momento da
  criação, então mudar o preço na tela vale só para reserva nova. Há teste que dobra um
  preço e confere que a reserva já gravada continua com o valor antigo **e que a linha
  inteira dela ficou intacta** — se um dia alguém acrescentar um "recalcular reservas"
  ao salvar, é ali que estoura.

### Categoria de profissão e relatórios
- Toda reserva guarda a **área de atuação** do cliente. As cinco iniciais são
  Marketing, Jurídico, Contábil, Área da Saúde e Outros, mas **a lista é editável no
  painel desde 27/10/2026** — ver "Áreas de atuação editáveis no painel". A reserva
  aponta para a área pelo campo `profissao_id`; `categoria` já é de "hora ou diária" e
  as duas coisas não podem se misturar.
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
- **Sem faturamento, receita ou valor no relatório GERAL e na BUSCA de clientes** —
  decisão do dono. A garantia não é esconder na tela: a consulta traz uma lista fechada
  de campos e `valor` não está nela. Há teste procurando o valor dentro da resposta.
  *(Até 07/10/2026 isto valia para o dashboard inteiro; ver a exceção autorizada em
  "Faturamento no relatório individual".)*
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

### Métricas por cliente no dashboard (28/09/2026)
- **Horas por cliente**: ranking de quanto tempo cada cliente usou no período, do
  maior para o menor. Conta **CONFIRMADA, REAGENDADA e CONCLUIDA**; **cancelada não
  conta** — hora desmarcada não é hora usada, e somá-la faria o ranking premiar quem
  mais desmarca.
- O agrupamento é pelo **telefone**, nunca pelo nome: o telefone é o identificador
  único e validado, enquanto a mesma pessoa escreve o nome diferente a cada reserva
  ("Maria", "Maria Silva", "maria"). Na tela aparece o nome da **primeira**
  reserva do número no período (mudado em 29/10/2026 — era o da mais recente;
  ver "O telefone compartilhado e as 28 horas do Rafael").
- **Busca de cliente**: o telefone manda (normalizado, aceita qualquer formatação) e
  devolve um cliente só; o nome é busca auxiliar, sem diferenciar maiúscula nem
  acento, e devolve a lista para a equipe escolher. Procura apenas entre quem tem
  reserva **no período** — o campo filtra o relatório, não vasculha a base inteira.
- **O NOME SÓ SERVE PARA ACHAR O TELEFONE.** Daí em diante vale o telefone, e a soma é
  sobre **todas** as reservas dele. Ver "A busca somava só as reservas com o nome
  procurado".
- Quem só tem reserva **cancelada** no período ainda aparece na busca, com zero horas:
  sem isso a equipe não conseguiria achar essa pessoa.
- Com um cliente aberto, o relatório **geral some da tela**. Os dois juntos são dois
  conjuntos de números parecidos — um do coworking inteiro e outro de uma pessoa — e a
  equipe leria um achando que é o outro.
- **Uma reserva conta no dia em que COMEÇA, sem fatiar.** Uma reserva das 21h às 22h de
  segunda é, em UTC, meia-noite de terça: somar no fuso do banco jogaria as horas para
  o dia (e o mês) seguinte, e o relatório discordaria da agenda. Dividir horas entre
  dois dias criaria um número que não bate com nada. Há teste na virada do dia e na
  virada do mês.
- **O telefone aparece inteiro** nesta tela (`telefoneVisivel`), diferente do resto do
  sistema, que mascara. É a equipe olhando os próprios clientes, atrás de login — e sem
  o telefone ela não distingue dois clientes de mesmo nome.
- A **profissão fica na reserva**, não no cliente: quem marcou "Marketing" uma vez e
  "Outros" noutra não tem resposta única. Mostramos a **mais usada** e avisamos que há
  divergência, em vez de escolher em silêncio.
- Continua valendo **só leitura**. Sobre dinheiro, ver a seção seguinte: o relatório
  individual passou a mostrar faturamento em 07/10/2026; o geral e a busca continuam
  sem valor nenhum.

### Limite de reservas por telefone (desligado em 16/10/2026)
- **Decisão do dono: o teto de 3 reservas saiu do caminho do cliente.** O número virou
  o parâmetro `maximoReservasAtivas`, **editável em Configurações → Parâmetros**, e
  nasce em **zero**.
- **ZERO significa SEM LIMITE**, mesma convenção de `intervaloMinutos`. A regra não foi
  apagada do sistema: ficou desligada, e a equipe religa sozinha pelo painel se a
  agenda apertar — sem alteração no código nem migração nova.
- **Nunca foi um teto por MÊS**, e era isso que confundia. Conta reservas com **início
  no futuro**, em qualquer data: três reservas em três meses diferentes já batiam no
  limite, enquanto dez reservas já usadas no mesmo mês não contavam nada. Cancelar uma
  libera a vaga na hora.
- Motivo de desligar: o cliente que marcava com antecedência batia no teto rápido e a
  saída era ligar para a recepção, **que nunca teve limite**. Na prática virou atrito
  para o cliente bom e trabalho a mais para a equipe, enquanto quem quisesse abusar
  precisava só de um telefonema.
- **A antecedência máxima de 60 dias continua limitando** o quanto alguém segura a
  agenda à frente, e as travas de sobreposição seguem intactas. O freio que importa
  não é este.
- A mensagem de recusa usa **o número que está valendo**, lido da configuração, e não
  um "3" escrito no código. Há teste com o limite em 1 conferindo isso.
- A recepção continua **sem limite nenhum**, ligado ou desligado. Há teste que liga o
  limite de propósito e prova que a recepção passa por cima.

### Faturamento no relatório individual (liberado em 07/10/2026)
- **MUDANÇA AUTORIZADA PELO DONO, reabrindo de propósito a decisão anterior.** Até
  07/10/2026 valia "sem faturamento em lugar nenhum" no dashboard. O dono mudou de
  ideia e liberou o faturamento **somente no relatório de um cliente específico**.
  Isto está registrado como mudança de regra, e não como exceção aberta por engano.
- **O relatório GERAL do coworking e a BUSCA de clientes continuam sem dinheiro
  nenhum.** A fronteira é essa, e é o que os testes vigiam.
- O número é a **soma do valor JÁ GRAVADO** em cada reserva não cancelada do cliente
  no período. **Nunca um recálculo.** O preço fica congelado na reserva no momento da
  criação; recalcular no relatório criaria uma segunda fonte de verdade — a tela
  mostraria um número e a reserva guardaria outro assim que um preço mudasse no painel.
  Há teste que muda o preço da sala e confere que o faturamento **não se mexe**.
- **Cancelada não entra**, igual às horas. REAGENDADA e CONCLUIDA entram.
- Guardado e somado **em centavos**: somar reais em ponto flutuante acumula diferença
  de um centavo ao longo de muitas reservas. Há teste com três reservas de R$ 33,33
  que precisam dar R$ 99,99.
- **Só o total sai na resposta**, nunca o preço de cada reserva. O dono liberou a
  métrica, e não o preço reserva a reserva — a lista de reservas do cliente continua
  sem valor.
- A consulta que traz dinheiro é **separada** (`reservasDoClienteNoPeriodo`), e não a
  lista fechada compartilhada. Deixar o `valor` entrar na consulta geral faria o dado
  circular também no relatório do coworking e na busca, e bastaria alguém mudar uma
  linha de montagem para ele vazar sem ninguém reparar.
- Na tela, uma legenda curta avisa que é **o valor das reservas, não pagamento
  confirmado** — o sistema não processa pagamento.
- Não houve necessidade de estimar nada: a coluna `valor` é **obrigatória no banco**,
  e as 55 reservas de produção têm valor gravado. Não existe reserva sem valor.
- **Os quatro testes que proibiam dinheiro não foram apagados** — viraram a vigia da
  fronteira nova: geral sem dinheiro, busca sem dinheiro, individual com o total e
  sem o preço linha a linha.

### Ajuste de término: o cliente ficou mais tempo (23/10/2026)
- **Cenário real:** a pessoa marcou das 10h às 11h e saiu 11h30, porque não havia
  reserva depois. Pagou o tempo a mais no balcão, mas a agenda e o relatório seguiam
  dizendo 11h. A equipe não tinha como registrar.
- **É uma ação PRÓPRIA (`esticarTerminoComoAdmin`), e não o "Remarcar".** O remarcar
  não serve por três motivos: (1) **recusa reserva encerrada**, e a reserva de quem
  ficou mais tempo já está CONCLUIDA; (2) marcaria **REAGENDADA**, o que seria mentira
  — ninguém remarcou nada; (3) **zera lembrete e avaliação** e manda o WhatsApp de
  remarcação. Aqui o status fica como está e nada disso é tocado.
- **SÓ ESTICA** (decisão do dono). Encurtar reduziria faturamento já registrado com um
  clique. Para reduzir, usa-se o "Remarcar".
- **O VALOR: o congelado é MANTIDO e o tempo extra é somado pelo preço de hoje.** Assim
  a quebra fica honesta — "R$ 40,00 + R$ 20,00 de 30 min = R$ 60,00". Recalculando tudo
  não daria para dizer quanto custou o extra se o preço da sala tivesse mudado. O
  histórico guarda `extra: { minutos, valor }`, porque sem isso ninguém explicaria a
  diferença numa reserva de três meses atrás.
- **A ARMADILHA que exigiu conferência própria:** a trava de sobreposição do banco só
  enxerga reserva ATIVA — o gatilho tira a linha de `ocupacao_salas` assim que a
  reserva vira CONCLUIDA. Como a reserva ajustada quase sempre já terminou, e a
  seguinte também pode ter terminado, **nem o banco nem o motor barrariam** o término
  novo de engolir a reserva de outro cliente. Por isso a checagem é feita na mão,
  olhando todas as reservas da sala menos as canceladas, mais os bloqueios. Há teste
  com as duas reservas CONCLUIDAS.
- **Diária não aceita ajuste:** tem preço fechado do dia inteiro, e cobrar hora extra
  em cima seria inventar regra que ninguém combinou. A recusa explica isso.
- O tempo extra precisa ser **múltiplo de 30 min**, como o resto da agenda.
- **O cliente é avisado** (decisão do dono): décimo modelo, `reserva_estendida`, com o
  horário novo, quanto tempo foi acrescentado (`{{extra}}`) e o valor já atualizado.
- Na tela, a recepção escolhe **quanto tempo a mais** (30 min, 1h, 90 min, 2h), e não o
  horário final: a equipe pensa em "ficou meia hora a mais", e pedir o horário obrigaria
  a fazer a conta de cabeça com o cliente na frente. O botão "Ficou mais tempo" aparece
  tanto na reserva ativa quanto na **concluída** — onde antes não havia ação nenhuma.
- **O relatório se ajusta sozinho:** ele lê `fim` e `valor` da reserva, e os dois mudam.

### Janela de silêncio: nada de mensagem de madrugada (26/10/2026)
- **O problema, medido em produção antes de escrever a correção:**

  | Lembrete | Enviados | Fora de hora |
  |---|---|---|
  | 13h antes | 53 | **38 (72%)** |
  | 3h antes | 48 | **17 (35%)** |

  As horas: **10 mensagens às 4h da manhã**, 9 às 5h, 5 à 1h, 5 às 2h, 5 às 3h.
- **A conta explica sozinha:** o lembrete de 13h de uma reserva das 15h cai às **2h da
  manhã**. Qualquer reserva de tarde caía de madrugada. O de 3h de uma reserva das 8h
  cai às 5h.
- **Dois parâmetros editáveis** em Configurações → Parâmetros: `mensagensHoraInicial`
  (8) e `mensagensHoraFinal` (21). Salvar com o final menor ou igual ao inicial é
  recusado — sem nenhuma hora permitida, ninguém receberia lembrete e não apareceria
  erro em lugar nenhum.
- **LEMBRETE ANTECIPA, AVALIAÇÃO ADIA.** São direções opostas, de propósito:
  - o lembrete cujo horário cai na janela recua para as **20:59 da véspera**. Adiar o
    lembrete de 3h de uma reserva das 8h para as 8h entregaria o aviso no instante em
    que a reserva começa — aviso que chega depois não é aviso;
  - o convite de avaliação **espera a janela abrir** (8h do dia seguinte). Não dá para
    convidar alguém a avaliar a sala antes de ter usado.
- **Não vale para a confirmação da reserva nem para o código do WhatsApp:** a pessoa
  acabou de mexer no site e está esperando a resposta. Travar essas seria pior.
- A busca das rotinas passou a olhar **mais longe** (24h além da janela do lembrete),
  porque um lembrete antecipado sai quando a reserva ainda está a quase um dia de
  distância. O volume é pequeno e os índices já existiam.
- A tolerância de 15 min continua valendo, agora em volta do **horário ajustado**. Fora
  dela, a reserva é marcada "não aplicável" — reserva lançada tarde demais, ou sistema
  fora do ar na hora certa.

### Nome travado ao telefone (23/10/2026)
- **O problema, medido no banco:** 25 telefones geraram **44 nomes diferentes**. Treze
  pessoas usaram mais de um nome. O pior caso é uma cliente que apareceu como
  "Prestare", "Prestare Karen", "Prestare - Karen" e "Prestare - Cliente Dani".
- **Os números do relatório NUNCA estiveram errados:** ele sempre agrupou pelo
  **telefone** e mostra um nome daquele número. O que a bagunça suja é a **busca** e a
  leitura da equipe — e a sensação de que o sistema perdeu o cliente.
- **No site:** quando o telefone já reservou antes, o campo do nome vem **preenchido e
  travado**, com "Trocar o nome" do lado. Não é para impedir a pessoa de se corrigir —
  é para ela não reescrever o nome por reflexo a cada reserva.
- **Na recepção:** digitar um telefone conhecido **preenche o nome sozinho**, mas aqui
  fica só como sugestão editável: metade das reservas da Prestare saiu do balcão, e às
  vezes quem liga é outra pessoa da mesma empresa. O campo nunca apaga o que a equipe
  já digitou.
- O nome conhecido **não precisa de cadastro**: é o `nomeCliente` da reserva mais
  recente daquele telefone, que é o mesmo que o relatório já usava.
- A sessão pública (`/api/publico/sessao`) passou a devolver `nomeConhecido`. Não é
  dado novo exposto: é o próprio nome de quem está com o cookie na mão, e a resposta
  sai do cookie, nunca de um parâmetro. O telefone continua mascarado.
- **Isto não conserta o passado.** Os 44 nomes continuam lá. Com o cadastro de empresas
  (próximo passo), a limpeza provavelmente deixa de ser necessária.

### Confirmação agrupada (16/10/2026)
- **Problema real:** o site reserva UMA de cada vez, então quem quer três passa pelo
  fluxo três vezes. A cliente recebia três mensagens, cada uma com um valor, e **nunca
  via o total**. Conferido nos registros: nenhuma mensagem tinha se perdido — as três
  saíram, e era esse justamente o incômodo.
- **A confirmação deixou de sair na hora.** A reserva nasce com `confirmacaoEnviadaEm`
  nulo, e a rotina `confirmacoesAgrupadas` manda depois, agrupando por telefone.
- **Janela de 3 minutos, DESLIZANTE:** conta a partir da ÚLTIMA reserva daquele
  telefone. Quem marca às 10:00, 10:02 e 10:04 recebe uma mensagem às 10:07 com as
  três. É o deslizamento que mantém a leva inteira.
- A rotina roda **de minuto em minuto**, e não no tick de 5. Pendurada nos 5, a espera
  viraria de 3 a 8 minutos em vez de 3. A consulta é leve e tem índice próprio.
- **Uma reserva usa o texto de sempre** (`reserva_confirmada`); **duas ou mais** usam o
  nono modelo, `reservas_confirmadas`, com `{{quantidade}}`, `{{lista}}` (uma linha por
  reserva) e `{{valor}}` **somado**. A soma é em centavos — somar reais em ponto
  flutuante acumula diferença.
- **O cliente não fica sem resposta:** a TELA confirma na hora, com sala, dia, horário e
  valor. O WhatsApp é o comprovante que fica guardado.
- **SÓ O SITE.** A recepção continua confirmando na hora, uma por reserva: ali o cliente
  costuma estar no balcão e a equipe confirma na frente dele.
- **O QUE NÃO MUDOU, e precisa continuar assim** (ponto que o dono fez questão):
  - **lembretes de 13h e 3h seguem individuais**, um por reserva, no dia de cada uma.
    Três reservas em dias diferentes = três lembretes, cada um no seu dia. Há teste.
  - **cancelamento segue individual**: cancelar a reserva do dia 20 não cancela as
    outras e a mensagem não pode dizer que cancelou tudo. O cliente leria isso como
    defeito do sistema.
- Idempotência igual à dos lembretes: **marcar primeiro, mandar depois**, com UPDATE
  condicional que só o primeiro consegue aplicar.
- A migração **preenche `confirmacao_enviada_em` em todas as reservas que já existem**.
  Sem isso, na primeira passada a rotina mandaria confirmação das 90 reservas antigas.
- O texto do modelo entra **pela migração**, e não pelo seed: o deploy roda
  `migrate deploy` e **não** roda o seed. Um modelo só no seed nunca chegaria em
  produção, e a rotina ficaria sem texto para enviar.

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
- **UMA VEZ POR CLIENTE, e não por reserva (23/10/2026).** Até aqui saía a cada
  reserva, e quem usa o coworking toda semana juntou **14 convites** para avaliar no
  Google — conferido no banco. Convite demais vira incômodo e o cliente para de ler as
  mensagens do coworking. O freio é o LOG de envio por telefone, não um campo da
  reserva: a segunda reserva é marcada como "não aplicável" e nunca manda.
- **Só conta envio que DEU CERTO.** Se a mensagem falhou, a pessoa nunca a recebeu, e
  queimar a próxima chance dela por causa de uma falha nossa seria perder o convite
  sem ninguém perceber.
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

### Áreas de atuação editáveis no painel (27/10/2026)
- **A lista deixou de ser um tipo fixo do banco e virou TABELA** (`profissoes`), por
  pedido do dono: a equipe acrescenta e tira áreas em **Configurações → Áreas de
  atuação**, sem programador. Um enum do PostgreSQL não serve para isso — ele aceita
  acrescentar valor, mas nunca remover, e nem isso pode ser feito na mesma transação
  que o usa.
- A migração `20261027300000_profissoes_editaveis` **cria as cinco de hoje e religa
  cada reserva existente** pelo nome interno. Ela confere no fim que nenhuma reserva
  que tinha profissão ficou sem; se sobrar alguma, a migração inteira é desfeita. As
  cinco entram **pela migração, não pelo seed** — o deploy roda `migrate deploy` e não
  roda o seed, e uma lista só no seed deixaria o formulário de reserva sem opção
  nenhuma em produção.
- **O nome interno (`slug`) nunca muda.** Renomear mexe só em `nome`. É o slug que
  amarra a área ao que já está gravado; mudando, um relatório antigo deixaria de bater
  com a lista.
- **Três ações, três significados diferentes:**
  - **renomear** troca o rótulo em todo lugar, **inclusive nas reservas antigas** — elas
    apontam para a área e não guardam o texto, então área que mudou de nome não vira
    duas no relatório. A linha da reserva fica intacta (há teste comparando antes e
    depois);
  - **desligar** tira a área das telas de reserva (site, recepção e série). O histórico
    fica: as reservas antigas continuam de pé e a área segue no relatório;
  - **bloquear** deixa a área **na lista, visível**, e recusa a reserva.
- **Excluir não existe**, mesma regra das salas e das empresas. A chave estrangeira é
  `ON DELETE RESTRICT`.
- **A ÚLTIMA área que pode reservar não se desliga nem se bloqueia.** Sem nenhuma área
  escolhível, o formulário não fecha e **ninguém consegue reservar** — nem no site, nem
  no balcão. O erro apareceria como "escolha a área" numa lista vazia, e ninguém ligaria
  uma coisa à outra. Há teste para desligar e para bloquear.
- A **ordem** é definida no painel por botões de mover (não arrastando: a recepção mexe
  no tablet, e arrastar não funciona pelo teclado). Essa ordem é a que o cliente vê **e
  a do gráfico no relatório** — por ordem, e não por quantidade, para as barras ficarem
  no mesmo lugar quando a equipe troca de período. A reordenação regrava a ordem de
  todas em bloco, para nunca haver dois números iguais.

### O bloqueio do Jurídico (virou botão em 27/10/2026)
- **A área jurídica não pode reservar.** Motivo: o coworking tem contrato de
  exclusividade com uma empresa de advocacia, então não aceita reservas de outros
  advogados. **O Jurídico já nasce bloqueado pela migração**, do jeito que estava em
  produção.
- **MUDANÇA DE DECISÃO:** até 27/10/2026 o bloqueio era a constante
  `PROFISSOES_BLOQUEADAS` no código, e a decisão registrada era de que ficaria lá. O
  dono mudou: *"vira botão no painel mas no caso do jurídico, já deixa configurado pra
  não poder reservar"*. O motivo é prático — ele quer destravar sozinho no dia em que o
  contrato acabar, sem publicar versão nova.
- **O AVISO ficou na própria área** (coluna `aviso_bloqueio`), editável, e não escrito
  no código. O texto de hoje fala em "área jurídica"; se a equipe bloquear outra área
  amanhã com a mesma frase, a mensagem mentiria. Sem texto próprio, vale o genérico de
  `AVISO_BLOQUEIO_GENERICO`.
- **A área bloqueada CONTINUA aparecendo na lista**, de propósito. Escondida, o advogado
  não acharia a opção dele, escolheria "Outros" e a reserva passaria. Aparecendo, a
  recusa explica o motivo e ele fala com a recepção.
- Vale para o **cliente no site** e para a **recepção no painel**. A recepção fura regra
  comercial (antecedência, duração, expediente), mas esta não é regra comercial: é
  compromisso com outra empresa.
- A recusa é do **servidor** (`recusaDaProfissao`), nas três portas que criam reserva. A
  tela também bloqueia, mas só para a pessoa não preencher o resto à toa — esconder o
  botão não para quem manda o pedido direto. Há teste nas três portas.
- **Reservas de Jurídico que já existem não são afetadas:** continuam de pé, e a equipe
  continua podendo remarcar e cancelar. A regra vale só para reserva nova.
- Há teste que **desbloqueia e confirma que a reserva passa na hora** — é o dia em que o
  contrato acabar.

### Reserva lançada depois de acontecer, excluir e mudar status (13/11/2026)
- **O caso real:** o cliente esquece de marcar, a recepcionista anota no papel e lança
  no sistema no dia seguinte. *"Eu posso, exatamente agora, adicionar uma reserva para
  ontem."*
- **Isso JÁ funcionava, e foi conferido por simulação** com o motor de verdade: a
  recepção lança para ontem (aceito), a reserva nasce **CONFIRMADA**, e a rotina
  `marcarConcluidas` a vira **CONCLUIDA**. Duas ressalvas que o dono precisava saber:
  a rotina roda **de 5 em 5 minutos** (olhar na hora parece defeito) e **não roda com
  `CRON_ATIVO="false"`** — ou seja, na prévia isso nunca acontece sozinho.

#### O status virou três AÇÕES, nunca uma lista solta
Uma caixinha "escolha o status" deixaria fazer três coisas erradas sem reclamar:
marcar como concluída uma reserva de amanhã (o sistema passaria a dizer que algo que
não aconteceu, aconteceu), escrever REAGENDADA sem remarcação nenhuma (histórico
mentira) e descancelar por cima de uma sala que outro cliente já pegou.

| Ação | Só aparece quando | Por quê |
|---|---|---|
| **Marcar como concluída** | o término já passou | não espera a rotina; é o único caminho com o cron desligado |
| **Reabrir** | concluída e ainda **não** terminou | depois do término a rotina marcaria de novo em minutos, e o botão pareceria quebrado |
| **Desfazer cancelamento** | está cancelada | ver abaixo |

- **Descancelar é o mais perigoso:** ao cancelar, o banco **libera o horário**. A
  conferência é feita na mão, olhando todas as reservas da sala menos as canceladas,
  mais os bloqueios — **a trava do banco só enxerga reserva ATIVA** e não barraria
  sozinha quando a concorrente também já estivesse concluída. Mesma armadilha do
  "Ficou mais tempo". Há teste que prova a recusa e que a reserva **continua
  cancelada** depois dela.
- Volta como **CONFIRMADA**, nunca como REAGENDADA: esse status significa "alguém
  remarcou isto", e desfazer um cancelamento não remarcou nada. E **`canceladoEm` é
  limpo** — deixá-lo preenchido faria a reserva dizer que está ativa *e* que foi
  cancelada em tal dia.
- **Quem decide se já terminou é o SERVIDOR** (`jaTerminou` na resposta). Refazer essa
  conta no navegador poria a regra de fuso em dois lugares, e o navegador do operador
  pode estar em outro fuso.

#### Excluir reserva: autorizado, com evidência obrigatória
- **Pedido e justificativa do dono:** *"pode até ser essa questão de excluir, só que a
  gente inclui um histórico de ações dentro do sistema... mesmo que exclua, a gente
  pelo menos tem esse dado. Aí sim, é uma evidência."*
- **Para que serve:** lançamento errado — sala trocada, dia trocado, duplicado.
  **Cancelar não resolve esse caso**, e o dono está certo: a reserva cancelada
  **continua contando como reserva no relatório**, então um engano cancelado infla o
  número e deixa no histórico do cliente um cancelamento que nunca existiu.
- **Tabela `acoes_registradas`**, com `RESERVA_EXCLUIDA` e `RESERVA_STATUS_ALTERADO`.
- **O resumo é CONGELADO** no momento da ação. A reserva excluída não existe mais para
  ser consultada e o cliente dela pode ter sido desligado depois: montar a frase na
  hora de LER deixaria o histórico em branco justamente no caso que mais importa. Junto
  vai o retrato completo em JSON — cliente, telefone, sala, dia, horário, valor, status
  e origem.
- **O nome de quem fez vai GRAVADO na linha**, além da chave estrangeira: o usuário
  pode ser desligado, e a evidência não pode virar "alguém fez isso". A chave é
  `ON DELETE SET NULL`.
- **Motivo obrigatório na exclusão**, com trava no banco (`acao_exclusao_exige_motivo`).
  Mudança de status não exige: o antes-e-depois já está nos dados, e pedir texto a cada
  clique faria a equipe escrever "a" para passar da tela.
- **Registro e exclusão na MESMA transação.** Gravando por fora, uma falha no meio
  deixaria a reserva apagada sem registro nenhum — exatamente o que isto existe para
  impedir.
- **O horário fica livre sozinho:** o gatilho do banco já trata DELETE e tira a linha
  de `ocupacao_salas`. Os registros de mensagem ficam, com a referência nula — a
  mensagem foi enviada de verdade, e isso não deixa de ser verdade. Há teste que exclui
  e cria outra reserva no mesmo horário.
- **O HISTÓRICO NUNCA SE APAGA.** Não existe rota que o remova (a de leitura só tem
  GET), a faxina diária não o toca, e a tela é só leitura. Um registro de evidência que
  pode ser mexido não é evidência.
- Visível em **Configurações → Histórico de ações**, por último na lista: não é uma
  configuração, é a prova do que foi feito.
- Mudança de status é registrada nos **dois** lugares: no `historicoAlteracoes` da
  reserva (para quem abre aquela reserva) e no histórico geral (para quem procura "o
  que mexeram na agenda" sem abrir uma por uma).
- 15 testes. **Foi para o `main`, e não para a prévia** — decisão do dono: *"é para
  atualizar isso de fato no sistema oficial que está rodando hoje."*
### Versão 2.0 construída numa PRÉVIA (11/11/2026)
- **Decisão do dono:** o financeiro e o empório nascem numa **cópia do sistema**, que
  ele olha e aprova antes de qualquer coisa ir para o original. *"A gente posta no
  original quando ele aprovar."*
- **Branch `previa`** no mesmo repositório, e um segundo app no EasyPanel apontando
  para ela. Aprovado, a branch entra na `main` e vai pelo deploy de sempre.
- **O PERIGO é a prévia ser IDÊNTICA.** Com as duas abas abertas, alguém lança a
  reserva de um cliente na prévia, ela nunca chega na agenda de verdade, e o cliente
  aparece no dia sem sala. Três avisos impedem isso, todos ligados por `AMBIENTE="previa"`:
  faixa preta em toda página (pública e do painel), **"PRÉVIA ·"** na frente do título
  da aba — a barra de abas é onde a faixa não aparece — e o site inteiro fora do Google.
- **Esquecer a variável NÃO DÁ ERRO:** a prévia sobe funcionando, só que
  indistinguível do sistema real. Por isso há teste para os três avisos, e para o valor
  errado cair no lado seguro (qualquer coisa que não seja "previa" é produção).
- **Cinco travas, cada uma por um motivo diferente** (ver `docs/previa.md`):
  - **banco próprio**, cópia de produção, em serviço separado — nenhum caminho leva a
    prévia a escrever na agenda real;
  - **`CRON_ATIVO="false"`**: os telefones na cópia são os **reais**, e as rotinas
    mandariam lembrete e convite de avaliação para os clientes de verdade;
  - **`EVOLUTION_*` vazias**: segunda camada da mesma proteção, pelo modo simulado;
  - **`CLOUDINARY_*` vazias** — a que quase passou batido: com a mesma credencial,
    apagar uma foto na prévia **apagaria o arquivo de verdade** e ela sumiria do site
    real. Vazias, as fotos existentes continuam aparecendo;
  - **`ADMIN_SESSAO_SEGREDO` diferente**: o login de um não vale no outro.
- **A cópia dos dados é de produção**, e não inventada (decisão do dono): o dono
  reconhece os próprios clientes e a demonstração convence. Fica atrás de login.

### Fase 15 — o catálogo de verdade, categorias e etiquetas (14/11/2026)
- **O catálogo veio das FICHAS FÍSICAS e das plaquinhas**, conferido um a um: a lista da
  geladeira bateu com a tabela de preços colada na porta (**10 de 10**) e a do chocolate
  com as etiquetas do expositor (**8 de 8**). Entra **pela migração, não pelo seed** — o
  deploy roda `migrate deploy`, e catálogo só no seed deixaria a tela de lançamento
  nascer vazia em produção.
- **Duas categorias FIXAS** (`COMIDA` / `BEBIDA`), que são as duas fichas que a equipe já
  usa — "CHOCOLATE" e "GELADEIRA". A coluna **não tem padrão**: um silencioso poria
  bebida na ficha da comida.
- **As etiquetas são TABELA, com cor** (`tags_produto`), editáveis sem programador, mesma
  decisão das áreas de atuação. Nove de saída: Chocolate, Biscoito, Proteína, Água,
  Refrigerante, Suco, Energético, Cerveja, Café. A cor tem trava de formato no banco —
  cor torta não dá erro, a etiqueta só **some da tela** e ninguém liga uma coisa à outra.
- **VÁRIAS etiquetas por produto**, de propósito: o Chocobiscuit é chocolate *e*
  biscoito. Obrigar a escolher uma faria a equipe perder um dos dois jeitos de achar.

#### A MÁQUINA DE CAFÉ NÃO TEM ESTOQUE — TEM CONTADOR
- Descoberto na ficha: o Expresso vai **10939 → 10949 → 10958 → 10972 → 10975** nos dias
  3 a 7. **Não é quanto tem, é quanto a máquina já fez na vida.** O vendido no dia é a
  *diferença* entre duas leituras.
- Os **12 botões entram como produto mesmo sendo GRÁTIS** (preço zero). Palavra do dono:
  *"os outros que não aparece preço é porque realmente não é cobrado à parte, pode
  consumir à vontade"*. Eles existem porque a máquina conta, e o coworking precisa do
  consumo para repor leite, pó e copo.
- **Em aberto:** a máquina tem duas plaquinhas de **R$ 10** (Mokaccino e Achocolatado) e
  esses nomes **não batem** com os 12 da ficha. A equipe acerta o preço no painel — é
  campo editável, não precisa de migração.

#### A CONTAGEM DIÁRIA vai substituir a reposição item a item (aprovado, NÃO construído)
- **A rotina real da equipe é CONTAR a prateleira**, não lançar cada venda. As fichas
  mostram isso: um número por produto por dia, com as reposições anotadas na mão
  ("3+1=4"), mais as linhas TOTAL e FALTOU.
- **A contagem é AUTOCORRETIVA**, e é por isso que ela ganha: o que foi esquecido aparece
  sozinho na conta do dia seguinte, porque a prateleira não mente. A reposição item a
  item é exata **só se ninguém esquecer** — e quando alguém esquece, o sistema nunca
  descobre.
- **As duas fichas respondem perguntas diferentes, e as duas ficam:** a do cliente (nome,
  sala, produto) diz **quem deve**; a contagem diz **o que saiu**. **A diferença entre as
  duas é a coluna "FALTOU"** — o que sumiu sem ninguém pagar. Hoje ninguém calcula isso.
- **A reposição continua sendo registrada**: sem ela a conta da contagem não fecha (não
  dá para distinguir "vendeu 2" de "chegou 1 e vendeu 3").

#### A CONTAGEM DIÁRIA, construída em 14/11/2026
- **A contagem RECONCILIA os movimentos, não os substitui.** Gravar uma contagem gera um
  movimento de **AJUSTE** com a diferença, e o estoque continua sendo a soma dos
  movimentos. Isto é o ponto: duas fontes de verdade para o mesmo número são o começo de
  dois números que discordam na mesma tela — a doença que este projeto já teve três vezes.
- **O "esperado" fica CONGELADO em cada linha da ficha.** Recalculado depois daria sempre
  zero, porque o ajuste já aconteceu — e o relatório do que faltou ficaria vazio
  justamente no caso que importa. Mesma lógica do valor congelado na reserva.
- **Diferença zero não gera movimento:** um movimento que não move nada só suja o extrato.
- **Contar duas vezes no mesmo dia NÃO conta em dobro**, e isso sai de graça do desenho:
  a segunda contagem reconcilia contra o estoque já ajustado e encontra zero. Por isso
  não há trava de "uma contagem por dia" — ela seria uma regra artificial para um
  problema que não existe. Há teste.
- **A reposição continua sendo lançada**, e é o `3+1=4` escrito à mão na ficha: sem
  registrar o que chegou, a contagem acusaria uma sobra que não existe. Há teste com a
  reposição no meio de duas contagens.
- **Sobra não compensa falta.** O número "faltaram" soma **só** o que sumiu; o que
  apareceu a mais é outro problema (chegou mercadoria sem registro). Somar os dois
  esconderia os dois.
- A ficha guarda **o horário e a observação** como estão no papel ("09:40", "1 cookies"),
  e o **dia é o da FICHA**, não o do lançamento — a recepcionista lê o papel no dia
  seguinte. Formato de hora torto é recusado pelo banco: errado, ele não daria erro, só
  apareceria estranho na tela.
- **Dia no futuro é recusado:** a prateleira de amanhã ninguém viu.

#### A MÁQUINA DE CAFÉ TEM CONTADOR, e isso virou um TIPO de produto
- `TipoDeControle`: **ESTOQUE** (conta unidades na prateleira) ou **CONTADOR** (lê o
  número acumulado da máquina). Os 12 cafés são CONTADOR; os outros 18, ESTOQUE.
- **A ficha é preenchida igual nos dois casos** — um número por produto por dia. O que
  muda é a conta que o sistema faz: na prateleira, `contado − esperado`; na máquina,
  `leitura − leitura anterior`.
- **Leitura de contador NÃO gera movimento de estoque.** "Estoque de expresso" não
  existe, e tratar igual faria o estoque despencar para menos dez mil.
- **Leitura menor que a anterior é RECUSADA.** O contador só cresce; uma leitura menor é
  quase sempre erro de digitação, e aceitar faria o consumo do dia sair negativo — um
  número que não bate com nada e que ninguém vai conferir. A mensagem mostra a leitura
  anterior, para a pessoa achar o erro.
- **Teste com os números reais da ficha:** Expresso 10939 → 10949 → 10958 → 10972 →
  10975 nos dias 3 a 7, dando 10, 9, 14 e 3 cafés. A primeira leitura não tem anterior.

#### Migração que falha pode deixar PEDAÇO PARA TRÁS
- Esta migração falhou duas vezes no desenvolvimento (erro meu de SQL), e **nas duas o
  que já tinha rodado ficou gravado** — o tipo na primeira, os 30 produtos na segunda.
  `migrate resolve --rolled-back` marca a migração como desfeita **mas não desfaz nada
  no banco**.
- **Consequência prática:** antes de tentar de novo é preciso limpar à mão o que a
  tentativa anterior criou. E em produção isso seria pior — mais um motivo para o
  ensaio numa cópia antes do deploy, como na Fase 14.

### Ao acrescentar tabela de cadastro nova
- `scripts/preparar-banco-de-teste.sh` copia os dados de uma **lista fechada de
  tabelas** (salas, horários, configurações, templates, profissões, **produtos e
  etiquetas**). Tabela de cadastro
  nova que fique fora dessa lista faz o banco de teste nascer sem ela, e **todo teste
  que cria reserva falha** por registro não encontrado — uma falha que não tem nada a
  ver com a regra sendo testada. Foi o que aconteceu ao criar as profissões, e de novo
  ao criar o catálogo do empório.
- **A ordem das tabelas importa.** O `pg_dump` escreve em ordem alfabética, então
  `produtos_com_tag` sairia ANTES de `tags_produto` e a chave estrangeira recusaria cada
  linha — em silêncio, deixando o banco de teste sem as ligações. Por isso ela vai numa
  **segunda passada** do script.

## Roteiro de construção — 13 fases
Construir uma fase por vez. Não antecipar funcionalidade de fase futura. Cada fase termina com teste e commit.

- Fase 0 — Alinhamento (resumo, dúvidas, riscos). Sem código.
- Fase 1 — Esqueleto: Next.js 15, TypeScript, Tailwind, shadcn/ui, cores da marca, docker-compose com Postgres, Prisma, Vitest, git, página inicial.
- Fase 2 — Banco de dados: schema Prisma (Sala, HorarioFuncionamento, Reserva, CodigoVerificacao, SessaoCliente, TemplateMensagem, LogMensagem, Bloqueio, Recorrencia, Usuario, Configuracao); exclusion constraints em SQL (sobreposição + intervalo entre reservas); seed.
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
### Empresas: vários telefones da mesma empresa (27/10/2026)
- **O problema, medido no banco:** a Prestare aparece em **3 telefones** (17 reservas
  no total) e a Toca em **2** (14 reservas). Para a equipe é um cliente só; para o
  relatório eram cinco clientes diferentes, cada um com uma fatia das horas.
- **Quem responde é o CLIENTE, na hora de reservar** (mudado em 27/10/2026, antes de
  ir para produção). A primeira versão só tinha a tela do painel, com a equipe
  marcando telefone por telefone — o dono vetou: *"a gente não vai ter toda hora esse
  controle de ficar olhando reserva por reserva"*. Com 26 telefones e crescendo, isso
  não se sustentava.
- **A resposta fica GRAVADA NA RESERVA** (`empresaId`), e não no telefone. Dois
  motivos: é a verdade daquele dia (reserva antiga não muda de dono porque a pessoa
  trocou de emprego depois) e acaba o conflito entre "o que a equipe marcou" e "o que
  o cliente disse".
- **Correção de 27/10/2026:** houve um terceiro motivo listado aqui, de que telefone de
  empresa seria compartilhado na prática, apoiado no número `+5514996040233` aparecer
  como "Toca" e como "Prestare" em produção. **Estava errado:** esse número é o
  atendimento comercial do próprio coworking, e a coincidência foi teste. **O telefone
  continua sendo um bom critério de agrupamento** (palavra do dono), e os dois motivos
  acima bastam para a decisão — que não mudou.
- **O que o número da casa ainda implica:** reserva lançada pelo balcão com o telefone
  do atendimento comercial cai toda num "cliente" só, que é a recepção. É justamente a
  empresa gravada na reserva que salva o relatório nesse caso, porque ela não depende
  do telefone usado.
- **O vínculo do TELEFONE continua existindo, com dois papéis menores:** atribuir as
  reservas ANTIGAS, que nunca foram perguntadas, e já vir escolhido na próxima reserva
  do mesmo número. É o padrão, não a fonte da verdade. A coluna aceita nulo de
  propósito, igual à `profissao`: preencher as reservas antigas seria inventar resposta
  que o cliente não deu.
- **A ordem de leitura no relatório é regra, não detalhe:** primeiro a empresa gravada
  na reserva, só depois o vínculo do telefone. Há teste com o telefone vinculado a A e
  a reserva respondida como B — vale B.
- **Um telefone pertence a no máximo UMA empresa, e quem garante é o banco:** o
  telefone é a CHAVE PRIMÁRIA de `telefones_empresa`. Sem isso o mesmo número poderia
  somar em duas empresas e o faturamento apareceria dobrado, sem ninguém desconfiar
  do número.
- **A tela do painel virou conserto, não cadastro diário.** Ela ainda SUGERE
  agrupamentos (números que compartilham uma palavra de 4 letras ou mais no nome,
  ignorando genéricas como de/da/cliente/teste) e nunca junta sozinha — um palpite
  errado viraria faturamento somado na empresa errada, e ninguém reclamaria porque o
  número continuaria parecendo certo. Mas o caminho normal agora é o cliente
  respondendo; o painel serve para arrumar o passado e para o caso raro da empresa que
  veio uma vez só com dois funcionários.
- A lista de telefones mostra **todos os nomes que cada número já usou**, e não só o
  mais recente: é justamente a variação ("Prestare", "Prestare Karen", "Prestare -
  Karen") que faz a equipe reconhecer de quem é o número.
- **Empresa não se exclui, se desliga** — mesma regra das salas. Apagar tiraria em
  silêncio o histórico do relatório.
- O telefone aparece **inteiro** nesta tela, como no relatório de clientes: é a equipe
  olhando os próprios clientes, atrás de login.
- Isto **resolve o problema dos 44 nomes sem limpar nada**: os nomes antigos continuam
  lá, e o agrupamento passa a ser pela empresa. Ver "Nome travado ao telefone".

### A empresa na visão do cliente (27/10/2026)
- **No site, depois de sala e horário:** *"Esta reserva é de uma empresa mensalista?"*
  Quem diz sim escolhe **de uma lista fechada**, cadastrada pela equipe. Quem diz não
  segue como sempre.
- **Lista fechada, nunca campo livre.** Digitar o nome devolveria a bagunça por outra
  porta: o servidor até resolveria "Prestare" / "prestare" / "PRESTARE" sozinho, mas
  não "Prestarre" nem "Prestare Advocacia". Com lista, o erro não tem por onde entrar.
- **A lista é PÚBLICA, e isto foi decisão consciente do dono.** O motivo: um
  funcionário novo de mensalista reserva pela primeira vez e o sistema não tem como
  saber que ele é de lá; sem a lista aberta ele dependeria de a recepção marcar o
  número depois — o trabalho manual que a mudança veio tirar. O que custa, e o dono
  aceitou: quem abre o site vê quais empresas são mensalistas, e nada impede alguém de
  se dizer de uma delas. Como a empresa **só muda o relatório** — não muda preço, nem
  sala, nem libera horário —, o estrago possível é uma reserva somada na empresa
  errada, que a equipe corrige no painel. A rota devolve **só id e nome**: nada de
  telefone nem de quanto a empresa usa o espaço. Há teste conferindo os campos.
- **Ser mensalista não muda NADA além do relatório** (decisão do dono). Mesmas salas,
  mesmos horários, mesmo preço, mesmo código no WhatsApp.
- **A empresa já vem escolhida** para quem o telefone conhece, igual ao nome. Vem da
  **última reserva** daquele número que tinha empresa; só depois cai no vínculo do
  painel. Empresa desligada não é sugerida.
- **Na recepção** o campo é um seletor simples, sem a pergunta de sim/não — o balcão
  conhece o cliente. Sugerido pelo telefone e sempre editável, e **nunca apaga o que a
  equipe já escolheu**, mesma regra do nome.
- **Na série recorrente** a empresa é perguntada **uma vez** e todas as ocorrências
  nascem com ela, igual à profissão.
- **O servidor confere nas três portas** que a empresa existe e está ativa. A tela
  manda o identificador, e esconder o campo não para quem manda o pedido direto.
  Empresa inventada ou desligada é recusada. Há teste nas duas recusas.
- **Empresa com reserva não se apaga:** a chave estrangeira é `ON DELETE RESTRICT`.
  Não existe tela para apagar empresa; se um dia existir, a trava é do banco.

### Desligar uma empresa: sai da lista, o histórico fica (27/10/2026)
- **Pedido do dono, com a palavra dele:** *"mesmo que ela não apareça mais ali na parte
  de reservas como uma alternativa de empresa mensalista, ainda assim ela vai ter o
  registro"*. É o caso da empresa que sai do coworking e para de ser mensalista.
- **Desligar é decisão sobre o FUTURO, não sobre o passado.** A empresa sai da lista
  que o cliente vê no site e deixa de ser sugerida; o histórico fica **inteiro**:
  - as reservas antigas continuam de pé, **apontando para ela**;
  - ela continua no relatório geral, com as horas dela;
  - o relatório dela ainda **abre**, com o faturamento;
  - as reservas atribuídas pelo **vínculo do telefone** também continuam — desligar
    não apaga o vínculo, senão as reservas antigas perderiam a empresa em silêncio;
  - **religar devolve tudo** como estava.
  **Há teste para cada um desses cinco pontos**, inclusive um que compara a linha
  inteira da reserva antes e depois: desligar não é gancho para mexer em reserva
  nenhuma.
- **Em Configurações → Empresas a equipe pode:** cadastrar, **renomear**, desligar e
  religar. **Não pode excluir**, mesma regra das salas — apagar tiraria o histórico do
  relatório em silêncio, e é justamente o que o dono não quer.
- **Renomear troca o nome TAMBÉM nas reservas antigas**, e isso é o desejado: a reserva
  aponta para a empresa e não guarda o texto do nome, então empresa que mudou de razão
  social não vira duas no relatório. A linha da reserva fica intacta — há teste
  comparando antes e depois. Nome repetido é recusado; salvar o mesmo nome é aceito,
  porque a tela manda o nome junto mesmo quando a pessoa só olhou.
- **No painel a empresa desligada continua visível**, marcada como "(desligada)" e com
  o aviso "fora da lista do site, histórico mantido" — sem isso a equipe não teria como
  religar, e não entenderia o que o desligamento fez.

### Faturamento por empresa (27/10/2026)
- **Autorizado pelo dono** — *"Isso é sobre faturamento, cara. No final das contas,
  sim, tem que mostrar."* Mesmo desenho do relatório individual de cliente, e pelo
  mesmo motivo: é a empresa que paga a conta do mês.
- **A fronteira do dinheiro não mudou:** o relatório **GERAL** e a **BUSCA** continuam
  sem valor nenhum. A lista de empresas no dashboard mostra **horas e reservas, sem
  dinheiro**; o faturamento aparece só quando a equipe **ABRE** uma empresa — exatamente
  como no cliente. Há teste procurando o valor dentro da resposta geral.
- Com uma empresa aberta, **o relatório geral e a busca de cliente saem da tela**, pela
  mesma razão de sempre: dois conjuntos de números parecidos, um do coworking e outro
  de uma empresa, e a equipe leria um achando que é o outro.
- **Soma do valor JÁ GRAVADO**, nunca recálculo, e **em centavos**. Há teste com três
  reservas de R$ 33,33 que precisam dar R$ 99,99.
- **Cancelada não entra** no faturamento nem nas horas, mas **conta como reserva** —
  ela aconteceu na agenda.
- **Só o total sai na resposta**, nunca o preço de cada reserva. Há teste procurando o
  preço dentro da resposta da empresa.
- A consulta que traz dinheiro é **separada** (`reservasDaEmpresaNoPeriodo`), como a do
  cliente. Ela junta dois conjuntos: as reservas com `empresaId` daquela empresa **e**
  as reservas **sem empresa** dos telefones vinculados a ela. A condição de empresa
  nula no segundo conjunto é essencial — sem ela, uma reserva marcada para OUTRA
  empresa entraria aqui só porque o telefone está vinculado a esta.
- O relatório da empresa mostra **quem reservou** no nome dela, com o **telefone
  inteiro** — mesma regra do relatório de clientes: é a equipe olhando o próprio
  cliente, atrás de login.

### O relatório abre em 30 dias (27/10/2026)
- **O dono do coworking leu "poucas horas" da Toca Imóveis achando que era o total.**
  Conferido em produção: **11 reservas, 22,5 horas, de 05/10 a 26/10** — tudo no banco,
  tudo fora da janela de **7 dias** com que a tela abria.
- **Nada foi perdido e nenhuma consulta tem corte:** a consulta do relatório não limita
  quantidade, não limita cliente e não descarta situação (só cancelada, de propósito).
  O problema era o tamanho da janela.
- O padrão virou **"Últimos 30 dias"** (`ATALHO_PADRAO`). Os três atalhos continuam na
  tela na ordem de leitura (7, 30, este mês); mudou qual já vem escolhido. **Dois testes
  travam isso**, porque voltar para sete dias não daria erro nenhum — só faria a equipe
  ler um número menor que a realidade.
- **O futuro continua fora:** todo atalho termina em *hoje*, então reserva marcada para
  frente não aparece em atalho nenhum (em produção a Giovanna tem reserva até 31/10 e a
  Nicole até 29/10). Fica **em aberto**, por decisão de escopo do dono.
- **Editar o nome NUNCA criou cliente novo.** O agrupamento sempre foi pelo telefone; o
  que troca é o rótulo, que é o nome da primeira reserva. Há teste provando isso,
  com dois nomes no mesmo número dando um cliente só.

### A busca somava só as reservas com o nome procurado (corrigido em 29/10/2026)
- **Defeito de verdade, achado pelo dono na tela.** Procurando "passos", a busca mostrava
  *"Rafael Dos Passos — 2 h em 1 reserva"*, enquanto o gráfico "Horas por cliente", logo
  abaixo na MESMA tela, mostrava **28 h** para o mesmo cliente.
- **A causa:** `procurarClientes` filtrava as **reservas cujo nome batia** e somava só
  essas. Quem escreveu o próprio nome de dois jeitos aparecia na busca com uma fração
  das horas. Era o problema dos "44 nomes para 25 telefones" voltando por outra porta.
- **O gráfico e o relatório individual seguem a regra deles**: agrupam pelo telefone,
  sobre todas as reservas. Quem mentia era a busca, que somava outra coisa. Isso importa
  porque o dono escreveu *"como que eu chego a confiar no painel"*.
- **CORREÇÃO DE 29/10/2026:** aqui estava escrito que "a métrica geral nunca esteve
  errada". **Isso é forte demais.** O gráfico está certo *pela regra dele*, mas a regra
  — telefone = cliente — quebra quando um número é usado por várias pessoas. Ver "O
  telefone compartilhado e as 28 horas do Rafael".
- **A correção:** o nome passou a servir **só para achar o telefone**. Achado o telefone,
  a soma é sobre todas as reservas dele, exatamente como o gráfico faz.
- **Os testes comparam os TRÊS lados da mesma informação** — busca, gráfico e relatório
  individual — em vez de conferir um número só. Dois números que discordam na mesma tela
  destroem a confiança no painel inteiro, e nenhum teste que olhe para um lado só pegaria
  isso. Há também teste de que a correção **não junta demais**: dois telefones diferentes
  com sobrenome igual continuam sendo dois clientes.
- Foi conferido que o teste **falha antes da correção** (dá 2 em vez de 5) e passa depois.
### O telefone compartilhado e as 28 horas do Rafael (29/10/2026)
- **O que o dono viu:** no gráfico "Horas por cliente", *"Rafael Passos — 28 h"*. O
  Rafael tem **6,5 horas na vida toda**. Ele procurou essas reservas na agenda e não
  achou nenhuma com o nome dele.
- **O que estava acontecendo, conferido em produção:** o telefone **+5514996040233**, que
  é o do **atendimento comercial do próprio coworking**, acumulou **14 reservas de quatro
  clientes diferentes** — Toca (11 reservas, 22,5 h), Prestare (1, 3 h), Matheus Toca
  (1, 1 h) e Rafael Passos (1, 1,5 h). Somadas, exatamente 28,0 h.
- **A prova de que não é uma pessoa:** no dia 26/10 três dessas reservas acontecem **ao
  mesmo tempo, em três salas diferentes** (Container 13:00–17:30, Privativa 15:00–18:00,
  Reunião 17:00–18:30). Ninguém ocupa três salas de uma vez, e o banco não permite
  sobreposição dentro da mesma sala. **As 14 são todas de origem ADMIN** — nenhuma veio
  do site. O vazamento é no balcão.
- **A agenda sempre mostrou a verdade.** Ela exibe o `nomeCliente` de cada reserva: Toca
  no dia 05, Prestare no dia 26. Quem inventou o "Rafael com 28 horas" foi o rótulo do
  relatório, não a agenda. Nenhuma reserva estava escondida.
- **O rótulo passou a ser o nome da PRIMEIRA reserva do número**, e não o da mais recente
  (decisão do dono: *"é só manter o nome da primeira reserva que ela fez"*). No caso
  acima, o bloco deixa de se chamar "Rafael Passos" e passa a se chamar "Toca", que é
  quem tem 22,5 das 28 horas. Vale nos **quatro** lugares que mostram nome de cliente —
  gráfico, busca, relatório individual e "quem reservou" da empresa —, porque dois
  rótulos diferentes para a mesma pessoa na mesma tela é o que derruba a confiança. Há
  teste comparando os três lados.
- **Isto é rótulo, não agrupamento.** As 28 horas continuam somadas no mesmo bloco. O que
  resolve de verdade é o cadastro de clientes (Fase 14): o nome vira campo próprio, para
  de depender do período escolhido na tela, e o telefone da casa deixa de ser identidade.
- **O telefone continua sendo o critério mais forte que o nome** (palavra do dono): mesmo
  número com nome escrito diferente é **um cliente só**. A exceção é o telefone
  compartilhado, que precisa ser marcado como tal — não dá para adivinhar.
- **Como o sistema sabe que Matheus e Vinícius, com telefones diferentes, são os dois da
  Toca:** pela **empresa gravada na reserva**, que já existe desde 27/10/2026. O cadastro
  de clientes resolve "quem é a pessoa"; a empresa resolve "de quem é a conta". São duas
  perguntas diferentes e cada uma tem o campo dela.

### A recepção procura o cliente em vez de digitar (29/10/2026)
- **A CAUSA do telefone compartilhado, e não o sintoma.** O telefone é campo
  **obrigatório e validado** na reserva do balcão. Quando o cliente liga, passa na
  frente ou manda mensagem pelo Instagram, a recepção não tem o número dele na mão — e
  o formulário não deixa salvar sem um. O único número sempre à mão é o da própria
  recepção. **O sistema empurrou a equipe para isso.**
- **O balcão NUNCA precisou de código de WhatsApp** (a rota diz isso por escrito). A
  trava nunca foi a verificação: era a obrigatoriedade do telefone.
- **O segundo estrago, que ninguém tinha visto:** as mensagens automáticas vão para o
  telefone **gravado na reserva**. As 14 reservas do número da recepção mandaram
  confirmação e os lembretes de 13h e 3h **para o WhatsApp da própria recepção**. Os
  clientes da Toca, da Prestare e o Rafael nunca receberam aviso nenhum.
- **A busca:** a recepção digita um pedaço do nome ("toca", "rafa") ou do telefone,
  escolhe na lista, e **o telefone DELE** entra na reserva. Procurar é mais rápido do
  que digitar um número inteiro, então o atalho ruim deixa de ser atalho.
- **A lista sai das próprias reservas**, não de um cadastro: cada telefone que já
  reservou é um "cliente conhecido". É o mesmo dado que o relatório já usa. O cadastro
  de verdade — com identificador próprio e com o Rafael dos dois números virando um só
  — é a fase seguinte.
- **O NOME SÓ SERVE PARA ACHAR O TELEFONE**, mesma regra da busca do relatório: achado
  o número, vem o cliente inteiro, com todas as reservas e todos os nomes dele. Há
  teste com a mesma pessoa escrita de três jeitos.
- **Os outros nomes do número aparecem na lista, de propósito.** Num telefone de balcão
  eles são **pessoas diferentes**, e ver "Toca · também: Prestare, Rafael Passos" de uma
  vez é o que impede a recepção de escolher aquele número sem perceber.
- **Cliente novo continua entrando na mão.** Não achou ninguém, a tela diz isso e a
  recepção digita nome e telefone como sempre. Travar aí impediria a primeira reserva
  de qualquer cliente.
- **A conversão do telefone tem teste próprio.** O banco guarda `+5511900000802` e o
  campo mostra `(11) 90000-0802`: quem traduz é `telefoneVisivel`. Usar
  `formatarEnquantoDigita` (o formatador que roda a cada tecla) produz
  `(55) 11900-0008` — corta no 11º dígito e come o DDD. A reserva nasceria com o
  telefone errado e **o campo pareceria preenchido**. Há teste de ida e volta.
- **Nada mudou no site público, no relatório nem em reserva nenhuma que já existe.**

### Detectar telefone usado por mais de uma pessoa
- **Sobreposição de horário NÃO é prova sozinha.** Uma pessoa pode reservar duas salas
  ao mesmo tempo — em produção o Matheus e o Rafael fazem isso, cada um com o nome dele
  nas duas. O critério certo é **sobreposição com nomes DIFERENTES**.
- Por esse critério, em 29/10/2026 **só o +5514996040233** (atendimento comercial do
  coworking) é telefone de balcão: em 26/10, das 15h às 17h30, tem "Toca" na Container e
  "Prestare" na Privativa ao mesmo tempo.
- O número do Vinícius (+5514996173797) está limpo: 4 reservas, três dele e uma lançada
  como "Toca" pelo balcão. Uma linha torta, não um número compartilhado.

### Telefone de balcão: um número que não é de um cliente (29/10/2026)
- **O que resolve:** o relatório agrupa cliente pelo **telefone**, e para 24 dos 25
  números isso está certo. O do atendimento comercial do coworking, não: a recepção
  lança nele a reserva de quem não deixou o próprio número, e ele acumulou **14 reservas
  de quatro clientes diferentes** — que no painel viraram um "cliente" com 28 horas.
- **A equipe MARCA o número** em Configurações → Telefones do balcão. Marcado, o
  relatório agrupa as reservas dele **pelo NOME de cada uma**: a Toca aparece com as
  22,5 h dela, a Prestare com 3, o Matheus Toca com 1 e o Rafael com 1,5.
- **POR QUE A EQUIPE MARCA E O SISTEMA NÃO ADIVINHA.** O sinal mais forte que existe no
  banco — duas reservas ao mesmo tempo em salas diferentes — **não basta**: uma pessoa
  pode reservar duas salas de uma vez, e em produção o Matheus e o Rafael fazem
  exatamente isso. Adivinhar errado quebraria um cliente de verdade em várias linhas, e
  **ninguém desconfiaria**, porque cada linha continuaria parecendo certa.
- **MARCAR NÃO TOCA EM RESERVA NENHUMA.** É uma lente na hora de montar o relatório.
  Desmarcar devolve tudo exatamente como era — há teste que compara a linha inteira da
  reserva antes e depois, e outro que desmarca e confere que o agrupamento voltou.
- **Dentro do número marcado, a grafia ainda junta:** "Toca" e "toca" continuam sendo um
  cliente só. O que separa são nomes diferentes, não maiúscula e acento.
- **Fora do número marcado, nada muda:** quem escreve o próprio nome de dois jeitos
  ("Giovana"/"Giovanna") continua sendo um cliente só, agrupado pelo telefone. Há teste —
  sem ele, a correção reabriria o problema dos "44 nomes para 25 telefones".
- **Abrir um cliente de número marcado exige o NOME junto** (`separadoPorNome` na
  resposta, `?nomeCliente=` na rota). Sem isso, abrir "Rafael Passos" traria as reservas
  **e o faturamento** das quatro pessoas daquele telefone. Há teste.
- **A busca acha a pessoa certa dentro do número:** procurar "rafael" devolve o Rafael
  com 1,5 h, e não os quatro. Procurar pelo **telefone** devolve os quatro separados —
  quem digita o número quer ver quem está ali dentro.
- **O motivo é obrigatório** ao marcar. Daqui a seis meses ninguém lembra por que aquele
  número foi marcado, e sem explicação a próxima pessoa desmarca "para testar".
- **Telefone torto é recusado:** gravado em outro formato, ele nunca casaria com as
  reservas e a marcação não faria efeito — sem erro aparecer. Mesma recusa do vínculo de
  empresa, pelo mesmo motivo.
- **A tabela `telefones_balcao` NÃO entra** em `scripts/preparar-banco-de-teste.sh`: ela
  precisa nascer **vazia** no banco de teste. Copiar os números marcados de produção
  faria os testes de agrupamento mudarem de resultado conforme a equipe mexesse no
  painel. Nenhuma reserva aponta para ela, então nada quebra por ela faltar.
- **Isto arruma o passado. O futuro quem arruma é a busca de cliente no balcão** — ver
  "A recepção procura o cliente em vez de digitar".

### O telefone do balcão sai da busca, e vira lista de trabalho (10/11/2026)
- **O defeito, visto pelo dono na tela:** procurando "presta" na nova reserva, o primeiro
  resultado era *"Toca — (14) 99604-0233 — também: Matheus Toca · Prestare · Rafael
  Passos · Miguel"*. O número já estava marcado como de balcão, e **a busca não sabia
  disso** — eu liguei a marcação ao relatório e esqueci de ligar à busca.
- Se a recepcionista clicasse ali, a reserva nova nasceria **no telefone da recepção
  outra vez** — exatamente o que a tela veio impedir.
- **Telefone marcado não entra mais na lista de escolha.** A equipe marcou justamente
  porque ele não é de um cliente.
- **Mas não some calado.** Quando o nome procurado só existe dentro de um número de
  balcão — o caso do "Miguel", que tem uma reserva lá e nenhum telefone próprio — a tela
  avisa: *"Miguel aparece só num telefone do balcão, que não é de nenhum cliente. Peça o
  telefone do cliente."* Sem isso a recepção acharia que o sistema perdeu o cliente.
- **O aviso só vale para quem NÃO tem telefone próprio.** "Prestare" tem reserva no
  balcão e num número dele: ali a recepção já tem o que escolher, e avisar seria ruído.
  Há teste para os dois casos.
- **Em Configurações → Telefones do balcão, cada número abre QUEM está preso nele**, com
  nome, horas, quantas reservas e a data da última. Pedido do dono: *"tinha que ter
  também uma listagem que mostra clientes que foram preenchidos ali de reservas por esse
  número do balcão"*. Não é estatística, é **lista de trabalho**: de quem ainda falta
  pegar o telefone de verdade.
- **As horas não contam cancelada** (mesma regra do relatório, para os dois números nunca
  discordarem); **a contagem de reservas conta todas**, porque elas estão naquele número
  e a pessoa precisa aparecer na lista. A tela diz isso em uma linha, para ninguém
  comparar com o relatório e achar defeito.
- Dentro do número, "Toca" e "toca" continuam sendo a mesma pessoa — mesma regra do
  relatório.
- **Como medir se está funcionando:** a lista para de crescer. Entre 29/10 e 03/11 o
  número da recepção foi de 4 para 5 nomes (o "Miguel" entrou) e de 14 para 16 reservas.

### Fase 14 — Cadastro de clientes (plano aprovado em 29/10/2026, ainda NÃO construído)
> Registrado aqui em 10/11/2026. O plano foi combinado em 29/10 e ficou só na conversa
> — o dono não lembrava do contexto uma semana depois. Plano que não entra neste
> arquivo não existe.

**O PROBLEMA DE FUNDO.** O sistema não tem cadastro de cliente. Quem é o cliente é
adivinhado de dois campos soltos que a recepção digita em cada reserva: o nome e o
telefone. Daí vem tudo — 44 nomes para 25 telefones, o Rafael em dois números, e o
telefone da casa virando "cliente". As correções de 29/10 e 10/11 (busca no balcão,
telefone de balcão, nome da primeira reserva) são **remendos que funcionam**; nenhuma
tira a causa.

**A IDEIA:** fazer com PESSOA o que já foi feito com EMPRESA — um cadastro de verdade,
com a reserva apontando para ele.

**O BANCO**
- `clientes`: nome oficial, ativo, criado_em.
- `telefones_cliente`: o **telefone é a CHAVE PRIMÁRIA**, igual a `telefones_empresa`.
  É o banco impedindo sozinho que um número pertença a dois clientes e o faturamento
  apareça dobrado.
- `reservas.cliente_id`, com chave estrangeira. O banco passa a **recusar** reserva
  apontando para cliente que não existe. Identidade deixa de ser texto livre, que é
  onde o erro entra hoje.
- **`nome_cliente` e `telefone` CONTINUAM gravados na reserva.** São a verdade daquele
  dia — quem apareceu e qual número foi usado — e é o que a agenda mostra. Mesma
  decisão da empresa.

**A MIGRAÇÃO — como os primeiros cadastros nascem** (regra confirmada pelo dono em
29/10 e de novo em 10/11: *"o critério do telefone tem que ser mais importante que o
nome"*)
- **Um cliente por TELEFONE.** Mesmo número com nome escrito de dois jeitos é **um
  cliente só**, e fica o nome da **primeira** reserva daquele número.
- **EXCEÇÃO, acrescentada em 10/11:** telefone marcado como **de balcão** não vira um
  cliente. Ali cada **nome** vira um cliente, que é o que o relatório já faz desde
  29/10. Sem essa exceção a migração criaria um "cliente" chamado Toca com as reservas
  da Prestare, do Rafael e do Miguel dentro — e aí ficaria gravado no banco, em vez de
  ser só um agrupamento de tela.
- A migração confere no fim que **nenhuma reserva ficou sem cliente**; sobrando uma, ela
  inteira é desfeita. Mesmo desenho da `profissoes_editaveis`.

**EM TRÊS PARTES, uma de cada vez**
- **Parte A — a fundação.** Tabelas, migração e as três portas achando-ou-criando o
  cliente sozinhas. O relatório passa a agrupar por cliente em vez de por telefone. **Na
  tela, nada muda** — é a base ficando correta embaixo.
- **Parte B — o painel.** Configurações → Clientes: listar, corrigir o nome, **juntar
  dois cadastros** (o Rafael dos dois números vira um) e ligar telefone. Com sugestões
  automáticas de quem parece ser a mesma pessoa, como nas empresas — **sugere e nunca
  junta sozinho**: um palpite errado viraria faturamento somado na pessoa errada e
  ninguém reclamaria, porque o número continuaria parecendo certo.
- **Parte C — o balcão.** A recepção passa a escolher um cliente **cadastrado** em vez
  de digitar. Cliente novo, cadastra na hora.

**O QUE ISSO RESOLVE E O QUE NÃO RESOLVE**
- Resolve: Rafael em dois números; nome oficial que não depende do período escolhido na
  tela; o telefone da casa deixando de ser identidade de alguém.
- **Não resolve sozinho:** quem é a mesma pessoa em dois cadastros é a **equipe** que
  decide, na Parte B. São ~25 números, trabalho de uma sentada, uma vez só.

**EXCLUIR NÃO EXISTE**, mesma regra de salas, empresas e áreas de atuação: desliga-se.
Apagar tiraria o histórico do relatório em silêncio.

### Fase 14, Parte A — construída em 10/11/2026
- **Invisível de propósito:** na tela nada mudou. A base ficou correta embaixo.
- **O que entrou:** tabelas `clientes` e `telefones_cliente`, coluna `cliente_id` na
  reserva, as três portas gravando o cadastro e o relatório agrupando por ele.
- **`chaveDoCliente` agora é o `clienteId`.** É ele que junta o mesmo Rafael de dois
  telefones — coisa que nenhuma regra sobre telefone ou nome conseguia fazer sozinha.
- **O `?? telefone` que sobrou ali é TRANSIÇÃO, não caminho alternativo.** A migração
  preencheu todas as reservas e as três portas preenchem as novas, então na prática ele
  não pega. Existe para que uma reserva sem cadastro, se escapar, continue aparecendo
  no relatório agrupada do jeito antigo em vez de **sumir da tela sem ninguém ver**.
  Morre quando a coluna virar obrigatória no banco, no fim da fase.
- **`garantirCliente` roda DENTRO da transação da reserva** no site: cliente criado para
  uma reserva que não chegou a nascer viraria cadastro fantasma. A trava por telefone
  que já existia ali serializa dois pedidos do mesmo número, então não há como nascerem
  dois cadastros para a mesma pessoa.
- **A série resolve o cliente UMA vez**, antes do laço, igual à profissão e à empresa.
  Dentro do laço seriam 17 consultas para chegar sempre na mesma resposta.
- **O nome mostrado no relatório é o OFICIAL do cadastro.** Ele não depende do período
  escolhido na tela, que era o problema do rótulo até aqui. A busca procura nos dois: no
  nome oficial e no escrito na reserva.

#### O ENSAIO DA MIGRAÇÃO, com os dados reais de produção
Antes do deploy, a cópia de produção (192 reservas) foi restaurada num banco de ensaio e
a migração rodou nela. **Faça isto sempre que uma migração religar linhas existentes** —
o custo é de minutos e o erro apareceria em produção, no meio do deploy:

| Conferência | Resultado |
|---|---|
| reservas sem cliente | **0** |
| cadastros criados | 36 = 31 telefones normais + 5 nomes do balcão |
| telefones ligados | 31 (de 32 distintos; o do balcão fica de fora) |
| telefone do balcão ligado a alguém | **0** |
| Giovana: 3 grafias | **1 cadastro**, 62 reservas |
| Prestare: 4 grafias | **1 cadastro**, 11 reservas |
| Rafael: 2 grafias no mesmo número | **1 cadastro**, 4 reservas |

O número do balcão virou cinco cadastros — Toca (12), Prestare (3), Matheus Toca, Miguel
e Rafael Passos —, exatamente o que o relatório já mostrava na tela desde 29/10.

#### Teste com data: nunca fixa no futuro
`tests/cadastro-de-clientes.test.ts` calcula **a próxima segunda-feira a partir de hoje**.
Uma data fixa passa a ficar no passado com o tempo, e a reserva do site — que tem
antecedência mínima — começa a ser recusada sozinha, sem nada ter quebrado. Já aconteceu
neste projeto (ver `12dcd9e`).

#### O que falta da Fase 14
- **Parte B:** Configurações → Clientes — renomear, **juntar dois cadastros** (o Rafael
  dos dois números) e ligar telefone, com sugestões que nunca juntam sozinhas.
- **Parte C:** o balcão escolhe um cliente **cadastrado** em vez de digitar.
- **No fim:** `cliente_id` vira **obrigatório** no banco, e o `?? telefone` do relatório
  sai junto. Hoje ela aceita nulo porque 20 arquivos de teste criam reserva direto no
  banco; apertar isso agora misturaria a mudança de regra com churn de teste.

### Fase 14, Parte B — o painel de clientes (10/11/2026)
- **O que a migração não conseguia sozinha:** ela acerta os nomes escritos de vários
  jeitos no MESMO telefone. Não tem como saber que o "Rafael dos Passos" de um número é
  o "Rafael Passos" de **outro** número. Ninguém tem — só a equipe. Esta tela é isso.
- **Configurações → Clientes**, com quatro ações:
  - **renomear:** troca o rótulo no relatório. **Não toca em reserva nenhuma** — há
    teste comparando a linha inteira antes e depois;
  - **juntar:** as reservas e os telefones passam para o cadastro escolhido, e o
    absorvido deixa de existir;
  - **separar:** tira um telefone do cadastro e devolve a ele um cadastro próprio, com
    as reservas daquele número;
  - **desligar/religar:** decisão sobre o futuro; o histórico fica e o cliente continua
    no relatório.
- **APAGAR O CADASTRO ABSORVIDO NÃO FERE A REGRA DE "NUNCA EXCLUIR".** Depois da junção
  ele não guarda histórico nenhum: reserva e telefone já mudaram de dono. O que a regra
  protege é o histórico, e ele continua inteiro — embaixo do outro cadastro.
- **JUNTAR ERRADO TEM VOLTA, e é por isso que dá para usar a tela sem medo.** A reserva
  continua guardando o **telefone** dela, então `separarTelefone` devolve o número e as
  reservas dele a um cadastro próprio. Há teste que junta, separa e confere que os dois
  voltaram com as horas certas. Mesmo assim a tela mostra o que vai mudar **antes** de
  confirmar: desfazer dá trabalho.
- **Separar só aparece com dois ou mais números.** Tirar o único telefone de um cadastro
  criaria uma cópia dele sem resolver nada.
- **As sugestões nunca juntam sozinhas** — mesma regra das empresas. Um palpite errado
  viraria faturamento somado na pessoa errada, e ninguém reclamaria, porque o número
  continuaria parecendo certo. Há teste provando que gerar sugestões não muda o
  relatório.
- As sugestões olham **o nome oficial E os nomes escritos nas reservas**: é assim que
  "Rafael dos Passos" encontra "Rafael Passos", que pode não estar no rótulo de nenhum
  dos dois. Palavras genéricas (de/da/cliente/teste/sala…) ficam de fora — juntariam
  gente que não tem nada a ver. Há teste.
- **Juntar N cadastros é feito um a um pela tela**, e não num pedido só: assim uma falha
  no meio não deixa metade do grupo pendurada sem ninguém saber quais entraram.
- A lista do painel usa a **mesma regra de horas do relatório** (cancelada não conta),
  porque dois números que discordam na mesma tela derrubam a confiança no painel
  inteiro. A contagem de reservas conta todas.

### Fase 14, Parte C — o balcão escolhe um cadastro (10/11/2026)
- **A busca da nova reserva passou a olhar o CADASTRO**, e não mais as reservas soltas.
  É a diferença que faz o **Rafael dos dois telefones aparecer UMA vez**, com os dois
  números para a recepção escolher — antes ele aparecia duas, como se fossem duas
  pessoas.
- **A recepção escolhe QUAL telefone usar** quando o cadastro tem mais de um. O sistema
  não decide sozinho porque é o telefone **gravado na reserva** que recebe a confirmação
  e os lembretes.
- **O telefone de balcão sumiu da busca de graça.** Ele nunca entra em
  `telefones_cliente`, então não existe número de balcão para escolher. O que aparece é
  a **pessoa** — "Miguel", sem telefone —, e a tela pede o número dela. O tratamento
  especial que a versão anterior precisava (`soNoTelefoneDeBalcao`) deixou de existir: o
  cadastro resolveu aquilo por desenho, e não por exceção.
- **O momento que fecha o ciclo:** a recepção escolhe o cadastro do Miguel, digita o
  número que acabou de conseguir, e os dois ficam ligados. Da próxima vez aquele
  telefone cai no cadastro dele sozinho. É isso que tira gente do telefone da casa, uma
  por uma, no uso normal — sem mutirão de limpeza.
- **TELEFONE QUE JÁ É DE OUTRO CADASTRO É RECUSADO** (`TelefoneDeOutroCliente`, 422). A
  mensagem diz de quem é o número. Deixar passar ligaria o telefone de alguém ao cliente
  errado — e dali em diante **todas** as reservas daquele número cairiam na conta
  errada, sem ninguém desconfiar. Há teste que tenta e confere que o vínculo antigo
  ficou intacto.
- **Cliente desligado não aparece na escolha.** Desligar é decisão sobre o futuro.
- O campo do telefone usa `telefoneVisivel` para traduzir do formato do banco
  (`+5511900000802`) para o da tela (`(11) 90000-0802`). `formatarEnquantoDigita` cortaria
  no 11º dígito e comeria o DDD, e **o campo pareceria preenchido**. Há teste de ida e
  volta — a armadilha é antiga e continua valendo.

### Fase 14 — FECHADA (10/11/2026)
- **`cliente_id` virou OBRIGATÓRIO no banco.** Quem garante que nenhuma reserva fica sem
  dono deixou de ser a aplicação e passou a ser o PostgreSQL. Ensaiado numa cópia de
  produção: a coluna ficou `NOT NULL`, uma inserção sem cliente é **recusada pelo banco**,
  e os números continuaram os mesmos (192 reservas, 36 cadastros, zero órfãs).
- **O `?? telefone` do relatório morreu junto**, como estava previsto. `chaveDoCliente`
  virou uma linha: o cadastro.
- **Nos testes**, quem cria reserva direto no banco usa `idDoCliente(telefone, nome)`
  (em `tests/apoio/banco.ts`), que chama o mesmo `garantirCliente` da aplicação. Foram
  26 pontos em 19 arquivos. *Tentei primeiro uma extensão do Prisma que preenchia
  sozinha — resolve o runtime mas não os tipos, então não valia a pena: o explícito
  custa o mesmo e aparece.*
- **A limpeza entre testes precisa apagar os cadastros órfãos.** Sem isso o PRIMEIRO
  teste do arquivo decide o nome oficial daquele telefone e todos os seguintes herdam
  esse nome, em vez do que eles gravaram — falha que não tem nada a ver com a regra
  sendo testada.

#### DEFEITO que eu mesmo deixei na Parte B, achado ao fechar
- O gráfico já agrupava pelo **cadastro**, mas o relatório individual ainda filtrava por
  **telefone**. Num cliente com dois números — o Rafael, depois de juntado — o gráfico
  dizia **5 h** e abrir o cliente mostrava **2 h**.
- **Dois números discordando na mesma tela é exatamente a doença que esta fase veio
  curar**, e eu reintroduzi. O teste da Parte B conferia o gráfico depois de juntar e
  nunca abria o detalhe.
- Corrigido: `montarDetalheDoCliente(periodo, clienteId)`, e a rota recebe `?clienteId=`
  no lugar de `?telefone=` e `?nomeCliente=`. O detalhe devolve **todos** os telefones
  do cliente.
- Há teste comparando gráfico e detalhe **depois da junção**. Conferido que ele falha
  antes da correção (dá 2 em vez de 5) e passa depois.
- **A lição:** teste que olha um lado só não pega discordância. Quando duas telas mostram
  a mesma informação, o teste tem de comparar as duas.

#### Marcar telefone de balcão virou AÇÃO SOBRE OS DADOS
- Era uma lente na hora de montar o relatório. Agora **separa de verdade**: cria um
  cadastro por nome, move as reservas e tira o número de `telefones_cliente`.
- É o mesmo que a migração fez com o que já existia. Ter as duas regras no mesmo formato
  importa: se divergissem, o sistema trataria o passado de um jeito e o futuro de outro,
  e **ninguém desconfiaria**, porque cada metade continuaria parecendo certa.
- **DESMARCAR NÃO JUNTA DE VOLTA**, e isso é de propósito: o sistema não tem como saber
  que a Toca e a Prestare eram para ser a mesma pessoa — e não eram. Marcação errada se
  conserta juntando os cadastros em Configurações → Clientes, escolhendo quais.
- Marcar **troca o cadastro da reserva e nada mais nela**: horário, sala, valor, nome e
  telefone ficam intactos. Há teste comparando a linha inteira.

### Controle de horas: o demonstrativo mensal do cliente (11/11/2026)
- **O PROBLEMA, medido na planilha que o dono mandou** (`DEMONSTRATIVO 12 agos a 10 set`,
  da Toca Imobiliária): ela **não tinha uma fórmula sequer**. O "52 horas" e o
  "VALOR TOTAL : R$ 3.033,66" eram **texto digitado**. Somando as linhas da própria
  planilha: **50 horas** e **R$ 3.023,66**. Foram **R$ 70 cobrados a mais**, num
  documento já enviado, e ninguém tinha como perceber.
- Havia ainda um erro de formato escondido: uma célula com formato de hora e o número 4
  solto, que o Excel lê como **4 dias = 96 horas**. Não aparecia porque ninguém somava.
- **AQUI NENHUM TOTAL É DIGITADO.** O sistema soma, **em centavos** — somar reais em
  ponto flutuante acumula diferença. Há teste com três linhas de R$ 33,33 dando R$ 99,99.
- **O único número que a gestão escreve é o total ajustado**, para o caso de
  renegociação. O dono pediu essa saída avisando que é rara, então ela fica num
  "detalhe" fechado, com o valor calculado escrito ao lado — para ninguém usar sem
  perceber de quanto era.

#### O que o documento tem, e por quê
- Segue a planilha de propósito — "Para / Período", tabela de dias, "Valor
  discriminado", "Valor total" — para quem recebe reconhecer o documento de sempre.
- **O período é livre, NÃO é mês fechado:** o ciclo da Toca vai de 10/09 a 10/10, e o
  anterior ia de 12/08 a 10/09. Uma tela de "escolha o mês" não serviria.
- **As horas aparecem por sala E somadas** (pedido do dono: *"pode somar todas as salas,
  mas também mostra separado, porque o cliente também tem essa visualização"*).
- **Cancelada não entra:** hora desmarcada não é hora cobrada.
- **O preço é o COMBINADO COM O CLIENTE** (`clientes.preco_hora_acordado`), e não o da
  tabela da sala: a Toca paga R$ 30 numa sala de R$ 40, então o valor congelado na
  reserva **não serve aqui**. Fica guardado no cliente e vem preenchido na próxima vez.

#### SALVAR CONGELA
Igual ao valor congelado na reserva: a tabela de horas é copiada para o demonstrativo na
emissão. Remarcar uma reserva depois **não muda** o documento que o cliente recebeu. Há
teste que emite, muda a reserva de 2 h para 5 h e confere que o documento continua com 2.

#### Uma biblioteca entrou na stack (pdf-lib)
- Era inevitável: o dono pediu para **mandar o PDF pelo WhatsApp**, e para anexar um
  arquivo é preciso ter o arquivo. A ideia anterior — abrir a tela no formato de
  impressão e deixar o navegador salvar — só produziria o PDF na máquina do operador.
- Escolhida porque **não lê fonte do disco em tempo de execução**. O Dockerfile usa o
  modo standalone do Next, que copia só o que consegue rastrear: biblioteca que abre
  arquivo de fonte na hora de rodar funciona no desenvolvimento e quebra em produção.
  **O `npm run build` foi conferido** antes do commit, por isso.
- A **logo** sai de `public/logotipo-multcoworking-recorte.png` (estava lá desde a Fase 1
  e nunca tinha sido usada). Se o arquivo sumir, o PDF sai com o nome escrito no lugar e
  **não falha** — uma imagem faltando não pode impedir a gestão de cobrar.

#### O envio pelo WhatsApp
- Rota `sendMedia` da Evolution, com o arquivo em **base64 no próprio pedido**: um
  demonstrativo tem nome de cliente e valor pago, e não deve ficar num link que qualquer
  um abra.
- O texto é o **décimo primeiro modelo editável** (`demonstrativo_mensal`), com
  `{{nome}}`, `{{periodo}}`, `{{horas}}` e `{{valor}}`. Entrou pela **migração**, não pelo
  seed. A chave do enum foi numa migração separada, porque o Postgres não deixa usar um
  valor de enum na mesma transação em que ele é criado.
- A tela mostra a **prévia da mensagem já com as variáveis trocadas**, e deixa editar o
  texto ali mesmo — avisando que **vale para todos os demonstrativos**, porque é o mesmo
  modelo de Configurações → Mensagens.
- **MARCA DEPOIS DE MANDAR**, ao contrário das rotinas automáticas. Aqui a ação é de uma
  pessoa, que vê o resultado na tela e tenta de novo se falhar; nas rotinas, marcar
  primeiro evita mandar duas vezes sem ninguém ver.

#### O preço por hora é OPCIONAL (11/11/2026)
- **Visto pelo dono depois do deploy:** o campo de valor por hora era obrigatório — sem
  ele a tela não salvava. *"Se eu não alterar esse valor por hora, ele se mantém no valor
  fixo de cada reserva que foi reservada... Somar no total sem precisar incluir nada
  nesse campo."*
- **Dois caminhos, e o normal é o segundo:**
  - **com** preço combinado: horas × preço. É a Toca, que paga R$ 30 numa sala de R$ 40;
  - **em branco** (o padrão): o documento soma o **valor já congelado em cada reserva** —
    o que o cliente foi cobrado no dia. Nenhum número precisa ser digitado.
- **Nunca um recálculo pela tabela de hoje.** O valor sai da coluna `valor` da reserva,
  que já viaja dentro de `itens` na emissão. Há teste que **dobra o preço da sala** e
  confere que o documento não se mexe: um mês já fechado não pode mudar sozinho quando a
  equipe reajusta preço no painel. Mesma regra do faturamento do relatório.
- O campo virou **"Preço especial por hora (opcional)"**: o nome antigo ("Valor por
  hora") parecia o valor que o sistema ia usar, quando na verdade é a **exceção** de quem
  tem preço negociado.
- **Salvar com o campo vazio NÃO apaga o preço combinado já cadastrado** no cliente.
  Gravar nulo ali tiraria em silêncio o preço negociado da equipe, e o mês seguinte
  sairia pela tabela da sala. Há teste.
- A coluna `valor_hora` virou **opcional no banco** (migração
  `20261111300000_valor_hora_opcional`). **Os demonstrativos já emitidos não mudam:**
  todos têm preço gravado, e com preço gravado a conta continua sendo horas × preço.
- No PDF a linha discriminada muda de texto nos dois casos: *"Horas · 50 h × R$ 30,00"*
  ou *"Horas · 50 h · valor de cada reserva"* — para o cliente não procurar uma
  multiplicação que não existe.

#### O que o sistema NÃO tem, e o dono precisa saber
- **O histórico anterior a outubro não existe.** No período da planilha (10/09 a 10/10),
  o sistema só tem as reservas da Toca **a partir de 05/10** — e de 05/10 em diante elas
  batem quase exatamente com a planilha (5 h, 1 h, 4,5 h). Antes disso a equipe não
  lançava. Demonstrativo de período antigo sai com a tabela incompleta.
- **As reservas da Toca não estão marcadas com a empresa.** O agrupamento aqui é pelo
  **cadastro do cliente**, que funciona; mas o relatório por empresa continua sem elas.
- **O e-mail é o destino certo, e ainda não existe.** Palavra do dono: *"o email
  específico da equipe financeira da Toca receberia, e não enviar para algum número de
  algum funcionário da Toca por WhatsApp"*. Por enquanto a gestão **baixa o PDF e envia
  por e-mail à mão**. O envio automático por e-mail é o próximo passo.

#### O demonstrativo NÃO trata horas incluídas no plano (12/11/2026)
- **Levantei isto como possível erro de cobrança e o dono confirmou que está certo.**
  Fica registrado para ninguém "consertar" depois achando que faltou algo.
- O mensalista tem uma cota de horas de sala na mensalidade (varia por cliente — 10,
  15). **O demonstrativo não desconta essa cota:** ele é o documento das **horas
  extras** e do **empório**, as duas coisas que ficam fora da mensalidade. Palavra do
  dono: *"o demonstrativo só foca em reservas, ou seja, horas extras e o valor do
  empório. Ele não foca em horas incluídas."*
- **A mensalidade também fica fora do sistema** — nem valor, nem dia de vencimento.
  Motivo da recepcionista: *"eles vão pagar automático, não precisa de cobrança"*. Só
  um ou dois pedem nota ou boleto, e ela resolve na mão.
- Consequência a lembrar: **o campo "Preço especial por hora" é o preço da hora
  extra.** Para quem não é mensalista dá no mesmo, porque todas as horas dele são
  cobradas.

#### Documento enviado não se reescreve, e excluir não existe (12/11/2026)
- **Pedido do dono:** *"nem nessa linha aí do controle de horas devia ter a opção de
  excluir documentos enviados"*.
- **Excluir nunca existiu:** não há rota que apague um demonstrativo, mesma regra de
  salas, empresas, áreas de atuação e clientes.
- **Mas "Salvar de novo" era a mesma coisa com outro nome**, e isso era um defeito meu:
  depois de enviado, a equipe podia mudar período e valores e regravar em cima — e o
  que estava guardado deixava de bater com o que o cliente tinha na mão, sem ninguém
  perceber. Uma nota de cobrança que pode ser reescrita depois de enviada perde a
  serventia de ser prova. É a doença da planilha voltando por outra porta.
- **Agora:** demonstrativo com `enviadoEm` preenchido é recusado no servidor
  (`JA_ENVIADO`), e a tela avisa antes, para a equipe não preencher tudo à toa.
- **Corrigir é emitir um documento NOVO** para o mesmo período. O antigo fica como
  registro do que foi enviado. **Antes de enviar, regravar continua liberado** — a
  equipe mexe à vontade até mandar.
- Três testes: a recusa (conferindo que a linha ficou **intacta**, não só que a
  mensagem apareceu), a regravação ainda valendo antes do envio, e a emissão de um
  segundo documento com o primeiro continuando na lista.

### Fase 15 — Empório: plano aprovado em 12/11/2026 (ainda NÃO construído)
> Veio de uma ligação do dono com a recepcionista, perguntando como funciona de
> verdade. Registrado aqui antes de construir: plano que não entra neste arquivo não
> existe (lição da Fase 14).

- **O empório já é cobrado hoje, digitado à mão.** As "Outras linhas" do controle de
  horas existem justamente para isso — o comentário no código diz "posições, empório,
  impressões". Alguém soma a ficha física e digita um valor. É o mesmo risco da
  planilha: total digitado, sem conferência.
- **NÃO EXISTE COMANDA.** Duas formas de fechar, e só essas duas:
  - **paga na hora**, com a forma de pagamento;
  - **acumula e paga junto com a mensalidade** (o mensalista fecha no dia dele).
- **A FICHA FÍSICA CONTINUA.** O cliente escreve nela, com a mão: **nome, sala, forma
  de pagamento, produto e horário**. A recepcionista lê no dia seguinte e lança no
  sistema. O lançamento guarda **a data e a hora do consumo, não as do lançamento** —
  carimbar a hora do lançamento faria o relatório dizer que todo mundo consome no fim
  do dia.
- **O lançamento usa a BUSCA DE CLIENTE CADASTRADO** da Fase 14, nunca um campo de nome
  livre. A recepcionista disse por que sem eu perguntar: *"pego o sobrenome para não
  ficar tipo Matheus da Toca, Matheus Vitullo"*. Nome solto aqui recriaria a bagunça dos
  44 nomes dentro do empório.
- **Estoque por MOVIMENTO, nunca por um número solto:** toda entrada e toda saída é uma
  linha. Assim dá para responder "por que o estoque está em 3?" — um número que alguém
  edita não responde nada.
- **Reposição registra só a QUANTIDADE**, não o custo (decisão do dono). Consequência
  aceita: o sistema controla o estoque mas não sabe a margem do empório.
- **Produtos: criar, editar, desligar. NUNCA excluir** — mesma regra de salas, empresas
  e áreas de atuação; apagar tiraria o histórico de vendas em silêncio.
- **A versão em que o próprio CLIENTE registra o consumo entra SÓ NA PRÉVIA**, atrás da
  variável `AMBIENTE="previa"`. O dono quer mostrá-la, mas não quer em produção agora:
  *"não é todo mundo que vai escanear QR code"*. Em produção a tela simplesmente não
  existe; no dia em que ele aprovar, é uma linha para liberar.
- **O que fecha o ciclo:** o consumo acumulado do mensalista entra sozinho no controle
  de horas, em vez de alguém somar a ficha e digitar um valor.

### Fase 16 — Financeiro: só ENTRADAS (decidido em 12/11/2026)
- Reservas, empório e o que mais entrar, por período e por forma de pagamento.
- **Despesas ficam para depois**, mas o banco já nasce com elas previstas — lançamentos
  com tipo (entrada/saída), só sem a tela de saída. Sem isso a fase seguinte obrigaria
  a refazer.
- **DRE não entra**, e o motivo é de escopo: *"DRE é balanço, é parte de contábeis"*. A
  decisão de ir até lá é do dono do coworking, depois de ver a prévia.

### O cliente pertence a uma EMPRESA (11/11/2026)
- **O que o dono viu, depois do deploy:** procurou "Toca" no controle de horas e achou
  **quatro cadastros** — Matheus Vitullo (30 reservas), Toca (12), Vinicius (2) e Matheus
  Toca (1). *"Todos eles são da mesma empresa. Por que, caralhos, eles não estão já
  juntados?"*
- **NÃO SÃO A MESMA PESSOA.** São quatro gentes, com telefones diferentes. Juntar como
  **cliente** apagaria quem reservou o quê — e cliente é cadastro de PESSOA.
  Quem junta gente da mesma empresa é a **EMPRESA**.
- **O vínculo saiu do TELEFONE e passou para o CLIENTE** (`clientes.empresa_id`). O de
  telefone continua existindo (ainda sugere a empresa na próxima reserva), mas não
  bastava por duas razões:
  1. **não alcança quem não tem número próprio** — a "Toca" com 12 reservas nasceu do
     telefone do balcão e não tem telefone nenhum;
  2. a equipe pensa em *"o Matheus é da Toca"*, e não em *"este número é da Toca"*.
- **O ERRO QUE EU COMETI, e que o dono achou:** eu li a planilha, vi **"Para: Toca
  Imobiliária"** no cabeçalho — a empresa, não uma pessoa — e mesmo assim construí o
  controle de horas **por cliente**. Para fechar o mês da Toca a gestão teria de gerar
  quatro documentos e somar à mão, que é exatamente o trabalho que a tela veio tirar.
- **O demonstrativo passou a aceitar EMPRESA ou pessoa.** Na empresa entram as reservas
  de **todos os clientes ligados a ela** — e não só as que tinham a empresa respondida na
  hora de reservar. Em produção só **4 de 199** reservas tinham empresa: contar apenas
  essas deixaria a fatura da Toca com um vinte-avos do que ela usou, **e o número
  continuaria parecendo certo**.
- **O documento mostra DE QUEM foram as horas** (`porPessoa`), porque o cliente quer
  conferir. No PDF, a coluna do horário vira "QUEM · HORA" quando há mais de uma pessoa.
- **O botão fica na busca da própria tela**, não só em Configurações: é olhando a lista
  dos quatro "Toca" que a equipe percebe que falta vincular, e mandá-la trocar de tela
  para arrumar seria pedir que desistisse.
- **Ligar à empresa traz as reservas PASSADAS junto, e desligar as tira** — sem reescrever
  uma linha. O vínculo é lido na hora de montar o documento. Há teste comparando a linha
  inteira da reserva antes e depois.
- **Empresa desligada é recusada:** vincular alguém a uma empresa que saiu do coworking
  poria as horas dele numa fatura que ninguém vai emitir.
- **A migração preenche o que dá para saber com segurança:** primeiro a empresa que o
  próprio cliente **já respondeu** numa reserva (é ele quem disse), depois o vínculo do
  telefone. **Telefone de balcão fica de fora** — em produção o número do balcão estava
  vinculado à Prestare por engano, e deixar passar poria as reservas de quatro clientes
  diferentes na conta de uma empresa só.

#### Ainda em aberto, e o dono precisa decidir
- **186 de 199 reservas estão sem empresa.** A pergunta existe no site e no balcão, mas é
  fácil de pular. O vínculo do cliente resolve daqui para frente; o que sobrar do passado
  é trabalho de uma sentada no painel.
- **O telefone do balcão está vinculado à Prestare** em `telefones_empresa`. Está errado
  — ele não é de ninguém — e deve ser removido no painel.
- **O cancelamento dentro de 24h com 50% + link do Pix**: pedido do dono, ainda não
  planejado.

### O vínculo com a empresa fica onde a equipe está olhando (11/11/2026)
- **Pergunta do dono, olhando a tela dos telefones do balcão:** *"como que eu incluo o
  Miguel na empresa tal, o Matheus Toca na empresa Toca?"* O seletor existia só na busca
  do controle de horas — outra tela.
- **O seletor foi para as duas listas.** É olhando os cinco nomes presos no número do
  balcão que a equipe percebe que o Miguel e o Matheus são da Toca; mandá-la trocar de
  tela para arrumar seria pedir que desistisse.
- **Dúvida que vale ficar registrada:** *"eles reservaram sem ter colocado o telefone?"*
  **Não.** O telefone é obrigatório e as 18 reservas têm um — todas com o
  **(14) 99604-0233**, o da recepção. Ninguém reserva sem telefone; o que houve foi a
  recepção digitar o número da casa por não ter o do cliente.
- **DESMARCAR não apaga nada** — nem reserva, nem cadastro, nem hora. Mas também **não
  junta de volta**, e tem um efeito ruim: o número volta a aceitar vínculo, e a próxima
  reserva lançada nele cria mais um cadastro e prende o número a ele. Para um número que
  é da casa mesmo, **a marcação deve ficar**.
