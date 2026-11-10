/**
 * Achar um cliente que ja reservou, pelo nome ou pelo telefone.
 *
 * POR QUE ISTO EXISTE
 *
 * O telefone e campo OBRIGATORIO na reserva do balcao, e precisa ser valido.
 * Quando o cliente liga, passa na frente ou manda mensagem pelo Instagram, a
 * recepcao muitas vezes nao tem o numero dele na mao — e o formulario nao
 * deixa salvar sem um. O unico numero sempre a mao e o da propria recepcao.
 *
 * Foi exatamente isso que aconteceu em producao: o telefone do atendimento
 * comercial acumulou 14 reservas de QUATRO clientes diferentes (Toca,
 * Prestare, Matheus Toca e Rafael Passos). No relatorio aquilo virou um
 * "cliente" so, com 28 horas, levando o nome de quem tinha 1,5. E pior: as
 * confirmacoes e os lembretes daquelas 14 reservas foram todos para o
 * WhatsApp da recepcao, porque as mensagens vao para o telefone GRAVADO na
 * reserva. Os clientes nunca receberam aviso nenhum.
 *
 * Com a busca, procurar "toca" fica mais rapido do que digitar um numero
 * inteiro, e o telefone que entra na reserva e o do cliente. E o conserto da
 * CAUSA; marcar o telefone de balcao conserta o que ja esta gravado.
 *
 * NAO e um cadastro de clientes. A lista sai das proprias reservas: cada
 * telefone que ja reservou e um "cliente conhecido". O cadastro de verdade,
 * com identificador proprio e com o Rafael dos dois numeros virando um so,
 * e a fase seguinte.
 */
import { prisma } from "./prisma";
import { apenasDigitos, normalizarTelefone } from "./telefone";
import { telefonesDeBalcao } from "./telefones-balcao";

/** Quantos clientes a busca devolve. A tela e uma lista para escolher, nao um
 *  relatorio: passando disso a recepcao para de conseguir ler. */
const MAXIMO = 8;

export type ClienteConhecido = {
  /** Telefone COMPLETO. Area protegida: o CLAUDE.md permite aqui. */
  telefone: string;
  /** O nome da PRIMEIRA reserva deste numero, igual ao relatorio. */
  nome: string;
  /**
   * Os outros nomes que este numero ja usou.
   *
   * Aparecem de proposito, e e justamente a variacao ("Prestare", "Prestare
   * Karen", "Prestare - Karen") que faz a recepcao reconhecer de quem e o
   * numero. Num telefone de balcao sao nomes de pessoas DIFERENTES, e ver os
   * quatro de uma vez e o que impede a recepcao de escolher aquele numero
   * sem perceber.
   */
  outrosNomes: string[];
  reservas: number;
  /** Data da ultima reserva, "AAAA-MM-DD", para a equipe se situar. */
  ultimaReserva: string;
};

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type ResultadoDaBusca = {
  clientes: ClienteConhecido[];
  /**
   * Nomes que só existem dentro de um TELEFONE DE BALCAO.
   *
   * Aparecem como aviso na tela, e nunca como opcao de escolha. O caso real: o
   * "Miguel" tem uma reserva lancada no numero do atendimento comercial e
   * nenhum telefone proprio no sistema. Oferecer aquele numero faria a reserva
   * nova nascer no telefone da recepcao outra vez — exatamente o que esta tela
   * veio impedir. Sumir calado seria pior: a recepcao acharia que o sistema
   * perdeu o cliente, em vez de entender que precisa pedir o numero dele.
   */
  soNoTelefoneDeBalcao: string[];
};

/**
 * Procura entre quem ja reservou alguma vez.
 *
 * O termo pode ser um pedaco do nome ("toca", "rafa") ou um pedaco do
 * telefone ("99604", "(14) 99604-0233"). Numero e nome sao procurados ao
 * mesmo tempo: a recepcao digita o que tem na mao e nao escolhe o modo.
 *
 * TELEFONE DE BALCAO NUNCA ENTRA NA LISTA. A equipe marcou aquele numero
 * justamente porque ele nao e de um cliente; oferece-lo para escolher
 * devolveria o problema pela mesma porta.
 *
 * Termo curto demais devolve lista vazia — com uma letra so, viria metade da
 * base e a tela nao ajudaria ninguem.
 */
