#!/bin/sh
# O que acontece toda vez que o container sobe.
#
# As migracoes rodam ANTES do site atender. "migrate deploy" so aplica o que
# ainda nao foi aplicado — subir dez vezes seguidas nao repete nada e nao
# apaga dado nenhum. Assim, publicar uma versao nova que mexeu no banco nao
# exige ninguem lembrar de rodar um comando a mao.
#
# Se a migracao falhar, o site NAO sobe. E de proposito: um site no ar com o
# banco em versao errada mostra erro para o cliente no meio da reserva, o que
# e pior do que ficar fora do ar por dois minutos com o motivo escrito no log.
set -e

echo "→ Aplicando migracoes do banco..."
npx prisma migrate deploy --config prisma7.config.ts

echo "→ Migracoes em dia. Subindo o site..."
exec "$@"
