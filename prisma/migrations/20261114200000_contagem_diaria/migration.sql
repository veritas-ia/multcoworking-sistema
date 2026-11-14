-- A CONTAGEM DIARIA: a ficha da parede, passada para o sistema.
--
-- POR QUE ELA E A ROTINA PRINCIPAL do estoque, e nao o lancamento de cada
-- reposicao: e o que a equipe JA FAZ, e ela e AUTOCORRETIVA. O que alguem
-- esqueceu de lancar aparece sozinho na contagem do dia seguinte, porque a
-- prateleira nao mente. O lancamento item a item e exato so se ninguem
-- esquecer — e quando alguem esquece, o sistema nunca descobre.
--
-- A CONTAGEM NAO SUBSTITUI OS MOVIMENTOS, ela os RECONCILIA: gravar uma
-- contagem gera um AJUSTE com a diferenca. O estoque continua sendo a soma dos
-- movimentos (uma fonte de verdade so) e o extrato continua respondendo "por
-- que esta em 3?".

-- --------------------------------------------------------------------------
-- COMO O CONSUMO DAQUELE PRODUTO E MEDIDO
--
-- Sao duas coisas diferentes de verdade, descobertas nas fichas:
--   ESTOQUE  — a equipe conta quantas unidades ha na prateleira;
--   CONTADOR — a maquina conta quantos ja fez na vida, e a equipe anota a
--              leitura. O Expresso foi 10939 -> 10949 -> 10958 nos dias 3, 4
--              e 5: o vendido no dia e a DIFERENCA entre duas leituras, e
--              "estoque de expresso" nao existe.
-- --------------------------------------------------------------------------
CREATE TYPE "TipoDeControle" AS ENUM ('ESTOQUE', 'CONTADOR');

ALTER TABLE "produtos"
  ADD COLUMN "controle" "TipoDeControle" NOT NULL DEFAULT 'ESTOQUE';

-- Os 12 botoes da maquina de cafe sao leitura de contador.
UPDATE "produtos" SET "controle" = 'CONTADOR' WHERE "nome" LIKE 'Café %';

CREATE TABLE "contagens_estoque" (
  "id"            TEXT NOT NULL,
  "dia"           DATE NOT NULL,
  "horario"       VARCHAR(5),
  "observacao"    TEXT,
  "criado_por_id" TEXT,
  "criado_em"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contagens_estoque_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contagens_estoque_dia_idx" ON "contagens_estoque"("dia");

ALTER TABLE "contagens_estoque"
  ADD CONSTRAINT "contagens_estoque_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- "09:40", como esta escrito na ficha. Formato torto aqui nao daria erro: a
-- hora so apareceria estranha na tela e ninguem saberia de onde veio.
ALTER TABLE "contagens_estoque"
  ADD CONSTRAINT "contagem_horario_valido" CHECK (
    "horario" IS NULL OR "horario" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  );

CREATE TABLE "itens_da_contagem" (
  "contagem_id" TEXT NOT NULL,
  "produto_id"  TEXT NOT NULL,
  "quantidade"  INTEGER NOT NULL,
  "esperado"    INTEGER NOT NULL,
  CONSTRAINT "itens_da_contagem_pkey" PRIMARY KEY ("contagem_id", "produto_id")
);

CREATE INDEX "itens_da_contagem_produto_id_idx" ON "itens_da_contagem"("produto_id");

-- CASCADE na contagem: apagar a ficha leva as linhas dela. RESTRICT no
-- produto: produto nunca se exclui, mesma regra de sempre.
ALTER TABLE "itens_da_contagem"
  ADD CONSTRAINT "itens_da_contagem_contagem_id_fkey"
  FOREIGN KEY ("contagem_id") REFERENCES "contagens_estoque"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "itens_da_contagem"
  ADD CONSTRAINT "itens_da_contagem_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Contar "menos cinco Suflair" nao existe. Numa leitura de maquina, zero e
-- valido (maquina nova); negativo, nunca.
ALTER TABLE "itens_da_contagem"
  ADD CONSTRAINT "contagem_quantidade_nao_negativa" CHECK ("quantidade" >= 0);
