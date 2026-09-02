-- O token da sessao do cliente passa a ser guardado embaralhado (SHA-256).
-- Assim, quem conseguisse ler o banco ainda nao conseguiria se passar
-- por um cliente ja verificado.
--
-- Renomear (em vez de apagar e recriar) preserva as sessoes existentes.
ALTER TABLE "sessoes_cliente" RENAME COLUMN "token" TO "token_hash";
ALTER INDEX "sessoes_cliente_token_key" RENAME TO "sessoes_cliente_token_hash_key";
