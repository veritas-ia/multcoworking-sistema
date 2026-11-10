-- FASE 14, PARTE A: o cliente vira cadastro de verdade.
--
-- Ate aqui "quem e o cliente" era adivinhado de dois campos soltos digitados
-- em cada reserva: o nome e o telefone. Dai vinham os 44 nomes para 25
-- telefones, o mesmo Rafael em dois numeros e o telefone da casa virando um
-- "cliente" com 28 horas.
--
-- ESTA MIGRACAO NAO MUDA NADA NA TELA. Ela so cria a base correta embaixo:
-- as reservas passam a apontar para um cadastro, em vez de carregarem a
-- identidade em texto livre.
--
-- A REGRA DE AGRUPAMENTO (confirmada pelo dono): o TELEFONE manda sobre o
-- nome. Mesmo numero com nome escrito de dois jeitos e UM cliente so, e fica
-- o nome da PRIMEIRA reserva daquele numero.
--
-- A EXCECAO: telefone marcado como de BALCAO nao e de ninguem. Ali cada NOME
-- vira um cliente — que e exatamente o que o relatorio ja faz desde
-- 29/10/2026. Sem isso, a migracao gravaria no banco um "cliente Toca" com as
-- reservas da Prestare, do Rafael e do Miguel dentro, e o que hoje e um
-- agrupamento de tela (desfeito ao desmarcar) viraria permanente.

CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clientes_nome_idx" ON "clientes"("nome");

-- O TELEFONE E A CHAVE PRIMARIA: e o banco impedindo sozinho que um numero
-- pertenca a duas pessoas e o faturamento apareca dobrado. Um cliente pode
-- ter varios telefones — e assim que o Rafael dos dois numeros vira um so.
CREATE TABLE "telefones_cliente" (
    "telefone" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telefones_cliente_pkey" PRIMARY KEY ("telefone")
);

CREATE INDEX "telefones_cliente_cliente_id_idx" ON "telefones_cliente"("cliente_id");

ALTER TABLE "telefones_cliente"
  ADD CONSTRAINT "telefones_cliente_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservas" ADD COLUMN "cliente_id" TEXT;

-- -----------------------------------------------------------------------------
-- Religando as reservas que ja existem
-- -----------------------------------------------------------------------------

-- Normaliza o nome para comparar: sem acento e sem maiuscula, igual ao que a
-- aplicacao faz. Feito com translate() de proposito — a extensao "unaccent"
-- pode nao estar instalada, e uma migracao que depende dela quebraria o
-- deploy num banco limpo.
CREATE OR REPLACE FUNCTION pg_temp.sem_acento(texto TEXT) RETURNS TEXT AS $$
  SELECT lower(translate($1,
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'));
$$ LANGUAGE SQL IMMUTABLE;

-- (1) TELEFONES NORMAIS: um cliente por numero, com o nome da PRIMEIRA reserva.
CREATE TEMP TABLE mapa_por_telefone AS
SELECT DISTINCT ON (r.telefone)
       gen_random_uuid()::text AS cliente_id,
       r.telefone,
       r.nome_cliente AS nome
  FROM "reservas" r
 WHERE NOT EXISTS (
         SELECT 1 FROM "telefones_balcao" b WHERE b.telefone = r.telefone
       )
 ORDER BY r.telefone, r.inicio ASC, r.criado_em ASC;

INSERT INTO "clientes" ("id", "nome", "ativo", "criado_em", "atualizado_em")
SELECT cliente_id, nome, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM mapa_por_telefone;

INSERT INTO "telefones_cliente" ("telefone", "cliente_id", "criado_em")
SELECT telefone, cliente_id, CURRENT_TIMESTAMP FROM mapa_por_telefone;

UPDATE "reservas" r
   SET "cliente_id" = m.cliente_id
  FROM mapa_por_telefone m
 WHERE r.telefone = m.telefone;

-- (2) TELEFONES DE BALCAO: um cliente por NOME, e o telefone nao entra em
--     "telefones_cliente" — ele nao e de ninguem.
CREATE TEMP TABLE mapa_do_balcao AS
WITH do_balcao AS (
  SELECT r.telefone,
         r.nome_cliente,
         r.inicio,
         r.criado_em,
         pg_temp.sem_acento(r.nome_cliente) AS normalizado
    FROM "reservas" r
   WHERE EXISTS (
           SELECT 1 FROM "telefones_balcao" b WHERE b.telefone = r.telefone
         )
)
SELECT DISTINCT ON (telefone, normalizado)
       gen_random_uuid()::text AS cliente_id,
       telefone,
       normalizado,
       nome_cliente AS nome
  FROM do_balcao
 ORDER BY telefone, normalizado, inicio ASC, criado_em ASC;

INSERT INTO "clientes" ("id", "nome", "ativo", "criado_em", "atualizado_em")
SELECT cliente_id, nome, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM mapa_do_balcao;

UPDATE "reservas" r
   SET "cliente_id" = m.cliente_id
  FROM mapa_do_balcao m
 WHERE r.telefone = m.telefone
   AND pg_temp.sem_acento(r.nome_cliente) = m.normalizado;

-- -----------------------------------------------------------------------------
-- A CONFERENCIA: nenhuma reserva pode ter ficado sem cliente.
--
-- Se sobrar uma, a migracao INTEIRA e desfeita. Mesmo desenho da
-- "profissoes_editaveis": melhor o deploy parar com o motivo no log do que o
-- site subir com reservas orfas que sumiriam do relatorio sem ninguem ver.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  orfas INTEGER;
BEGIN
  SELECT count(*) INTO orfas FROM "reservas" WHERE "cliente_id" IS NULL;

  IF orfas > 0 THEN
    RAISE EXCEPTION
      'Migracao abortada: % reserva(s) ficaram sem cliente. Nenhuma alteracao foi mantida.',
      orfas;
  END IF;
END $$;

ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "reservas_cliente_id_idx" ON "reservas"("cliente_id");

DROP TABLE mapa_por_telefone;
DROP TABLE mapa_do_balcao;
