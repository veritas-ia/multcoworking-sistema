-- FASE 14, FECHAMENTO: a reserva passa a EXIGIR um cliente.
--
-- Ate aqui "cliente_id" aceitava nulo, e isso era um estado de TRANSICAO,
-- nao um estado normal: a migracao anterior preencheu todas as reservas que
-- existiam e as tres portas preenchem as novas. A coluna continuou aceitando
-- nulo so enquanto as partes B e C ficavam prontas.
--
-- Agora quem garante deixa de ser a aplicacao e passa a ser o BANCO. Reserva
-- sem dono deixa de ser possivel, e nao apenas improvavel.

DO $$
DECLARE
  orfas INTEGER;
BEGIN
  SELECT count(*) INTO orfas FROM "reservas" WHERE "cliente_id" IS NULL;

  IF orfas > 0 THEN
    RAISE EXCEPTION
      'Migracao abortada: % reserva(s) sem cliente. Rode a 20261110100000_cadastro_de_clientes antes.',
      orfas;
  END IF;
END $$;

ALTER TABLE "reservas" ALTER COLUMN "cliente_id" SET NOT NULL;
