-- A PROFISSAO DEIXA DE SER UM TIPO FIXO E VIRA UMA TABELA (27/10/2026).
--
-- Por que: o dono pediu para a equipe poder acrescentar e tirar profissoes no
-- painel. Um tipo fixo do PostgreSQL (enum) nao permite isso com seguranca —
-- ele aceita ACRESCENTAR valor, mas nunca remover, e nem isso pode ser feito
-- dentro da mesma transacao que o usa.
--
-- O BLOQUEIO ("nao pode reservar") veio junto, como coluna, por decisao do
-- dono: ele quer destravar o Juridico sozinho quando o contrato de
-- exclusividade com a advocacia acabar. O JURIDICO JA NASCE BLOQUEADO, do
-- jeito que esta hoje em producao.
--
-- O AVISO tambem e coluna, e nao texto no codigo: o texto de hoje fala em
-- "area juridica", e se a equipe bloquear outra area amanha a mensagem
-- mentiria. Cada profissao carrega o aviso dela.
--
-- A migracao roda TUDO OU NADA. Se o religamento das reservas falhar, nada e
-- aplicado e o banco fica como estava.

CREATE TABLE "profissoes" (
  "id" TEXT NOT NULL,
  -- O nome interno, que NUNCA muda: e por ele que o codigo antigo e os
  -- relatorios ja gravados se reconhecem. Renomear mexe em "nome", nao aqui.
  "slug" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  -- Desligada some do site, da recepcao e da serie, mas continua no
  -- relatorio: o historico de quem ja escolheu nao pode sumir.
  "ativa" BOOLEAN NOT NULL DEFAULT true,
  -- Nao pode reservar. Diferente de "desligada": a profissao continua na
  -- lista, visivel, e a recusa explica o motivo para o cliente.
  "bloqueada" BOOLEAN NOT NULL DEFAULT false,
  -- O texto mostrado quando ela esta bloqueada. Nulo usa o aviso generico.
  "aviso_bloqueio" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "profissoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profissoes_slug_key" ON "profissoes" ("slug");
CREATE UNIQUE INDEX "profissoes_nome_key" ON "profissoes" ("nome");

-- As cinco de hoje, na ordem em que ja apareciam nas telas.
--
-- Entram PELA MIGRACAO, e nao pelo seed: o deploy roda "migrate deploy" e NAO
-- roda o seed. Uma lista que existisse so no seed nunca chegaria em producao,
-- e o formulario de reserva ficaria sem nenhuma opcao para escolher.
INSERT INTO "profissoes" ("id", "slug", "nome", "ordem", "bloqueada", "aviso_bloqueio", "atualizado_em")
VALUES
  (gen_random_uuid()::text, 'MARKETING', 'Marketing',      1, false, NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'JURIDICO',  'Jurídico',       2, true,
   'No momento não realizamos reservas para a área jurídica. Para mais informações, entre em contato com a recepção.',
   CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CONTABIL',  'Contábil',       3, false, NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'SAUDE',     'Área da Saúde',  4, false, NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'OUTROS',    'Outros',         5, false, NULL, CURRENT_TIMESTAMP);

-- A reserva passa a APONTAR para a profissao.
--
-- Continua aceitando nulo de proposito, pelo mesmo motivo de antes: as
-- reservas anteriores ao campo nunca foram perguntadas, e preencher um valor
-- nelas agora seria inventar informacao que o cliente nao deu. No relatorio
-- elas seguem aparecendo como "Não informado".
--
-- ON DELETE RESTRICT: profissao com reserva nao se apaga. Nem existe tela
-- para apagar; se um dia existir, a trava e aqui.
ALTER TABLE "reservas" ADD COLUMN "profissao_id" TEXT;

ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_profissao_id_fkey"
  FOREIGN KEY ("profissao_id") REFERENCES "profissoes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- RELIGA cada reserva existente a linha certa, pelo nome interno.
UPDATE "reservas"
   SET "profissao_id" = "profissoes"."id"
  FROM "profissoes"
 WHERE "profissoes"."slug" = "reservas"."profissao"::text;

-- Conferencia: nenhuma reserva que TINHA profissao pode ter ficado sem. Se
-- sobrar alguma, a migracao inteira e desfeita e ninguem fica com dado torto.
DO $$
DECLARE orfas INTEGER;
BEGIN
  SELECT count(*) INTO orfas
    FROM "reservas"
   WHERE "profissao" IS NOT NULL AND "profissao_id" IS NULL;

  IF orfas > 0 THEN
    RAISE EXCEPTION 'Religamento incompleto: % reservas ficaram sem profissao.', orfas;
  END IF;
END $$;

CREATE INDEX "reservas_profissao_id_idx" ON "reservas" ("profissao_id");

-- So agora a coluna velha sai, com o tipo fixo junto.
ALTER TABLE "reservas" DROP COLUMN "profissao";
DROP TYPE "CategoriaProfissao";
