-- A FOTO DO PRODUTO (Fase 15, Parte A).
--
-- Pedido do dono: "adicionar imagem, adicionar um titulo, que e o nome do
-- produto, como se fosse igual no iFood". E a foto que a recepcionista
-- reconhece de relance na hora de lancar o que esta escrito na ficha fisica.
--
-- UMA foto por produto, e nao um carrossel como nas salas: aqui ela serve para
-- IDENTIFICAR o item, nao para vende-lo.
--
-- NULO E ESTADO NORMAL, nao erro: produto sem foto aparece com a inicial do
-- nome. Isso tambem e o que mantem o sistema funcionando quando o Cloudinary
-- nao esta configurado — mesma regra das fotos das salas.
ALTER TABLE "produtos" ADD COLUMN "foto_public_id" TEXT;
ALTER TABLE "produtos" ADD COLUMN "foto_url" TEXT;

-- As duas andam juntas: ter o endereco sem o identificador deixaria um arquivo
-- orfao no Cloudinary para sempre, e ter o identificador sem o endereco
-- mostraria uma imagem quebrada na tela.
ALTER TABLE "produtos"
  ADD CONSTRAINT "produto_foto_completa" CHECK (
    ("foto_public_id" IS NULL AND "foto_url" IS NULL)
    OR ("foto_public_id" IS NOT NULL AND "foto_url" IS NOT NULL)
  );
