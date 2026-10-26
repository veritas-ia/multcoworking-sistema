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
  listarClientesConhecidos,
  listarEmpresas,
  sugerirAgrupamentos,
  vincularTelefone,
  type ClienteConhecido,
} from "@/lib/empresas";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

const PREFIXO = "ZZ Empresa";
const TELEFONES = ["+5511900000701", "+5511900000702", "+5511900000703"];

let salaId: string;

beforeAll(async () => {
  await aquecerConexao();
  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  salaId = sala.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.telefoneDaEmpresa.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
  await bancoDeTeste.empresa.deleteMany({ where: { nome: { startsWith: PREFIXO } } });
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: { in: TELEFONES } } });
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

async function reserva(telefone: string, nome: string, dia = "2026-11-10") {
  const hora = String(proximaHora++).padStart(2, "0");

  return bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: nome,
      telefone,
      profissao: "OUTROS",
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
