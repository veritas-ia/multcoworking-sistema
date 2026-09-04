import path from "node:path";

import type { NextConfig } from "next";

/**
 * DUAS CORRECOES PARA O MESMO PROBLEMA: o driver do Postgres (`pg`) e o
 * node-cron usam recursos do Node — arquivos, caminhos — que o empacotador do
 * Next nao consegue abrir sozinho. Eles entram na conta por causa do
 * `instrumentation.ts`, que liga as rotinas da Fase 10.
 *
 * O Next monta o `instrumentation.ts` duas vezes, e cada montagem precisa de um
 * remedio diferente:
 *
 * 1. No SERVIDOR de verdade: `serverExternalPackages` manda usar o driver
 *    instalado, sem tentar empacotar.
 * 2. No ambiente RESTRITO do `middleware.ts` (chamado "edge"), que nao olha para
 *    a lista acima: ali o agendador e trocado por um substituto vazio. Isso e
 *    seguro porque o `register()` do `instrumentation.ts` ja desiste antes de
 *    usar o agendador quando NEXT_RUNTIME nao e "nodejs" — ou seja, essa
 *    montagem nunca liga rotina nenhuma.
 */
const AGENDADOR = /[\\/]src[\\/]lib[\\/]agendador\.ts$/;

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  webpack: (config, { nextRuntime, webpack }) => {
    if (nextRuntime === "edge") {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          AGENDADOR,
          path.resolve(import.meta.dirname, "src/lib/agendador-fora-do-servidor.ts"),
        ),
      );
    }

    return config;
  },
};

export default nextConfig;
