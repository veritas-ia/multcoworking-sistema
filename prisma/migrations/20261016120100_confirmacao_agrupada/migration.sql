-- =============================================================================
-- CONFIRMACAO AGRUPADA: quem marca varias reservas de uma vez recebe UMA
-- mensagem, com a quantidade e o valor somado.
--
-- O problema real: o site reserva UMA de cada vez. Quem queria tres passava
-- pelo fluxo tres vezes, e recebia tres mensagens, cada uma falando de uma
-- reserva e de um valor. Ninguem via o total. Aconteceu com uma cliente e a
-- equipe precisou explicar na mao.
--
-- COMO FUNCIONA: a confirmacao deixa de sair na hora da reserva. Uma rotina,
-- de minuto em minuto, procura telefones cuja ULTIMA reserva ja tem 3 minutos
-- e manda uma mensagem so. Dentro dos 3 minutos, cada reserva nova reinicia a
-- contagem — e isso que mantem a leva inteira.
--
-- O QUE NAO MUDA, e precisa continuar nao mudando:
--   - os LEMBRETES de 13h e 3h seguem individuais, um por reserva, no dia de
--     cada uma;
--   - a mensagem de CANCELAMENTO segue individual: cancelar a reserva do dia
--     20 nao pode cancelar as outras nem dizer que cancelou tudo. O cliente
--     leria isso como defeito do sistema;
--   - a RECEPCAO continua confirmando na hora, uma por reserva: ali o cliente
--     costuma estar no balcao e a equipe confirma na frente dele.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. O campo de controle
--
-- Mesma mecanica dos lembretes: nulo = ainda nao saiu. A marcacao e um UPDATE
-- condicional que so o primeiro consegue aplicar (marcar primeiro, mandar
-- depois).
-- -----------------------------------------------------------------------------
ALTER TABLE "reservas" ADD COLUMN "confirmacao_enviada_em" TIMESTAMPTZ(3);

-- A rotina procura as NAO marcadas a cada minuto. Sem indice, isso varre a
-- tabela inteira 1440 vezes por dia.
CREATE INDEX "reservas_confirmacao_enviada_em_idx"
  ON "reservas" ("confirmacao_enviada_em");

-- -----------------------------------------------------------------------------
-- 2. AS RESERVAS QUE JA EXISTEM JA FORAM CONFIRMADAS
--
-- Esta e a parte que nao da para esquecer. Sem ela, na primeira vez que a
-- rotina rodasse em producao, ela veria 90 reservas "sem confirmacao" e
-- mandaria mensagem de todas — uma enxurrada em cima de clientes que ja
-- receberam a confirmacao meses atras.
-- -----------------------------------------------------------------------------
UPDATE "reservas" SET "confirmacao_enviada_em" = "criado_em";

-- -----------------------------------------------------------------------------
-- 3. O texto do modelo novo
--
-- Entra pela MIGRACAO, e nao pelo seed: o deploy roda "migrate deploy" e nao
-- roda o seed. Um modelo que so existisse no seed nunca chegaria em producao,
-- e a rotina ficaria sem texto para enviar.
--
-- {{lista}} e o bloco com uma linha por reserva (dia, sala e horario).
-- -----------------------------------------------------------------------------
INSERT INTO "templates_mensagem" ("id", "chave", "texto", "descricao", "atualizado_em")
VALUES (
  gen_random_uuid()::text,
  'reservas_confirmadas',
  E'Olá, {{nome}}! Suas {{quantidade}} reservas estão confirmadas:\n\n{{lista}}\n\nValor total estimado: {{valor}}\n\nQualquer mudança, é só acessar: {{link}}',
  'Enviada quando o cliente marca mais de uma reserva seguida no site. Vai uma mensagem só, com a quantidade e o valor somado. Quem marca uma reserva única continua recebendo "Reserva confirmada".',
  NOW()
)
ON CONFLICT ("chave") DO NOTHING;
