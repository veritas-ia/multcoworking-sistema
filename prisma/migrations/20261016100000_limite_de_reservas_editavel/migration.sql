-- =============================================================================
-- O LIMITE DE RESERVAS ATIVAS VIRA PARAMETRO, E COMECA DESLIGADO.
--
-- Decisao do dono (16/10/2026): o teto de 3 reservas ativas por telefone sai
-- do caminho do cliente e passa a ser um numero editavel em Configuracoes ->
-- Parametros.
--
-- Motivo: o limite contava reservas COM INICIO NO FUTURO, em qualquer mes —
-- nao era um teto mensal. O cliente que marcava com antecedencia batia nele
-- rapido e a saida era ligar para a recepcao, que nunca teve limite. Na
-- pratica virou atrito para o cliente bom e trabalho a mais para a equipe,
-- enquanto quem quisesse abusar precisava so de um telefonema.
--
-- ZERO SIGNIFICA SEM LIMITE, mesma convencao de "intervaloMinutos". Assim a
-- regra nao desaparece do sistema: ela fica desligada e o dono religa sozinho
-- pelo painel, sem precisar de alteracao no codigo nem de migracao nova.
--
-- O que NAO muda: a antecedencia maxima de 60 dias continua limitando o quanto
-- alguem consegue segurar a agenda a frente, e as travas de sobreposicao
-- seguem intactas.
-- =============================================================================

INSERT INTO "configuracoes" ("chave", "valor", "descricao", "atualizado_em")
VALUES (
  'maximoReservasAtivas',
  '0',
  'Quantas reservas futuras um cliente pode ter ao mesmo tempo pelo site. Zero = sem limite.',
  now()
)
ON CONFLICT ("chave") DO NOTHING;
