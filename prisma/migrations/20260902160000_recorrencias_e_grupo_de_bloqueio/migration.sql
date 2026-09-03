-- Fase 9: recorrencias de verdade e bloqueio em grupo.
--
-- A tabela "recorrencias" da Fase 2 so guardava UM dia da semana e nao tinha
-- frequencia. A Fase 9 precisa de series como "terca E quarta, a cada duas
-- semanas" e "a primeira terca de cada mes". A tabela estava vazia, entao a
-- troca e direta, sem migrar dado nenhum.

-- De quanto em quanto tempo a serie se repete. A base e SEMPRE dia da semana:
-- nunca "dia 15", porque "dia 15" cai em qualquer dia da semana.
CREATE TYPE "FrequenciaRecorrencia" AS ENUM ('SEMANAL', 'QUINZENAL', 'MENSAL');

ALTER TABLE "recorrencias"
  DROP COLUMN "dia_da_semana",
  ADD COLUMN "dias_da_semana" INTEGER[] NOT NULL DEFAULT '{}',
  ADD COLUMN "frequencia" "FrequenciaRecorrencia" NOT NULL,
  ADD COLUMN "semana_do_mes" INTEGER,
  ADD COLUMN "criado_por_id" TEXT;

-- Toda serie tem fim (decisao da Fase 9).
ALTER TABLE "recorrencias"
  ALTER COLUMN "data_fim" SET NOT NULL;

ALTER TABLE "recorrencias"
  ADD CONSTRAINT "recorrencia_tem_dia"
    CHECK (array_length("dias_da_semana", 1) >= 1),
  ADD CONSTRAINT "recorrencia_dias_validos"
    CHECK ("dias_da_semana" <@ ARRAY[0,1,2,3,4,5,6]),
  ADD CONSTRAINT "recorrencia_fim_depois_do_inicio"
    CHECK ("data_fim" >= "data_inicio"),
  -- "semana do mes" so faz sentido na frequencia mensal, e so aceita
  -- primeira/segunda/terceira (1,2,3) ou ultima (-1).
  ADD CONSTRAINT "recorrencia_semana_do_mes_coerente"
    CHECK (
      ("frequencia" = 'MENSAL' AND "semana_do_mes" IN (1, 2, 3, -1))
      OR ("frequencia" <> 'MENSAL' AND "semana_do_mes" IS NULL)
    );

ALTER TABLE "recorrencias"
  ADD CONSTRAINT "recorrencias_criado_por_id_fkey"
    FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "recorrencias_sala_id_dia_da_semana_idx";
CREATE INDEX "recorrencias_sala_id_idx" ON "recorrencias"("sala_id");
CREATE INDEX "recorrencias_criado_por_id_idx" ON "recorrencias"("criado_por_id");

-- Bloqueios criados juntos (um feriado em todas as salas) passam a compartilhar
-- um identificador de grupo, para serem removidos de uma vez.
ALTER TABLE "bloqueios" ADD COLUMN "grupo_id" TEXT;
CREATE INDEX "bloqueios_grupo_id_idx" ON "bloqueios"("grupo_id");
