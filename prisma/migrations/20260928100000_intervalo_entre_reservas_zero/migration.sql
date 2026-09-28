-- =============================================================================
-- INTERVALO ENTRE RESERVAS PASSA A SER ZERO.
--
-- Decisao do dono: nao existe mais folga obrigatoria entre duas reservas da
-- mesma sala. Reserva colada e permitida — 09:00-10:00 e 10:00-11:00 na mesma
-- sala passam a conviver. O que continua PROIBIDO e a sobreposicao de verdade,
-- garantida pela TRAVA 1 ("ocupacao_sem_sobreposicao"), que esta intocada.
--
-- A TRAVA 2 ("ocupacao_intervalo_entre_reservas") CONTINUA EXISTINDO de
-- proposito. Com folga zero ela vira uma copia da TRAVA 1 restrita a reservas
-- — nao atrapalha e nao custa nada. Se um dia a folga voltar, basta mudar o
-- numero em "configuracoes": nenhuma mudanca de estrutura e necessaria.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. O valor efetivo
-- -----------------------------------------------------------------------------
UPDATE "configuracoes"
   SET "valor"     = '0',
       "descricao" = 'Minutos de folga obrigatórios entre duas reservas da mesma sala. Zero: reservas podem ficar coladas.'
 WHERE "chave" = 'intervaloMinutos';

-- -----------------------------------------------------------------------------
-- 2. O valor de emergencia da funcao
--
-- Ela usa este numero quando o registro nao existe na tabela. Estava 30; se
-- ficasse assim, um banco sem o registro ressuscitaria a folga antiga sem
-- ninguem perceber.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "intervalo_entre_reservas"() RETURNS interval AS $$
  SELECT COALESCE(
    (SELECT "valor"::int FROM "configuracoes" WHERE "chave" = 'intervaloMinutos'),
    0
  ) * interval '1 minute';
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- 3. AS RESERVAS QUE JA EXISTEM
--
-- Esta e a parte que nao da para esquecer. O periodo esticado e calculado pelo
-- gatilho NA HORA DE GRAVAR e fica congelado na linha. Sem este passo, as
-- reservas ja marcadas continuariam carregando a folga de 30 min e seguiriam
-- bloqueando o horario colado depois delas — a mudanca so valeria para reserva
-- nova, e a agenda ficaria com duas regras ao mesmo tempo.
--
-- A operacao so ENCOLHE periodos, nunca aumenta: encolher nao cria
-- sobreposicao nova, entao nao ha risco de esbarrar nas travas.
-- -----------------------------------------------------------------------------
UPDATE "ocupacao_salas"
   SET "periodo_com_intervalo" = "periodo"
 WHERE "tipo" = 'RESERVA'
   AND "periodo_com_intervalo" <> "periodo";
