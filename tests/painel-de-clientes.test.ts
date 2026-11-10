/**
 * FASE 14, PARTE B — o painel de clientes (10/11/2026).
 *
 * A parte A acerta os 44 nomes para 25 telefones sozinha, com uma regra
 * simples: um cliente por telefone. O que ela NAO tem como saber e que o
 * "Rafael dos Passos" de um numero e o "Rafael Passos" de OUTRO numero sao a
 * mesma pessoa. Ninguem tem — so a equipe.
 *
 * O que estes testes protegem:
 *  1. JUNTAR move as reservas E os telefones, e o relatorio passa a ver uma
 *     pessoa so — o caso do Rafael, que o sistema nunca resolveu;
 *  2. juntar NAO INVENTA e NAO PERDE: a soma de horas depois e a soma das
 *     duas antes;
 *  3. SEPARAR desfaz: a reserva guarda o telefone dela, entao da para tirar
 *     um numero de volta. E o que torna a juncao errada recuperavel;
 *  4. RENOMEAR nao toca em reserva nenhuma — a linha fica intacta;
 *  5. DESLIGAR e decisao sobre o futuro: o historico fica e o cliente
 *     continua no relatorio;
 *  6. as SUGESTOES acham os parecidos e NUNCA juntam sozinhas;
 *  7. o banco impede o mesmo telefone em dois cadastros.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  juntarClientes,
  ligarOuDesligarCliente,
  listarClientes,
  renomearCliente,
  separarTelefone,
  sugerirJuncoes,
} from "@/lib/clientes-painel";
import { montarRelatorio } from "@/lib/relatorios";
import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";

const UM = "+5511900002001";
const OUTRO = "+5511900002002";
const TERCEIRO = "+5511900002003";
const TELEFONES = [UM, OUTRO, TERCEIRO];

/** Um prefixo próprio, para a limpeza não encostar em cadastro de fora. */
const PREFIXO = "ZZ ";

function proximaSegunda(): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + 3);
  while (data.getUTCDay() !== 1) {
    data.setUTCDate(data.getUTCDate() + 1);
  }
  return data.toISOString().slice(0, 10);
}

const DIA = proximaSegunda();
const PERIODO = { de: DIA, ate: DIA };

let salaId: string;
let salaContainer: string;
let operador: { id: string; nome: string };

beforeAll(async () => {
  await aquecerConexao();

  const ci = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-ci" },
    select: { id: true },
  });
  salaId = ci.id;

  const container = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaContainer = container.id;

  operador = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.painelclientes" },
    create: { nome: "Admin de Teste", usuario: "zz.painelclientes", senhaHash: "x" },
    update: {},
    select: { id: true, nome: true },
  });
});

let proxima = 8;

async function reservaDe(telefone: string, nome: string, sala = salaId, horas = 1) {
  const hora = proxima;
  proxima += horas;

  const criada = await criarReservaNaRecepcao({
    salaId: sala,
    telefone,
    nomeCliente: nome,
    profissaoId: await idDaProfissao("OUTROS"),
    inicio: instanteDe(DIA, `${String(hora).padStart(2, "0")}:00`),
    fim: instanteDe(DIA, `${String(hora + horas).padStart(2, "0")}:00`),
    operador,
  });

  if (!criada.ok) {
    throw new Error(`Não criou a reserva de teste: ${criada.falha.motivo}`);
  }

  return criada.dados.id;
}

/** O cadastro ligado a um telefone. */
async function cadastroDe(telefone: string) {
  const ligado = await bancoDeTeste.telefoneDoCliente.findUnique({
    where: { telefone },
    select: { clienteId: true, cliente: { select: { nome: true } } },
  });
  return ligado;
}

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: { in: TELEFONES } } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
  await bancoDeTeste.cliente.deleteMany({
    where: { reservas: { none: {} }, telefones: { none: {} } },
  });
  proxima = 8;
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.painelclientes" } });
  await bancoDeTeste.$disconnect();
});

// -----------------------------------------------------------------------------

