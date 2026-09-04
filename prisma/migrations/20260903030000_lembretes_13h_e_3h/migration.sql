-- Os lembretes deixam de ser 24h/2h e passam a ser 13h/3h (Fase 10).
--
-- Decisao do dono do coworking. Renomeamos de verdade, em vez de deixar
-- "lembrete_24h" guardando um lembrete de 13 horas: nome que mente vira
-- armadilha na primeira vez que alguem for mexer nisso daqui a um ano.

-- 1. Os modelos de mensagem
ALTER TYPE "ChaveTemplate" RENAME VALUE 'lembrete_24h' TO 'lembrete_13h';
ALTER TYPE "ChaveTemplate" RENAME VALUE 'lembrete_2h'  TO 'lembrete_3h';

-- 2. As colunas de controle da reserva
ALTER TABLE "reservas"
  RENAME COLUMN "lembrete_24h_enviado_em" TO "lembrete_13h_enviado_em";
ALTER TABLE "reservas"
  RENAME COLUMN "lembrete_2h_enviado_em" TO "lembrete_3h_enviado_em";

-- 3. O estado que faltava: "nao aplicavel".
--
-- Ate agora so existiam dois estados (nulo = nao enviado, data = enviado).
-- Faltava o terceiro: a recepcao pode lancar uma reserva para daqui a 30 min,
-- e nesse caso o lembrete de 13h NUNCA vai poder sair. Sem esta coluna a
-- rotina reavaliaria essa reserva para sempre e o painel nao teria como
-- mostrar "nao se aplica".
ALTER TABLE "reservas"
  ADD COLUMN "lembrete_13h_nao_aplicavel" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lembrete_3h_nao_aplicavel"  BOOLEAN NOT NULL DEFAULT false;

-- Enviado e "nao aplicavel" sao mutuamente exclusivos: ou saiu, ou nunca ia sair.
ALTER TABLE "reservas"
  ADD CONSTRAINT "lembrete_13h_coerente"
    CHECK (NOT ("lembrete_13h_enviado_em" IS NOT NULL AND "lembrete_13h_nao_aplicavel")),
  ADD CONSTRAINT "lembrete_3h_coerente"
    CHECK (NOT ("lembrete_3h_enviado_em" IS NOT NULL AND "lembrete_3h_nao_aplicavel"));
