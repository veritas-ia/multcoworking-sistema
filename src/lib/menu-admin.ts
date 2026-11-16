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
  | "History";

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

export type ItemDoMenu = {
  rotulo: string;
  href: string;
  icone: NomeDoIcone;
  /**
   * Para os itens de Configuracoes: qual aba eles abrem. Nulo nos demais.
   *
   * Existe porque todos eles apontam para o MESMO caminho
   * ("/admin/configuracoes") e so o parametro muda — sem isto, os onze
   * acenderiam juntos.
   */
  aba: AbaDeConfiguracao | null;
};

export type GrupoDoMenu = { titulo: string; itens: ItemDoMenu[] };

/**
 * A aba que Configuracoes abre quando o endereco nao diz qual.
 *
 * A tela de configuracoes cai na primeira da lista nesse caso; a barra
 * precisa concordar, senao o item aceso e a aba aberta ficam diferentes.
 */
export const ABA_PADRAO: AbaDeConfiguracao = "salas";

/**
 * O menu, agrupado.
 *
 * A ORDEM DOS GRUPOS SEGUE A FREQUENCIA DE USO, nao a importancia: a agenda
 * e aberta dezenas de vezes por dia, e "Histórico de ações" talvez uma vez
 * por mes. Quem usa o painel inteiro todo dia nao procura no menu — vai
 * direto, pela posicao.
 */
export const MENU: readonly GrupoDoMenu[] = [
  {
    titulo: "Dia a dia",
    itens: [
      { rotulo: "Agenda", href: "/admin/agenda", icone: "CalendarDays", aba: null },
    ],
  },
  {
    titulo: "Cobrança",
    itens: [
      {
        rotulo: "Controle de horas",
        href: "/admin/demonstrativos",
        icone: "FileText",
        aba: null,
      },
      {
        rotulo: "Relatórios",
        href: "/admin/relatorios",
        icone: "ChartColumn",
        aba: null,
      },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      {
        rotulo: "Clientes",
        href: "/admin/configuracoes?aba=clientes",
        icone: "Users",
        aba: "clientes",
      },
      {
        rotulo: "Empresas",
        href: "/admin/configuracoes?aba=empresas",
        icone: "Building2",
        aba: "empresas",
      },
      {
        rotulo: "Salas",
        href: "/admin/configuracoes?aba=salas",
        icone: "DoorOpen",
        aba: "salas",
      },
      {
        rotulo: "Áreas de atuação",
        href: "/admin/configuracoes?aba=profissoes",
        icone: "Briefcase",
        aba: "profissoes",
      },
      {
        rotulo: "Telefones do balcão",
        href: "/admin/configuracoes?aba=telefones-balcao",
        icone: "Phone",
        aba: "telefones-balcao",
      },
    ],
  },
  {
    titulo: "Ajustes",
    itens: [
      {
        rotulo: "Horários",
        href: "/admin/configuracoes?aba=horarios",
        icone: "Clock",
        aba: "horarios",
      },
      {
        rotulo: "Parâmetros",
        href: "/admin/configuracoes?aba=parametros",
        icone: "SlidersHorizontal",
        aba: "parametros",
      },
      {
        rotulo: "Políticas",
        href: "/admin/configuracoes?aba=politicas",
        icone: "ScrollText",
        aba: "politicas",
      },
      {
        rotulo: "Mensagens",
        href: "/admin/configuracoes?aba=mensagens",
        icone: "MessageSquare",
        aba: "mensagens",
      },
      {
        rotulo: "Usuários",
        href: "/admin/configuracoes?aba=usuarios",
        icone: "UserCog",
        aba: "usuarios",
      },
    ],
  },
  {
    titulo: "Sistema",
    itens: [
      {
        rotulo: "Histórico de ações",
        href: "/admin/configuracoes?aba=acoes",
        icone: "History",
        aba: "acoes",
      },
    ],
  },
];

/** Todos os itens, sem os grupos. */
export function todosOsItens(): ItemDoMenu[] {
  return MENU.flatMap((grupo) => grupo.itens);
}

/**
 * Este item esta aceso?
 *
 * DUAS REGRAS, e a segunda e a que ninguem lembra:
 *
 *  1. item comum acende quando o caminho e o dele;
 *  2. item de CONFIGURACOES acende quando o caminho e o das configuracoes E a
 *     aba bate. Sem a segunda metade, os onze itens de configuracoes
 *     acenderiam todos ao mesmo tempo — e a pessoa nao saberia em qual esta.
 *
 * Sem aba no endereco, a tela de configuracoes abre a primeira da lista. A
 * barra precisa concordar com ela.
 */
export function estaAceso(
  item: ItemDoMenu,
  caminho: string,
  aba: string | null,
): boolean {
  if (item.aba === null) {
    return caminho === item.href;
  }

  if (caminho !== "/admin/configuracoes") {
    return false;
  }

  return aba ? aba === item.aba : item.aba === ABA_PADRAO;
}

/**
 * O nome da tela aberta, para o cabecalho e para o titulo da aba.
 *
 * Devolve nulo na tela inicial do painel, que nao e um item do menu.
 */
export function telaAberta(caminho: string, aba: string | null): string | null {
  return todosOsItens().find((item) => estaAceso(item, caminho, aba))?.rotulo ?? null;
}
