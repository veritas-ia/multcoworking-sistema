# =============================================================================
# IMAGEM DE PRODUCAO — Sistema de Reservas Mult Coworking
#
# Construida em tres etapas. As duas primeiras existem so para preparar as
# coisas e sao JOGADAS FORA no fim: o que vai para o servidor e apenas a
# terceira. E por isso que a imagem final nao carrega o 1,2 GB de ferramentas
# de desenvolvimento.
# =============================================================================

# --- Etapa 1: baixar as dependencias ----------------------------------------
FROM node:22-alpine AS dependencias
WORKDIR /app

COPY package.json package-lock.json ./

# "--ignore-scripts" porque o "npm install" deste projeto tenta gerar o cliente
# do Prisma, e o codigo ainda nao foi copiado. Ele e gerado na etapa seguinte.
RUN npm ci --ignore-scripts


# --- Etapa 2: construir o site ----------------------------------------------
FROM node:22-alpine AS construcao
WORKDIR /app

COPY --from=dependencias /app/node_modules ./node_modules
COPY . .

# O cliente do Prisma e gerado AQUI DENTRO, para o Linux do container. O
# gerado no computador de quem programa nao serve: sao sistemas diferentes.
# A DATABASE_URL de mentira e so para o comando ter o que ler — nenhuma
# conexao e aberta durante a construcao.
ENV DATABASE_URL="postgresql://construcao:construcao@localhost:5432/construcao"
RUN npx prisma generate --config prisma7.config.ts

RUN npm run build


# --- Etapa 3: a imagem que vai para o servidor -------------------------------
FROM node:22-alpine AS producao
WORKDIR /app

ENV NODE_ENV=production
# Tira o aviso de "nova versao do npm" do log de producao: no meio de uma
# falha real, esse recado so atrapalha quem esta lendo.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# O Next precisa escutar em 0.0.0.0 para o EasyPanel alcancar o site. Em
# "localhost" ele so responderia a chamadas de dentro do proprio container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Poe as ferramentas de banco no caminho. Sem isto, a carga inicial falha com
# "spawn tsx ENOENT": o Prisma chama "tsx" pelo nome e nao o encontra.
ENV PATH="/app/node_modules/.bin:${PATH}"

# O site roda como "nextjs", e nao como root. Se um dia alguem encontrar uma
# falha no site, encontra uma conta sem poder nenhum do lado de dentro.
#
# A troca de usuario acontece ANTES de instalar qualquer coisa, de proposito.
# Instalar como root e corrigir o dono depois com "chown -R" parece igual, mas
# nao e: cada arquivo tocado pelo chown e gravado de novo, e a imagem carrega
# duas copias de tudo. Aqui os arquivos ja nascem com o dono certo.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs --home /home/nextjs nextjs \
 && chown nextjs:nodejs /app

USER nextjs
# O npm precisa de um lugar seu para escrever; sem isto ele tenta a pasta do
# root e para.
ENV HOME=/home/nextjs
ENV npm_config_cache=/home/nextjs/.npm

# --- as ferramentas de banco -------------------------------------------------
# So o necessario para criar as tabelas e carregar os dados iniciais pelo
# terminal do EasyPanel: o Prisma, o leitor de TypeScript que a carga inicial
# usa e o dotenv que o arquivo de configuracao pede.
#
# A instalacao usa um manifesto PROPRIO, de uma linha, e nao o package.json do
# projeto. Duas razoes, as duas descobertas rodando a imagem de verdade:
#
#   1. com o package.json do projeto, o npm instalava tambem as centenas de
#      dependencias do site — 1 GB numa imagem que deveria ser enxuta;
#   2. com NODE_ENV=production, o npm PULA tudo que esta em
#      "devDependencies" — e o leitor de TypeScript esta la. A imagem subia
#      sem ele e a carga inicial falhava com "spawn tsx ENOENT".
#
# As versoes saem do package-lock.json do projeto, para a ferramenta nunca
# ficar em desacordo com o que o site usa.
COPY --chown=nextjs:nodejs package-lock.json /tmp/lock.json
RUN printf '{"name":"ferramentas-de-banco","private":true}' > package.json \
 && npm install --no-audit --no-fund \
      "prisma@$(node -p "require('/tmp/lock.json').packages['node_modules/prisma'].version")" \
      "tsx@$(node -p "require('/tmp/lock.json').packages['node_modules/tsx'].version")" \
      "dotenv@$(node -p "require('/tmp/lock.json').packages['node_modules/dotenv'].version")" \
      "bcryptjs@$(node -p "require('/tmp/lock.json').packages['node_modules/bcryptjs'].version")" \
 && rm package.json /tmp/lock.json \
 && npm cache clean --force

COPY --chown=nextjs:nodejs prisma7.config.ts ./
# O schema e as migracoes: sao eles que o "prisma migrate deploy" aplica.
COPY --chown=nextjs:nodejs prisma ./prisma

# O cliente do Prisma gerado, do jeito que a CARGA INICIAL o importa.
#
# O site nao precisa desta copia — o dele ja vai embutido no pacote enxuto. Ela
# existe porque a carga inicial e um programa a parte, que abre o banco por
# conta propria. Sem ela, o comando falha com "Cannot find module".
COPY --from=construcao --chown=nextjs:nodejs /app/src/generated ./src/generated

# --- o site ------------------------------------------------------------------
# "standalone" e o pacote enxuto que o Next monta: so o codigo realmente usado.
COPY --from=construcao --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=construcao --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
