-- =============================================================================
-- JANELA DE SILENCIO: nenhuma mensagem automatica de madrugada.
--
-- O problema, medido em producao antes de escrever isto:
--   lembrete de 13h -> 38 de 53 enviados fora de hora (72%)
--   lembrete de 3h  -> 17 de 48 (35%)
-- As horas: 10 mensagens as 4h da manha, 9 as 5h, 5 a 1h, 5 as 2h, 5 as 3h.
--
-- A conta explica sozinha: o lembrete de 13h de uma reserva das 15h cai as
-- 2h da manha. Qualquer reserva de tarde caia de madrugada.
--
-- Dois numeros, editaveis no painel como os outros. Fora deste intervalo,
-- nenhum lembrete e nenhum convite de avaliacao sai.
-- =============================================================================

INSERT INTO "configuracoes" ("chave", "valor", "descricao", "atualizado_em")
VALUES
  ('mensagensHoraInicial', '8',
   'A partir de que hora o sistema pode mandar mensagem automatica (lembretes e convite para avaliar).',
   NOW()),
  ('mensagensHoraFinal', '21',
   'Ate que hora o sistema pode mandar mensagem automatica. Depois disso, so no dia seguinte.',
   NOW())
ON CONFLICT ("chave") DO NOTHING;
