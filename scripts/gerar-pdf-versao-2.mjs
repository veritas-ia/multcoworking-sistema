/**
 * O DOCUMENTO DA VERSÃO 2.0, em PDF.
 *
 * Para quem é: os donos do Mult Coworking. Não é documentação técnica — é a
 * explicação, em português simples, do que o sistema passou a fazer.
 *
 * POR QUE É UM SCRIPT, e não um texto escrito à mão: assim o documento pode
 * ser refeito quando algo mudar, sem ninguém reformatar nada. É o mesmo
 * pdf-lib que já gera o demonstrativo do cliente — nenhuma biblioteca nova.
 *
 * Rodar com:  node scripts/gerar-pdf-versao-2.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// --- A paleta da marca (CLAUDE.md) -------------------------------------------
const AMARELO = rgb(1, 0.78, 0);
const PRETO = rgb(0, 0, 0);
const BRANCO = rgb(1, 1, 1);
const TEXTO = rgb(0.13, 0.13, 0.13);
const SECUNDARIO = rgb(0.33, 0.33, 0.33);
const BORDA = rgb(0.898, 0.898, 0.898);
const FUNDO = rgb(0.969, 0.969, 0.969);

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;
const UTIL = A4.largura - MARGEM * 2;
const RODAPE = 64;

/**
 * A fonte padrão do PDF escreve só o alfabeto ocidental (WinAnsi). Uma seta
 * ou um sinal de certo derrubariam a geração inteira — e o documento não
 * sairia. Aqui eles viram texto comum antes de chegar na folha.
 */
function limpar(texto) {
  return texto
    .replace(/[→➔]/g, ">")
    .replace(/[✓✔]/g, "-")
    .replace(/[ ]/g, " ");
}

const estado = {
  pdf: null,
  pagina: null,
  y: 0,
  numero: 0,
  normal: null,
  negrito: null,
  logo: null,
};

function larguraDe(texto, tamanho, negrito = false) {
  const fonte = negrito ? estado.negrito : estado.normal;
  return fonte.widthOfTextAtSize(limpar(texto), tamanho);
}

/** Quebra o texto em linhas que cabem na largura dada. */
function emLinhas(texto, largura, tamanho, negrito = false) {
  const palavras = limpar(texto).split(/\s+/).filter(Boolean);
  const linhas = [];
  let atual = "";

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;

    if (larguraDe(tentativa, tamanho, negrito) <= largura) {
      atual = tentativa;
      continue;
    }

    if (atual) linhas.push(atual);
    atual = palavra;
  }

  if (atual) linhas.push(atual);
  return linhas;
}

function novaPagina(opcoes = {}) {
  estado.pagina = estado.pdf.addPage([A4.largura, A4.altura]);
  estado.y = A4.altura - MARGEM - 10;

  // A CAPA NAO E NUMERADA, e por isso nao incrementa o contador: numerada,
  // a pagina seguinte sairia como 2 e o sumario deixaria de bater.
  if (opcoes.capa) {
    return;
  }

  estado.numero += 1;

  // Rodapé: a faixa fina amarela e o número da página.
  estado.pagina.drawRectangle({
    x: 0,
    y: 0,
    width: A4.largura,
    height: 4,
    color: AMARELO,
  });

  const rodape = "Mult Coworking · Sistema de reservas, versão 2.0";
  estado.pagina.drawText(rodape, {
    x: MARGEM,
    y: 30,
    size: 8,
    font: estado.normal,
    color: SECUNDARIO,
  });

  const numero = String(estado.numero);
  estado.pagina.drawText(numero, {
    x: A4.largura - MARGEM - larguraDe(numero, 8, true),
    y: 30,
    size: 8,
    font: estado.negrito,
    color: TEXTO,
  });
}

/** Garante espaço na folha; vira a página quando não cabe. */
function cabe(altura) {
  if (estado.y - altura < RODAPE) {
    novaPagina();
  }
}

function escrever(texto, x, y, opcoes = {}) {
  estado.pagina.drawText(limpar(texto), {
    x,
    y,
    size: opcoes.tamanho ?? 10,
    font: opcoes.negrito ? estado.negrito : estado.normal,
    color: opcoes.cor ?? TEXTO,
  });
}

