/**
 * OS PRINTS DO PAINEL que entram no PDF da versao 2.0.
 *
 * COMO RODAR (o passo a passo inteiro, porque ele nao e obvio):
 *
 *   1. copie um banco com dados de verdade para um banco LOCAL — nunca
 *      aponte isto para producao nem para a previa:
 *        docker exec <previa-db> pg_dump -U postgres -d automacoes \
 *          --no-owner --no-acl > /tmp/copia.sql
 *        docker exec <local-db> psql -U <usuario> -d postgres \
 *          -c 'CREATE DATABASE coworking_prints'
 *        docker exec -i <local-db> psql -U <usuario> -d coworking_prints < /tmp/copia.sql
 *
 *   2. ponha as migracoes em dia nessa copia:
 *        DATABASE_URL=...coworking_prints npx prisma migrate deploy
 *
 *   3. crie o admin dos prints:
 *        DATABASE_URL=...coworking_prints npx tsx scripts/admin-dos-prints.ts
 *
 *   4. suba o sistema contra ela, com AMBIENTE VAZIO — senao a faixa preta da
 *      previa aparece em todos os prints:
 *        DATABASE_URL=...coworking_prints AMBIENTE="" CRON_ATIVO="false" \
 *        ADMIN_SESSAO_SEGREDO=<qualquer coisa> npx next start -p 3100
 *
 *   5. instale o navegador FORA do projeto (o playwright nao e dependencia
 *      daqui, e nao deve virar uma) e rode este arquivo:
 *        npm install playwright && npx playwright install chromium --with-deps
 *        node scripts/tirar-prints.mjs <pasta-de-destino>
 *
 *   6. recorte e reduza pela metade (o print sai em dobro para ficar nitido),
 *      salvando em docs/prints/.
 *
 * O LOGIN USA SELETOR DE CSS, e nao o rotulo do campo: os campos do painel
 * tem identificador gerado pelo React, que muda a cada build.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:3100";
const DESTINO = process.argv[2];
await mkdir(DESTINO, { recursive: true });

const TELAS = [
  ["01-controle-de-horas", "/admin/demonstrativos"],
  ["02-clientes", "/admin/configuracoes?aba=clientes"],
  ["03-empresas", "/admin/configuracoes?aba=empresas"],
  ["04-emporio", "/admin/emporio?aba=lancar"],
  ["04b-contagem", "/admin/emporio?aba=contagem"],
  ["04c-produtos", "/admin/emporio?aba=produtos"],
  ["05-financeiro", "/admin/financeiro?aba=painel"],
  ["05b-contas", "/admin/financeiro?aba=contas"],
  ["05c-mensalidades", "/admin/financeiro?aba=mensalidades"],
  ["06-agenda", "/admin/agenda?data=2026-10-26"],
  ["06b-acoes", "/admin/configuracoes?aba=acoes"],
  ["07-mensagens", "/admin/configuracoes?aba=mensagens"],
  ["07b-parametros", "/admin/configuracoes?aba=parametros"],
  ["08-usuarios", "/admin/configuracoes?aba=usuarios"],
  ["08b-relatorios", "/admin/relatorios"],
];

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});
const pagina = await contexto.newPage();

await pagina.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
await pagina.fill("input[type=text]", "prints");
await pagina.fill("input[type=password]", "prints-para-o-pdf-2026");
await pagina.getByRole("button", { name: /entrar/i }).click();
await pagina.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20000 });
process.stdout.write(`entrou: ${pagina.url()}\n`);

for (const [nome, caminho] of TELAS) {
  try {
    await pagina.goto(`${BASE}${caminho}`, { waitUntil: "networkidle", timeout: 30000 });
    await pagina.waitForTimeout(2200);
    if (pagina.url().includes("/login")) {
      process.stdout.write(`SESSAO PERDIDA em ${nome}\n`);
      continue;
    }
    await pagina.screenshot({ path: `${DESTINO}/${nome}.png` });
    process.stdout.write(`ok  ${nome}\n`);
  } catch (erro) {
    process.stdout.write(`FALHOU ${nome}: ${erro.message.split("\n")[0]}\n`);
  }
}

await navegador.close();
