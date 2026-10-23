-- =============================================================================
-- AJUSTE DO TERMINO: o cliente ficou mais tempo do que reservou.
--
-- O cenario real: a pessoa marcou das 10h as 11h e saiu 11h30, porque nao
-- havia reserva depois. Ela pagou o tempo a mais no balcao, mas o sistema nao
-- tinha como registrar isso — a agenda e o relatorio seguiam dizendo 11h.
--
-- POR QUE NAO DA PARA USAR O "REMARCAR" QUE JA EXISTE:
--   1. ele RECUSA reserva encerrada, e a reserva de quem ficou mais tempo ja
--      esta CONCLUIDA ("So da para remarcar uma reserva ativa");
--   2. ele marca a reserva como REAGENDADA, o que nao e verdade: ninguem
--      remarcou nada, so ficou mais tempo;
--   3. ele zera lembretes e avaliacao e manda o WhatsApp de "remarcada".
--
-- Por isso a acao e propria. O status fica como esta, lembrete e avaliacao
-- nao sao tocados, e o historico guarda quem ajustou, quando e quanto.
--
-- O PRECO: o valor congelado da reserva e MANTIDO e o tempo extra e somado
-- pelo preco de hoje. Assim a quebra fica honesta — "R$ 80,00 + R$ 40,00 de
-- 30 min a mais". Recalculando tudo, nao daria para dizer quanto custou o
-- extra se o preco da sala tivesse mudado no meio do caminho.
-- =============================================================================

INSERT INTO "templates_mensagem" ("id", "chave", "texto", "descricao", "atualizado_em")
VALUES (
  gen_random_uuid()::text,
  'reserva_estendida',
  E'Olá, {{nome}}! Ajustamos o horário da sua reserva na {{sala}}.\n\n📅 {{data}}\n🕐 {{inicio}} às {{fim}} ({{extra}} a mais)\n\nValor atualizado: {{valor}}\n\nQualquer dúvida, é só falar com a recepção.',
  'Enviada quando a equipe estica o término de uma reserva porque o cliente ficou mais tempo. Mostra o horário novo, quanto tempo foi acrescentado e o valor já atualizado.',
  NOW()
)
ON CONFLICT ("chave") DO NOTHING;
