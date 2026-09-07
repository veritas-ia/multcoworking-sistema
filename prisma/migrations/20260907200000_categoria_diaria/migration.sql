-- CATEGORIA DIARIA: reserva de dia inteiro, horario fixo e preco fechado.
--
-- Uma diaria e uma reserva NORMAL: entra na mesma tabela, ocupa a sala no
-- periodo e passa pelas mesmas travas do banco (sem sobreposicao, com o
-- intervalo entre reservas). O que muda e como o preco e calculado e o fato
-- de o horario nao ser escolhido — ele vem da configuracao.
--
-- Toda reserva que ja existe e HORA: era a unica coisa que existia ate agora.
CREATE TYPE "CategoriaReserva" AS ENUM ('HORA', 'DIARIA');

ALTER TABLE "reservas"
  ADD COLUMN "categoria" "CategoriaReserva" NOT NULL DEFAULT 'HORA';

-- O horario da diaria fica em Configuracao, e nao no codigo: e numero de
-- negocio, o dono muda no painel sem mexer no sistema.
INSERT INTO "configuracoes" ("chave", "valor", "descricao", "atualizado_em")
VALUES
  ('diariaInicio', '08:00', 'A que horas comeca a diaria (dia inteiro).', NOW()),
  ('diariaFim', '18:00', 'A que horas termina a diaria (dia inteiro).', NOW())
ON CONFLICT ("chave") DO NOTHING;
