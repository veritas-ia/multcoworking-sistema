-- O TEXTO que acompanha o PDF do demonstrativo no WhatsApp.
--
-- Entra pela MIGRACAO, e nao pelo seed: o deploy roda "migrate deploy" e NAO
-- roda o seed. Um modelo so no seed nunca chegaria em producao, e o envio
-- ficaria sem texto.
INSERT INTO "templates_mensagem" ("id", "chave", "texto", "descricao", "atualizado_em")
VALUES (
  gen_random_uuid()::text,
  'demonstrativo_mensal',
  'Olá, {{nome}}! Segue o demonstrativo de uso do período {{periodo}}.

Total de horas: {{horas}}
Valor total: {{valor}}

Qualquer dúvida é só chamar. Obrigado por usar a Mult Coworking!',
  'Acompanha o PDF do demonstrativo mensal. Variáveis: {{nome}}, {{periodo}}, {{horas}} e {{valor}}.',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("chave") DO NOTHING;
