-- Usuario do painel pode ser DESLIGADO (Fase 11).
--
-- Desligar em vez de excluir: bloqueios e feriados guardam quem os criou, e
-- apagar a pessoa deixaria esse historico sem autor. Quem esta desligado nao
-- entra mais no painel (ver "admin.ts"), mas continua aparecendo como autor.
--
-- A linha das recorrencias abaixo nao tem relacao com a Fase 11: era uma
-- diferenca antiga entre o schema e o banco (um DEFAULT que o schema nao
-- declara), que o Prisma aproveitou para acertar agora.
-- AlterTable
ALTER TABLE "recorrencias" ALTER COLUMN "dias_da_semana" DROP DEFAULT;

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true;
