-- O CONSUMO DO EMPORIO: cada linha da ficha fisica virando um lancamento.
--
-- POR QUE: hoje a recepcionista le a ficha, SOMA DE CABECA por cliente e
-- digita uma linha de texto no controle de horas, com o total escrito a mao
-- ("EMPORIO 12 aguas sem gas/10 aguas com gas/... R$ 201,50"). E o mesmo tipo
-- de numero digitado sem conferencia que gerou os R$ 70 cobrados a mais na
-- planilha da Toca.
--
-- A recepcionista JA lanca todo dia (confirmado pelo dono), entao o volume de
-- digitacao nao muda muito: o que muda e QUEM SOMA.

-- --------------------------------------------------------------------------
-- QUANDO o consumo e pago. As duas unicas formas que existem: "nao existe
-- comanda" (palavra do dono).
-- --------------------------------------------------------------------------
CREATE TYPE "MomentoDoPagamento" AS ENUM ('NA_HORA', 'NA_MENSALIDADE');

-- --------------------------------------------------------------------------
-- A FORMA de pagamento e TABELA, nao enum — mesma decisao das areas de
-- atuacao e das etiquetas. Um enum do PostgreSQL aceita acrescentar valor mas
-- NUNCA remover, e esta e exatamente a lista que muda sem avisar programador.
-- --------------------------------------------------------------------------
CREATE TABLE "formas_pagamento" (
  "id"        TEXT NOT NULL,
  "nome"      TEXT NOT NULL,
  "ativa"     BOOLEAN NOT NULL DEFAULT true,
  "ordem"     INTEGER NOT NULL,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "formas_pagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "formas_pagamento_nome_key" ON "formas_pagamento"("nome");
CREATE INDEX "formas_pagamento_ativa_ordem_idx" ON "formas_pagamento"("ativa", "ordem");

-- O PIX e o unico CONFIRMADO: a plaquinha do emporio diz "PAGAMENTO DE
-- INSUMOS DO EMPORIO MULT POR PIX", com o CNPJ como chave. Dinheiro e cartao
-- entram porque sao o resto do balcao de qualquer lugar — se nao forem
-- usados, a equipe desliga no painel, sem migracao.
INSERT INTO "formas_pagamento" ("id", "nome", "ordem") VALUES
  (gen_random_uuid()::text, 'Pix',      1),
  (gen_random_uuid()::text, 'Dinheiro', 2),
  (gen_random_uuid()::text, 'Cartão',   3);

CREATE TABLE "consumos_emporio" (
  "id"                 TEXT NOT NULL,
  "cliente_id"         TEXT NOT NULL,
  "produto_id"         TEXT NOT NULL,
  "quantidade"         INTEGER NOT NULL,
  "preco_unitario"     DECIMAL(10,2) NOT NULL,
  "valor"              DECIMAL(10,2) NOT NULL,
  "consumido_em"       TIMESTAMPTZ(3) NOT NULL,
  "sala_id"            TEXT,
  "momento"            "MomentoDoPagamento" NOT NULL,
  "forma_pagamento_id" TEXT,
  "criado_por_id"      TEXT,
  "criado_em"          TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consumos_emporio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "consumos_emporio_cliente_id_consumido_em_idx"
  ON "consumos_emporio"("cliente_id", "consumido_em");
CREATE INDEX "consumos_emporio_consumido_em_idx" ON "consumos_emporio"("consumido_em");
CREATE INDEX "consumos_emporio_produto_id_idx" ON "consumos_emporio"("produto_id");

-- RESTRICT em tudo: cliente, produto e sala nunca se excluem neste sistema, e
-- o consumo e historico de cobranca.
ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumos_emporio_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumos_emporio_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumos_emporio_sala_id_fkey"
  FOREIGN KEY ("sala_id") REFERENCES "salas"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumos_emporio_forma_pagamento_id_fkey"
  FOREIGN KEY ("forma_pagamento_id") REFERENCES "formas_pagamento"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumos_emporio_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Consumir "zero barrinhas" ou "menos uma" nao existe.
ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumo_quantidade_positiva" CHECK ("quantidade" > 0);

-- Preco e valor negativos nao existem. Zero existe: o cafe e cortesia, e o
-- consumo dele precisa ser registrado do mesmo jeito.
ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumo_valores_nao_negativos"
  CHECK ("preco_unitario" >= 0 AND "valor" >= 0);

-- A FORMA DE PAGAMENTO SO EXISTE NO "NA_HORA".
--
-- No NA_MENSALIDADE ainda nao foi pago: gravar uma forma ali seria dizer que
-- aconteceu algo que nao aconteceu, e o relatorio de formas de pagamento
-- passaria a contar dinheiro que ninguem recebeu.
ALTER TABLE "consumos_emporio"
  ADD CONSTRAINT "consumo_forma_so_quando_pago" CHECK (
    "momento" = 'NA_HORA' OR "forma_pagamento_id" IS NULL
  );