describe("juntar dois cadastros", () => {
  it("o Rafael dos DOIS telefones vira UMA pessoa no relatório", async () => {
    // O caso que o sistema nunca resolveu sozinho, e que nenhuma regra sobre
    // telefone ou nome resolveria: são dois números de verdade.
    await reservaDe(UM, `${PREFIXO}Rafael dos Passos`, salaId, 2);
    await reservaDe(OUTRO, `${PREFIXO}Rafael Passos`, salaContainer, 3);

    const antes = await montarRelatorio(PERIODO);
    expect(
      antes.horasPorCliente.filter((c) => TELEFONES.includes(c.telefone)),
    ).toHaveLength(2);

    const principal = await cadastroDe(UM);
    const absorvido = await cadastroDe(OUTRO);

    const feito = await juntarClientes(principal!.clienteId, absorvido!.clienteId);
    expect(feito.ok).toBe(true);

    const depois = await montarRelatorio(PERIODO);
    const doRafael = depois.horasPorCliente.filter((c) =>
      TELEFONES.includes(c.telefone),
    );

    expect(doRafael).toHaveLength(1);
    // 2 h + 3 h: nada foi inventado e nada se perdeu no caminho.
    expect(doRafael[0]?.horas).toBe(5);
    expect(doRafael[0]?.nome).toBe(`${PREFIXO}Rafael dos Passos`);
  });

  it("os DOIS telefones passam para o cadastro que ficou", async () => {
    await reservaDe(UM, `${PREFIXO}Rafael`);
    await reservaDe(OUTRO, `${PREFIXO}Rafael`, salaContainer);

    const principal = await cadastroDe(UM);
    const absorvido = await cadastroDe(OUTRO);

    await juntarClientes(principal!.clienteId, absorvido!.clienteId);

    const agora = await cadastroDe(OUTRO);
    expect(agora?.clienteId).toBe(principal!.clienteId);

    // E o cadastro absorvido deixou de existir — ele não guardava mais nada.
    const sumiu = await bancoDeTeste.cliente.findUnique({
      where: { id: absorvido!.clienteId },
    });
    expect(sumiu).toBeNull();
  });

  it("diz quantas reservas e quais telefones mudaram de dono", async () => {
    // A tela mostra isso ANTES de confirmar: juntar errado soma faturamento
    // na pessoa errada, e ninguém reclamaria.
    await reservaDe(UM, `${PREFIXO}Rafael`);
    await reservaDe(OUTRO, `${PREFIXO}Rafael`, salaContainer);
    await reservaDe(OUTRO, `${PREFIXO}Rafael`, salaId);

    const principal = await cadastroDe(UM);
    const absorvido = await cadastroDe(OUTRO);

    const feito = await juntarClientes(principal!.clienteId, absorvido!.clienteId);

    expect(feito.ok && feito.dados.reservas).toBe(2);
    expect(feito.ok && feito.dados.telefones).toEqual(["(11) 90000-2002"]);
  });

  it("recusa juntar um cadastro com ele mesmo", async () => {
    await reservaDe(UM, `${PREFIXO}Rafael`);
    const cadastro = await cadastroDe(UM);

    const feito = await juntarClientes(cadastro!.clienteId, cadastro!.clienteId);

    expect(feito.ok).toBe(false);
    expect(feito.ok === false && feito.falha.codigo).toBe("MESMO_CLIENTE");
  });
});

describe("separar: o desfazer da junção", () => {
  it("devolve o telefone e as reservas dele a um cadastro próprio", async () => {
    // Só funciona porque a reserva continua guardando o TELEFONE dela. É isso
    // que torna uma junção errada recuperável.
    await reservaDe(UM, `${PREFIXO}Rafael`, salaId, 2);
    await reservaDe(OUTRO, `${PREFIXO}Rafael`, salaContainer, 3);

    const principal = await cadastroDe(UM);
    const absorvido = await cadastroDe(OUTRO);
    await juntarClientes(principal!.clienteId, absorvido!.clienteId);

    const desfeito = await separarTelefone(OUTRO, `${PREFIXO}Rafael de novo`);
    expect(desfeito.ok).toBe(true);
    expect(desfeito.ok && desfeito.dados.reservas).toBe(1);

    const relatorio = await montarRelatorio(PERIODO);
    const dois = relatorio.horasPorCliente.filter((c) =>
      TELEFONES.includes(c.telefone),
    );

    expect(dois).toHaveLength(2);
    expect(dois.map((c) => c.horas).sort()).toEqual([2, 3]);
  });

  it("recusa telefone que não está ligado a cadastro nenhum", async () => {
    const feito = await separarTelefone(TERCEIRO, `${PREFIXO}Ninguém`);

    expect(feito.ok).toBe(false);
    expect(feito.ok === false && feito.falha.codigo).toBe("SEM_VINCULO");
  });
});

describe("renomear", () => {
  it("troca o rótulo no relatório sem tocar na reserva", async () => {
    const reservaId = await reservaDe(UM, `${PREFIXO}Rafael dos Passos`);
    const antes = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reservaId },
    });

    const cadastro = await cadastroDe(UM);
    await renomearCliente(cadastro!.clienteId, `${PREFIXO}Rafael Passos`);

    const depois = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reservaId },
    });

    // A LINHA INTEIRA da reserva ficou igual: renomear não é gancho para
    // mexer em reserva nenhuma.
    expect(depois).toEqual(antes);

    const relatorio = await montarRelatorio(PERIODO);
    expect(
      relatorio.horasPorCliente.find((c) => c.telefone === UM)?.nome,
    ).toBe(`${PREFIXO}Rafael Passos`);
  });

  it("recusa nome curto demais", async () => {
    await reservaDe(UM, `${PREFIXO}Rafael`);
    const cadastro = await cadastroDe(UM);

    const feito = await renomearCliente(cadastro!.clienteId, " R ");

    expect(feito.ok).toBe(false);
    expect(feito.ok === false && feito.falha.codigo).toBe("NOME_CURTO");
  });
});

