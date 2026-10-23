-- O DECIMO MODELO: aviso de que o termino da reserva foi esticado.
--
-- Separada da proxima pelo mesmo motivo de sempre: o Postgres nao deixa USAR
-- um valor de enum na mesma transacao em que ele e criado, e a migracao
-- seguinte insere a linha do modelo usando esta chave.
ALTER TYPE "ChaveTemplate" ADD VALUE 'reserva_estendida';
