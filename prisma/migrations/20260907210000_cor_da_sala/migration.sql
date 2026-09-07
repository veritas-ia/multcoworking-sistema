-- COR DA SALA NA AGENDA.
--
-- Antes a agenda pintava so por SITUACAO da reserva (confirmada, remarcada,
-- cancelada, concluida). A cor da sala e informacao nova, e serve para bater
-- o olho na agenda e ver de quem e cada bloco.
--
-- A situacao continua se distinguindo por BORDA, TEXTURA e TEXTO, e nao por
-- cor (CLAUDE.md): quem nao enxerga bem cores nao pode perder a agenda.
ALTER TABLE "salas" ADD COLUMN "cor" VARCHAR(7) NOT NULL DEFAULT '#FFC700';

-- Uma cor por sala, para elas nao se confundirem na tela. Sao tons da paleta
-- fechada do painel, todos escolhidos para funcionar com texto preto em cima.
UPDATE "salas" SET "cor" = '#FFC700' WHERE "slug" = 'sala-ci';
UPDATE "salas" SET "cor" = '#9AD5F0' WHERE "slug" = 'sala-de-reuniao';
UPDATE "salas" SET "cor" = '#B7E4A0' WHERE "slug" = 'sala-container';

-- So "#RRGGBB": qualquer outra coisa vira estilo quebrado na tela.
ALTER TABLE "salas"
  ADD CONSTRAINT "sala_cor_hexadecimal"
    CHECK ("cor" ~ '^#[0-9A-Fa-f]{6}$');