function paragrafo(texto, opcoes = {}) {
  const tamanho = opcoes.tamanho ?? 10.5;
  const entrelinha = opcoes.entrelinha ?? tamanho * 1.55;
  const largura = opcoes.largura ?? UTIL;
  const x = opcoes.x ?? MARGEM;

  for (const linha of emLinhas(texto, largura, tamanho, opcoes.negrito)) {
    cabe(entrelinha);
    escrever(linha, x, estado.y, { ...opcoes, tamanho });
    estado.y -= entrelinha;
  }

  estado.y -= opcoes.depois ?? 6;
}

function espaco(quanto) {
  estado.y -= quanto;
}

// -----------------------------------------------------------------------------
// As peças do documento
// -----------------------------------------------------------------------------

/** Título de capítulo: número grande em amarelo, título em preto. */
function capitulo(numero, titulo, resumo) {
  novaPagina();

  estado.pagina.drawRectangle({
    x: MARGEM,
    y: estado.y - 4,
    width: 46,
    height: 46,
    color: AMARELO,
  });

  const rotulo = String(numero);
  escrever(rotulo, MARGEM + 23 - larguraDe(rotulo, 24, true) / 2, estado.y + 12, {
    tamanho: 24,
    negrito: true,
    cor: PRETO,
  });

  const xTitulo = MARGEM + 62;
  const larguraTitulo = UTIL - 62;
  const linhas = emLinhas(titulo, larguraTitulo, 19, true);
  let yTitulo = estado.y + 22 + (linhas.length - 1) * 11;

  for (const linha of linhas) {
    escrever(linha, xTitulo, yTitulo, { tamanho: 19, negrito: true, cor: PRETO });
    yTitulo -= 22;
  }

  estado.y -= Math.max(56, linhas.length * 22 + 34);

  if (resumo) {
    paragrafo(resumo, { tamanho: 11, cor: SECUNDARIO, depois: 14 });
  }
}

/** Um rótulo pequeno em maiúsculas, com um traço amarelo embaixo. */
function etiqueta(texto) {
  cabe(34);
  escrever(texto.toUpperCase(), MARGEM, estado.y, {
    tamanho: 8.5,
    negrito: true,
    cor: SECUNDARIO,
  });
  estado.pagina.drawRectangle({
    x: MARGEM,
    y: estado.y - 6,
    width: 28,
    height: 2,
    color: AMARELO,
  });
  estado.y -= 20;
}

/** Item de lista: quadradinho amarelo e o texto. */
function marcador(texto) {
  const tamanho = 10.5;
  const entrelinha = 15.5;
  const x = MARGEM + 16;
  const linhas = emLinhas(texto, UTIL - 16, tamanho);

  cabe(linhas.length * entrelinha + 4);

  estado.pagina.drawRectangle({
    x: MARGEM + 1,
    y: estado.y + 2.5,
    width: 6,
    height: 6,
    color: AMARELO,
  });

  for (const linha of linhas) {
    escrever(linha, x, estado.y, { tamanho });
    estado.y -= entrelinha;
  }

  estado.y -= 4;
}

/** Caixa cinza com título — usada para "antes e agora" e para os avisos. */
function caixa(titulo, corpo, opcoes = {}) {
  const tamanho = 10;
  const entrelinha = 14.5;
  const largura = UTIL - 36;
  const linhas = corpo.flatMap((texto) => emLinhas(texto, largura, tamanho));
  const altura = 30 + linhas.length * entrelinha + (titulo ? 18 : 0);

  cabe(altura + 10);

  estado.pagina.drawRectangle({
    x: MARGEM,
    y: estado.y - altura + 16,
    width: UTIL,
    height: altura,
    color: opcoes.cor ?? FUNDO,
    borderColor: BORDA,
    borderWidth: 1,
  });

  // A barrinha amarela da lateral esquerda.
  estado.pagina.drawRectangle({
    x: MARGEM,
    y: estado.y - altura + 16,
    width: 4,
    height: altura,
    color: AMARELO,
  });

  let y = estado.y;

  if (titulo) {
    escrever(titulo, MARGEM + 18, y, { tamanho: 10.5, negrito: true, cor: PRETO });
    y -= 18;
  }

  for (const linha of linhas) {
    escrever(linha, MARGEM + 18, y, { tamanho, cor: TEXTO });
    y -= entrelinha;
  }

  estado.y -= altura + 10;
}

