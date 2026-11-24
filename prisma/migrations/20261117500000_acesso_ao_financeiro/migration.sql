-- ACESSO AO FINANCEIRO (17/11/2026)
--
-- Pedido dos donos do coworking: poder criar um usuario do painel que ve
-- tudo MENOS a parte financeira — o caso da recepcionista.
--
-- NASCE LIGADA PARA TODO MUNDO. Quem ja existia continua com acesso total;
-- sem o padrao, o unico admin de producao perderia o financeiro no deploy e
-- NAO TERIA COMO SE DEVOLVER o acesso, porque a tela de usuarios tambem
-- exige este campo.
--
-- Um booleano, e nao uma lista de niveis: sao dois niveis, e so dois, que foi
-- o que o dono pediu. Um enum do Postgres aceita acrescentar valor, mas nunca
-- remover — e viraria uma porta aberta para niveis que ninguem pediu.
ALTER TABLE "usuarios"
  ADD COLUMN "acesso_financeiro" BOOLEAN NOT NULL DEFAULT true;
