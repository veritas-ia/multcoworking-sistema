-- CATEGORIA DE PROFISSAO DO CLIENTE.
--
-- Serve ao relatorio do painel: em que areas estao as pessoas que usam o
-- coworking. NAO entra em preco nem em disponibilidade.
--
-- A coluna aceita NULO de proposito. Toda reserva criada de agora em diante
-- e obrigada a informar — quem cobra isso e a aplicacao —, mas as reservas
-- que ja existem nunca foram perguntadas, e preencher um valor agora seria
-- inventar informacao que o cliente nunca deu. No relatorio elas aparecem
-- como "nao informado".
CREATE TYPE "CategoriaProfissao" AS ENUM (
  'MARKETING',
  'JURIDICO',
  'CONTABIL',
  'SAUDE',
  'OUTROS'
);

ALTER TABLE "reservas" ADD COLUMN "profissao" "CategoriaProfissao";

-- O relatorio agrupa por profissao dentro de um periodo; sem este indice a
-- consulta varre a tabela inteira a cada troca de filtro.
CREATE INDEX "reservas_profissao_inicio_idx" ON "reservas" ("profissao", "inicio");
