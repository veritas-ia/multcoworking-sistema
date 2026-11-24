-- FASE 16, PARTE B — o lancamento ESPELHA a origem.
--
-- O QUE ISTO RESOLVE: hoje a receita de reserva e de emporio existe no
-- relatorio mas nao no caixa. Digitar de novo no financeiro criaria DOIS
-- numeros para o mesmo dinheiro — a doenca da planilha da Toca, onde o total
-- digitado dizia R$ 3.033 e as linhas somavam R$ 3.023. Entao o lancamento
-- APONTA para a origem em vez de ser redigitado.
--
-- POR QUE O EMPORIO E AGRUPADO POR DIA E O RESERVA NAO:
-- uma barrinha de R$ 6,50 por linha daria ~150 linhas de emporio por mes,
-- afogando as ~20 contas de verdade. O dinheiro tambem nao chega assim: chega
-- como UM comprovante de Pix do dia. A reserva, ao contrario, e paga uma por
-- uma no balcao — e la uma linha por reserva e exatamente o que aconteceu.

-- -----------------------------------------------------------------------------
-- A reserva paga no balcao
-- -----------------------------------------------------------------------------

ALTER TABLE "lancamentos" ADD COLUMN "reserva_id" TEXT;

ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_reserva_id_fkey"
  FOREIGN KEY ("reserva_id") REFERENCES "reservas" ("id")
  -- SET NULL, e nao RESTRICT: a reserva PODE ser excluida (com evidencia,
  -- desde 13/11). Se levasse o lancamento junto, o dinheiro que entrou no
  -- caixa desapareceria dele — e o caixa de um mes fechado mudaria sozinho.
  -- Solto, o lancamento continua de pe e vira manual.
  ON DELETE SET NULL ON UPDATE CASCADE;

-- UMA reserva, UM lancamento. Sem isto, dois cliques no "Recebi" criariam
-- duas entradas do mesmo dinheiro e o faturamento do mes sairia dobrado.
CREATE UNIQUE INDEX "lancamentos_reserva_id_key"
  ON "lancamentos" ("reserva_id");

-- -----------------------------------------------------------------------------
-- O emporio pago na hora, agrupado por dia e forma de pagamento
-- -----------------------------------------------------------------------------

ALTER TABLE "lancamentos" ADD COLUMN "emporio_dia" DATE;

-- UMA linha por dia e por forma. A forma entra na chave porque o dinheiro
-- chega separado: o Pix do dia e um comprovante, o dinheiro da gaveta e
-- outro, e juntar os dois numa linha esconderia de onde veio.
--
-- COALESCE no indice: forma NULA e um valor legitimo aqui (consumo pago na
-- hora sem forma anotada), e no Postgres dois NULOs nao colidem num indice
-- unico — sem isto, cada sincronizacao criaria mais uma linha "sem forma".
CREATE UNIQUE INDEX "lancamentos_emporio_dia_forma_key"
  ON "lancamentos" ("emporio_dia", COALESCE("forma_pagamento_id", ''))
  WHERE "emporio_dia" IS NOT NULL;

CREATE INDEX "lancamentos_emporio_dia_idx" ON "lancamentos" ("emporio_dia");

-- -----------------------------------------------------------------------------
-- As duas origens sao exclusivas entre si
-- -----------------------------------------------------------------------------

-- Um lancamento espelha UMA origem, ou nenhuma (o digitado a mao). Os dois
-- preenchidos nao significam nada, e a tela nao saberia o que mostrar.
ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamento_uma_origem_so" CHECK (
    "reserva_id" IS NULL OR "emporio_dia" IS NULL
  );