describe("desligar", () => {
  it("o histórico fica e o cliente continua no relatório", async () => {
    // Desligar é decisão sobre o FUTURO. Mesma regra das salas, das empresas
    // e das áreas de atuação; excluir não existe.
    await reservaDe(UM, `${PREFIXO}Rafael`, salaId, 2);
    const cadastro = await cadastroDe(UM);

    await ligarOuDesligarCliente(cadastro!.clienteId, false);

    const relatorio = await montarRelatorio(PERIODO);
    expect(
      relatorio.horasPorCliente.find((c) => c.telefone === UM)?.horas,
    ).toBe(2);

    const naLista = (await listarClientes()).find(
      (c) => c.id === cadastro!.clienteId,
    );
    expect(naLista?.ativo).toBe(false);
    expect(naLista?.reservas).toBe(1);
  });
});

describe("a lista do painel", () => {
  it("mostra os telefones, os nomes usados e as horas", async () => {
    await reservaDe(UM, `${PREFIXO}Rafael dos Passos`, salaId, 2);
    await reservaDe(UM, `${PREFIXO}Rafael Passos`, salaContainer, 1);

    const cadastro = await cadastroDe(UM);
    const dele = (await listarClientes()).find((c) => c.id === cadastro!.clienteId);

    expect(dele?.telefones).toEqual(["(11) 90000-2001"]);
    expect(dele?.nomesNasReservas).toHaveLength(2);
    expect(dele?.reservas).toBe(2);
    expect(dele?.horas).toBe(3);
  });

  it("hora CANCELADA não conta, igual ao relatório", async () => {
    const reservaId = await reservaDe(UM, `${PREFIXO}Rafael`, salaId, 2);
    await bancoDeTeste.reserva.update({
      where: { id: reservaId },
      data: { status: "CANCELADA", canceladoEm: new Date() },
    });

    const cadastro = await cadastroDe(UM);
    const dele = (await listarClientes()).find((c) => c.id === cadastro!.clienteId);

    expect(dele?.horas).toBe(0);
    expect(dele?.reservas).toBe(1);
  });
});

describe("as sugestões", () => {
  it("acham dois cadastros com nome parecido", async () => {
    await reservaDe(UM, `${PREFIXO}Rafael dos Passos`);
    await reservaDe(OUTRO, `${PREFIXO}Rafael Passos`, salaContainer);

    const sugestoes = await sugerirJuncoes();
    const doRafael = sugestoes.find((s) => s.palavra === "rafael");

    expect(doRafael?.clientes.length).toBeGreaterThanOrEqual(2);
  });

  it("NUNCA juntam sozinhas", async () => {
    // Um palpite errado viraria faturamento somado na pessoa errada, e
    // ninguém reclamaria — o número continuaria parecendo certo.
    await reservaDe(UM, `${PREFIXO}Rafael dos Passos`);
    await reservaDe(OUTRO, `${PREFIXO}Rafael Passos`, salaContainer);

    await sugerirJuncoes();

    const relatorio = await montarRelatorio(PERIODO);
    expect(
      relatorio.horasPorCliente.filter((c) => TELEFONES.includes(c.telefone)),
    ).toHaveLength(2);
  });

  it("ignoram palavras genéricas", async () => {
    // "cliente" e "teste" aparecem em meio mundo de nome e juntariam gente
    // que não tem nada a ver.
    await reservaDe(UM, `${PREFIXO}Cliente Teste Alfa`);
    await reservaDe(OUTRO, `${PREFIXO}Cliente Teste Beta`, salaContainer);

    const sugestoes = await sugerirJuncoes();
    const palavras = sugestoes.map((s) => s.palavra);

    expect(palavras).not.toContain("cliente");
    expect(palavras).not.toContain("teste");
  });
});

describe("o banco é quem garante", () => {
  it("o mesmo telefone não fica em dois cadastros depois de juntar", async () => {
    await reservaDe(UM, `${PREFIXO}Rafael`);
    await reservaDe(OUTRO, `${PREFIXO}Rafael`, salaContainer);

    const principal = await cadastroDe(UM);
    const absorvido = await cadastroDe(OUTRO);
    await juntarClientes(principal!.clienteId, absorvido!.clienteId);

    const quantos = await bancoDeTeste.telefoneDoCliente.count({
      where: { telefone: { in: TELEFONES } },
    });

    expect(quantos).toBe(2);
  });
});
