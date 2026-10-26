-- =============================================================================
-- EMPRESAS: varias pessoas da mesma empresa num total so.
--
-- O problema real: tem salas alugadas por mes a empresas, e varios
-- funcionarios da MESMA empresa reservam, cada um do seu telefone. No
-- relatorio isso virava varios clientes separados, e as vezes quem paga a
-- conta do mes e a empresa, nao a pessoa.
--
-- Medido no banco antes de escrever isto: a Prestare aparece em TRES
-- telefones diferentes (17 reservas no total), e a Toca em dois (14).
--
-- O VINCULO E DO TELEFONE, NAO DA RESERVA, e isso e a decisao central.
-- O relatorio descobre a empresa pelo telefone na hora de montar. Por isso,
-- no minuto em que a equipe marcar os tres numeros da Prestare, as 17
-- reservas passadas se juntam sozinhas — sem tocar em reserva nenhuma.
-- O outro lado, combinado com o dono: desvincular um telefone tira o
-- historico dele do total da empresa. Para um coworking isso e desejavel, o
-- relatorio passa a refletir quem e cliente hoje.
-- =============================================================================

CREATE TABLE "empresas" (
  "id"            TEXT PRIMARY KEY,
  "nome"          TEXT NOT NULL UNIQUE,
  -- Desligada some dos relatorios novos, mas nao apaga vinculo nenhum:
  -- empresa que saiu do coworking ainda precisa aparecer no historico.
  "ativa"         BOOLEAN NOT NULL DEFAULT true,
  "criado_em"     TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
  "atualizado_em" TIMESTAMPTZ(3) NOT NULL
);

-- Um telefone pertence a NO MAXIMO UMA empresa: o telefone e a chave, e nao
-- um id proprio. Assim o banco impede, sozinho, o mesmo numero somar em duas
-- empresas e inflar o relatorio das duas.
CREATE TABLE "telefones_empresa" (
  "telefone"   TEXT PRIMARY KEY,
  "empresa_id" TEXT NOT NULL REFERENCES "empresas"("id") ON DELETE CASCADE,
  "criado_em"  TIMESTAMPTZ(3) NOT NULL DEFAULT NOW()
);

CREATE INDEX "telefones_empresa_empresa_id_idx"
  ON "telefones_empresa" ("empresa_id");

-- O telefone segue a mesma regra de formato das reservas: internacional,
-- validado. Sem isto, um numero digitado torto aqui nunca casaria com as
-- reservas e a empresa ficaria com zero horas, sem erro aparecer.
ALTER TABLE "telefones_empresa"
  ADD CONSTRAINT "telefone_empresa_e164"
    CHECK ("telefone" ~ '^\+55[1-9][0-9]9[0-9]{8}$');
