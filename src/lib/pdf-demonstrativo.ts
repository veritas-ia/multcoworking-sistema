/**
 * O PDF do demonstrativo, desenhado com as cores da Mult.
 *
 * POR QUE UMA BIBLIOTECA ENTROU NA STACK
 *
 * O CLAUDE.md fixa a stack, e ate aqui nada de PDF existia: o plano era abrir
 * a tela no formato de impressao e deixar o navegador salvar. Isso deixou de
 * servir quando o dono pediu para MANDAR o documento pelo WhatsApp — para
 * anexar um arquivo e preciso ter o arquivo, e so o navegador do operador
 * poderia produzi-lo. Entao o PDF passou a ser gerado no servidor.
 *
 * A escolhida foi a "pdf-lib": JavaScript puro, sem dependencia nativa e sem
 * ler fonte do disco em tempo de execucao. Essa ultima parte importa para o
 * deploy: o Dockerfile usa o modo "standalone" do Next, que copia so os
 * arquivos que ele consegue rastrear — biblioteca que abre arquivo de fonte
 * na hora de rodar costuma funcionar no desenvolvimento e quebrar em
 * producao, que e o pior lugar para descobrir.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  comoDinheiro,
  horasPorExtenso,
  type Demonstrativo,
} from "./demonstrativos";

/** As cores da marca, do CLAUDE.md. */
const AMARELO = rgb(1, 0.78, 0);
const PRETO = rgb(0, 0, 0);
const TEXTO = rgb(0.13, 0.13, 0.13);
const SECUNDARIO = rgb(0.33, 0.33, 0.33);
const BORDA = rgb(0.9, 0.9, 0.9);
const FUNDO = rgb(0.97, 0.97, 0.97);

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 48;
const LARGURA_UTIL = A4.largura - MARGEM * 2;

