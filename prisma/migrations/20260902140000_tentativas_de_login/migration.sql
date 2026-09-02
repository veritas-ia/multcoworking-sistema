-- Tentativas de login no painel (Fase 7).
--
-- Existe para travar ataque de forca bruta: 5 erros em 15 minutos bloqueiam
-- por 15 minutos, contando por nome de usuario E por endereco de rede.
--
-- Fica no banco, e nao na memoria do servidor, para o bloqueio nao sumir
-- quando o processo reinicia.
CREATE TABLE "tentativas_login" (
    "id" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "ip" TEXT,
    "sucesso" BOOLEAN NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tentativas_login_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tentativas_login_usuario_criado_em_idx"
  ON "tentativas_login"("usuario", "criado_em");

CREATE INDEX "tentativas_login_ip_criado_em_idx"
  ON "tentativas_login"("ip", "criado_em");
