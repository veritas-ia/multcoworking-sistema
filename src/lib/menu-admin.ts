/**
 * O MAPA DA BARRA LATERAL DO PAINEL.
 *
 * POR QUE ISTO E UM MODULO SEPARADO DA TELA
 *
 * A regra de "qual item esta aceso" nao e decoracao: e o que diz a pessoa
 * onde ela esta. Errada, ela nao da erro nenhum — a tela abre, tudo funciona,
 * e a recepcionista so fica com a sensacao de estar perdida. Por isso a regra
 * mora aqui, em TypeScript puro, com teste.
 *
 * O QUE MUDOU EM 16/11/2026
 *
 * Ate aqui o painel nao tinha moldura: cada uma das cinco paginas carregava a
 * PROPRIA copia da barra "Painel", e para trocar de secao a pessoa voltava
 * para a tela inicial. Pior: as onze abas de Configuracoes ficavam escondidas
 * atras de um cartao so — onze destinos que ninguem via.
 *
 * Agora tudo que existe aparece na lateral. Isso e possivel de graca porque
 * as abas de Configuracoes JA funcionam por endereco ("?aba=clientes"): cada
 * item e so um link diferente, sem refazer nada por dentro.
 *
 * O QUE MUDOU EM 17/11/2026
 *
 * O emporio entrou, e ele tambem e uma tela com abas. A regra de "qual acende"
 * deixou de citar "/admin/configuracoes" por escrito e passou a sair do
 * proprio item — senao a primeira aba do emporio acenderia junto com a de
 * configuracoes, ou nenhuma acenderia, dependendo de qual nome estivesse
 * escrito na comparacao.
 */

/** Os icones usados, pelo nome do lucide. A tela traduz para o desenho. */
export type NomeDoIcone =
  | "CalendarDays"
  | "FileText"
  | "ChartColumn"
  | "Users"
  | "Building2"
  | "DoorOpen"
  | "Briefcase"
  | "Phone"
  | "Clock"
  | "SlidersHorizontal"
  | "ScrollText"
  | "MessageSquare"
  | "UserCog"
  | "History"
  | "ShoppingBasket"
  | "ClipboardList"
  | "Package"
  | "ArrowLeftRight"
  | "Wallet"
  | "Tags"
  | "Truck";

/**
 * As abas de Configuracoes, como TIPO.
 *
 * E isto que faz o COMPILADOR garantir que menu e tela nao se separem: a
 * tela de configuracoes declara um conteudo por aba num
 * "Record<AbaDeConfiguracao, ...>", entao esquecer uma vira erro de
 * compilacao — nao um item de menu que leva a uma tela em branco.
 */
export type AbaDeConfiguracao =
  | "salas"
  | "horarios"
  | "parametros"
  | "politicas"
  | "mensagens"
  | "clientes"
  | "empresas"
  | "profissoes"
  | "telefones-balcao"
  | "usuarios"
  | "acoes";

/** As abas do Emporio, pela mesma razao: o compilador cobra o conteudo. */
export type AbaDoEmporio = "lancar" | "produtos" | "contagem" | "movimentos";

/** As abas do Financeiro, idem. */
export type AbaDoFinanceiro = "contas" | "categorias" | "fornecedores";

/** As telas que guardam a aba escolhida no endereco. */
export const TELA_CONFIGURACOES = "/admin/configuracoes";
export const TELA_EMPORIO = "/admin/emporio";
export const TELA_FINANCEIRO = "/admin/financeiro";

type Comum = { rotulo: string; href: string; icone: NomeDoIcone };

/**
 * Um item do menu.
 *
 * E uma UNIAO de tres formatos, e nao um tipo com campos soltos, de proposito:
 * assim o `aba` de um item de configuracoes tem o tipo das abas DELA, e o do
 * emporio o das abas DELE. Com um `aba: string` generico, a tela de
 * configuracoes voltaria a aceitar uma aba que nao existe nela e o erro so
 * apareceria no navegador, numa tela em branco.
 */
export type ItemSimples = Comum & { tela: null; aba: null };
export type ItemDeConfiguracao = Comum & {
  tela: typeof TELA_CONFIGURACOES;
  aba: AbaDeConfiguracao;
};
export type ItemDoEmporio = Comum & {
  tela: typeof TELA_EMPORIO;
  aba: AbaDoEmporio;
};
export type ItemDoFinanceiro = Comum & {
  tela: typeof TELA_FINANCEIRO;
  aba: AbaDoFinanceiro;
};

