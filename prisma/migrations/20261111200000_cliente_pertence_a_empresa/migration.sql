-- O CLIENTE PASSA A PERTENCER A UMA EMPRESA.
--
-- O dono procurou "Toca" no painel e achou QUATRO cadastros — Matheus
-- Vitullo, Toca, Vinicius e Matheus Toca — e perguntou por que nao estavam
-- juntos. Nao estavam porque nao sao a mesma PESSOA: sao quatro gentes, com
-- telefones diferentes. Juntar como cliente apagaria quem reservou o que.
--
-- Quem junta gente da mesma empresa e a EMPRESA. Ate aqui esse vinculo era
-- do TELEFONE, e isso nao bastava por duas razoes:
--   1. nao alcanca quem nasceu do telefone do balcao e nao tem numero
--      proprio — a "Toca" com 12 reservas e exatamente esse caso;
--   2. a equipe pensa em "o Matheus e da Toca", e nao em "este numero e da
--      Toca".
--
-- O vinculo do telefone continua existindo e nao e apagado: ele ainda serve
-- para sugerir a empresa na proxima reserva.

ALTER TABLE "clientes" ADD COLUMN "empresa_id" TEXT;

CREATE INDEX "clientes_empresa_id_idx" ON "clientes"("empresa_id");

ALTER TABLE "clientes"
  ADD CONSTRAINT "clientes_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Preenchendo o que da para saber com seguranca
-- -----------------------------------------------------------------------------

-- (1) A empresa que o PROPRIO CLIENTE ja respondeu numa reserva. E a resposta
--     mais forte que existe: foi ele quem disse. Quando houver mais de uma,
--     vale a mais frequente.
WITH respondida AS (
  SELECT DISTINCT ON (r.cliente_id)
         r.cliente_id, r.empresa_id, count(*) AS vezes
    FROM "reservas" r
   WHERE r.empresa_id IS NOT NULL
   GROUP BY r.cliente_id, r.empresa_id
   ORDER BY r.cliente_id, count(*) DESC, r.empresa_id
)
UPDATE "clientes" c
   SET "empresa_id" = respondida.empresa_id
  FROM respondida
 WHERE c.id = respondida.cliente_id;

-- (2) O vinculo do TELEFONE, para quem ainda ficou sem.
--
--     TELEFONE DE BALCAO FICA DE FORA, de proposito: ele nao e de ninguem, e
--     em producao ele estava vinculado a uma empresa por engano. Deixar passar
--     poria as reservas de QUATRO clientes diferentes na conta de uma empresa
--     so — e o numero continuaria parecendo certo.
UPDATE "clientes" c
   SET "empresa_id" = te.empresa_id
  FROM "telefones_cliente" tc
  JOIN "telefones_empresa" te ON te.telefone = tc.telefone
 WHERE tc.cliente_id = c.id
   AND c."empresa_id" IS NULL
   AND NOT EXISTS (
         SELECT 1 FROM "telefones_balcao" b WHERE b.telefone = tc.telefone
       );
