-- Mensagem unica para confirmar uma SERIE recorrente (Fase 9).
--
-- Antes, cada ocorrencia disparava a confirmacao: uma serie de terca e quarta
-- por dois meses mandava ~17 mensagens seguidas para a mesma pessoa. Parecia
-- defeito para o cliente e arriscava esbarrar no limite de rajada do WhatsApp.
--
-- Agora sai UMA mensagem resumindo a serie. Os LEMBRETES (24h e 2h) continuam
-- individuais por ocorrencia — esses fazem sentido um a um.
ALTER TYPE "ChaveTemplate" ADD VALUE IF NOT EXISTS 'serie_confirmada' AFTER 'reserva_confirmada';