export type ItemDoMenu =
  | ItemSimples
  | ItemDeConfiguracao
  | ItemDoEmporio
  | ItemDoFinanceiro;

export type GrupoDoMenu = { titulo: string; itens: ItemDoMenu[] };

/**
 * A aba que cada tela abre quando o endereco nao diz qual.
 *
 * A tela cai na primeira da lista nesse caso; a barra precisa concordar com
 * ela, senao o item aceso e a aba aberta ficam diferentes.
 */
export const ABA_PADRAO: AbaDeConfiguracao = "salas";
export const ABA_PADRAO_EMPORIO: AbaDoEmporio = "lancar";
export const ABA_PADRAO_FINANCEIRO: AbaDoFinanceiro = "contas";

const PADRAO_DA_TELA: Record<
  typeof TELA_CONFIGURACOES | typeof TELA_EMPORIO | typeof TELA_FINANCEIRO,
  string
> = {
  [TELA_CONFIGURACOES]: ABA_PADRAO,
  [TELA_EMPORIO]: ABA_PADRAO_EMPORIO,
  [TELA_FINANCEIRO]: ABA_PADRAO_FINANCEIRO,
};

/** Atalho para montar um item de Configuracoes sem repetir o endereco. */
function configuracao(
  rotulo: string,
  aba: AbaDeConfiguracao,
  icone: NomeDoIcone,
): ItemDeConfiguracao {
  return {
    rotulo,
    href: `${TELA_CONFIGURACOES}?aba=${aba}`,
    icone,
    tela: TELA_CONFIGURACOES,
    aba,
  };
}

/** O mesmo para o Emporio. */
function emporio(
  rotulo: string,
  aba: AbaDoEmporio,
  icone: NomeDoIcone,
): ItemDoEmporio {
  return {
    rotulo,
    href: `${TELA_EMPORIO}?aba=${aba}`,
    icone,
    tela: TELA_EMPORIO,
    aba,
  };
}

/** O mesmo para o Financeiro. */
function financeiro(
  rotulo: string,
  aba: AbaDoFinanceiro,
  icone: NomeDoIcone,
): ItemDoFinanceiro {
  return {
    rotulo,
    href: `${TELA_FINANCEIRO}?aba=${aba}`,
    icone,
    tela: TELA_FINANCEIRO,
    aba,
  };
}

/**
 * O menu, agrupado.
 *
 * A ORDEM DOS GRUPOS SEGUE A FREQUENCIA DE USO, nao a importancia: a agenda
 * e aberta dezenas de vezes por dia, e "Histórico de ações" talvez uma vez
 * por mes. Quem usa o painel inteiro todo dia nao procura no menu — vai
 * direto, pela posicao.
 *
 * O EMPORIO tem grupo PROPRIO, e nao uma linha dentro de "Dia a dia": sao
 * quatro destinos de uma rotina so (ler a ficha, contar a prateleira), e
 * misturados com a agenda a pessoa teria de ler o menu inteiro para achar
 * qual e qual.
 */
export const MENU: readonly GrupoDoMenu[] = [
  {
    titulo: "Dia a dia",
    itens: [
      {
        rotulo: "Agenda",
        href: "/admin/agenda",
        icone: "CalendarDays",
        tela: null,
        aba: null,
      },
    ],
  },
  {
    titulo: "Empório",
    itens: [
      // Dentro do grupo, a ordem tambem e de frequencia: a recepcionista
      // lanca a ficha varias vezes por dia e mexe no catalogo quase nunca.
      emporio("Lançar consumo", "lancar", "ShoppingBasket"),
      emporio("Contagem do dia", "contagem", "ClipboardList"),
      emporio("Produtos", "produtos", "Package"),
      emporio("Movimentos", "movimentos", "ArrowLeftRight"),
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      // "Contas" primeiro: e a tela do dia a dia. Categoria e fornecedor sao
      // cadastro, mexidos quase nunca.
      financeiro("Contas", "contas", "Wallet"),
      financeiro("Categorias", "categorias", "Tags"),
      financeiro("Fornecedores", "fornecedores", "Truck"),
    ],
  },
  {
    titulo: "Cobrança",
    itens: [
      {
        rotulo: "Controle de horas",
        href: "/admin/demonstrativos",
        icone: "FileText",
        tela: null,
        aba: null,
      },
      {
        rotulo: "Relatórios",
        href: "/admin/relatorios",
        icone: "ChartColumn",
        tela: null,
        aba: null,
      },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      configuracao("Clientes", "clientes", "Users"),
      configuracao("Empresas", "empresas", "Building2"),
      configuracao("Salas", "salas", "DoorOpen"),
      configuracao("Áreas de atuação", "profissoes", "Briefcase"),
      configuracao("Telefones do balcão", "telefones-balcao", "Phone"),
    ],
  },
  {
    titulo: "Ajustes",
    itens: [
      configuracao("Horários", "horarios", "Clock"),
      configuracao("Parâmetros", "parametros", "SlidersHorizontal"),
      configuracao("Políticas", "politicas", "ScrollText"),
      configuracao("Mensagens", "mensagens", "MessageSquare"),
      configuracao("Usuários", "usuarios", "UserCog"),
    ],
  },
  {
    titulo: "Sistema",
    itens: [configuracao("Histórico de ações", "acoes", "History")],
  },
];