/** Onde a coisa fica no painel. */
function ondeFica(texto) {
  cabe(26);
  escrever("ONDE FICA:", MARGEM, estado.y, { tamanho: 8.5, negrito: true, cor: SECUNDARIO });
  escrever(texto, MARGEM + larguraDe("ONDE FICA: ", 8.5, true), estado.y, {
    tamanho: 9.5,
    negrito: true,
    cor: PRETO,
  });
  estado.y -= 24;
}

// -----------------------------------------------------------------------------
// O conteúdo
// -----------------------------------------------------------------------------

function capa() {
  novaPagina({ capa: true });

  // Bloco amarelo do topo, com o logotipo preto em cima — a regra de contraste
  // da própria marca.
  const alturaDaFaixa = 300;
  estado.pagina.drawRectangle({
    x: 0,
    y: A4.altura - alturaDaFaixa,
    width: A4.largura,
    height: alturaDaFaixa,
    color: AMARELO,
  });

  if (estado.logo) {
    const alturaDaLogo = 52;
    const largura = (estado.logo.width / estado.logo.height) * alturaDaLogo;
    estado.pagina.drawImage(estado.logo, {
      x: (A4.largura - largura) / 2,
      y: A4.altura - alturaDaFaixa / 2 - alturaDaLogo / 2,
      width: largura,
      height: alturaDaLogo,
    });
  } else {
    const nome = "MULT COWORKING";
    escrever(nome, (A4.largura - larguraDe(nome, 28, true)) / 2, A4.altura - 160, {
      tamanho: 28,
      negrito: true,
      cor: PRETO,
    });
  }

  let y = A4.altura - alturaDaFaixa - 88;

  const chapeu = "SISTEMA DE RESERVAS E GESTÃO";
  escrever(chapeu, MARGEM, y, { tamanho: 10, negrito: true, cor: SECUNDARIO });
  y -= 56;

  escrever("Versão 2.0", MARGEM, y, { tamanho: 52, negrito: true, cor: PRETO });
  y -= 34;

  estado.pagina.drawRectangle({ x: MARGEM, y, width: 90, height: 5, color: PRETO });
  y -= 44;

  for (const linha of emLinhas(
    "O que o sistema passou a fazer: a cobrança do mensalista, o cadastro de clientes, o empório e o controle financeiro do coworking inteiro.",
    UTIL - 60,
    13,
  )) {
    escrever(linha, MARGEM, y, { tamanho: 13, cor: TEXTO });
    y -= 21;
  }

  y -= 30;
  escrever("Documento preparado para os donos do Mult Coworking", MARGEM, y, {
    tamanho: 10,
    cor: SECUNDARIO,
  });
  y -= 16;
  escrever("Novembro de 2026", MARGEM, y, { tamanho: 10, negrito: true, cor: TEXTO });

  // Faixa preta do pé da capa.
  estado.pagina.drawRectangle({ x: 0, y: 0, width: A4.largura, height: 28, color: PRETO });
  escrever("Sala CI  |  Sala de Reunião  |  Sala Container", MARGEM, 10, {
    tamanho: 9,
    negrito: true,
    cor: BRANCO,
  });
}

