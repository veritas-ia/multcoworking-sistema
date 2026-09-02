-- O BANCO PRECISA RODAR EM UTC.
--
-- O driver do Prisma envia os horarios sem dizer o fuso. Se a sessao do
-- PostgreSQL estiver em America/Sao_Paulo, ele interpreta os digitos como
-- hora de Brasilia e grava tudo 3 horas adiantado. O erro fica invisivel
-- para a aplicacao (que le pelo mesmo caminho torto) e so aparece quando
-- alguem olha o banco por fora, ou quando se compara com o now() do banco.
--
-- Esta trava vale para TODA conexao com este banco, inclusive psql,
-- Prisma Studio e backups — nao depende do arquivo .env de cada maquina.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
