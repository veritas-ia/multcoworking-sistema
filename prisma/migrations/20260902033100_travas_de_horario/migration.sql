-- =============================================================================
-- TRAVAS DE HORARIO — escrita a mao (o Prisma nao gera nada disto sozinho).
--
-- Objetivo: as regras de agenda passam a ser garantidas pelo BANCO.
-- Mesmo que dois clientes cliquem em "confirmar" no mesmo milissegundo,
-- o banco aceita apenas um. Nao depende do codigo da aplicacao.
-- =============================================================================

-- btree_gist permite misturar comparacao de igualdade (sala) com
-- comparacao de intervalos de tempo dentro da mesma trava.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- -----------------------------------------------------------------------------
-- 1. Coerencia dos dados (regras que valem linha a linha)
-- -----------------------------------------------------------------------------

-- Salas
ALTER TABLE "salas"
  ADD CONSTRAINT "salas_preco_nao_negativo"
    CHECK ("preco_por_hora" >= 0),
  ADD CONSTRAINT "salas_duracao_maxima_valida"
    CHECK ("duracao_maxima_minutos" IS NULL
           OR ("duracao_maxima_minutos" >= 60 AND "duracao_maxima_minutos" % 30 = 0));

-- Horario de funcionamento: dia valido e horas em ":00" ou ":30" (CLAUDE.md).
ALTER TABLE "horarios_funcionamento"
  ADD CONSTRAINT "horario_dia_valido"
    CHECK ("dia_da_semana" BETWEEN 0 AND 6),
  ADD CONSTRAINT "horario_formato_valido"
    CHECK (
      ("hora_abertura" IS NULL OR "hora_abertura" ~ '^([01][0-9]|2[0-3]):(00|30)$')
      AND
      ("hora_fechamento" IS NULL OR "hora_fechamento" ~ '^([01][0-9]|2[0-3]):(00|30)$')
    ),
  ADD CONSTRAINT "horario_aberto_coerente"
    CHECK (
      (NOT "aberto")
      OR ("hora_abertura" IS NOT NULL
          AND "hora_fechamento" IS NOT NULL
          AND "hora_abertura" < "hora_fechamento")
    );

-- Reservas
ALTER TABLE "reservas"
  ADD CONSTRAINT "reserva_fim_depois_do_inicio"
    CHECK ("fim" > "inicio"),
  ADD CONSTRAINT "reserva_duracao_minima_e_grade"
    CHECK ("duracao_minutos" >= 60 AND "duracao_minutos" % 30 = 0),
  ADD CONSTRAINT "reserva_duracao_bate_com_horario"
    CHECK ("duracao_minutos" = (EXTRACT(EPOCH FROM ("fim" - "inicio")) / 60)::int),
  ADD CONSTRAINT "reserva_valor_nao_negativo"
    CHECK ("valor" >= 0),
  -- Telefone sempre em formato internacional: +55 + DDD + celular de 9 digitos.
  ADD CONSTRAINT "reserva_telefone_e164"
    CHECK ("telefone" ~ '^\+55[1-9][0-9]9[0-9]{8}$'),
  -- Cancelada tem data de cancelamento; nao cancelada nao tem.
  ADD CONSTRAINT "reserva_cancelamento_coerente"
    CHECK (("status" = 'CANCELADA') = ("cancelado_em" IS NOT NULL));

-- Bloqueios
ALTER TABLE "bloqueios"
  ADD CONSTRAINT "bloqueio_fim_depois_do_inicio"
    CHECK ("fim" > "inicio");

-- Recorrencias
ALTER TABLE "recorrencias"
  ADD CONSTRAINT "recorrencia_dia_valido"
    CHECK ("dia_da_semana" BETWEEN 0 AND 6),
  ADD CONSTRAINT "recorrencia_horas_validas"
    CHECK ("hora_inicio" ~ '^([01][0-9]|2[0-3]):(00|30)$'
           AND "hora_fim" ~ '^([01][0-9]|2[0-3]):(00|30)$'
           AND "hora_inicio" < "hora_fim"),
  ADD CONSTRAINT "recorrencia_periodo_valido"
    CHECK ("data_fim" IS NULL OR "data_fim" >= "data_inicio"),
  ADD CONSTRAINT "recorrencia_telefone_e164"
    CHECK ("telefone" ~ '^\+55[1-9][0-9]9[0-9]{8}$');

-- Codigos de verificacao
ALTER TABLE "codigos_verificacao"
  ADD CONSTRAINT "codigo_tentativas_nao_negativas"
    CHECK ("tentativas" >= 0),
  ADD CONSTRAINT "codigo_telefone_e164"
    CHECK ("telefone" ~ '^\+55[1-9][0-9]9[0-9]{8}$');