function numeros() {
  novaPagina();

  escrever("O que mudou, em números", MARGEM, estado.y, {
    tamanho: 22,
    negrito: true,
    cor: PRETO,
  });
  estado.y -= 26;
  estado.pagina.drawRectangle({ x: MARGEM, y: estado.y, width: 60, height: 4, color: AMARELO });
  estado.y -= 26;

  paragrafo(
    "Cada número abaixo foi medido no próprio sistema, nos dados de verdade do coworking — nenhum deles é estimativa. São os problemas que a versão 2.0 veio resolver.",
    { tamanho: 11, cor: SECUNDARIO, depois: 18 },
  );

  const itens = [
    ["R$ 70", "cobrados a mais num único demonstrativo feito à mão. A planilha não tinha uma fórmula sequer: o total era digitado, e ninguém tinha como conferir."],
    ["44 nomes", "para 25 telefones. Treze clientes apareciam com mais de um nome, e a equipe não reconhecia quem era quem."],
    ["28 horas", "atribuídas a um cliente que usou 6,5. O telefone da recepção, usado quando o cliente não deixava o dele, tinha virado um “cliente” com as reservas de quatro pessoas."],
    ["72%", "dos lembretes de 13 horas antes saíam fora de hora. Dez mensagens foram enviadas às 4h da manhã."],
    ["14 convites", "para avaliar no Google mandados para o mesmo cliente. Um a cada reserva."],
    ["186 de 199", "reservas sem a empresa marcada. A conta do mensalista não fechava sozinha, e alguém somava à mão."],
  ];

  for (const [numero, texto] of itens) {
    const linhas = emLinhas(texto, UTIL - 132, 10);
    const altura = Math.max(42, linhas.length * 14.5 + 20);

    cabe(altura + 8);

    estado.pagina.drawRectangle({
      x: MARGEM,
      y: estado.y - altura + 14,
      width: UTIL,
      height: altura,
      color: FUNDO,
      borderColor: BORDA,
      borderWidth: 1,
    });
    estado.pagina.drawRectangle({
      x: MARGEM,
      y: estado.y - altura + 14,
      width: 4,
      height: altura,
      color: AMARELO,
    });

    escrever(numero, MARGEM + 18, estado.y - 4, { tamanho: 17, negrito: true, cor: PRETO });

    let y = estado.y;
    for (const linha of linhas) {
      escrever(linha, MARGEM + 120, y, { tamanho: 10, cor: TEXTO });
      y -= 14.5;
    }

    estado.y -= altura + 8;
  }
}

function sumario(capitulos) {
  novaPagina();

  escrever("O que tem neste documento", MARGEM, estado.y, {
    tamanho: 22,
    negrito: true,
    cor: PRETO,
  });
  estado.y -= 26;
  estado.pagina.drawRectangle({ x: MARGEM, y: estado.y, width: 60, height: 4, color: AMARELO });
  estado.y -= 34;

  capitulos.forEach((titulo, indice) => {
    cabe(34);

    escrever(String(indice + 1).padStart(2, "0"), MARGEM, estado.y, {
      tamanho: 13,
      negrito: true,
      cor: AMARELO,
    });
    escrever(titulo, MARGEM + 34, estado.y, { tamanho: 12, negrito: true, cor: PRETO });

    estado.y -= 12;
    estado.pagina.drawRectangle({
      x: MARGEM + 34,
      y: estado.y,
      width: UTIL - 34,
      height: 0.8,
      color: BORDA,
    });
    estado.y -= 22;
  });
}

// -----------------------------------------------------------------------------

