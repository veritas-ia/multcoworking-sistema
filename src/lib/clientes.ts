/**
 * Achar um cliente CADASTRADO, pelo nome ou pelo telefone, e gravar o
 * cadastro na reserva.
 *
 * POR QUE A BUSCA EXISTE
 *
 * O telefone e campo OBRIGATORIO na reserva do balcao, e precisa ser valido.
 * Quando o cliente liga, passa na frente ou manda mensagem pelo Instagram, a
 * recepcao nao tem o numero dele na mao — e o formulario nao deixa salvar sem
 * um. O unico numero sempre a mao e o da propria recepcao.
 *
 * Foi exatamente isso que aconteceu em producao: o telefone do atendimento
 * comercial acumulou reservas de CINCO clientes diferentes. No relatorio
 * aquilo virou um "cliente" so, com 28 horas, levando o nome de quem tinha
 * 1,5. E pior: as confirmacoes e os lembretes daquelas reservas foram todos
 * para o WhatsApp da recepcao, porque as mensagens vao para o telefone
 * GRAVADO na reserva. Os clientes nunca receberam aviso nenhum.
 *
 * DESDE A FASE 14 A BUSCA OLHA O CADASTRO, e nao mais as reservas soltas. E
 * a diferenca que faz o Rafael dos dois telefones aparecer UMA vez, com os
 * dois numeros para a recepcao escolher — antes ele aparecia duas, como se
 * fossem duas pessoas.
 */
import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "./prisma";
import { apenasDigitos, normalizarTelefone } from "./telefone";
import { telefonesDeBalcao } from "./telefones-balcao";

/** Quantos clientes a busca devolve. A tela e uma lista para escolher, nao um
 *  relatorio: passando disso a recepcao para de conseguir ler. */
const MAXIMO = 8;

export type ClienteParaEscolher = {
  id: string;
  /** O nome OFICIAL do cadastro. */
  nome: string;
  /**
   * Os telefones do cadastro, em formato internacional.
   *
   * PODE SER VAZIO, e isso e informacao, nao defeito: sao os clientes que so
   * tem reserva lancada no telefone do balcao e nunca deixaram o numero
   * deles. Para esses a recepcao precisa pedir o telefone — e a tela diz
   * isso, em vez de oferecer o numero da casa outra vez.
   */
  telefones: string[];
  /**
   * Os nomes que as reservas dele ja usaram, fora o oficial.
   *
   * E justamente a variacao ("Prestare", "Prestare Karen", "Prestare -
   * Karen") que faz a recepcao reconhecer de quem e o cadastro.
   */
  outrosNomes: string[];
  reservas: number;
  /** "AAAA-MM-DD" da reserva mais recente, ou null para cadastro sem reserva. */
  ultimaReserva: string | null;
};

function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Procura entre os clientes CADASTRADOS.
 *
 * O termo pode ser um pedaco do nome ("toca", "rafa") ou um pedaco do
 * telefone ("99604", "(14) 99604-0233"). Numero e nome sao procurados ao
 * mesmo tempo: a recepcao digita o que tem na mao e nao escolhe o modo.
 *
 * Procura TAMBEM nos nomes escritos nas reservas, e nao so no oficial: quem
 * atende lembra do nome que o cliente usou, que pode nao ser o rotulo do
 * cadastro.
 *
 * TELEFONE DE BALCAO NAO APARECE, e agora isso sai de graca: ele nunca entra
 * em "telefones_cliente", entao nao ha numero de balcao para escolher. O que
 * aparece e a PESSOA — "Miguel", sem telefone — e a tela pede o numero dela.
 *
 * Cliente DESLIGADO fica de fora: desligar e decisao sobre o futuro.
 */
export async function procurarClientesCadastrados(
  termo: string,
): Promise<ClienteParaEscolher[]> {
  const limpo = termo.trim();

  if (limpo.length < 2) {
    return [];
  }

  const alvo = semAcento(limpo);
  const digitos = apenasDigitos(limpo);
  // "11" sozinho e DDD de meio Sao Paulo; a partir de 3 digitos ja distingue.
  const porNumero = digitos.length >= 3;
  const telefoneInteiro = normalizarTelefone(limpo);

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: {
      id: true,
      nome: true,
      telefones: { select: { telefone: true }, orderBy: { criadoEm: "asc" } },
      reservas: {
        select: { nomeCliente: true, inicio: true },
        orderBy: { inicio: "asc" },
      },
    },
  });

  const achados = clientes.filter((cliente) => {
    if (
      telefoneInteiro &&
      cliente.telefones.some((ligado) => ligado.telefone === telefoneInteiro)
    ) {
      return true;
    }

    if (
      porNumero &&
      cliente.telefones.some((ligado) =>
        apenasDigitos(ligado.telefone).includes(digitos),
      )
    ) {
      return true;
    }

    if (semAcento(cliente.nome).includes(alvo)) {
      return true;
    }

    return cliente.reservas.some((reserva) =>
      semAcento(reserva.nomeCliente).includes(alvo),
    );
  });

  return achados
    .map((cliente): ClienteParaEscolher => {
      const nomes = new Set(cliente.reservas.map((reserva) => reserva.nomeCliente));
      nomes.delete(cliente.nome);

      const ultima = cliente.reservas[cliente.reservas.length - 1]?.inicio ?? null;

      return {
        id: cliente.id,
        nome: cliente.nome,
        telefones: cliente.telefones.map((ligado) => ligado.telefone),
        outrosNomes: [...nomes],
        reservas: cliente.reservas.length,
        ultimaReserva: ultima ? ultima.toISOString().slice(0, 10) : null,
      };
    })
    // Quem reservou mais recentemente primeiro: e quem a recepcao tem mais
    // chance de estar atendendo agora. Cadastro sem reserva vai para o fim.
    .sort((a, b) => (b.ultimaReserva ?? "").localeCompare(a.ultimaReserva ?? ""))
    .slice(0, MAXIMO);
}

