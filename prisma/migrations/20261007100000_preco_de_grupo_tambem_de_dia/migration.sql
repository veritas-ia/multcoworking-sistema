-- =============================================================================
-- PRECO DE GRUPO TAMBEM DE DIA, E DIARIA COM O CORTE DELA.
--
-- Regra definitiva da Sala de Reuniao, confirmada pelo dono:
--
--   POR HORA   | 1 a 4 pessoas | 5 a 10 pessoas
--   dia        | R$ 40         | R$ 75
--   noite      | R$ 75         | R$ 95
--
--   DIARIA (8h-18h, valor fechado)
--   1 a 5 pessoas -> R$ 350   |   6 a 10 pessoas -> R$ 450
--
-- ATENCAO: O CORTE DE PESSOAS E DIFERENTE ENTRE OS DOIS MODOS. Por hora o
-- pulo e entre 4 e 5; na diaria e entre 5 e 6. Por isso sao DUAS colunas, e
-- nao uma reaproveitada. Unificar faria a diaria de 5 pessoas custar R$ 450
-- em vez de R$ 350 — a conta erraria justamente no caso do meio, que e o mais
-- dificil de alguem perceber olhando.
--
-- NAO MEXE EM RESERVA NENHUMA. O valor fica congelado na reserva no momento
-- da criacao (regra do CLAUDE.md); isto aqui so muda a TABELA DE PRECOS da
-- sala, que vale para reserva nova. Conferido antes de escrever: nao existe
-- reserva de Sala de Reuniao com mais de 10 pessoas nem com 5 a 10 pessoas em
-- horario de dia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. As colunas novas
-- -----------------------------------------------------------------------------
ALTER TABLE "salas"
  -- Preco por hora DE DIA quando o grupo passa de "pessoas_para_grupo".
  -- Nulo = a sala nao cobra diferente por tamanho de grupo durante o dia.
  ADD COLUMN "preco_por_hora_grupo" DECIMAL(10,2),
  -- Preco da DIARIA para grupo grande. Nulo = a diaria tem valor unico.
  ADD COLUMN "preco_diaria_grupo" DECIMAL(10,2),
  -- ACIMA de quantas pessoas vale o preco de diaria de grupo. E um numero
  -- PROPRIO, separado de "pessoas_para_grupo" de proposito (ver acima).
  ADD COLUMN "pessoas_para_grupo_diaria" INTEGER;

-- -----------------------------------------------------------------------------
-- 2. Coerencia: preco de grupo e corte andam JUNTOS
--
-- Um sem o outro seria uma regra pela metade, que a tela nao saberia aplicar.
-- O preco de grupo POR HORA (dia e noite) usa "pessoas_para_grupo"; o da
-- diaria usa o corte dela.
-- -----------------------------------------------------------------------------
ALTER TABLE "salas"
  ADD CONSTRAINT "salas_preco_grupo_dia_nao_negativo"
    CHECK ("preco_por_hora_grupo" IS NULL OR "preco_por_hora_grupo" >= 0),
  ADD CONSTRAINT "salas_preco_diaria_grupo_nao_negativo"
    CHECK ("preco_diaria_grupo" IS NULL OR "preco_diaria_grupo" >= 0),
  -- Preco de grupo de dia exige o corte por hora preenchido.
  ADD CONSTRAINT "salas_grupo_de_dia_completo"
    CHECK ("preco_por_hora_grupo" IS NULL OR "pessoas_para_grupo" IS NOT NULL),
  -- A diaria de grupo exige o preco da diaria normal e o corte proprio.
  ADD CONSTRAINT "salas_diaria_de_grupo_completa"
    CHECK (
      ("preco_diaria_grupo" IS NULL AND "pessoas_para_grupo_diaria" IS NULL)
      OR (
        "preco_diaria_grupo" IS NOT NULL
        AND "pessoas_para_grupo_diaria" >= 1
        AND "preco_diaria" IS NOT NULL
      )
    );

-- -----------------------------------------------------------------------------
-- 3. Os valores da Sala de Reuniao
--
-- A busca e pelo SLUG, e nao pelo nome: o nome e editavel no painel (a antiga
-- "Sala CI" ja virou "Sala Privativa"), enquanto o slug nasce na criacao e
-- nunca muda — e o que esta nos QR codes impressos.
-- -----------------------------------------------------------------------------
UPDATE "salas"
   SET "preco_por_hora"              = 40.00,   -- 1 a 4 pessoas, ate as 18h
       "preco_por_hora_grupo"        = 75.00,   -- 5 a 10 pessoas, ate as 18h
       "preco_por_hora_noturno"      = 75.00,   -- 1 a 4 pessoas, apos as 18h
       "preco_por_hora_noturno_grupo"= 95.00,   -- 5 a 10 pessoas, apos as 18h
       "pessoas_para_grupo"          = 4,       -- ACIMA de 4 = 5 ou mais
       "preco_diaria"                = 350.00,  -- 1 a 5 pessoas
       "preco_diaria_grupo"          = 450.00,  -- 6 a 10 pessoas
       "pessoas_para_grupo_diaria"   = 5,       -- ACIMA de 5 = 6 ou mais
       -- O teto de pessoas da sala. Aparece no site ("até 10 pessoas") e e o
       -- mesmo numero que o servidor usa para recusar 11 — assim o que a
       -- equipe mostra e o que o sistema barra nunca discordam.
       "capacidade"                  = 10,
       "atualizado_em"               = now()
 WHERE "slug" = 'sala-de-reuniao';
