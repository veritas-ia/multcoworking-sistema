-- O NONO MODELO DE MENSAGEM: varias reservas confirmadas de uma vez.
--
-- Esta migracao faz SO isto, de proposito. O Postgres nao deixa USAR um valor
-- de enum na mesma transacao em que ele e criado, e a migracao seguinte
-- precisa inserir a linha do modelo usando esta chave. Separar em duas e o
-- que torna as duas aplicaveis.
ALTER TYPE "ChaveTemplate" ADD VALUE 'reservas_confirmadas';
