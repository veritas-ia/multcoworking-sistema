-- O valor novo do enum vai numa migracao PROPRIA, e nao junto com a anterior.
--
-- O Postgres nao deixa USAR um valor de enum na mesma transacao em que ele e
-- criado. Juntando as duas coisas, a migracao funcionaria enquanto ninguem
-- precisasse do valor ali dentro e estouraria no dia em que precisasse — ja
-- aconteceu neste projeto, com a chave do modelo do demonstrativo.
ALTER TYPE "TipoDeAcao" ADD VALUE IF NOT EXISTS 'LANCAMENTO_EXCLUIDO';
