-- HISTORICO DE ACOES.
--
-- POR QUE ISTO EXISTE: passou a ser possivel EXCLUIR uma reserva lancada por
-- engano. Excluir apaga a prova — e a prova e o que permite responder, tres
-- meses depois, "por que o relatorio de outubro mudou?".
--
-- Pedido do dono: "mesmo que exclua, a gente pelo menos tem esse dado... pelo
-- menos a gente sabe que aconteceu essa ação. Aí sim, é uma evidência."
--
-- O RESUMO E CONGELADO: a reserva excluida nao existe mais para ser
-- consultada, e o cliente dela pode ter sido desligado depois. Montar a frase
-- na hora de LER deixaria o historico em branco justamente no caso que mais
-- importa.
--
-- ESTE REGISTRO NUNCA SE APAGA. Nao existe rota que o remova e a faxina
-- diaria nao o toca. Um registro de evidencia que pode ser apagado nao e
-- evidencia.

CREATE TYPE "TipoDeAcao" AS ENUM ('RESERVA_EXCLUIDA', 'RESERVA_STATUS_ALTERADO');

CREATE TABLE "acoes_registradas" (
  "id"           TEXT NOT NULL,
  "tipo"         "TipoDeAcao" NOT NULL,
  "resumo"       TEXT NOT NULL,
  "dados"        JSONB NOT NULL,
  "usuario_id"   TEXT,
  "usuario_nome" TEXT NOT NULL,
  "motivo"       TEXT,
  "criado_em"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "acoes_registradas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "acoes_registradas_criado_em_idx" ON "acoes_registradas"("criado_em");
CREATE INDEX "acoes_registradas_tipo_criado_em_idx"
  ON "acoes_registradas"("tipo", "criado_em");

-- O usuario pode ser desligado, e um dia pode ser excluido. A ACAO NAO PODE
-- SUMIR COM ELE: por isso ON DELETE SET NULL, e por isso o nome fica gravado
-- na propria linha. Sem o nome, a evidencia viraria "alguem fez isso".
ALTER TABLE "acoes_registradas"
  ADD CONSTRAINT "acoes_registradas_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- O resumo nunca pode nascer vazio: um registro sem frase nao explica nada a
-- quem for ler daqui a seis meses.
ALTER TABLE "acoes_registradas"
  ADD CONSTRAINT "acao_resumo_preenchido" CHECK (BTRIM("resumo") <> '');

-- A EXCLUSAO EXIGE MOTIVO. Mudanca de status nao exige: o antes-e-depois ja
-- esta nos dados, e exigir texto a cada clique faria a equipe escrever "a"
-- para passar da tela.
ALTER TABLE "acoes_registradas"
  ADD CONSTRAINT "acao_exclusao_exige_motivo" CHECK (
    "tipo" <> 'RESERVA_EXCLUIDA' OR (COALESCE(BTRIM("motivo"), '') <> '')
  );
