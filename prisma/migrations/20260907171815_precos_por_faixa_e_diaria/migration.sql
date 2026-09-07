-- PRECO POR FAIXA DE HORARIO E CATEGORIA DIARIA.
--
-- O preco da reserva passa a depender da HORA: cada bloco de 30 minutos e
-- cobrado pela faixa em que ele comeca. Uma reserva das 17h as 20h paga duas
-- faixas diferentes dentro da mesma reserva.
--
-- As salas passam a guardar, cada uma:
--   preco_por_hora               -> a faixa de DIA (ate o inicio da noite)
--   preco_por_hora_noturno       -> a faixa da NOITE
--   preco_por_hora_noturno_grupo -> a noite, quando o grupo passa do limite
--   pessoas_para_grupo           -> acima de quantas pessoas vale o preco acima
--   aceita_diaria / preco_diaria -> a categoria de dia inteiro
--
-- Nada disto muda reserva JA CRIADA: o valor fica congelado na reserva no
-- momento da criacao (regra do CLAUDE.md), e esta migracao nao toca na tabela
-- de reservas.

ALTER TABLE "salas"
  ADD COLUMN "preco_por_hora_noturno" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "preco_por_hora_noturno_grupo" DECIMAL(10,2),
  ADD COLUMN "pessoas_para_grupo" INTEGER,
  ADD COLUMN "aceita_diaria" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "preco_diaria" DECIMAL(10,2);

-- Valores confirmados pelo dono do projeto.
--
-- As salas sao identificadas pelo ENDERECO (slug), e nao pelo nome: a antiga
-- "Sala CI" ja foi renomeada para "Privativa" no painel, e o endereco e
-- justamente a parte que nunca muda depois de criada.
UPDATE "salas"
   SET "preco_por_hora" = 35.00, "preco_por_hora_noturno" = 75.00
 WHERE "slug" = 'sala-container';

UPDATE "salas"
   SET "preco_por_hora" = 40.00, "preco_por_hora_noturno" = 75.00
 WHERE "slug" = 'sala-ci';

-- A de Reuniao e a unica com preco de grupo e com diaria, por enquanto. A
-- "Sala Compartilhada" sera criada pelo painel e tera a diaria ligada la.
UPDATE "salas"
   SET "preco_por_hora" = 40.00,
       "preco_por_hora_noturno" = 75.00,
       "preco_por_hora_noturno_grupo" = 95.00,
       "pessoas_para_grupo" = 4,
       "aceita_diaria" = true,
       "preco_diaria" = 350.00
 WHERE "slug" = 'sala-de-reuniao';

-- Qualquer outra sala que ja exista fica com a noite igual ao dia ate a equipe
-- ajustar no painel. Deixar em zero faria a tela oferecer "R$ 0,00" a noite.
UPDATE "salas"
   SET "preco_por_hora_noturno" = "preco_por_hora"
 WHERE "preco_por_hora_noturno" = 0;

-- O padrao existia so para preencher as linhas antigas.
ALTER TABLE "salas" ALTER COLUMN "preco_por_hora_noturno" DROP DEFAULT;

-- As mesmas travas que o preco de dia ja tinha.
ALTER TABLE "salas"
  ADD CONSTRAINT "salas_preco_noturno_nao_negativo"
    CHECK ("preco_por_hora_noturno" >= 0);

ALTER TABLE "salas"
  ADD CONSTRAINT "salas_preco_noturno_grupo_nao_negativo"
    CHECK ("preco_por_hora_noturno_grupo" IS NULL OR "preco_por_hora_noturno_grupo" >= 0);

ALTER TABLE "salas"
  ADD CONSTRAINT "salas_preco_diaria_nao_negativo"
    CHECK ("preco_diaria" IS NULL OR "preco_diaria" >= 0);

-- Preco de grupo e o numero de pessoas andam juntos: um sem o outro seria uma
-- regra pela metade, que a tela nao saberia aplicar.
ALTER TABLE "salas"
  ADD CONSTRAINT "salas_grupo_completo"
    CHECK (("preco_por_hora_noturno_grupo" IS NULL AND "pessoas_para_grupo" IS NULL)
        OR ("preco_por_hora_noturno_grupo" IS NOT NULL AND "pessoas_para_grupo" >= 1));

-- Sala que aceita diaria precisa ter preco de diaria.
ALTER TABLE "salas"
  ADD CONSTRAINT "salas_diaria_com_preco"
    CHECK ("aceita_diaria" = false OR "preco_diaria" IS NOT NULL);

-- A hora em que a faixa noturna comeca. Fica em Configuracao, e nao no codigo,
-- porque e numero de negocio: o dono pode mudar sem mexer no sistema.
INSERT INTO "configuracoes" ("chave", "valor", "descricao", "atualizado_em")
VALUES ('horaInicioNoturno', '18:00',
        'A partir de que hora vale o preco noturno das salas.', NOW())
ON CONFLICT ("chave") DO NOTHING;