const CAPITULOS = [
  {
    titulo: "A cobrança do mensalista deixou de ser feita à mão",
    resumo:
      "Era uma planilha preenchida manualmente. Hoje o sistema soma, monta o documento e envia.",
    problema: [
      "A planilha do ciclo de um cliente dizia 52 horas e R$ 3.033,66. Somando as linhas dela: 50 horas e R$ 3.023,66.",
      "Os totais eram texto digitado — não havia conta nenhuma por trás. O documento já tinha sido enviado ao cliente.",
    ],
    agora: [
      "O sistema monta o demonstrativo a partir das reservas do período, dia a dia, e soma sozinho. Nenhum total é digitado.",
      "O período é livre: o ciclo de um cliente pode ir do dia 10 ao dia 10, que é como ele já funcionava.",
      "As horas aparecem por sala e somadas, porque o cliente confere das duas formas.",
      "As horas inclusas na mensalidade são descontadas automaticamente, e o documento cobra só o excedente.",
      "O preço pode ser o combinado com aquele cliente — quem paga R$ 30 numa sala de R$ 40 continua pagando R$ 30.",
      "Sai em PDF com a identidade do coworking, e vai pelo WhatsApp com um toque.",
      "Depois de enviado, o documento não pode ser reescrito. Para corrigir, emite-se um novo — o antigo fica como registro do que foi mandado.",
    ],
    onde: "Cobrança > Controle de horas",
  },
  {
    titulo: "Cada cliente virou um cadastro de verdade",
    resumo:
      "Antes, quem era o cliente era adivinhado de dois campos soltos digitados em cada reserva: o nome e o telefone.",
    problema: [
      "25 telefones geraram 44 nomes diferentes. A mesma cliente aparecia como \u201cPrestare\u201d, \u201cPrestare Karen\u201d e \u201cPrestare - Karen\u201d.",
      "O telefone da recepção, usado quando o cliente não deixava o dele, acumulou 14 reservas de quatro pessoas diferentes — e o relatório mostrava um cliente com 28 horas que nunca existiu.",
    ],
    agora: [
      "Existe um cadastro de cliente, e a reserva aponta para ele. O mesmo cliente com dois telefones é uma pessoa só.",
      "No balcão, a recepção PROCURA o cliente em vez de digitar o telefone — e esse era justamente o motivo de o número da casa entrar no lugar do dele.",
      "No site, quem já reservou tem o nome preenchido e travado, com a opção de trocar.",
      "A equipe pode juntar dois cadastros, separar um telefone, renomear e desligar. Nada se apaga: o histórico fica.",
      "Um telefone de balcão pode ser marcado como tal, e o sistema separa as pessoas que estavam presas nele.",
    ],
    onde: "Cadastros > Clientes",
  },
  {
    titulo: "As empresas mensalistas, com a conta somada",
    resumo:
      "Quatro funcionários da mesma empresa eram quatro clientes, cada um com um pedaço das horas.",
    problema: [
      "Para fechar o mês de uma empresa, a gestão teria de gerar quatro documentos e somar à mão — exatamente o trabalho que a tela veio tirar.",
    ],
    agora: [
      "Existe um cadastro de empresas, e o cliente pertence a uma delas. As horas de todos os funcionários caem na conta da empresa.",
      "O próprio cliente responde, no site, se a reserva é de uma empresa mensalista — de uma lista fechada, para não voltar a bagunça de nomes.",
      "O demonstrativo pode ser emitido para a empresa, mostrando de quem foram as horas.",
      "O relatório mostra horas, reservas e faturamento de cada empresa.",
      "Empresa que sai do coworking é desligada, não apagada: ela some da lista do site e o histórico fica inteiro.",
    ],
    onde: "Cadastros > Empresas",
  },
  {
    titulo: "O empório entrou no sistema",
    resumo:
      "A ficha de papel continua na parede. O que mudou é quem soma — e o que o sistema passou a enxergar.",
    problema: [
      "O consumo era somado de cabeça e digitado como uma linha só na cobrança — o mesmo risco da planilha.",
      "Ninguém sabia o que saía da prateleira sem ser cobrado.",
    ],
    agora: [
      "Catálogo com os 30 produtos de verdade, conferido um a um com as fichas e as plaquinhas, com foto, categoria e etiquetas.",
      "A recepção lança o consumo escolhendo o produto numa grade com foto; o sistema multiplica e soma — o valor nunca vem digitado.",
      "O consumo pode ser pago na hora, com a forma de pagamento, ou acumular para a mensalidade.",
      "O que acumula entra sozinho no documento de cobrança do cliente, agrupado por produto.",
      "A contagem diária da prateleira reconcilia o estoque e mostra a coluna que ninguém calculava: o que faltou.",
      "A máquina de café tem contador, não estoque. O sistema lê o número acumulado e calcula o consumo do dia.",
    ],
    onde: "Empório > Lançar consumo, Contagem do dia, Produtos e Movimentos",
  },
  {
    titulo: "O financeiro do coworking inteiro",
    resumo:
      "Entradas e saídas, contas a pagar e a receber, as mensalidades das salas privativas e o painel do mês.",
    problema: [
      "O sistema cuidava das 3 salas alugadas por hora. As salas privativas alugadas por mês — de onde vem a maior parte do dinheiro — ele nunca tinha visto.",
    ],
    agora: [
      "Lançamento de entradas e saídas, com categoria, fornecedor, vencimento e data de pagamento.",
      "\u201cPago\u201d, \u201cpendente\u201d e \u201catrasado\u201d não são digitados: saem das datas, então nunca discordam do que está na tela.",
      "Duas visões separadas: as contas DO mês e o caixa DO mês. Uma conta de outubro paga em novembro é despesa de outubro e caixa de novembro.",
      "Os espaços mensais são cadastrados um a um, com contrato, valor, dia de vencimento e horas inclusas.",
      "A cobrança do mês é gerada com um clique, e gerar duas vezes não cobra em dobro.",
      "A reserva paga no balcão vira entrada no caixa com o botão \u201cRecebi no balcão\u201d, e o consumo pago na hora entra sozinho.",
      "O painel mostra entrou, saiu, resultado, margem, inadimplência, os últimos seis meses e a projeção dos próximos três.",
    ],
    onde: "Financeiro > Painel, Contas, Mensalidades, Categorias e Fornecedores",
  },
  {
    titulo: "A agenda ficou mais honesta",
    resumo:
      "Três situações reais do balcão que o sistema não sabia registrar — e agora sabe, com evidência.",
    problema: [
      "O cliente marcava uma hora e ficava uma hora e meia: pagava no balcão, mas a agenda e o relatório seguiam dizendo uma hora.",
      "Uma reserva lançada errada só podia ser cancelada — e reserva cancelada continua contando como reserva no relatório.",
    ],
    agora: [
      "\u201cFicou mais tempo\u201d: a recepção escolhe quanto tempo a mais, o valor já cobrado é mantido e o extra é somado pelo preço de hoje. O cliente é avisado.",
      "Reserva lançada errada pode ser EXCLUÍDA, com motivo obrigatório e um retrato completo guardado no histórico.",
      "O histórico de ações nunca se apaga: não existe tela nem rotina que o remova.",
      "Marcar como concluída, reabrir e desfazer um cancelamento são três ações separadas, e cada uma só aparece quando faz sentido.",
      "Lançar uma reserva de ontem, quando o cliente esqueceu de marcar, sempre funcionou — e agora está documentado.",
    ],
    onde: "Dia a dia > Agenda, e Sistema > Histórico de ações",
  },
  {
    titulo: "As mensagens pararam de incomodar o cliente",
    resumo:
      "Três correções medidas nos envios de verdade, antes de qualquer linha ser escrita.",
    problema: [
      "72% dos lembretes de 13 horas antes caíam fora do horário comercial — dez deles às 4h da manhã. A conta explica sozinha: o lembrete de uma reserva das 15h cai às 2h.",
      "Um cliente que usa o coworking toda semana recebeu 14 convites para avaliar no Google.",
      "Quem marcava três reservas recebia três mensagens, cada uma com um valor, e nunca via o total.",
    ],
    agora: [
      "Nenhuma mensagem automática entre 21h e 8h, e esse intervalo é editável no painel.",
      "O lembrete que cairia de madrugada ANTECIPA para as 20h59 da véspera; o convite de avaliação ESPERA a manhã. Um aviso que chega depois não é aviso.",
      "O convite para avaliar é enviado uma vez por cliente, na vida toda.",
      "Quem marca várias reservas seguidas recebe UMA mensagem, com a lista e o valor somado. Os lembretes continuam individuais, um no dia de cada reserva.",
      "A confirmação da reserva e o código de verificação não esperam: a pessoa acabou de mexer no site.",
    ],
    onde: "Ajustes > Mensagens e Parâmetros",
  },
  {
    titulo: "O painel, o acesso e o aplicativo no celular",
    resumo: "A casa onde tudo isso mora — e quem pode abrir cada porta.",
    problema: [
      "O painel era um cabeçalho e quatro cartões. Onze destinos ficavam escondidos atrás de um único cartão de configurações.",
      "Todo mundo que entrava no painel podia tudo.",
    ],
    agora: [
      "Barra lateral com 23 destinos agrupados por rotina, na ordem da frequência de uso. No celular e no tablet em pé ela abre por botão.",
      "Dois níveis de acesso: total, ou tudo menos a parte financeira — o caso da recepção.",
      "Quem não vê o financeiro também não administra usuários, senão bastaria liberar o próprio acesso. Trocar a própria senha continua com todo mundo.",
      "O sistema pode ser salvo na tela de início do celular, com ícone próprio e em tela cheia, sem a barra de endereço. Serve iPhone e Android, e não passa por loja de aplicativos.",
      "Relatórios com total do período, evolução, dias da semana, salas, horários, situação das reservas, área de atuação e horas por cliente.",
    ],
    onde: "Ajustes > Usuários, e a barra lateral de todo o painel",
  },
];

