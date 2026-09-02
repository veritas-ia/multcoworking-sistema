/**
 * Impede DOIS servidores de desenvolvimento no mesmo projeto.
 *
 * Por que isto existe: quando dois "npm run dev" rodam ao mesmo tempo, o
 * Next avisa que a porta esta ocupada e vai sozinho para a porta seguinte —
 * mas os dois continuam escrevendo na MESMA pasta ".next". Eles se sobrescrevem,
 * e o site passa a falhar de um jeito que nao parece ter causa: uma hora abre,
 * outra hora uma tela fica girando para sempre.
 *
 * Roda sozinho antes do "npm run dev" (gancho "predev" do package.json).
 * Se der qualquer problema inesperado, ele sai de lado e deixa o dev subir:
 * a funcao dele e avisar, nunca atrapalhar.
 */
import { createServer } from "node:net";

const porta = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(porta) || porta <= 0) {
  process.exit(0);
}

const sonda = createServer();

sonda.once("error", (erro) => {
  if (erro.code !== "EADDRINUSE") {
    process.exit(0);
  }

  process.stderr.write(
    [
      "",
      `  A porta ${porta} ja esta ocupada.`,
      "",
      "  Quase sempre isso e um servidor antigo deste mesmo projeto que ficou",
      "  aberto. Dois servidores ao mesmo tempo atrapalham um ao outro e o site",
      "  para de abrir.",
      "",
      "  Para ver quem esta segurando a porta:",
      `      lsof -nP -iTCP:${porta} -sTCP:LISTEN`,
      "",
      "  Para fechar todos os servidores deste projeto:",
      '      pkill -f "next dev"',
      "",
      "  Depois rode 'npm run dev' de novo.",
      "",
    ].join("\n"),
  );
  process.exit(1);
});

sonda.once("listening", () => {
  sonda.close(() => process.exit(0));
});

// Sem endereco fixo, igual ao proprio Next: assim a sonda enxerga um servidor
// tanto em IPv4 quanto em IPv6.
sonda.listen(porta);
