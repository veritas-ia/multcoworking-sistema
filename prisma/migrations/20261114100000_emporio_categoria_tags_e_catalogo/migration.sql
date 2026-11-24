-- CATEGORIA, ETIQUETAS E O CATALOGO DE VERDADE DO EMPORIO.
--
-- Os produtos e os precos vieram das fichas fisicas e das plaquinhas do
-- coworking, conferidos um a um: a lista da geladeira bateu com a tabela de
-- precos colada na porta (10 de 10), e a do chocolate bateu com as etiquetas
-- do expositor (8 de 8).
--
-- ENTRA PELA MIGRACAO, NAO PELO SEED: o deploy roda "migrate deploy" e NAO
-- roda o seed. Um catalogo so no seed nunca chegaria em producao, e a tela de
-- lancamento nasceria vazia.

CREATE TYPE "CategoriaDoProduto" AS ENUM ('COMIDA', 'BEBIDA');

-- Sem DEFAULT depois de preenchida: toda linha nova tem de dizer de qual
-- prateleira ela e. Um padrao silencioso poria bebida na ficha da comida.
ALTER TABLE "produtos" ADD COLUMN "categoria" "CategoriaDoProduto";

CREATE TABLE "tags_produto" (
  "id"        TEXT NOT NULL,
  "nome"      TEXT NOT NULL,
  "cor"       VARCHAR(7) NOT NULL,
  "ativa"     BOOLEAN NOT NULL DEFAULT true,
  "ordem"     INTEGER NOT NULL,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tags_produto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_produto_nome_key" ON "tags_produto"("nome");
CREATE INDEX "tags_produto_ativa_ordem_idx" ON "tags_produto"("ativa", "ordem");

-- A cor e escrita na tela: formato torto viraria etiqueta invisivel, sem erro
-- nenhum aparecer.
ALTER TABLE "tags_produto"
  ADD CONSTRAINT "tag_cor_hexadecimal" CHECK ("cor" ~ '^#[0-9A-Fa-f]{6}$');

CREATE TABLE "produtos_com_tag" (
  "produto_id" TEXT NOT NULL,
  "tag_id"     TEXT NOT NULL,
  CONSTRAINT "produtos_com_tag_pkey" PRIMARY KEY ("produto_id", "tag_id")
);

CREATE INDEX "produtos_com_tag_tag_id_idx" ON "produtos_com_tag"("tag_id");

-- CASCADE aqui NAO fere a regra de "nunca excluir": o que se apaga e a
-- LIGACAO, e nao o produto nem a etiqueta. Produto continua protegido pela
-- chave RESTRICT dos movimentos de estoque.
ALTER TABLE "produtos_com_tag"
  ADD CONSTRAINT "produtos_com_tag_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "produtos_com_tag"
  ADD CONSTRAINT "produtos_com_tag_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags_produto"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- AS ETIQUETAS
-- --------------------------------------------------------------------------
INSERT INTO "tags_produto" ("id", "nome", "cor", "ordem") VALUES
  (gen_random_uuid()::text, 'Chocolate',    '#6F4421', 1),
  (gen_random_uuid()::text, 'Biscoito',     '#B8862B', 2),
  (gen_random_uuid()::text, 'Proteína',     '#C2410C', 3),
  (gen_random_uuid()::text, 'Água',         '#0E7490', 4),
  (gen_random_uuid()::text, 'Refrigerante', '#B91C1C', 5),
  (gen_random_uuid()::text, 'Suco',         '#C2410C', 6),
  (gen_random_uuid()::text, 'Energético',   '#6D28D9', 7),
  (gen_random_uuid()::text, 'Cerveja',      '#A16207', 8),
  (gen_random_uuid()::text, 'Café',         '#44302A', 9);

-- --------------------------------------------------------------------------
-- O CATALOGO
--
-- A ordem segue a das fichas, para a equipe lancar na mesma sequencia em que
-- le o papel. Trocar a ordem na tela depois e um clique.
-- --------------------------------------------------------------------------
INSERT INTO "produtos" ("id", "nome", "categoria", "preco", "ordem", "atualizado_em") VALUES
  -- Ficha "CHOCOLATE"
  (gen_random_uuid()::text, 'Suflair',                     'COMIDA',  7.50,  1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Kit Kat',                     'COMIDA',  6.50,  2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Baton',                       'COMIDA',  2.50,  3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Chokito',                     'COMIDA',  4.00,  4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Cookies',                     'COMIDA',  4.50,  5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Chocobiscuit',                'COMIDA',  7.50,  6, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Stick',                       'COMIDA',  3.80,  7, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Barrinha Proteína',           'COMIDA', 12.00,  8, CURRENT_TIMESTAMP),
  -- Ficha "GELADEIRA"
  (gen_random_uuid()::text, 'Água com gás',                'BEBIDA',  4.00,  9, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Água sem gás',                'BEBIDA',  3.00, 10, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Energético',                  'BEBIDA', 14.00, 11, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Refrigerante lata 350ml',     'BEBIDA',  6.00, 12, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Refrigerante caçulinha 200ml','BEBIDA',  3.50, 13, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Refrigerante lata 220ml',     'BEBIDA',  4.50, 14, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Suco Del Valle',              'BEBIDA',  5.50, 15, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'YoPro',                       'BEBIDA', 10.00, 16, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Longneck Heineken',           'BEBIDA', 12.00, 17, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Longneck Corona',             'BEBIDA', 12.00, 18, CURRENT_TIMESTAMP);

-- --------------------------------------------------------------------------
-- A MAQUINA DE CAFE
--
-- Os 12 botoes da ficha. PRECO ZERO = CORTESIA, palavra do dono: "os outros
-- que nao aparece preco e porque realmente nao e cobrado a parte, pode
-- consumir a vontade".
--
-- Eles entram mesmo sendo gratuitos porque a maquina CONTA quantos fez, e o
-- coworking precisa saber o consumo para repor leite, po e copo. Quem for
-- cobrado (ha duas plaquinhas de R$ 10 na maquina) a equipe acerta o preco no
-- painel — e campo editavel, nao precisa de migracao nova.
-- --------------------------------------------------------------------------
INSERT INTO "produtos" ("id", "nome", "categoria", "preco", "ordem", "atualizado_em") VALUES
  (gen_random_uuid()::text, 'Café 1 · Expresso',             'BEBIDA', 0, 19, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 2 · Capuccino',            'BEBIDA', 0, 20, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 3 · Cap. Alpino',          'BEBIDA', 0, 21, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 4 · Curto',                'BEBIDA', 0, 22, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 5 · Com leite',            'BEBIDA', 0, 23, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 6 · Achocolatado Alpino',  'BEBIDA', 0, 24, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 7 · Duplo',                'BEBIDA', 0, 25, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 8 · Com leite curto',      'BEBIDA', 0, 26, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 9 · Cap. Padre',           'BEBIDA', 0, 27, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 10 · Americano',           'BEBIDA', 0, 28, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 11 · Nescau',              'BEBIDA', 0, 29, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Café 12 · Achocolatado Padre',  'BEBIDA', 0, 30, CURRENT_TIMESTAMP);

-- --------------------------------------------------------------------------
-- QUEM LEVA QUAL ETIQUETA
-- --------------------------------------------------------------------------
INSERT INTO "produtos_com_tag" ("produto_id", "tag_id")
SELECT p."id", t."id"
FROM "produtos" p
JOIN (VALUES
  ('Suflair', 'Chocolate'),
  ('Kit Kat', 'Chocolate'),
  ('Baton', 'Chocolate'),
  ('Chokito', 'Chocolate'),
  ('Chocobiscuit', 'Chocolate'),
  ('Chocobiscuit', 'Biscoito'),
  ('Stick', 'Chocolate'),
  ('Cookies', 'Biscoito'),
  ('Barrinha Proteína', 'Proteína'),
  ('YoPro', 'Proteína'),
  ('Água com gás', 'Água'),
  ('Água sem gás', 'Água'),
  ('Energético', 'Energético'),
  ('Refrigerante lata 350ml', 'Refrigerante'),
  ('Refrigerante caçulinha 200ml', 'Refrigerante'),
  ('Refrigerante lata 220ml', 'Refrigerante'),
  ('Suco Del Valle', 'Suco'),
  ('Longneck Heineken', 'Cerveja'),
  ('Longneck Corona', 'Cerveja')
) AS x("produto", "tag") ON x."produto" = p."nome"
JOIN "tags_produto" t ON t."nome" = x."tag";

-- Todo cafe leva a etiqueta "Café".
INSERT INTO "produtos_com_tag" ("produto_id", "tag_id")
SELECT p."id", t."id"
FROM "produtos" p
CROSS JOIN "tags_produto" t
WHERE p."nome" LIKE 'Café %' AND t."nome" = 'Café';

-- --------------------------------------------------------------------------
-- A COLUNA FICA OBRIGATORIA, agora que toda linha tem categoria.
--
-- Conferencia antes de apertar: se sobrar produto sem categoria, o ALTER
-- abaixo falha sozinho e a migracao inteira e desfeita.
-- --------------------------------------------------------------------------
ALTER TABLE "produtos" ALTER COLUMN "categoria" SET NOT NULL;
