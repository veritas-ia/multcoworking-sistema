-- A EMPRESA PASSA A FICAR NA RESERVA (27/10/2026).
--
-- Ate aqui a empresa era so do TELEFONE (telefones_empresa). Isso resolvia a
-- bagunca que ja existia, mas obrigava a equipe a marcar numero por numero —
-- que nao se sustenta com a base crescendo.
--
-- Agora quem responde e o PROPRIO CLIENTE, na hora de reservar, escolhendo de
-- uma lista que so a equipe cadastra. A resposta fica GRAVADA NA RESERVA, e
-- nao no telefone, por tres motivos:
--
--  1. e a verdade do momento: aquela reserva foi para aquela empresa. Reserva
--     antiga nao muda de dono porque o cliente trocou de emprego depois;
--  2. acaba o conflito entre "o que a equipe marcou" e "o que o cliente
--     disse": cada reserva carrega a propria resposta.
--
-- O telefone continua sendo um bom critério de agrupamento, e e o que atribui
-- as reservas antigas. Guardar na reserva nao o substitui: completa.
--
-- O vinculo do telefone CONTINUA existindo e tem dois papeis: atribuir as
-- reservas antigas, que nunca foram perguntadas, e ja vir escolhido na proxima
-- reserva do mesmo numero.
--
-- ON DELETE RESTRICT: empresa com reserva nao se apaga. Nem existe tela para
-- apagar empresa, mas se um dia existir, a trava e aqui.
ALTER TABLE "reservas"
  ADD COLUMN "empresa_id" TEXT,
  ADD CONSTRAINT "reservas_empresa_id_fkey"
    FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- O relatorio por empresa percorre as reservas de uma empresa num periodo.
CREATE INDEX "reservas_empresa_id_inicio_idx" ON "reservas" ("empresa_id", "inicio");
