-- CreateEnum
CREATE TYPE "StatusReserva" AS ENUM ('CONFIRMADA', 'REAGENDADA', 'CANCELADA', 'CONCLUIDA');

-- CreateEnum
CREATE TYPE "OrigemReserva" AS ENUM ('PUBLICO', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusMensagem" AS ENUM ('ENVIADA', 'FALHOU');

-- CreateEnum
CREATE TYPE "ChaveTemplate" AS ENUM ('codigo_verificacao', 'reserva_confirmada', 'reserva_cancelada', 'reserva_reagendada', 'lembrete_24h', 'lembrete_2h');

-- CreateEnum
CREATE TYPE "TipoOcupacao" AS ENUM ('RESERVA', 'BLOQUEIO');

-- CreateTable
CREATE TABLE "salas" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "capacidade" INTEGER,
    "preco_por_hora" DECIMAL(10,2) NOT NULL,
    "duracao_maxima_minutos" INTEGER,
    "ordem" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios_funcionamento" (
    "id" TEXT NOT NULL,
    "dia_da_semana" INTEGER NOT NULL,
    "aberto" BOOLEAN NOT NULL,
    "hora_abertura" VARCHAR(5),
    "hora_fechamento" VARCHAR(5),
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "horarios_funcionamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "sala_id" TEXT NOT NULL,
    "nome_cliente" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "duracao_minutos" INTEGER NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "status" "StatusReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "origem" "OrigemReserva" NOT NULL,
    "recorrencia_id" TEXT,
    "lembrete_24h_enviado_em" TIMESTAMPTZ(3),
    "lembrete_2h_enviado_em" TIMESTAMPTZ(3),
    "historico_alteracoes" JSONB NOT NULL DEFAULT '[]',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "cancelado_em" TIMESTAMPTZ(3),

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios" (
    "id" TEXT NOT NULL,
    "sala_id" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(3) NOT NULL,
    "fim" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT,
    "criado_por_id" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recorrencias" (
    "id" TEXT NOT NULL,
    "sala_id" TEXT NOT NULL,
    "nome_cliente" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "dia_da_semana" INTEGER NOT NULL,
    "hora_inicio" VARCHAR(5) NOT NULL,
    "hora_fim" VARCHAR(5) NOT NULL,
    "data_inicio" DATE NOT NULL,
    "data_fim" DATE,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recorrencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codigos_verificacao" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "usado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "codigos_verificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_cliente" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessoes_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates_mensagem" (
    "id" TEXT NOT NULL,
    "chave" "ChaveTemplate" NOT NULL,
    "texto" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "templates_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_mensagem" (
    "id" TEXT NOT NULL,
    "reserva_id" TEXT,
    "telefone" TEXT NOT NULL,
    "tipo" "ChaveTemplate" NOT NULL,
    "status" "StatusMensagem" NOT NULL,
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocupacao_salas" (
    "origem_id" TEXT NOT NULL,
    "tipo" "TipoOcupacao" NOT NULL,
    "sala_id" TEXT NOT NULL,
    "periodo" tstzrange NOT NULL,
    "periodo_com_intervalo" tstzrange NOT NULL,

    CONSTRAINT "ocupacao_salas_pkey" PRIMARY KEY ("origem_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "salas_nome_key" ON "salas"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "salas_slug_key" ON "salas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "horarios_funcionamento_dia_da_semana_key" ON "horarios_funcionamento"("dia_da_semana");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- CreateIndex
CREATE INDEX "reservas_sala_id_inicio_idx" ON "reservas"("sala_id", "inicio");

-- CreateIndex
CREATE INDEX "reservas_telefone_status_idx" ON "reservas"("telefone", "status");

-- CreateIndex
CREATE INDEX "reservas_recorrencia_id_idx" ON "reservas"("recorrencia_id");

-- CreateIndex
CREATE INDEX "bloqueios_sala_id_inicio_idx" ON "bloqueios"("sala_id", "inicio");

-- CreateIndex
CREATE INDEX "bloqueios_criado_por_id_idx" ON "bloqueios"("criado_por_id");

-- CreateIndex
CREATE INDEX "recorrencias_sala_id_dia_da_semana_idx" ON "recorrencias"("sala_id", "dia_da_semana");

-- CreateIndex
CREATE INDEX "codigos_verificacao_telefone_criado_em_idx" ON "codigos_verificacao"("telefone", "criado_em");

-- CreateIndex
CREATE INDEX "codigos_verificacao_ip_criado_em_idx" ON "codigos_verificacao"("ip", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_cliente_token_key" ON "sessoes_cliente"("token");

-- CreateIndex
CREATE INDEX "sessoes_cliente_telefone_idx" ON "sessoes_cliente"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "templates_mensagem_chave_key" ON "templates_mensagem"("chave");

-- CreateIndex
CREATE INDEX "logs_mensagem_reserva_id_idx" ON "logs_mensagem"("reserva_id");

-- CreateIndex
CREATE INDEX "logs_mensagem_telefone_criado_em_idx" ON "logs_mensagem"("telefone", "criado_em");

-- CreateIndex
CREATE INDEX "ocupacao_salas_sala_id_idx" ON "ocupacao_salas"("sala_id");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_recorrencia_id_fkey" FOREIGN KEY ("recorrencia_id") REFERENCES "recorrencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueios" ADD CONSTRAINT "bloqueios_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueios" ADD CONSTRAINT "bloqueios_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorrencias" ADD CONSTRAINT "recorrencias_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_mensagem" ADD CONSTRAINT "logs_mensagem_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupacao_salas" ADD CONSTRAINT "ocupacao_salas_sala_id_fkey" FOREIGN KEY ("sala_id") REFERENCES "salas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
