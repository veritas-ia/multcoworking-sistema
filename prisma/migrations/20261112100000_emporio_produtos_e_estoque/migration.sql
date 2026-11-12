-- EMPORIO: produtos e estoque (Fase 15, Parte A).
--
-- O emporio JA e cobrado hoje, digitado a mao nas "Outras linhas" do controle
-- de horas. Isto existe para o valor parar de ser digitado.
--
-- O ESTOQUE E UMA LISTA DE MOVIMENTOS, e nao um numero na linha do produto.
-- Um numero solto responde "o estoque esta em 3" e nada mais; quando ele
-- estiver errado — e vai estar, porque a reposicao e lancada a mao — ninguem
-- consegue dizer de onde veio o 3.

CREATE TYPE "TipoMovimentoEstoque" AS ENUM ('REPOSICAO', 'VENDA', 'PERDA', 'AJUSTE');

CREATE TABLE "produtos" (
  "id"            TEXT NOT NULL,
  "nome"          TEXT NOT NULL,
  "preco"         DECIMAL(10,2) NOT NULL,
  "ativo"         BOOLEAN NOT NULL DEFAULT true,
  "ordem"         INTEGER NOT NULL,
  "criado_em"     TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "produtos_nome_key" ON "produtos"("nome");
CREATE INDEX "produtos_ativo_ordem_idx" ON "produtos"("ativo", "ordem");

-- Preco negativo nao existe. Zero existe: brinde, cortesia, agua.
ALTER TABLE "produtos"
  ADD CONSTRAINT "produto_preco_nao_negativo" CHECK ("preco" >= 0);

CREATE TABLE "movimentos_estoque" (
  "id"             TEXT NOT NULL,
  "produto_id"     TEXT NOT NULL,
  "tipo"           "TipoMovimentoEstoque" NOT NULL,
  "quantidade"     INTEGER NOT NULL,
  "motivo"         TEXT,
  "criado_por_id"  TEXT,
  "criado_em"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movimentos_estoque_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "movimentos_estoque_produto_id_criado_em_idx"
  ON "movimentos_estoque"("produto_id", "criado_em");

-- Produto com movimento NAO se apaga. Mesma regra de salas, empresas e areas
-- de atuacao: apagar tiraria o historico de vendas em silencio.
ALTER TABLE "movimentos_estoque"
  ADD CONSTRAINT "movimentos_estoque_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Quem lancou. ON DELETE SET NULL porque usuario desligado nao e excluido,
-- mas se um dia for, o movimento nao pode desaparecer com ele.
ALTER TABLE "movimentos_estoque"
  ADD CONSTRAINT "movimentos_estoque_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- A TRAVA QUE IMPORTA: o sinal da quantidade tem de combinar com o tipo.
--
-- O estoque e a SOMA das quantidades. Uma REPOSICAO gravada com -10, ou uma
-- VENDA com +1, somaria para o lado errado — e o numero continuaria parecendo
-- certo, porque ninguem confere o sinal de cada linha. Por isso a regra e do
-- banco, e nao so da aplicacao.
--
-- AJUSTE vai para os dois lados de proposito (a contagem na prateleira pode
-- estar acima ou abaixo), mas nunca pode ser zero: um movimento que nao move
-- nada so suja o historico.
ALTER TABLE "movimentos_estoque"
  ADD CONSTRAINT "movimento_sinal_do_tipo" CHECK (
    ("tipo" = 'REPOSICAO' AND "quantidade" > 0)
    OR ("tipo" IN ('VENDA', 'PERDA') AND "quantidade" < 0)
    OR ("tipo" = 'AJUSTE' AND "quantidade" <> 0)
  );

-- AJUSTE exige explicacao escrita. Daqui a seis meses ninguem lembra por que o
-- estoque foi corrigido, e sem motivo a proxima pessoa corrige de novo.
ALTER TABLE "movimentos_estoque"
  ADD CONSTRAINT "movimento_ajuste_exige_motivo" CHECK (
    "tipo" <> 'AJUSTE' OR (COALESCE(BTRIM("motivo"), '') <> '')
  );
