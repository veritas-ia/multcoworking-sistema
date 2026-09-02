-- A duracao minima de 1 hora deixa de ser trava do BANCO (Fase 8).
--
-- Por que: a trava antiga misturava duas coisas de naturezas diferentes:
--
--   * "duracao % 30 = 0"  -> INTEGRIDADE. A agenda inteira e feita de blocos
--                            de 30 min; uma reserva fora da grade quebraria a
--                            grade de todo mundo. Continua no banco.
--
--   * "duracao >= 60"     -> POLITICA COMERCIAL. Vale para o cliente no site,
--                            mas a recepcao negocia caso a caso (decisao do
--                            dono do projeto na Fase 8). Passa a ser aplicada
--                            na aplicacao, que sabe QUEM esta marcando.
--
-- Quem garante o minimo de 1 hora para o cliente agora e o motor de
-- disponibilidade (modo CLIENTE), com teste automatizado.
ALTER TABLE "reservas"
  DROP CONSTRAINT "reserva_duracao_minima_e_grade";

ALTER TABLE "reservas"
  ADD CONSTRAINT "reserva_duracao_na_grade"
    CHECK ("duracao_minutos" > 0 AND "duracao_minutos" % 30 = 0);
