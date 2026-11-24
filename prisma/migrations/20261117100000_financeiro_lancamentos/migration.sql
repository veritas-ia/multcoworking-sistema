-- FASE 16, PARTE A — a fundacao do lancamento financeiro.
--
-- O QUE ESTA MIGRACAO FAZ: cria tres tabelas novas e enche a de categorias.
-- Ela NAO religa nenhuma linha existente e NAO toca em reserva, cliente nem
-- consumo — por isso nao precisou do ensaio numa copia de producao que a
-- Fase 14 exigiu. O que ela acrescenta nasce vazio.
--
-- AS CATEGORIAS ENTRAM AQUI, E NAO NO SEED: o deploy roda `migrate deploy` e
-- NAO roda o seed. Categoria so no seed deixaria a tela de lancamento sem
-- opcao nenhuma em producao, e o primeiro lancamento seria impossivel.

CREATE TYPE "TipoDeLancamento" AS ENUM ('ENTRADA', 'SAIDA');

-- -----------------------------------------------------------------------------
-- As categorias
-- -----------------------------------------------------------------------------

CREATE TABLE "categorias_financeiras" (
  "id"            TEXT NOT NULL,
  "nome"          TEXT NOT NULL,
  "tipo"          "TipoDeLancamento" NOT NULL,
  "slug"          TEXT NOT NULL,
  "ativa"         BOOLEAN NOT NULL DEFAULT true,
  "ordem"         INTEGER NOT NULL,
  "criado_em"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "categorias_financeiras_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categorias_financeiras_slug_key"
  ON "categorias_financeiras" ("slug");

-- Mesmo nome dentro do MESMO lado e erro. "Impostos" como entrada e como
-- saida, nao: sao coisas diferentes.
CREATE UNIQUE INDEX "categorias_financeiras_tipo_nome_key"
  ON "categorias_financeiras" ("tipo", "nome");

CREATE INDEX "categorias_financeiras_tipo_ativa_ordem_idx"
  ON "categorias_financeiras" ("tipo", "ativa", "ordem");

-- -----------------------------------------------------------------------------
-- Os fornecedores
-- -----------------------------------------------------------------------------

CREATE TABLE "fornecedores" (
  "id"            TEXT NOT NULL,
  "nome"          TEXT NOT NULL,
  "ativo"         BOOLEAN NOT NULL DEFAULT true,
  "observacao"    TEXT,
  "criado_em"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fornecedores_nome_key" ON "fornecedores" ("nome");
CREATE INDEX "fornecedores_ativo_nome_idx" ON "fornecedores" ("ativo", "nome");

-- -----------------------------------------------------------------------------
-- Os lancamentos
-- -----------------------------------------------------------------------------

CREATE TABLE "lancamentos" (
  "id"                  TEXT NOT NULL,
  "descricao"           TEXT NOT NULL,
  "valor"               DECIMAL(10,2) NOT NULL,
  "categoria_id"        TEXT NOT NULL,
  "cliente_id"          TEXT,
  "empresa_id"          TEXT,
  "fornecedor_id"       TEXT,
  "forma_pagamento_id"  TEXT,
  "vencimento"          DATE NOT NULL,
  -- NULO = ainda nao aconteceu. Nao existe coluna de situacao: "pendente",
  -- "pago" e "atrasado" saem daqui e do vencimento. Uma coluna de status
  -- exigiria rotina virando-a todo dia, e com CRON_ATIVO="false" nada ficaria
  -- atrasado nunca — sem erro aparecer em lugar nenhum.
  "pago_em"             DATE,
  "observacao"          TEXT,
  "criado_por_id"       TEXT,
  -- O nome vai gravado junto com a chave: o usuario pode ser desligado, e
  -- "alguem lancou isso" nao explica nada seis meses depois.
  "criado_por_nome"     TEXT,
  "criado_em"           TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "lancamentos_pkey" PRIMARY KEY ("id"),

  -- O VALOR E SEMPRE POSITIVO. Quem diz o lado e a categoria. Sem esta trava,
  -- uma "entrada de -200" subtrairia do caixa e o numero continuaria
  -- parecendo certo na lista.
  CONSTRAINT "lancamento_valor_positivo" CHECK ("valor" > 0),

  -- Cliente E fornecedor juntos nao existe: ou o dinheiro veio de um cliente,
  -- ou foi para um fornecedor. Os dois preenchidos deixariam o relatorio sem
  -- saber de quem e a linha.
  CONSTRAINT "lancamento_cliente_ou_fornecedor" CHECK (
    "cliente_id" IS NULL OR "fornecedor_id" IS NULL
  )
);

-- RESTRICT em tudo que guarda historico: apagar uma categoria ou um
-- fornecedor com lancamento tiraria a linha do relatorio em silencio. Nao ha
-- tela para apagar nenhum dos dois — desliga-se.
ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_categoria_id_fkey"
  FOREIGN KEY ("categoria_id") REFERENCES "categorias_financeiras" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_fornecedor_id_fkey"
  FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_forma_pagamento_id_fkey"
  FOREIGN KEY ("forma_pagamento_id") REFERENCES "formas_pagamento" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- SET NULL no autor: o usuario pode ser desligado e apagado um dia, e o
-- lancamento nao pode ir junto. O nome gravado na linha segura a evidencia.
ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "lancamentos_vencimento_idx"     ON "lancamentos" ("vencimento");
CREATE INDEX "lancamentos_pago_em_idx"        ON "lancamentos" ("pago_em");
CREATE INDEX "lancamentos_categoria_id_idx"   ON "lancamentos" ("categoria_id");
CREATE INDEX "lancamentos_cliente_id_idx"     ON "lancamentos" ("cliente_id");
CREATE INDEX "lancamentos_empresa_id_idx"     ON "lancamentos" ("empresa_id");
CREATE INDEX "lancamentos_fornecedor_id_idx"  ON "lancamentos" ("fornecedor_id");

-- -----------------------------------------------------------------------------
-- AS CATEGORIAS DE SAIDA: as treze que o dono listou na conversa que originou
-- esta fase, mais "Compras do emporio" — a reposicao da geladeira e do
-- expositor e despesa real e mensal, e sem categoria propria ela cairia em
-- "Outras despesas", onde ninguem conseguiria medir a margem do emporio
-- depois. Entram todas ligadas; a equipe desliga o que nao usar.
-- -----------------------------------------------------------------------------

INSERT INTO "categorias_financeiras" ("id", "nome", "tipo", "slug", "ordem")
VALUES
  (gen_random_uuid()::text, 'Aluguel',                 'SAIDA', 'aluguel',        1),
  (gen_random_uuid()::text, 'Energia',                 'SAIDA', 'energia',        2),
  (gen_random_uuid()::text, 'Água',                    'SAIDA', 'agua',           3),
  (gen_random_uuid()::text, 'Internet',                'SAIDA', 'internet',       4),
  (gen_random_uuid()::text, 'Limpeza',                 'SAIDA', 'limpeza',        5),
  (gen_random_uuid()::text, 'Manutenção',              'SAIDA', 'manutencao',     6),
  (gen_random_uuid()::text, 'Funcionários',            'SAIDA', 'funcionarios',   7),
  (gen_random_uuid()::text, 'Contabilidade',           'SAIDA', 'contabilidade',  8),
  (gen_random_uuid()::text, 'Impostos',                'SAIDA', 'impostos',       9),
  (gen_random_uuid()::text, 'Marketing',               'SAIDA', 'marketing',     10),
  (gen_random_uuid()::text, 'Material de escritório',  'SAIDA', 'material',      11),
  (gen_random_uuid()::text, 'Taxas de cartão',         'SAIDA', 'taxas-cartao',  12),
  (gen_random_uuid()::text, 'Compras do empório',      'SAIDA', 'compras-emporio', 13),
  (gen_random_uuid()::text, 'Outras despesas',         'SAIDA', 'outras-despesas', 14);

-- -----------------------------------------------------------------------------
-- AS CATEGORIAS DE ENTRADA.
--
-- "Mensalidades", "Reservas de sala" e "Empório" sao as tres fontes que o
-- sistema conhece — e e nelas que a Parte B vai pendurar o lancamento
-- automatico da reserva e do consumo.
-- -----------------------------------------------------------------------------

INSERT INTO "categorias_financeiras" ("id", "nome", "tipo", "slug", "ordem")
VALUES
  (gen_random_uuid()::text, 'Mensalidades',     'ENTRADA', 'mensalidades',    1),
  (gen_random_uuid()::text, 'Reservas de sala', 'ENTRADA', 'reservas',        2),
  (gen_random_uuid()::text, 'Empório',          'ENTRADA', 'emporio',         3),
  (gen_random_uuid()::text, 'Outras receitas',  'ENTRADA', 'outras-receitas', 4);

-- CONFERENCIA: se o numero nao bater, a migracao inteira e desfeita. Sem
-- isto, um INSERT recusado em silencio deixaria a tela sem categoria e o erro
-- so apareceria quando alguem tentasse lancar.
DO $$
DECLARE
  quantas INTEGER;
BEGIN
  SELECT COUNT(*) INTO quantas FROM "categorias_financeiras";

  IF quantas <> 18 THEN
    RAISE EXCEPTION 'esperava 18 categorias, encontrei %', quantas;
  END IF;
END $$;