// -----------------------------------------------------------------------------
// Gravar o cadastro na reserva
// -----------------------------------------------------------------------------

export type FalhaDoCliente = { motivo: string; codigo: string };

/**
 * O telefone ja pertence a OUTRO cadastro?
 *
 * Sai como recusa quando a recepcao escolhe um cliente na busca e digita um
 * numero que e de outra pessoa. Deixar passar ligaria o telefone de alguem ao
 * cadastro errado — e, dali em diante, TODAS as reservas daquele numero
 * cairiam na conta errada, sem ninguem desconfiar.
 */
export class TelefoneDeOutroCliente extends Error {
  readonly codigo = "TELEFONE_DE_OUTRO_CLIENTE";

  constructor(readonly nomeDoDono: string) {
    super(
      `Este telefone já é do cadastro "${nomeDoDono}". Escolha esse cliente ou use outro número.`,
    );
    this.name = "TelefoneDeOutroCliente";
  }
}

/**
 * Acha ou cria o cliente de uma reserva, e devolve o identificador dele.
 *
 * Chamada pelas TRES portas que criam reserva. Do lado do cliente nada muda:
 * ele continua so digitando nome e telefone, e o cadastro aparece sozinho.
 *
 * A REGRA E A MESMA DA MIGRACAO, de proposito — se as duas divergissem, o
 * sistema agruparia o passado de um jeito e o futuro de outro, e ninguem
 * desconfiaria porque cada metade continuaria parecendo certa:
 *
 *  - telefone NORMAL: o numero manda. Ja tem dono, e esse dono; nao tem,
 *    nasce um cadastro com o nome desta reserva e o numero fica ligado a ele.
 *    Nome escrito diferente no mesmo numero NAO cria cadastro novo.
 *  - telefone de BALCAO: o numero nao e de ninguem, entao quem manda e o
 *    NOME. O telefone nunca e ligado a cadastro nenhum.
 *
 * QUANDO A RECEPCAO ESCOLHE UM CLIENTE NA BUSCA ("clienteEscolhidoId"), ele
 * manda — e e assim que o "Miguel", que so tinha reserva no telefone do
 * balcao, finalmente ganha um numero proprio: a recepcao escolhe o cadastro
 * dele e digita o telefone que acabou de conseguir.
 *
 * Roda DENTRO da transacao da reserva quando ela existe: cliente criado para
 * uma reserva que nao chegou a nascer viraria cadastro fantasma.
 */
export async function garantirCliente(
  entrada: {
    telefone: string;
    nome: string;
    /** O cadastro que a recepcao escolheu na busca, quando houve escolha. */
    clienteEscolhidoId?: string | null;
  },
  tx: Prisma.TransactionClient = prisma,
): Promise<string> {
  const ehDeBalcao = (await telefonesDeBalcao()).has(entrada.telefone);

  const dono = await tx.telefoneDoCliente.findUnique({
    where: { telefone: entrada.telefone },
    select: { clienteId: true, cliente: { select: { nome: true } } },
  });

  if (entrada.clienteEscolhidoId) {
    const escolhido = await tx.cliente.findUnique({
      where: { id: entrada.clienteEscolhidoId },
      select: { id: true },
    });

    if (!escolhido) {
      throw new TelefoneDeOutroCliente("desconhecido");
    }

    // O numero ja e de OUTRA pessoa: recusa em vez de roubar o telefone.
    if (dono && dono.clienteId !== escolhido.id) {
      throw new TelefoneDeOutroCliente(dono.cliente.nome);
    }

    // Numero solto + cadastro escolhido = o momento em que alguem que so
    // existia no telefone do balcao finalmente ganha um numero proprio.
    if (!dono && !ehDeBalcao) {
      await tx.telefoneDoCliente.create({
        data: { telefone: entrada.telefone, clienteId: escolhido.id },
      });
    }

    return escolhido.id;
  }

  if (ehDeBalcao) {
    return clienteDoBalcao(entrada, tx);
  }

  if (dono) {
    return dono.clienteId;
  }

  const cliente = await tx.cliente.create({
    data: { nome: entrada.nome },
    select: { id: true },
  });

  await tx.telefoneDoCliente.create({
    data: { telefone: entrada.telefone, clienteId: cliente.id },
  });

  return cliente.id;
}

/**
 * O cliente de uma reserva lancada num telefone de balcao.
 *
 * Aqui o numero nao identifica ninguem, entao o nome e tudo o que existe.
 * Procura entre as pessoas que ja apareceram NESTE numero — e nao na base
 * inteira: dois "Miguel" de telefones diferentes sao duas pessoas ate que a
 * equipe diga o contrario, na tela de juntar cadastros.
 *
 * O telefone NAO e ligado ao cliente criado: ele e da casa, e liga-lo faria
 * a proxima reserva de outra pessoa cair nesse mesmo cadastro.
 */
async function clienteDoBalcao(
  entrada: { telefone: string; nome: string },
  tx: Prisma.TransactionClient,
): Promise<string> {
  const doNumero = await tx.reserva.findMany({
    where: { telefone: entrada.telefone },
    select: { nomeCliente: true, clienteId: true },
    orderBy: { inicio: "asc" },
  });

  const alvo = semAcento(entrada.nome);
  const mesma = doNumero.find((reserva) => semAcento(reserva.nomeCliente) === alvo);

  if (mesma?.clienteId) {
    return mesma.clienteId;
  }

  const cliente = await tx.cliente.create({
    data: { nome: entrada.nome },
    select: { id: true },
  });

  return cliente.id;
}
