/**
 * EMPRESAS (27/10/2026).
 *
 * O que estes testes protegem:
 *  1. um telefone pertence a NO MAXIMO uma empresa — o banco garante;
 *  2. marcar um telefone junta as reservas PASSADAS dele na hora, porque o
 *     vinculo e do telefone e nao da reserva;
 *  3. desvincular tira o historico do total da empresa (combinado com o dono);
 *  4. a sugestao automatica acha os numeros com nome parecido e NUNCA junta
 *     nada sozinha;
 *  5. telefone torto nao entra: sem isso ele nunca casaria com as reservas e a
 *     empresa ficaria com zero horas, sem erro aparecer.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  criarEmpresa,
  editarEmpresa,
  empresaConhecidaDoTelefone,
  empresaEscolhidaEhValida,
  listarEmpresasParaEscolher,
  listarClientesConhecidos,
  listarEmpresas,
  sugerirAgrupamentos,
  vincularTelefone,
  type ClienteConhecido,
} from "@/lib/empresas";
import { criarReservaPublica } from "@/lib/reservas";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

const PREFIXO = "ZZ Empresa";
const TELEFONES = ["+5511900000701", "+5511900000702", "+5511900000703"];

let salaId: string;
/** A Container: liberada, sem preco de grupo e sem teto de pessoas. */
let salaContainer: string;

beforeAll(async () => {
  await aquecerConexao();
  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  salaId = sala.id;

  const container = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaContainer = container.id;
});

async function limpar(): Promise<void> {
  // A ORDEM IMPORTA: a reserva aponta para a empresa com ON DELETE RESTRICT,
  // entao a empresa so sai depois das reservas dela. E e de proposito —
  // apagar uma empresa com reserva tiraria horas do relatorio em silencio.
  await bancoDeTeste.reserva.deleteMany({
    where: {
      OR: [
        { telefone: { in: TELEFONES } },
        // Tambem as reservas que APONTAM para uma empresa de teste, venham
        // de que telefone vierem: senao uma sobra trava a limpeza e o
        // proximo teste falha dizendo que o nome ja existe.
        { empresa: { nome: { startsWith: PREFIXO } } },
      ],
    },
  });
  await bancoDeTeste.telefoneDaEmpresa.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
  await bancoDeTeste.empresa.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/**
 * Uma reserva de um telefone, com um nome escolhido.
 *
 * Cada chamada pega uma hora diferente: duas reservas no mesmo horario e na
 * mesma sala sao recusadas pelo banco, e aqui o horario nao importa para nada.
 */
let proximaHora = 8;

async function reserva(
  telefone: string,
  nome: string,
  dia = "2026-11-10",
  empresaId: string | null = null,
) {
  const hora = String(proximaHora++).padStart(2, "0");

  return bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: nome,
      telefone,
      profissao: "OUTROS",
      empresaId,
      inicio: instanteDe(dia, `${hora}:00`),
      fim: instanteDe(dia, `${hora}:30`),
      duracaoMinutos: 30,
      valor: "20.00",
      origem: "PUBLICO",
      confirmacaoEnviadaEm: new Date(),
    },
  });
}

async function empresaDeTeste(nome = `${PREFIXO} Prestare`) {
  const resultado = await criarEmpresa(nome);

  if (!resultado.ok) {
    throw new Error(`Nao criou: ${resultado.falha.motivo}`);
  }

  return resultado.dados;
}

// -----------------------------------------------------------------------------

describe("cadastro", () => {
  it("cria e lista uma empresa", async () => {
    const criada = await empresaDeTeste();

    expect(criada.nome).toBe(`${PREFIXO} Prestare`);
    expect(criada.ativa).toBe(true);
    expect(criada.telefones).toBe(0);

    const lista = await listarEmpresas();
    expect(lista.some((e) => e.id === criada.id)).toBe(true);
  });

  it("recusa nome repetido e nome curto demais", async () => {
    await empresaDeTeste();

    const repetida = await criarEmpresa(`${PREFIXO} Prestare`);
    expect(repetida.ok).toBe(false);

    const curta = await criarEmpresa("A");
    expect(curta.ok).toBe(false);
  });

  it("desliga sem apagar: o histórico não pode sumir", async () => {
    const criada = await empresaDeTeste();

    const desligada = await editarEmpresa(criada.id, { ativa: false });

    expect(desligada.ok).toBe(true);
    if (!desligada.ok) return;
    expect(desligada.dados.ativa).toBe(false);
  });
});