/**
 * As telas que guardam a aba no endereco, com a aba que cada uma abre.
 *
 * EXISTE PARA O TESTE NAO PRECISAR DE EDICAO A CADA TELA NOVA. Antes ele
 * listava as telas a mao, e a terceira tela com abas (o Financeiro) o fez
 * falhar — nao por um defeito, mas por desatualizacao. Derivando daqui, as
 * regras valem para toda tela com abas, inclusive as que ainda nao existem.
 */
export function telasComAbas(): { tela: string; padrao: string }[] {
  return Object.entries(PADRAO_DA_TELA).map(([tela, padrao]) => ({ tela, padrao }));
}

/** Todos os itens, sem os grupos. */
export function todosOsItens(): ItemDoMenu[] {
  return MENU.flatMap((grupo) => grupo.itens);
}

/**
 * Os itens de Configuracoes, com o tipo da aba PRESERVADO.
 *
 * Um `.filter()` comum devolveria `ItemDoMenu[]`, e o `aba` voltaria a ser
 * "AbaDeConfiguracao | AbaDoEmporio | null" — perdendo justamente a garantia
 * que a uniao existe para dar. Por isso a funcao declara o que devolve.
 */
export function itensDeConfiguracao(): ItemDeConfiguracao[] {
  return todosOsItens().filter(
    (item): item is ItemDeConfiguracao => item.tela === TELA_CONFIGURACOES,
  );
}

/** Os itens do Emporio, pelo mesmo motivo. */
export function itensDoEmporio(): ItemDoEmporio[] {
  return todosOsItens().filter(
    (item): item is ItemDoEmporio => item.tela === TELA_EMPORIO,
  );
}

/** Os itens do Financeiro, pelo mesmo motivo. */
export function itensDoFinanceiro(): ItemDoFinanceiro[] {
  return todosOsItens().filter(
    (item): item is ItemDoFinanceiro => item.tela === TELA_FINANCEIRO,
  );
}

/**
 * Este item esta aceso?
 *
 * DUAS REGRAS, e a segunda e a que ninguem lembra:
 *
 *  1. item comum acende quando o caminho e o dele;
 *  2. item de uma tela com ABAS acende quando o caminho e o DAQUELA tela E a
 *     aba bate. Sem a segunda metade, os onze itens de configuracoes
 *     acenderiam todos ao mesmo tempo — e a pessoa nao saberia em qual esta.
 *
 * Sem aba no endereco, a tela abre a primeira da lista dela. A barra precisa
 * concordar com isso.
 */
export function estaAceso(
  item: ItemDoMenu,
  caminho: string,
  aba: string | null,
): boolean {
  if (item.tela === null) {
    return caminho === item.href;
  }

  if (caminho !== item.tela) {
    return false;
  }

  return aba ? aba === item.aba : item.aba === PADRAO_DA_TELA[item.tela];
}

/**
 * O nome da tela aberta, para o cabecalho e para o titulo da aba.
 *
 * Devolve nulo na tela inicial do painel, que nao e um item do menu.
 */
export function telaAberta(caminho: string, aba: string | null): string | null {
  return todosOsItens().find((item) => estaAceso(item, caminho, aba))?.rotulo ?? null;
}
