-- FASE 16, PARTE C — os espacos de locacao mensal e as mensalidades.
--
-- O QUE ISTO TRAZ PARA DENTRO DO SISTEMA: as salas privativas alugadas por
-- MES, que e de onde vem a maior parte do dinheiro do coworking e que o
-- sistema nunca viu. Ele cuidava das 3 salas alugadas por HORA.
--
-- POR QUE OS ESPACOS NAO ENTRAM NA TABELA "salas", e isto e o ponto:
-- "salas" e a tabela da AGENDA. Uma linha ali aparece no site publico para
-- qualquer um reservar, entra na grade de disponibilidade, nos relatorios de
-- reserva e nas travas de sobreposicao. Pondo os espacos mensais la, a Fase 16
-- estragaria o que ja funciona — e um cliente poderia reservar por hora a sala
-- que outro aluga por mes.

-- -----------------------------------------------------------------------------
-- Os espacos
-- -----------------------------------------------------------------------------

CREATE TABLE "espacos" (
  "id"            TEXT NOT NULL,
  "nome"          TEXT NOT NULL,
  "ativo"         BOOLEAN NOT NULL DEFAULT true,
  "ordem"         INTEGER NOT NULL,
  "observacao"    TEXT,
  "criado_em"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "espacos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "espacos_nome_key" ON "espacos" ("nome");
CREATE INDEX "espacos_ativo_ordem_idx" ON "espacos" ("ativo", "ordem");

-- -----------------------------------------------------------------------------
-- Os contratos de mensalidade
-- -----------------------------------------------------------------------------

CREATE TABLE "contratos_mensais" (
  "id"          TEXT NOT NULL,

  -- QUEM PAGA: uma pessoa ou uma empresa, nunca as duas. O demonstrativo ja
  -- aceita os dois desde 11/11, e pela mesma razao: "Para: Toca Imobiliaria"
  -- no cabecalho e a empresa, nao uma pessoa.
  "cliente_id"  TEXT,
  "empresa_id"  TEXT,

  -- O espaco ocupado. NULO e legitimo: ha mensalista que paga pelo acesso e
  -- pelas horas inclusas, sem sala propria.
  "espaco_id"   TEXT,

  "valor_mensal" DECIMAL(10,2) NOT NULL,

  -- O dia do mes. 1 a 31; quem nao existe no mes (31 em fevereiro) cai no
  -- ultimo dia dele, e quem faz essa conta e a aplicacao.
  "dia_vencimento" INTEGER NOT NULL,

  -- HORAS DE SALA INCLUSAS na mensalidade. NULO = sem cota (toda hora e
  -- cobrada). Quem usa isto para descontar e a Parte D; aqui e so o dado do
  -- contrato.
  "cota_horas"  INTEGER,

  "inicio"      DATE NOT NULL,
  -- NULO = vigente. Preenchido = o contrato terminou naquele dia.
  "fim"         DATE,

  "ativo"       BOOLEAN NOT NULL DEFAULT true,
  "observacao"  TEXT,

  "criado_em"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contratos_mensais_pkey" PRIMARY KEY ("id"),

  -- UM pagador, e exatamente um. Nenhum deixaria a cobranca sem dono; os dois
  -- deixariam a tela sem saber para quem emitir.
  CONSTRAINT "contrato_um_pagador_so" CHECK (
    ("cliente_id" IS NOT NULL AND "empresa_id" IS NULL)
    OR ("cliente_id" IS NULL AND "empresa_id" IS NOT NULL)
  ),

  CONSTRAINT "contrato_valor_positivo" CHECK ("valor_mensal" > 0),

  CONSTRAINT "contrato_dia_de_vencimento" CHECK (
    "dia_vencimento" BETWEEN 1 AND 31
  ),

  -- Cota de horas negativa nao significa nada. Zero tambem nao: quem nao tem
  -- cota deixa NULO, e zero diria "tem cota, de zero hora" — que e a mesma
  -- coisa dita de um jeito que a tela leria como "tem plano com horas".
  CONSTRAINT "contrato_cota_positiva" CHECK (
    "cota_horas" IS NULL OR "cota_horas" > 0
  ),

  CONSTRAINT "contrato_fim_depois_do_inicio" CHECK (
    "fim" IS NULL OR "fim" >= "inicio"
  )
);

ALTER TABLE "contratos_mensais"
  ADD CONSTRAINT "contratos_mensais_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contratos_mensais"
  ADD CONSTRAINT "contratos_mensais_empresa_id_fkey"
  FOREIGN KEY ("empresa_id") REFERENCES "empresas" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contratos_mensais"
  ADD CONSTRAINT "contratos_mensais_espaco_id_fkey"
  FOREIGN KEY ("espaco_id") REFERENCES "espacos" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "contratos_mensais_cliente_id_idx" ON "contratos_mensais" ("cliente_id");
CREATE INDEX "contratos_mensais_empresa_id_idx" ON "contratos_mensais" ("empresa_id");
CREATE INDEX "contratos_mensais_espaco_id_idx" ON "contratos_mensais" ("espaco_id");
CREATE INDEX "contratos_mensais_ativo_idx" ON "contratos_mensais" ("ativo");

-- -----------------------------------------------------------------------------
-- A cobranca da mensalidade e um lancamento, ligado ao contrato
-- -----------------------------------------------------------------------------

ALTER TABLE "lancamentos" ADD COLUMN "contrato_id" TEXT;

-- O MES COBRADO, como "2026-12". Nao e o vencimento: o contrato que vence dia
-- 10 cobra dezembro em 10/12, e o que vence dia 5 cobra dezembro em 05/12 —
-- os dois sao a mensalidade DE dezembro.
ALTER TABLE "lancamentos" ADD COLUMN "competencia" TEXT;

ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamentos_contrato_id_fkey"
  FOREIGN KEY ("contrato_id") REFERENCES "contratos_mensais" ("id")
  -- SET NULL pela mesma razao da reserva: o contrato pode ser apagado um dia,
  -- e o dinheiro que entrou nao pode desaparecer do caixa junto. Solto, o
  -- lancamento fica de pe e vira manual.
  ON DELETE SET NULL ON UPDATE CASCADE;

-- UMA COBRANCA POR CONTRATO POR MES. E esta trava que faz "gerar as
-- mensalidades de dezembro" poder ser clicado duas vezes sem cobrar em dobro —
-- e sem ela, dois cliques dobrariam a receita do mes e cada linha continuaria
-- parecendo certa.
CREATE UNIQUE INDEX "lancamentos_contrato_competencia_key"
  ON "lancamentos" ("contrato_id", "competencia")
  WHERE "contrato_id" IS NOT NULL;

CREATE INDEX "lancamentos_competencia_idx" ON "lancamentos" ("competencia");

-- CONTRATO EXIGE COMPETENCIA, mas NAO o contrario — e a direcao importa.
--
-- Um lancamento ligado a um contrato sem dizer que mes ele cobre deixaria a
-- trava de cima sem efeito: sem a competencia, nada impediria duas cobrancas
-- do mesmo mes.
--
-- O CONTRARIO E LEGITIMO, e exigir os dois era um erro meu: a chave do
-- contrato e ON DELETE SET NULL, e o banco zera "contrato_id" sem ter como
-- zerar outra coluna junto. Com a trava nos dois sentidos, apagar um contrato
-- era IMPOSSIVEL — e o jeito de "consertar" seria apagar a cobranca junto,
-- fazendo o dinheiro recebido desaparecer do caixa.
--
-- Competencia sozinha tambem nao e lixo: ela guarda qual mes aquela linha
-- cobriu, que continua sendo verdade depois do contrato sumir.
ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamento_competencia_com_contrato" CHECK (
    "contrato_id" IS NULL OR "competencia" IS NOT NULL
  );

-- As tres origens automaticas sao exclusivas entre si. A trava antiga cobria
-- reserva x emporio; agora o contrato entra na conta.
ALTER TABLE "lancamentos" DROP CONSTRAINT "lancamento_uma_origem_so";

ALTER TABLE "lancamentos"
  ADD CONSTRAINT "lancamento_uma_origem_so" CHECK (
    (
      ("reserva_id" IS NOT NULL)::int
      + ("emporio_dia" IS NOT NULL)::int
      + ("contrato_id" IS NOT NULL)::int
    ) <= 1
  );
