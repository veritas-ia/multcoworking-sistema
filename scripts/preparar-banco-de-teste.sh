#!/bin/sh
# Cria (ou recria) o banco que a suite de testes usa.
#
# Por que existe: sem ele os testes rodariam no MESMO banco do "npm run dev".
# Bastava voce criar uma reserva na tela para a suite comecar a falhar por
# sobreposicao de horario — e um teste podia apagar o que voce estava vendo.
#
# Uso: npm run db:teste
set -e

CONTAINER=coworking-postgres
ORIGEM=coworking
DESTINO=coworking_teste

echo "Recriando o banco de testes ($DESTINO)..."

docker exec "$CONTAINER" psql -U coworking -d postgres -c "DROP DATABASE IF EXISTS $DESTINO;" >/dev/null
docker exec "$CONTAINER" psql -U coworking -d postgres -c "CREATE DATABASE $DESTINO OWNER coworking;" >/dev/null

# O banco roda em UTC, sempre. Isto e um ajuste do BANCO, nao do schema, entao
# o pg_dump nao leva junto — sem esta linha os testes de fuso falham.
docker exec "$CONTAINER" psql -U coworking -d postgres -c "ALTER DATABASE $DESTINO SET timezone TO 'UTC';" >/dev/null

# A estrutura sai do banco de desenvolvimento, entao ela ja vem com todas as
# migracoes aplicadas — inclusive as travas e os gatilhos escritos em SQL puro.
docker exec "$CONTAINER" sh -c \
  "pg_dump -U coworking --schema-only $ORIGEM | psql -U coworking -d $DESTINO -q"

# Os cadastros que os testes esperam encontrar: salas, horario de
# funcionamento, parametros, modelos de mensagem e areas de atuacao.
#
# ATENCAO ao acrescentar tabela de cadastro nova aqui. As areas de atuacao
# (profissoes) entraram em 27/10/2026, quando a lista deixou de ser um tipo
# fixo do banco: sem esta linha o banco de teste nasce sem nenhuma area, e
# TODO teste que cria reserva falha dizendo que nao achou o registro — uma
# falha que nao tem nada a ver com a regra sendo testada.
docker exec "$CONTAINER" sh -c \
  "pg_dump -U coworking --data-only \
     --table=salas --table=horarios_funcionamento \
     --table=configuracoes --table=templates_mensagem \
     --table=profissoes \
     $ORIGEM | psql -U coworking -d $DESTINO -q"

echo "Pronto. Agora \`npm test\` usa o $DESTINO e nao encosta nos seus dados."
