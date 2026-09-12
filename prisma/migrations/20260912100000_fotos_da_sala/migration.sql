-- FOTOS DA SALA, para o cliente ver o espaco antes de reservar.
--
-- Os arquivos ficam no Cloudinary; esta tabela guarda so a referencia. O
-- "public_id" e o que permite apagar o arquivo de la depois — sem ele,
-- remover a foto do site deixaria o arquivo orfao para sempre.
--
-- ON DELETE CASCADE: se um dia uma sala for apagada direto no banco, as
-- referencias vao junto. (O painel nao apaga sala — so desliga.)
CREATE TABLE "fotos_sala" (
  "id"         TEXT NOT NULL,
  "sala_id"    TEXT NOT NULL,
  "public_id"  TEXT NOT NULL,
  "url"        TEXT NOT NULL,
  "ordem"      INTEGER NOT NULL,
  "criado_em"  TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fotos_sala_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "fotos_sala"
  ADD CONSTRAINT "fotos_sala_sala_id_fkey"
    FOREIGN KEY ("sala_id") REFERENCES "salas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- O carrossel le as fotos de uma sala na ordem; e sempre esta consulta.
CREATE INDEX "fotos_sala_sala_id_ordem_idx" ON "fotos_sala" ("sala_id", "ordem");

-- A mesma foto nao pode entrar duas vezes: o Cloudinary devolve um public_id
-- unico por arquivo, e repetir aqui significaria um envio gravado em dobro.
CREATE UNIQUE INDEX "fotos_sala_public_id_key" ON "fotos_sala" ("public_id");

-- Ordem comeca em 1. Zero ou negativo nao tem significado no carrossel.
ALTER TABLE "fotos_sala"
  ADD CONSTRAINT "foto_ordem_positiva" CHECK ("ordem" >= 1);
