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

/**
 * CABECALHOS DE SEGURANCA (Fase 12).
 *
 * Sao instrucoes que o servidor manda junto com cada pagina.
 *
 * O "X-Frame-Options: DENY" vale SO para o painel, e essa distincao e de
 * proposito. Ele impede que a pagina seja aberta dentro de outro site
 * disfarcada — o golpe classico e cobrir a tela com uma imagem e fazer a
 * pessoa clicar em "cancelar reserva" achando que clica noutra coisa. No
 * painel isso nunca deve acontecer; ja a area publica um dia pode ser
 * embutida no site do coworking, e bloquear tudo quebraria essa possibilidade
 * sem ninguem entender por que.
 */
const CABECALHOS_COMUNS = [
  // Impede o navegador de "adivinhar" o tipo de um arquivo e executar como
  // script algo que era para ser texto.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Ao sair do site por um link, o outro lado recebe so o dominio, nunca o
  // endereco completo com os parametros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Gera um pacote que se basta: o Next copia para dentro dele so o codigo
  // que o site realmente usa. E o que permite a imagem de producao dispensar
  // as centenas de megabytes de node_modules (ver o Dockerfile).
  output: "standalone",
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  // Esconde o "X-Powered-By: Next.js", que so serve para contar a quem estiver
  // procurando alvo qual e a tecnologia e a versao do site.
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:caminho*", headers: CABECALHOS_COMUNS },
      {
        source: "/admin/:caminho*",
        headers: [...CABECALHOS_COMUNS, { key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
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
