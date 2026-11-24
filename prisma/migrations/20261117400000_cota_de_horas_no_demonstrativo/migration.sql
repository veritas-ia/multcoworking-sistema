-- FASE 16, PARTE D — a cota de horas inclusa na mensalidade.
--
-- O QUE MUDA: o demonstrativo passa a descontar as horas que JA ESTAO PAGAS na
-- mensalidade e cobrar so o excedente — que e o que a gestao fazia de cabeca.
--
-- ISTO REABRE, COM AUTORIZACAO DO DONO (17/11/2026), a decisao de 12/11 que
-- dizia "o demonstrativo NAO trata horas incluidas no plano". Ela esta
-- registrada no CLAUDE.md como substituida, e nao apagada.
--
-- A COLUNA E OPCIONAL, e isso nao e descuido: NULO significa "sem cota, toda
-- hora e cobrada", que e o caso de quem nao e mensalista — e e exatamente o
-- que os demonstrativos JA EMITIDOS precisam continuar sendo. Com um padrao
-- zero, cada documento antigo passaria a dizer "cota de 0 h", e a tela leria
-- isso como "tem plano" em vez de "nao tem".
ALTER TABLE "demonstrativos" ADD COLUMN "cota_horas" INTEGER;

-- Cota negativa nao significa nada; zero tambem nao — quem nao tem cota deixa
-- NULO. Gravar zero diria "tem plano com zero hora", a mesma coisa dita de um
-- jeito que a tela leria diferente. Mesma trava do contrato.
ALTER TABLE "demonstrativos"
  ADD CONSTRAINT "demonstrativo_cota_positiva" CHECK (
    "cota_horas" IS NULL OR "cota_horas" > 0
  );