function fechamento() {
  novaPagina();

  escrever("O que ainda não está pronto", MARGEM, estado.y, {
    tamanho: 22,
    negrito: true,
    cor: PRETO,
  });
  estado.y -= 26;
  estado.pagina.drawRectangle({ x: MARGEM, y: estado.y, width: 60, height: 4, color: AMARELO });
  estado.y -= 30;

  paragrafo(
    "Esta página existe de propósito. Um documento que só conta o que ficou bom esconde justamente o que a equipe precisa saber antes de confiar no sistema.",
    { tamanho: 11, cor: SECUNDARIO, depois: 16 },
  );

  caixa("Envio do demonstrativo por e-mail", [
    "Hoje o documento vai pelo WhatsApp, ou a gestão baixa o PDF e envia à mão.",
    "O e-mail é o destino certo para o financeiro das empresas, e é o próximo passo.",
  ]);

  caixa("O histórico anterior a outubro de 2026", [
    "As reservas só começaram a ser lançadas no sistema a partir de outubro.",
    "Um demonstrativo de período anterior sai com a tabela incompleta — não é defeito, é falta de dado.",
  ]);

  caixa("DRE e balanço", [
    "Ficaram de fora por decisão do dono: são parte contábil, e o sistema precisa primeiro de alguns meses de despesa lançada.",
    "Por isso o número do painel se chama “resultado”, e não “lucro”.",
  ]);

  caixa("O QR code do empório", [
    "A tela em que o próprio cliente registraria o consumo está pronta na ideia, mas parada: a ficha de papel continua.",
    "No dia em que for aprovada, é uma mudança pequena para liberar.",
  ]);

  espaco(10);

  escrever("Como isto foi construído", MARGEM, estado.y, {
    tamanho: 14,
    negrito: true,
    cor: PRETO,
  });
  estado.y -= 22;

  marcador(
    "Tudo foi feito primeiro numa PRÉVIA — uma cópia do sistema, com banco separado e as mensagens desligadas — para os donos verem e aprovarem antes de qualquer coisa chegar no sistema de verdade.",
  );
  marcador(
    "A prévia se anuncia em toda página, com faixa preta e aviso no título da aba, para ninguém lançar uma reserva real nela por engano.",
  );
  marcador(
    "Cada regra de disponibilidade, de preço e de cobrança tem teste automático: hoje são 1.117 testes que rodam a cada mudança.",
  );
  marcador(
    "Os números deste documento foram medidos nos dados de verdade do coworking, e não estimados.",
  );
}