describe("vínculo do telefone", () => {
  it("marcar um telefone JUNTA as reservas passadas dele", async () => {
    // O ponto central: o vinculo e do TELEFONE, nao da reserva. As reservas
    // sao criadas ANTES de a empresa existir e mesmo assim entram.
    await reserva(TELEFONES[0]!, "Prestare Karen");
    await reserva(TELEFONES[1]!, "Prestare");

    const empresa = await empresaDeTeste();
    await vincularTelefone(TELEFONES[0]!, empresa.id);
    await vincularTelefone(TELEFONES[1]!, empresa.id);

    const clientes = await listarClientesConhecidos();
    const dela = clientes.filter((c) => c.empresaId === empresa.id);

    expect(dela).toHaveLength(2);
    expect((await listarEmpresas()).find((e) => e.id === empresa.id)?.telefones).toBe(2);
  });

  it("desvincular TIRA o telefone do total da empresa", async () => {
    await reserva(TELEFONES[0]!, "Prestare");
    const empresa = await empresaDeTeste();
    await vincularTelefone(TELEFONES[0]!, empresa.id);

    await vincularTelefone(TELEFONES[0]!, null);

    const clientes = await listarClientesConhecidos();
    expect(clientes.find((c) => c.telefone === TELEFONES[0])?.empresaId).toBeNull();
  });

  it("um telefone pertence a NO MÁXIMO uma empresa", async () => {
    await reserva(TELEFONES[0]!, "Prestare");
    const primeira = await empresaDeTeste(`${PREFIXO} Primeira`);
    const segunda = await empresaDeTeste(`${PREFIXO} Segunda`);

    await vincularTelefone(TELEFONES[0]!, primeira.id);
    await vincularTelefone(TELEFONES[0]!, segunda.id);

    // Trocou de empresa, e nao somou nas duas: senao o faturamento apareceria
    // dobrado, uma vez em cada, e ninguem desconfiaria do numero.
    const clientes = await listarClientesConhecidos();
    expect(clientes.find((c) => c.telefone === TELEFONES[0])?.empresaId).toBe(segunda.id);

    const lista = await listarEmpresas();
    expect(lista.find((e) => e.id === primeira.id)?.telefones).toBe(0);
    expect(lista.find((e) => e.id === segunda.id)?.telefones).toBe(1);
  });

  it("recusa telefone fora do formato", async () => {
    const empresa = await empresaDeTeste();

    const resultado = await vincularTelefone("123", empresa.id);

    expect(resultado.ok).toBe(false);
  });

  it("aceita o telefone escrito de qualquer jeito", async () => {
    await reserva("+5511912345678", "Teste");
    const empresa = await empresaDeTeste();

    try {
      const resultado = await vincularTelefone("(11) 91234-5678", empresa.id);
      expect(resultado.ok).toBe(true);
      if (!resultado.ok) return;
      expect(resultado.dados.telefone).toBe("+5511912345678");
    } finally {
      await bancoDeTeste.telefoneDaEmpresa.deleteMany({
        where: { telefone: "+5511912345678" },
      });
      await bancoDeTeste.reserva.deleteMany({ where: { telefone: "+5511912345678" } });
    }
  });
});

