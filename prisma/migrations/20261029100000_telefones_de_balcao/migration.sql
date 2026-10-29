-- TELEFONES QUE NAO SAO DE UM CLIENTE.
--
-- O relatorio agrupa cliente pelo telefone, e para quase todos os numeros
-- isso esta certo. O do atendimento comercial do coworking, nao: a recepcao
-- lanca nele a reserva de quem nao deixou o proprio numero. Em producao ele
-- acumulou 14 reservas de QUATRO clientes diferentes (Toca, Prestare,
-- Matheus Toca e Rafael Passos), que no painel viraram um "cliente" so com
-- 28 horas.
--
-- Marcado aqui, o relatorio agrupa as reservas desse numero pelo NOME de
-- cada uma. NENHUMA RESERVA E ALTERADA: nem ao marcar, nem ao desmarcar.
CREATE TABLE "telefones_balcao" (
    "telefone" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por_id" TEXT,

    CONSTRAINT "telefones_balcao_pkey" PRIMARY KEY ("telefone")
);

-- O usuario desligado some daqui, mas a marcacao fica: ela e do numero, e
-- nao de quem a criou.
ALTER TABLE "telefones_balcao"
  ADD CONSTRAINT "telefones_balcao_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "usuarios"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