-- -----------------------------------------------------------------------------
-- 2. As duas travas de agenda
--
-- Elas vivem em "ocupacao_salas", uma tabela tecnica que reune, num lugar so,
-- toda reserva ativa e todo bloqueio. So assim o banco consegue comparar uma
-- reserva com um bloqueio (que moram em tabelas diferentes).
-- -----------------------------------------------------------------------------

ALTER TABLE "ocupacao_salas"
  ADD CONSTRAINT "ocupacao_periodo_nao_vazio"
    CHECK (NOT isempty("periodo") AND NOT isempty("periodo_com_intervalo"));

-- TRAVA 1 — na mesma sala, nada pode se sobrepor no tempo:
-- reserva x reserva, reserva x bloqueio e bloqueio x bloqueio.
ALTER TABLE "ocupacao_salas"
  ADD CONSTRAINT "ocupacao_sem_sobreposicao"
    EXCLUDE USING gist ("sala_id" WITH =, "periodo" WITH &&);

-- TRAVA 2 — entre duas RESERVAS de cliente da mesma sala precisa sobrar folga.
-- Truque: cada reserva e tratada como 30 min mais longa. Se as versoes
-- esticadas encostam, e porque a folga nao existe. Bloqueios ficam de fora
-- (decisao do CLAUDE.md: bloqueio nao exige intervalo).
ALTER TABLE "ocupacao_salas"
  ADD CONSTRAINT "ocupacao_intervalo_entre_reservas"
    EXCLUDE USING gist ("sala_id" WITH =, "periodo_com_intervalo" WITH &&)
    WHERE ("tipo" = 'RESERVA');

-- -----------------------------------------------------------------------------
-- 3. Gatilhos que mantem "ocupacao_salas" sempre em dia
--
-- A aplicacao NUNCA escreve nesta tabela. Ela so grava em "reservas" e
-- "bloqueios"; o proprio banco copia para ca.
-- -----------------------------------------------------------------------------

-- Le o intervalo de folga do painel (Configuracao). Se nao existir, usa 30 min.
CREATE OR REPLACE FUNCTION "intervalo_entre_reservas"() RETURNS interval AS $$
  SELECT COALESCE(
    (SELECT "valor"::int FROM "configuracoes" WHERE "chave" = 'intervaloMinutos'),
    30
  ) * interval '1 minute';
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "sincronizar_ocupacao_reserva"() RETURNS trigger AS $$
DECLARE
  folga interval := "intervalo_entre_reservas"();
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM "ocupacao_salas" WHERE "origem_id" = OLD."id";
    RETURN OLD;
  END IF;

  -- So reserva ativa ocupa a sala. Cancelada e concluida liberam o horario.
  IF (NEW."status" IN ('CONFIRMADA', 'REAGENDADA')) THEN
    INSERT INTO "ocupacao_salas"
      ("origem_id", "tipo", "sala_id", "periodo", "periodo_com_intervalo")
    VALUES (
      NEW."id",
      'RESERVA',
      NEW."sala_id",
      tstzrange(NEW."inicio", NEW."fim", '[)'),
      tstzrange(NEW."inicio", NEW."fim" + folga, '[)')
    )
    ON CONFLICT ("origem_id") DO UPDATE SET
      "sala_id"               = EXCLUDED."sala_id",
      "periodo"               = EXCLUDED."periodo",
      "periodo_com_intervalo" = EXCLUDED."periodo_com_intervalo";
  ELSE
    DELETE FROM "ocupacao_salas" WHERE "origem_id" = NEW."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "sincronizar_ocupacao_bloqueio"() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM "ocupacao_salas" WHERE "origem_id" = OLD."id";
    RETURN OLD;
  END IF;

  -- Bloqueio ocupa exatamente o proprio periodo, sem folga.
  INSERT INTO "ocupacao_salas"
    ("origem_id", "tipo", "sala_id", "periodo", "periodo_com_intervalo")
  VALUES (
    NEW."id",
    'BLOQUEIO',
    NEW."sala_id",
    tstzrange(NEW."inicio", NEW."fim", '[)'),
    tstzrange(NEW."inicio", NEW."fim", '[)')
  )
  ON CONFLICT ("origem_id") DO UPDATE SET
    "sala_id"               = EXCLUDED."sala_id",
    "periodo"               = EXCLUDED."periodo",
    "periodo_com_intervalo" = EXCLUDED."periodo_com_intervalo";

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_ocupacao_reserva"
  AFTER INSERT OR UPDATE OR DELETE ON "reservas"
  FOR EACH ROW EXECUTE FUNCTION "sincronizar_ocupacao_reserva"();

CREATE TRIGGER "trg_ocupacao_bloqueio"
  AFTER INSERT OR UPDATE OR DELETE ON "bloqueios"
  FOR EACH ROW EXECUTE FUNCTION "sincronizar_ocupacao_bloqueio"();