describe("a lista que a equipe percorre", () => {
  it("mostra TODOS os nomes que cada número já usou", async () => {
    // E justamente a variacao que faz a equipe reconhecer de quem e o numero.
    await reserva(TELEFONES[0]!, "Prestare", "2026-11-10");
    await reserva(TELEFONES[0]!, "Prestare Karen", "2026-11-11");
    await reserva(TELEFONES[0]!, "Prestare - Karen", "2026-11-12");

    const clientes = await listarClientesConhecidos();
    const dele = clientes.find((c) => c.telefone === TELEFONES[0]);

    expect(dele?.reservas).toBe(3);
    expect(dele?.nomes).toHaveLength(3);
    expect(dele?.nomes).toContain("Prestare Karen");
  });
});

describe("sugestão automática", () => {
  const semEmpresa = (telefone: string, nomes: string[]): ClienteConhecido => ({
    telefone,
    nomes,
    reservas: nomes.length,
    empresaId: null,
  });

  it("acha os números que compartilham uma palavra", () => {
    const sugestoes = sugerirAgrupamentos([
      semEmpresa("+5511900000701", ["Prestare Karen"]),
      semEmpresa("+5511900000702", ["Prestare"]),
      semEmpresa("+5511900000703", ["Laura Ferrari"]),
    ]);

    const prestare = sugestoes.find((s) => s.palavra === "prestare");

    expect(prestare?.telefones).toHaveLength(2);
    expect(sugestoes.some((s) => s.palavra === "laura")).toBe(false);
  });

  it("ignora palavras curtas e genéricas", () => {
    const sugestoes = sugerirAgrupamentos([
      semEmpresa("+5511900000701", ["Ana de Souza"]),
      semEmpresa("+5511900000702", ["Rita de Castro"]),
    ]);

    // "de" e curta e generica; "ana" tem tres letras. Nada em comum de fato.
    expect(sugestoes).toHaveLength(0);
  });

  it("NÃO sugere quem já tem empresa marcada", () => {
    const sugestoes = sugerirAgrupamentos([
      { ...semEmpresa("+5511900000701", ["Prestare Karen"]), empresaId: "ja-tem" },
      semEmpresa("+5511900000702", ["Prestare"]),
    ]);

    expect(sugestoes).toHaveLength(0);
  });

  it("não diferencia acento nem maiúscula", () => {
    const sugestoes = sugerirAgrupamentos([
      semEmpresa("+5511900000701", ["TOCA Imóveis"]),
      semEmpresa("+5511900000702", ["Matheus Toca"]),
    ]);

    expect(sugestoes.find((s) => s.palavra === "toca")?.telefones).toHaveLength(2);
  });
});

// -----------------------------------------------------------------------------
// A EMPRESA GRAVADA NA RESERVA (27/10/2026)
//
// O que mudou: quem responde passou a ser o CLIENTE, escolhendo de uma lista
// fechada, e a resposta fica NA RESERVA. O vinculo do telefone continua, mas
// so como padrao e para atribuir as reservas antigas.
// -----------------------------------------------------------------------------

describe("a lista que o cliente escolhe", () => {
  it("mostra só as empresas ligadas", async () => {
    const ativa = await empresaDeTeste(`${PREFIXO} Ativa`);
    const desligada = await empresaDeTeste(`${PREFIXO} Desligada`);
    await editarEmpresa(desligada.id, { ativa: false });

    const lista = await listarEmpresasParaEscolher();
    const ids = lista.map((empresa) => empresa.id);

    expect(ids).toContain(ativa.id);
    expect(ids).not.toContain(desligada.id);
  });

  it("não devolve nada além do nome", async () => {
    await empresaDeTeste();

    const lista = await listarEmpresasParaEscolher();

    // E lista PUBLICA: telefone, contagem de reservas ou qualquer numero que
    // diga quanto a empresa usa o espaco nao pode sair por aqui.
    for (const empresa of lista) {
      expect(Object.keys(empresa).sort()).toEqual(["id", "nome"]);
    }
  });
});

describe("o servidor não acredita na tela", () => {
  it("aceita nulo — a maioria não é de empresa", async () => {
    expect(await empresaEscolhidaEhValida(null)).toBe(true);
    expect(await empresaEscolhidaEhValida(undefined)).toBe(true);
  });

  it("recusa empresa inventada e empresa desligada", async () => {
    const desligada = await empresaDeTeste();
    await editarEmpresa(desligada.id, { ativa: false });

    expect(await empresaEscolhidaEhValida("nao-existe")).toBe(false);
    expect(await empresaEscolhidaEhValida(desligada.id)).toBe(false);
  });
});

