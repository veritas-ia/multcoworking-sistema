-- O DEMONSTRATIVO MENSAL DO CLIENTE.
--
-- A gestao fazia isto numa planilha, a mao. A planilha de setembro da Toca
-- nao tinha UMA formula: o "52 horas" e o "R$ 3.033,66" eram texto digitado,
-- e os dois estavam errados — a soma das linhas dava 50 h e R$ 3.023,66.
-- Foram R$ 70 cobrados a mais, e ninguem tinha como perceber.

-- O preco por hora COMBINADO com o cliente. A Toca paga R$ 30 numa sala de
-- R$ 40: o valor congelado na reserva e o da tabela e nao serve aqui.
ALTER TABLE "clientes" ADD COLUMN "preco_hora_acordado" DECIMAL(10,2);

CREATE TABLE "demonstrativos" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "de" DATE NOT NULL,
    "ate" DATE NOT NULL,
    "valor_hora" DECIMAL(10,2) NOT NULL,
    "horas" DECIMAL(10,2) NOT NULL,
    -- A tabela de horas e as linhas digitadas, congeladas na emissao: se uma
    -- reserva for remarcada depois, o documento que o cliente recebeu continua
    -- batendo com o que foi enviado.
    "itens" JSONB NOT NULL,
    "linhas_extras" JSONB NOT NULL,
    "total_ajustado" DECIMAL(10,2),
    "enviado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demonstrativos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demonstrativos_cliente_id_de_idx" ON "demonstrativos"("cliente_id", "de");

ALTER TABLE "demonstrativos"
  ADD CONSTRAINT "demonstrativos_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- O periodo tem de fazer sentido. Sem isto, um "de" depois do "ate" geraria
-- um documento vazio e ninguem entenderia por que.
ALTER TABLE "demonstrativos"
  ADD CONSTRAINT "demonstrativo_periodo_coerente" CHECK ("ate" >= "de");
