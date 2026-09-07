-- HORARIO DE FUNCIONAMENTO ATE AS 22H, E SEXTA PASSA A ABRIR.
--
-- Pedido do dono junto com o preco por faixa. Sem esta mudanca a faixa
-- noturna nao existiria para o cliente: o dia acabava as 18h, e ele nem
-- chegava a ver um horario depois disso na tela.
--
--   segunda a SEXTA  08:00 - 22:00   (a sexta era fechada)
--   sabado           09:00 - 13:00   (sem mudanca)
--   domingo          fechado         (sem mudanca)
--
-- E uma AMPLIACAO: nenhum horario deixa de existir, entao nenhuma reserva ja
-- marcada fica fora do expediente por causa desta migracao.
--
-- Depois daqui, quem manda no horario e o painel (Configuracoes > Horarios).

UPDATE "horarios_funcionamento"
   SET "aberto" = true,
       "hora_abertura" = '08:00',
       "hora_fechamento" = '22:00',
       "atualizado_em" = NOW()
 WHERE "dia_da_semana" BETWEEN 1 AND 5;
