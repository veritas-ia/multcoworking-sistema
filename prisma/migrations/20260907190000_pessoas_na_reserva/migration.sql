-- QUANTAS PESSOAS VAO USAR A SALA.
--
-- So e perguntado nas salas que cobram diferente por tamanho de grupo (hoje,
-- a de Reuniao). Nas outras a coluna fica nula, e o preco nao olha para ela.
--
-- Nulo tambem nas reservas ANTIGAS, de propósito: ninguem perguntou o numero
-- de pessoas a elas, e inventar um valor agora seria inventar informacao que
-- o cliente nunca deu.
ALTER TABLE "reservas" ADD COLUMN "pessoas" INTEGER;

-- Uma reserva com "0 pessoas" ou com um numero absurdo nao existe no mundo
-- real; o banco recusa antes de a tela precisar se preocupar.
ALTER TABLE "reservas"
  ADD CONSTRAINT "reserva_pessoas_plausivel"
    CHECK ("pessoas" IS NULL OR ("pessoas" >= 1 AND "pessoas" <= 500));