export async function procurarClientesConhecidos(
  termo: string,
): Promise<ResultadoDaBusca> {
  const limpo = termo.trim();

  if (limpo.length < 2) {
    return { clientes: [], soNoTelefoneDeBalcao: [] };
  }

  // A busca e sobre os PARES telefone+nome, e nao sobre as reservas uma a
  // uma: o banco ja devolve agrupado, com a contagem e as datas.
  const [pares, balcao] = await Promise.all([
    prisma.reserva.groupBy({
      by: ["telefone", "nomeCliente"],
      _count: { _all: true },
      _min: { inicio: true },
      _max: { inicio: true },
    }),
    telefonesDeBalcao(),
  ]);

  const alvo = semAcento(limpo);
  const digitos = apenasDigitos(limpo);
  // "11" sozinho e DDD de meio Sao Paulo; a partir de 3 digitos ja distingue.
  const porNumero = digitos.length >= 3;
  const telefoneInteiro = normalizarTelefone(limpo);

  const achados = pares.filter((par) => {
    if (telefoneInteiro && par.telefone === telefoneInteiro) {
      return true;
    }
    if (porNumero && apenasDigitos(par.telefone).includes(digitos)) {
      return true;
    }
    return semAcento(par.nomeCliente).includes(alvo);
  });

  // O NOME SO SERVE PARA ACHAR O TELEFONE, mesma regra da busca do relatorio:
  // achado o telefone, o cliente vem inteiro, com TODOS os nomes e TODAS as
  // reservas dele — e nao so as que bateram com o que foi digitado.
  //
  // Os telefones de BALCAO ficam de fora da lista de escolha, e o que foi
  // achado dentro deles vira aviso.
  const telefones = new Set(
    achados.filter((par) => !balcao.has(par.telefone)).map((par) => par.telefone),
  );

  const porTelefone = new Map<string, typeof pares>();

  for (const par of pares) {
    if (!telefones.has(par.telefone)) {
      continue;
    }
    porTelefone.set(par.telefone, [...(porTelefone.get(par.telefone) ?? []), par]);
  }

  const clientes = [...porTelefone.entries()].map(
    ([telefone, doTelefone]): ClienteConhecido => {
      // Do mais antigo para o mais novo: o primeiro nome e o que fica, igual
      // ao relatorio. Dois rotulos diferentes para a mesma pessoa em telas
      // diferentes e o que faz a equipe desconfiar do painel.
      const emOrdem = [...doTelefone].sort(
        (a, b) => (a._min.inicio?.getTime() ?? 0) - (b._min.inicio?.getTime() ?? 0),
      );

      const ultima = doTelefone.reduce(
        (maior, par) =>
          (par._max.inicio?.getTime() ?? 0) > (maior?.getTime() ?? 0)
            ? par._max.inicio!
            : maior,
        emOrdem[0]!._max.inicio!,
      );

      return {
        telefone,
        nome: emOrdem[0]!.nomeCliente,
        outrosNomes: emOrdem.slice(1).map((par) => par.nomeCliente),
        reservas: doTelefone.reduce((soma, par) => soma + par._count._all, 0),
        ultimaReserva: ultima.toISOString().slice(0, 10),
      };
    },
  );

  // Quem reservou mais recentemente primeiro: e quem a recepcao tem mais
  // chance de estar atendendo agora.
  const lista = clientes
    .sort((a, b) => b.ultimaReserva.localeCompare(a.ultimaReserva))
    .slice(0, MAXIMO);

  // O AVISO e so para quem NAO tem telefone proprio no sistema.
  //
  // "Prestare" tem reserva no numero do balcao E num numero proprio: ali a
  // recepcao ja tem o que escolher, e avisar seria ruido. O "Miguel" so
  // existe dentro do balcao — esse precisa do aviso, senao a tela nao
  // explica por que nao achou ninguem.
  const jaNaLista = new Set(
    lista.flatMap((cliente) =>
      [cliente.nome, ...cliente.outrosNomes].map(semAcento),
    ),
  );

  const soNoTelefoneDeBalcao = [
    ...new Set(
      achados
        .filter(
          (par) =>
            balcao.has(par.telefone) &&
            semAcento(par.nomeCliente).includes(alvo) &&
            !jaNaLista.has(semAcento(par.nomeCliente)),
        )
        .map((par) => par.nomeCliente),
    ),
  ];

  return { clientes: lista, soNoTelefoneDeBalcao };
}
