-- MENSAGEM DE AVALIACAO, 1 HORA DEPOIS DO TERMINO.
--
-- Mesma mecanica dos lembretes de 13h e 3h: um campo com a data do envio e
-- outro dizendo "esta nunca vai sair". A diferenca e o ponto de referencia —
-- os lembretes olham para o INICIO da reserva, este olha para o TERMINO.
--
-- O "nao aplicavel" aqui serve para reserva que ja terminou ha tempo demais
-- quando o sistema viu. Sem ele, ligar o agendador depois de um tempo
-- desligado dispararia avaliacao atrasada de tudo que ja passou.

ALTER TYPE "ChaveTemplate" ADD VALUE 'avaliacao_pos_uso';

ALTER TABLE "reservas"
  ADD COLUMN "avaliacao_enviada_em" TIMESTAMPTZ(3),
  ADD COLUMN "avaliacao_nao_aplicavel" BOOLEAN NOT NULL DEFAULT false;

-- A rotina procura por termino dentro de uma janela, entre as que ainda nao
-- foram marcadas. Sem indice, isso varre a tabela a cada 5 minutos.
CREATE INDEX "reservas_avaliacao_fim_idx"
  ON "reservas" ("avaliacao_enviada_em", "avaliacao_nao_aplicavel", "fim");

-- O link do Google Meu Negocio. Fica em Configuracao, e nao no texto da
-- mensagem, para viver num lugar so: enquanto estiver vazio, a rotina NAO
-- envia — melhor ficar quieta do que pedir avaliacao sem dizer onde.
INSERT INTO "configuracoes" ("chave", "valor", "descricao", "atualizado_em")
VALUES ('linkAvaliacaoGoogle', '',
        'Link do Google Meu Negocio para o cliente avaliar. Enquanto estiver vazio, a mensagem de avaliacao nao e enviada.',
        NOW())
ON CONFLICT ("chave") DO NOTHING;