describe("a empresa que já vem escolhida", () => {
  it("vem da ÚLTIMA reserva do telefone, não do vínculo antigo", async () => {
    // O ponto: o que o cliente respondeu por ultimo vale mais do que o que a
    // equipe marcou na mao um dia. Quem trocou de empresa nao fica preso.
    const antiga = await empresaDeTeste(`${PREFIXO} Antiga`);
    const nova = await empresaDeTeste(`${PREFIXO} Nova`);

    await vincularTelefone(TELEFONES[0]!, antiga.id);
    await reserva(TELEFONES[0]!, "Cliente", "2026-11-10", nova.id);

    expect((await empresaConhecidaDoTelefone(TELEFONES[0]!))?.id).toBe(nova.id);
  });

  it("cai no vínculo do telefone quando nenhuma reserva tem empresa", async () => {
    const empresa = await empresaDeTeste();
    await reserva(TELEFONES[0]!, "Cliente");
    await vincularTelefone(TELEFONES[0]!, empresa.id);

    expect((await empresaConhecidaDoTelefone(TELEFONES[0]!))?.id).toBe(empresa.id);
  });

  it("não sugere empresa desligada", async () => {
    const empresa = await empresaDeTeste();
    await vincularTelefone(TELEFONES[0]!, empresa.id);
    await editarEmpresa(empresa.id, { ativa: false });

    expect(await empresaConhecidaDoTelefone(TELEFONES[0]!)).toBeNull();
  });

  it("é nula para quem nunca reservou", async () => {
    expect(await empresaConhecidaDoTelefone(TELEFONES[2]!)).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// A PORTA DO SITE
//
// Aqui o que importa nao e a tela: e o SERVIDOR. A tela manda o identificador
// da empresa, e esconder o campo nao para quem manda o pedido direto.
// -----------------------------------------------------------------------------

describe("criar reserva no site com empresa", () => {
  /** Uma terca-feira futura, dentro do horario de funcionamento. */
  const DIA = "2026-11-10";

  async function reservarNoSite(empresaId: string | null, hora: string) {
    return criarReservaPublica({
      salaId: salaContainer,
      telefone: TELEFONES[0]!,
      nomeCliente: "Cliente de Teste",
      profissao: "OUTROS",
      empresaId,
      inicio: instanteDe(DIA, hora),
      fim: instanteDe(DIA, `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`),
    });
  }

  it("grava a empresa NA RESERVA", async () => {
    const dela = await empresaDeTeste();

    const resultado = await reservarNoSite(dela.id, "09:00");

    expect(resultado.criada).toBe(true);
    if (!resultado.criada) return;

    const gravada = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: resultado.reservaId },
      select: { empresaId: true },
    });

    expect(gravada.empresaId).toBe(dela.id);
  });

  it("guarda o telefone na empresa, para a próxima já vir escolhida", async () => {
    const dela = await empresaDeTeste();

    await reservarNoSite(dela.id, "09:00");

    const vinculo = await bancoDeTeste.telefoneDaEmpresa.findUnique({
      where: { telefone: TELEFONES[0]! },
    });

    expect(vinculo?.empresaId).toBe(dela.id);
  });

  it("RECUSA empresa desligada", async () => {
    const dela = await empresaDeTeste();
    await editarEmpresa(dela.id, { ativa: false });

    const resultado = await reservarNoSite(dela.id, "09:00");

    expect(resultado.criada).toBe(false);
  });

  it("RECUSA empresa inventada", async () => {
    const resultado = await reservarNoSite("nao-existe", "09:00");

    expect(resultado.criada).toBe(false);
  });

  it("segue normal sem empresa — é o caso da maioria", async () => {
    const resultado = await reservarNoSite(null, "09:00");

    expect(resultado.criada).toBe(true);
  });
});
