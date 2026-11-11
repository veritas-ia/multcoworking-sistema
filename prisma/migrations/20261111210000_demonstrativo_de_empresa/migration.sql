-- O DEMONSTRATIVO PASSA A PODER SER DE UMA EMPRESA INTEIRA.
--
-- A planilha que a gestao usava e endereçada "Para: Toca Imobiliaria" — a
-- empresa, e nao uma pessoa. O documento por cliente obrigaria a gestao a
-- gerar quatro e somar a mao, que e exatamente o trabalho que esta tela veio
-- tirar.
ALTER TABLE "demonstrativos" ALTER COLUMN "cliente_id" DROP NOT NULL;
ALTER TABLE "demonstrativos" ADD COLUMN "empresa_id" TEXT;

CREATE INDEX "demonstrativos_empresa_id_de_idx" ON "demonstrativos"("empresa_id", "de");

ALTER TABLE "demonstrativos"
  ADD CONSTRAINT "demonstrativos_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- UM dos dois tem de estar preenchido. Sem a trava, um documento sem dono
-- nenhum sairia em branco no "Para" e ninguem entenderia de quem e.
ALTER TABLE "demonstrativos"
  ADD CONSTRAINT "demonstrativo_tem_dono"
  CHECK (("cliente_id" IS NOT NULL) <> ("empresa_id" IS NOT NULL));