// -----------------------------------------------------------------------------

async function principal() {
  estado.pdf = await PDFDocument.create();
  estado.pdf.setTitle("Mult Coworking — Sistema versão 2.0");
  estado.pdf.setAuthor("Mult Coworking");
  estado.pdf.setSubject("O que mudou na versão 2.0 do sistema de reservas e gestão");

  estado.normal = await estado.pdf.embedFont(StandardFonts.Helvetica);
  estado.negrito = await estado.pdf.embedFont(StandardFonts.HelveticaBold);

  try {
    const caminho = join(process.cwd(), "public", "logotipo-multcoworking-recorte.png");
    estado.logo = await estado.pdf.embedPng(await readFile(caminho));
  } catch {
    estado.logo = null;
  }

  capa();
  numeros();
  sumario(CAPITULOS.map((c) => c.titulo));

  CAPITULOS.forEach((c, indice) => {
    capitulo(indice + 1, c.titulo, c.resumo);

    etiqueta("O problema");
    for (const linha of c.problema) {
      paragrafo(linha, { tamanho: 10.5, cor: TEXTO, depois: 8 });
    }

    espaco(8);
    etiqueta("O que o sistema faz agora");
    for (const linha of c.agora) {
      marcador(linha);
    }

    espaco(6);
    ondeFica(c.onde);
  });

  fechamento();

  const bytes = await estado.pdf.save();
  const destino = join(process.cwd(), "docs", "mult-coworking-versao-2.pdf");
  await writeFile(destino, bytes);

  process.stdout.write(`PDF gerado: ${destino} (${estado.numero + 1} paginas)\n`);
}

await principal();