/** "2026-09-11" -> "11/09/2026". */
function emDiaMesAno(data: string): string {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

type Caneta = {
  pdf: PDFDocument;
  pagina: PDFPage;
  y: number;
  normal: PDFFont;
  negrito: PDFFont;
};

/** Abre uma página nova quando a atual acabou, repetindo o cabeçalho da tabela. */
function garantirEspaco(caneta: Caneta, precisa: number, aoVirar?: () => void): void {
  if (caneta.y - precisa > MARGEM + 40) {
    return;
  }
  caneta.pagina = caneta.pdf.addPage([A4.largura, A4.altura]);
  caneta.y = A4.altura - MARGEM;
  aoVirar?.();
}

function escrever(
  caneta: Caneta,
  texto: string,
  x: number,
  opcoes: { tamanho?: number; cor?: ReturnType<typeof rgb>; negrito?: boolean } = {},
): void {
  caneta.pagina.drawText(texto, {
    x,
    y: caneta.y,
    size: opcoes.tamanho ?? 10,
    font: opcoes.negrito ? caneta.negrito : caneta.normal,
    color: opcoes.cor ?? TEXTO,
  });
}

/** Escreve alinhado à direita, para os números ficarem na mesma coluna. */
function escreverADireita(
  caneta: Caneta,
  texto: string,
  xDireita: number,
  opcoes: { tamanho?: number; cor?: ReturnType<typeof rgb>; negrito?: boolean } = {},
): void {
  const tamanho = opcoes.tamanho ?? 10;
  const fonte = opcoes.negrito ? caneta.negrito : caneta.normal;
  const largura = fonte.widthOfTextAtSize(texto, tamanho);
  escrever(caneta, texto, xDireita - largura, opcoes);
}

/**
 * A logo da marca, lida de "public/".
 *
 * Devolve nulo quando o arquivo nao esta la, e o documento sai com o nome
 * escrito no lugar. Uma imagem que sumiu nao pode impedir a gestao de cobrar
 * o cliente.
 */
async function carregarLogo(pdf: PDFDocument) {
  try {
    const caminho = join(process.cwd(), "public", "logotipo-multcoworking-recorte.png");
    return await pdf.embedPng(await readFile(caminho));
  } catch {
    return null;
  }
}

/**
 * Monta o documento inteiro e devolve os bytes do PDF.
 *
 * O desenho segue a planilha que a gestao usava — cabecalho "De / Para /
 * Mes", a tabela de dias e horas, o valor discriminado e o total — para a
 * pessoa que recebe reconhecer o documento de sempre, so que conferido.
 */
export async function gerarPdfDoDemonstrativo(
  dados: Demonstrativo,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Demonstrativo ${dados.clienteNome}`);
  pdf.setProducer("Mult Coworking");

  const caneta: Caneta = {
    pdf,
    pagina: pdf.addPage([A4.largura, A4.altura]),
    y: A4.altura - MARGEM,
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  // --- faixa amarela da marca -------------------------------------------------
  caneta.pagina.drawRectangle({
    x: 0,
    y: A4.altura - 8,
    width: A4.largura,
    height: 8,
    color: AMARELO,
  });

  // A LOGO, quando o arquivo estiver no lugar. Falhar aqui nao pode derrubar
  // o documento: um PDF sem logo ainda e um PDF util, e a cobranca nao pode
  // parar porque uma imagem sumiu.
  const logo = await carregarLogo(pdf);

  if (logo) {
    // A logo ocupa o topo; o subtitulo vem logo abaixo dela, colado, para os
    // dois lerem como uma coisa so.
    const alturaDaLogo = 34;
    const largura = (logo.width / logo.height) * alturaDaLogo;
    caneta.y -= alturaDaLogo - 6;
    caneta.pagina.drawImage(logo, {
      x: MARGEM,
      y: caneta.y,
      width: largura,
      height: alturaDaLogo,
    });
    caneta.y -= 14;
  } else {
    escrever(caneta, "MULT COWORKING", MARGEM, {
      tamanho: 16,
      negrito: true,
      cor: PRETO,
    });
    caneta.y -= 18;
  }

  escrever(caneta, "Controle de horas", MARGEM, { tamanho: 10, cor: SECUNDARIO });

  // --- para quem, e de quando -------------------------------------------------
  caneta.y -= 28;
  escrever(caneta, "Para", MARGEM, { tamanho: 8, cor: SECUNDARIO });
  caneta.y -= 14;
  escrever(caneta, dados.clienteNome, MARGEM, { tamanho: 13, negrito: true });

  caneta.y += 14;
  escrever(caneta, "Período", MARGEM + 300, { tamanho: 8, cor: SECUNDARIO });
  caneta.y -= 14;
  escrever(
    caneta,
    `${emDiaMesAno(dados.de)} a ${emDiaMesAno(dados.ate)}`,
    MARGEM + 300,
    { tamanho: 13, negrito: true },
  );

  // --- a tabela de horas ------------------------------------------------------
  caneta.y -= 34;

  const COL_DIA = MARGEM;
  const COL_SALA = MARGEM + 90;
  const COL_HORARIO = MARGEM + 270;
  const COL_HORAS = MARGEM + LARGURA_UTIL;

  function cabecalhoDaTabela(): void {
    caneta.pagina.drawRectangle({
      x: MARGEM - 6,
      y: caneta.y - 5,
      width: LARGURA_UTIL + 12,
      height: 20,
      color: FUNDO,
    });
    escrever(caneta, "DIA", COL_DIA, { tamanho: 8, negrito: true, cor: SECUNDARIO });
    escrever(caneta, "SALA", COL_SALA, { tamanho: 8, negrito: true, cor: SECUNDARIO });
    escrever(caneta, dados.porPessoa.length > 1 ? "QUEM · HORA" : "HORÁRIO", COL_HORARIO, {
      tamanho: 8,
      negrito: true,
      cor: SECUNDARIO,
    });
    escreverADireita(caneta, "HORAS", COL_HORAS, {
      tamanho: 8,
      negrito: true,
      cor: SECUNDARIO,
    });
    caneta.y -= 20;
  }

  cabecalhoDaTabela();

  for (const item of dados.itens) {
    garantirEspaco(caneta, 18, cabecalhoDaTabela);
    escrever(caneta, emDiaMesAno(item.dia), COL_DIA);
    escrever(caneta, item.sala, COL_SALA);
    escrever(
      caneta,
      // Num documento de empresa, quem reservou importa mais do que o
      // horario exato: e o que o cliente confere.
      dados.porPessoa.length > 1
        ? `${item.pessoa} · ${item.inicio}`
        : `${item.inicio} às ${item.fim}`,
      COL_HORARIO,
      { cor: SECUNDARIO },
    );
    escreverADireita(caneta, horasPorExtenso(item.horas), COL_HORAS);
    caneta.y -= 16;
    caneta.pagina.drawLine({
      start: { x: MARGEM, y: caneta.y + 10 },
      end: { x: MARGEM + LARGURA_UTIL, y: caneta.y + 10 },
      thickness: 0.5,
      color: BORDA,
    });
  }

  if (dados.itens.length === 0) {
    escrever(caneta, "Nenhuma reserva registrada neste período.", COL_DIA, {
      cor: SECUNDARIO,
    });
    caneta.y -= 16;
  }

  // --- total de horas, e a divisão por sala -----------------------------------
  garantirEspaco(caneta, 40);
  caneta.y -= 6;
  escrever(caneta, "TOTAL DE HORAS", COL_DIA, { tamanho: 10, negrito: true });
  escreverADireita(caneta, horasPorExtenso(dados.horas), COL_HORAS, {
    tamanho: 10,
    negrito: true,
  });

  if (dados.porSala.length > 1) {
    caneta.y -= 14;
    escrever(
      caneta,
      dados.porSala
        .map((s) => `${s.sala}: ${horasPorExtenso(s.horas)}`)
        .join("   ·   "),
      COL_DIA,
      { tamanho: 9, cor: SECUNDARIO },
    );
  }

  // QUEM RESERVOU, num documento de empresa. O cliente quer saber de quem
  // sao as horas que estao sendo cobradas dele.
  if (dados.porPessoa.length > 1) {
    caneta.y -= 14;
    escrever(
      caneta,
      dados.porPessoa
        .map((p) => `${p.nome}: ${horasPorExtenso(p.horas)}`)
        .join("   ·   "),
      COL_DIA,
      { tamanho: 9, cor: SECUNDARIO },
    );
  }

  // --- o valor discriminado ---------------------------------------------------
  garantirEspaco(caneta, 120);
  caneta.y -= 34;
  escrever(caneta, "VALOR DISCRIMINADO", COL_DIA, {
    tamanho: 8,
    negrito: true,
    cor: SECUNDARIO,
  });
  caneta.y -= 20;

  escrever(
    caneta,
    `Horas · ${horasPorExtenso(dados.horas)} × ${comoDinheiro(
      Math.round(Number(dados.valorHora) * 100),
    )}`,
    COL_DIA,
  );
  escreverADireita(caneta, comoDinheiro(dados.valorDasHorasCentavos), COL_HORAS);
  caneta.y -= 18;

  for (const linha of dados.linhasExtras) {
    garantirEspaco(caneta, 18);
    escrever(caneta, linha.descricao, COL_DIA);
    escreverADireita(
      caneta,
      comoDinheiro(Math.round(Number(linha.valor || "0") * 100)),
      COL_HORAS,
    );
    caneta.y -= 18;
  }

  // --- o total ----------------------------------------------------------------
  garantirEspaco(caneta, 50);
  caneta.y -= 8;
  caneta.pagina.drawRectangle({
    x: MARGEM - 6,
    y: caneta.y - 10,
    width: LARGURA_UTIL + 12,
    height: 32,
    color: AMARELO,
  });
  caneta.y += 2;
  escrever(caneta, "VALOR TOTAL", COL_DIA, { tamanho: 12, negrito: true, cor: PRETO });
  escreverADireita(caneta, comoDinheiro(dados.totalCentavos), COL_HORAS, {
    tamanho: 14,
    negrito: true,
    cor: PRETO,
  });

  // --- rodapé -----------------------------------------------------------------
  caneta.y -= 34;
  escrever(
    caneta,
    `Emitido em ${new Date().toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    })} · Mult Coworking`,
    COL_DIA,
    { tamanho: 8, cor: SECUNDARIO },
  );

  return pdf.save();
}

/** O nome do arquivo, do jeito que o cliente vai ver no WhatsApp. */
export function nomeDoArquivo(dados: Demonstrativo): string {
  const limpo = dados.clienteNome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `Demonstrativo-${limpo}-${dados.de}-a-${dados.ate}.pdf`;
}
