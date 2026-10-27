/**
 * OS NUMEROS DO RELATORIO.
 *
 * O que estes testes protegem:
 *  1. o FUSO. O banco guarda em UTC; uma reserva de segunda as 21h nao pode
 *     virar terca no relatorio. E o erro mais provavel aqui, e o mais dificil
 *     de perceber olhando a tela;
 *  2. o relatorio nao devolve DINHEIRO nenhum — decisao do dono;
 *  3. o periodo de comparacao tem o mesmo tamanho do atual, senao fevereiro
 *     "cairia" so por ter menos dias;
 *  4. dias sem reserva aparecem como zero, para a linha do grafico nao pular
 *     o domingo e sugerir movimento onde nao houve;
 *  5. reserva sem profissao vira "Não informado", e nao some da conta.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  compararPeriodos,
  diasNoPeriodo,
  montarDetalheDaEmpresa,
  montarDetalheDoCliente,
  montarRelatorio,
  periodoAnterior,
  procurarClientes,
  somarDias,
} from "@/lib/relatorios";
import { GET as getRelatorios } from "@/app/api/admin/relatorios/route";
import { ATALHOS, ATALHO_PADRAO } from "@/components/admin/relatorios/periodos";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet } from "./apoio/requisicao";

/** 2026-11-02 e uma SEGUNDA. */
const SEGUNDA = "2026-11-02";
const TERCA = "2026-11-03";
const TELEFONE = "+5511900000789";

let salaCI: string;
let salaContainer: string;
let cookie: string;

beforeAll(async () => {
  await aquecerConexao();

  const ci = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-ci" },
    select: { id: true },
  });
  const container = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });

  salaCI = ci.id;
  salaContainer = container.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.relatorios" },
    create: { nome: "Admin de Teste", usuario: "zz.relatorios", senhaHash: "x" },
    update: {},
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(admin.id)}`;
});

/** Um segundo cliente, para o ranking ter com quem comparar. */
const TELEFONE_B = "+5511900000788";

const EMPRESA_DE_TESTE = "ZZ Relatorio";

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({
    where: { telefone: { in: [TELEFONE, TELEFONE_B] } },
  });
  // A ORDEM IMPORTA: a reserva aponta para a empresa com ON DELETE RESTRICT.
  await bancoDeTeste.telefoneDaEmpresa.deleteMany({
    where: { telefone: { in: [TELEFONE, TELEFONE_B] } },
  });
  await bancoDeTeste.empresa.deleteMany({
    where: { nome: { startsWith: EMPRESA_DE_TESTE } },
  });
}

/** Uma empresa de teste, criada direto no banco. */
async function empresa(sufixo = "") {
  return bancoDeTeste.empresa.create({
    data: { nome: `${EMPRESA_DE_TESTE}${sufixo} ${Date.now()}` },
    select: { id: true, nome: true },
  });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.relatorios" } });
  await bancoDeTeste.$disconnect();
});

/** Grava uma reserva direto no banco, sem passar pelas regras da agenda. */
async function reserva(entrada: {
  dia: string;
  inicio: string;
  fim: string;
  salaId?: string;
  status?: "CONFIRMADA" | "CANCELADA" | "CONCLUIDA" | "REAGENDADA";
  profissao?: "MARKETING" | "JURIDICO" | "CONTABIL" | "SAUDE" | "OUTROS" | null;
  nome?: string;
  telefone?: string;
  empresaId?: string | null;
  valor?: string;
}) {
  return bancoDeTeste.reserva.create({
    data: {
      salaId: entrada.salaId ?? salaCI,
      nomeCliente: entrada.nome ?? "Cliente de Teste",
      telefone: entrada.telefone ?? TELEFONE,
      profissao: entrada.profissao === undefined ? "MARKETING" : entrada.profissao,
      inicio: instanteDe(entrada.dia, entrada.inicio),
      fim: instanteDe(entrada.dia, entrada.fim),
      // O banco exige que a duracao bata com o horario (trava
      // "reserva_duracao_bate_com_horario"), entao ela sai do proprio par.
      duracaoMinutos:
        (instanteDe(entrada.dia, entrada.fim).getTime() -
          instanteDe(entrada.dia, entrada.inicio).getTime()) /
        60_000,
      valor: entrada.valor ?? "40.00",
      empresaId: entrada.empresaId ?? null,
      status: entrada.status ?? "CONFIRMADA",
      // O banco exige a data do cancelamento junto com o status CANCELADA
      // (trava "reserva_cancelamento_coerente"): status cancelado sem data
      // deixaria a agenda sem saber quando aquilo aconteceu.
      canceladoEm: entrada.status === "CANCELADA" ? new Date() : null,
      origem: "ADMIN",
    },
  });
}

// -----------------------------------------------------------------------------

describe("contas de calendario", () => {
  it("conta os dois extremos do periodo", () => {
    expect(diasNoPeriodo({ de: "2026-11-01", ate: "2026-11-01" })).toBe(1);
    expect(diasNoPeriodo({ de: "2026-11-01", ate: "2026-11-07" })).toBe(7);
  });

  it("atravessa a virada do mes", () => {
    expect(somarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("o periodo anterior tem o MESMO tamanho e termina colado no atual", () => {
    const anterior = periodoAnterior({ de: "2026-11-01", ate: "2026-11-30" });

    expect(anterior).toEqual({ de: "2026-10-02", ate: "2026-10-31" });
    expect(diasNoPeriodo(anterior)).toBe(30);
  });
});

describe("o fuso de Sao Paulo", () => {
  it("reserva de segunda as 21h conta na SEGUNDA, e nao na terca", async () => {
    // Em UTC isto e terca-feira as 00:00 — o erro que este teste existe para
    // pegar. O relatorio tem de concordar com a agenda, que mostra segunda.
    await reserva({ dia: SEGUNDA, inicio: "21:00", fim: "22:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.total).toBe(1);
    expect(relatorio.porDia).toEqual([{ data: SEGUNDA, total: 1 }]);

    const segunda = relatorio.porDiaDaSemana.find((dia) => dia.diaDaSemana === 1);
    expect(segunda?.total).toBe(1);
    expect(relatorio.porHora).toEqual([{ rotulo: "21h", total: 1 }]);
  });

  it("nao puxa reserva do dia seguinte para dentro do periodo", async () => {
    await reserva({ dia: TERCA, inicio: "09:00", fim: "10:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.total).toBe(0);
  });
});

describe("o que o relatorio conta", () => {
  it("conta TODOS os status, e mostra a divisao entre eles", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", status: "CANCELADA" });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "15:00", status: "CONCLUIDA" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.total).toBe(3);
    expect(relatorio.porStatus).toEqual([
      { rotulo: "Confirmadas", total: 1 },
      { rotulo: "Canceladas", total: 1 },
      { rotulo: "Concluídas", total: 1 },
    ]);
  });

  it("separa por sala, da mais usada para a menos", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", salaId: salaContainer });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", salaId: salaContainer });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "15:00", salaId: salaCI });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.porSala[0]?.total).toBe(2);
    expect(relatorio.porSala[1]?.total).toBe(1);
    // A cor da sala vem junto, para o grafico usar a mesma da agenda.
    expect(relatorio.porSala[0]?.cor).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("mostra os dias vazios como zero", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: somarDias(SEGUNDA, 2) });

    expect(relatorio.porDia).toEqual([
      { data: SEGUNDA, total: 1 },
      { data: TERCA, total: 0 },
      { data: somarDias(SEGUNDA, 2), total: 0 },
    ]);
  });

  it("junta a meia hora na hora cheia", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({ dia: SEGUNDA, inicio: "09:30", fim: "10:30", salaId: salaContainer });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.porHora).toEqual([{ rotulo: "09h", total: 2 }]);
  });
});

describe("profissao", () => {
  it("agrupa pelas areas e chama a ausencia de 'Não informado'", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", profissao: "SAUDE" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", profissao: "SAUDE" });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "15:00", profissao: null });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.porProfissao).toEqual([
      { rotulo: "Área da Saúde", total: 2 },
      { rotulo: "Não informado", total: 1 },
    ]);
  });
});

describe("comparacao entre periodos", () => {
  it("calcula a variacao contra o periodo anterior do mesmo tamanho", async () => {
    // Periodo atual: 2 reservas. Anterior (mesmo tamanho, colado antes): 1.
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00" });
    await reserva({ dia: somarDias(SEGUNDA, -1), inicio: "09:00", fim: "10:00" });

    const comparacao = await compararPeriodos({ de: SEGUNDA, ate: SEGUNDA });

    expect(comparacao.atual.total).toBe(2);
    expect(comparacao.anterior.total).toBe(1);
    expect(comparacao.variacaoAbsoluta).toBe(1);
    expect(comparacao.variacaoPercentual).toBe(100);
  });

  it("sem base de comparacao, a variacao percentual e nula", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const comparacao = await compararPeriodos({ de: SEGUNDA, ate: SEGUNDA });

    expect(comparacao.anterior.total).toBe(0);
    // "Aumentou infinito por cento" nao diz nada a ninguem.
    expect(comparacao.variacaoPercentual).toBeNull();
    expect(comparacao.variacaoAbsoluta).toBe(1);
  });
});

describe("dinheiro: só no relatório de UM cliente", () => {
  // Em 07/10/2026 o dono liberou o faturamento — e SO no relatorio individual.
  // Ate entao o dashboard inteiro era proibido de devolver dinheiro. Estes
  // testes nao foram apagados: viraram a vigia da fronteira nova. O geral e a
  // busca continuam sem valor nenhum, e o individual devolve APENAS o total.

  it("o relatório GERAL continua sem valor, receita nem faturamento", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });
    const texto = JSON.stringify(relatorio);

    // A reserva vale R$40 no banco. Se esse numero aparecer aqui, alguem
    // abriu a porta do dinheiro no lugar errado.
    expect(texto).not.toContain("valor");
    expect(texto).not.toContain("40.00");
    expect(texto).not.toContain("4000");
    expect(texto).not.toMatch(/receita|faturamento/i);
  });

  it("a BUSCA de clientes continua sem dinheiro", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "Maria" });

    const texto = JSON.stringify(
      await procurarClientes({ de: SEGUNDA, ate: SEGUNDA }, "maria"),
    );

    expect(texto).not.toContain("valor");
    expect(texto).not.toContain("40.00");
    expect(texto).not.toContain("4000");
    expect(texto).not.toMatch(/receita|faturamento/i);
  });

  it("o relatório de UM cliente devolve o faturamento — e SÓ o total", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    // O total aparece, em centavos.
    expect(detalhe?.faturamentoCentavos).toBe(4_000);

    // Mas a lista de reservas NAO carrega o valor de cada uma: o dono
    // liberou a metrica, e nao o preco reserva a reserva.
    for (const linha of detalhe?.reservas ?? []) {
      expect(Object.keys(linha)).not.toContain("valor");
    }
  });
});

describe("horas por cliente", () => {
  it("soma as horas certas e DEIXA A CANCELADA DE FORA", async () => {
    // 1h + 2h30 contam; a cancelada de 1h, nao.
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "16:30" });
    await reserva({ dia: SEGUNDA, inicio: "17:00", fim: "18:00", status: "CANCELADA" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });
    const cliente = relatorio.horasPorCliente.find((c) => c.telefone === TELEFONE);

    expect(cliente?.horas).toBe(3.5);
    expect(cliente?.reservas).toBe(2);
  });

  it("conta REAGENDADA e CONCLUIDA como tempo usado", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", status: "REAGENDADA" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", status: "CONCLUIDA" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.horasPorCliente[0]?.horas).toBe(2);
  });

  it("ordena do cliente com MAIS horas para o com menos", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "17:00",
      telefone: TELEFONE_B, nome: "Outro Cliente", salaId: salaContainer,
    });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.horasPorCliente[0]?.telefone).toBe(TELEFONE_B);
    expect(relatorio.horasPorCliente[0]?.horas).toBe(3);
    expect(relatorio.horasPorCliente[1]?.horas).toBe(1);
  });

  it("junta o mesmo telefone mesmo com o nome escrito diferente", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "maria" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", nome: "Maria Silva" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    // Uma linha so, com as duas horas somadas e o nome MAIS RECENTE.
    expect(relatorio.horasPorCliente).toHaveLength(1);
    expect(relatorio.horasPorCliente[0]?.horas).toBe(2);
    expect(relatorio.horasPorCliente[0]?.nome).toBe("Maria Silva");
  });

  it("A RESERVA DAS 21H DE SEGUNDA conta na segunda, e não na terça", async () => {
    // Em UTC isto e 2026-11-03T00:00Z — ja e TERCA. Somar no fuso do banco
    // jogaria as horas para o dia seguinte, e o relatorio discordaria da
    // agenda. Mesma armadilha na virada de mes.
    await reserva({ dia: SEGUNDA, inicio: "21:00", fim: "22:00" });

    const naSegunda = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });
    const naTerca = await montarRelatorio({ de: TERCA, ate: TERCA });

    expect(naSegunda.horasPorCliente[0]?.horas).toBe(1);
    expect(naTerca.horasPorCliente).toHaveLength(0);
  });

  it("na virada do MÊS, a reserva das 21h fica no mês em que começou", async () => {
    // 2026-11-30 e uma segunda; as 21h locais viram 2026-12-01 em UTC.
    await reserva({ dia: "2026-11-30", inicio: "21:00", fim: "22:00" });

    const novembro = await montarRelatorio({ de: "2026-11-01", ate: "2026-11-30" });
    const dezembro = await montarRelatorio({ de: "2026-12-01", ate: "2026-12-31" });

    expect(novembro.horasPorCliente[0]?.horas).toBe(1);
    expect(dezembro.horasPorCliente).toHaveLength(0);
  });
});

describe("busca de cliente", () => {
  it("acha pelo telefone em qualquer formato digitado", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "Maria" });

    // Os tres jeitos que a equipe digita o mesmo numero.
    for (const digitado of ["+5511900000789", "11900000789", "(11) 90000-0789"]) {
      const achados = await procurarClientes({ de: SEGUNDA, ate: SEGUNDA }, digitado);

      expect(achados).toHaveLength(1);
      expect(achados[0]?.telefone).toBe(TELEFONE);
      expect(achados[0]?.nome).toBe("Maria");
    }
  });

  it("acha pelo nome sem diferenciar maiúscula nem acento", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "João Antônio" });

    for (const digitado of ["joao", "JOÃO", "antonio"]) {
      const achados = await procurarClientes({ de: SEGUNDA, ate: SEGUNDA }, digitado);
      expect(achados[0]?.telefone).toBe(TELEFONE);
    }
  });

  it("devolve VÁRIOS quando o nome bate com mais de um cliente", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "Ana Paula" });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "15:00",
      nome: "Ana Beatriz", telefone: TELEFONE_B, salaId: salaContainer,
    });

    const achados = await procurarClientes({ de: SEGUNDA, ate: SEGUNDA }, "ana");

    expect(achados).toHaveLength(2);
  });

  it("acha quem só tem reserva cancelada, com zero horas", async () => {
    await reserva({
      dia: SEGUNDA, inicio: "09:00", fim: "10:00",
      nome: "Pedro", status: "CANCELADA",
    });

    const achados = await procurarClientes({ de: SEGUNDA, ate: SEGUNDA }, "pedro");

    expect(achados).toHaveLength(1);
    expect(achados[0]?.horas).toBe(0);
  });

  it("não devolve nada com menos de 2 letras, nem para quem não tem reserva no período", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "Maria" });

    expect(await procurarClientes({ de: SEGUNDA, ate: SEGUNDA }, "m")).toHaveLength(0);
    expect(await procurarClientes({ de: TERCA, ate: TERCA }, "maria")).toHaveLength(0);
  });
});

describe("faturamento do cliente", () => {
  // O helper grava R$40 em toda reserva, entao o teste manda o valor na mao
  // quando precisa de precos diferentes.
  async function reservaCom(valor: string, extra: Parameters<typeof reserva>[0]) {
    const criada = await reserva(extra);
    await bancoDeTeste.reserva.update({ where: { id: criada.id }, data: { valor } });
    return criada;
  }

  it("soma o valor GRAVADO de várias reservas, em salas e horários diferentes", async () => {
    await reservaCom("40.00", { dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reservaCom("150.00", {
      dia: SEGUNDA, inicio: "14:00", fim: "16:00", salaId: salaContainer,
    });
    await reservaCom("265.00", { dia: SEGUNDA, inicio: "17:00", fim: "20:00" });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    // 40 + 150 + 265 = R$455,00
    expect(detalhe?.faturamentoCentavos).toBe(45_500);
  });

  it("a CANCELADA não entra, igual às horas", async () => {
    await reservaCom("100.00", { dia: SEGUNDA, inicio: "09:00", fim: "10:00" });
    await reservaCom("999.00", {
      dia: SEGUNDA, inicio: "14:00", fim: "15:00", status: "CANCELADA",
    });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    expect(detalhe?.faturamentoCentavos).toBe(10_000);
    // A cancelada continua aparecendo na contagem e na lista — so nao soma.
    expect(detalhe?.totalDeReservas).toBe(2);
  });

  it("conta REAGENDADA e CONCLUIDA, como as horas", async () => {
    await reservaCom("70.00", {
      dia: SEGUNDA, inicio: "09:00", fim: "10:00", status: "REAGENDADA",
    });
    await reservaCom("30.00", {
      dia: SEGUNDA, inicio: "11:00", fim: "12:00", status: "CONCLUIDA",
    });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    expect(detalhe?.faturamentoCentavos).toBe(10_000);
  });

  it("NÃO recalcula: muda o preço da sala e o faturamento não se mexe", async () => {
    // O ponto que justifica somar o valor gravado em vez de recalcular. Se o
    // relatorio recalculasse, este numero mudaria sozinho quando a equipe
    // mexesse no preco — e discordaria do que a reserva guarda.
    await reservaCom("40.00", { dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const antes = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);
    expect(antes?.faturamentoCentavos).toBe(4_000);

    await bancoDeTeste.sala.update({
      where: { id: salaCI },
      data: { precoPorHora: "500.00" },
    });

    try {
      const depois = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);
      expect(depois?.faturamentoCentavos).toBe(4_000);
    } finally {
      await bancoDeTeste.sala.update({
        where: { id: salaCI },
        data: { precoPorHora: "40.00" },
      });
    }
  });

  it("soma centavos sem acumular diferença", async () => {
    // Tres reservas de R$33,33 dao R$99,99 — e nao R$99,98 nem R$100,00.
    for (const hora of ["09:00", "11:00", "13:00"]) {
      await reservaCom("33.33", {
        dia: SEGUNDA,
        inicio: hora,
        fim: `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`,
      });
    }

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    expect(detalhe?.faturamentoCentavos).toBe(9_999);
  });

  it("cliente só com reserva cancelada tem faturamento zero", async () => {
    await reservaCom("80.00", {
      dia: SEGUNDA, inicio: "09:00", fim: "10:00", status: "CANCELADA",
    });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    expect(detalhe?.faturamentoCentavos).toBe(0);
  });
});

describe("relatório de um cliente", () => {
  it("traz horas, reservas, salas e a lista do período", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:30", nome: "Maria" });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "15:00",
      nome: "Maria", salaId: salaContainer,
    });
    await reserva({
      dia: SEGUNDA, inicio: "17:00", fim: "18:00",
      nome: "Maria", status: "CANCELADA",
    });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    expect(detalhe?.nome).toBe("Maria");
    // 1h30 + 1h. A cancelada nao soma, mas aparece na contagem e na lista.
    expect(detalhe?.horas).toBe(2.5);
    expect(detalhe?.totalDeReservas).toBe(3);
    expect(detalhe?.porSala).toHaveLength(2);
    expect(detalhe?.reservas).toHaveLength(3);
    expect(detalhe?.reservas[0]).toMatchObject({
      data: SEGUNDA,
      inicio: "09:00",
      fim: "10:30",
      duracaoHoras: 1.5,
    });
  });

  it("mostra a profissão mais usada e avisa quando há divergência", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", profissao: "MARKETING" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", profissao: "MARKETING" });
    await reserva({ dia: SEGUNDA, inicio: "14:00", fim: "15:00", profissao: "OUTROS" });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    expect(detalhe?.profissao).toBe("Marketing");
    expect(detalhe?.profissaoDivergente).toBe(true);
  });

  it("não avisa divergência quando a profissão é sempre a mesma", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", profissao: "SAUDE" });
    await reserva({ dia: SEGUNDA, inicio: "11:00", fim: "12:00", profissao: "SAUDE" });

    const detalhe = await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, TELEFONE);

    expect(detalhe?.profissaoDivergente).toBe(false);
  });

  it("devolve nulo para telefone inválido ou sem reserva no período", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    expect(await montarDetalheDoCliente({ de: SEGUNDA, ate: SEGUNDA }, "abc")).toBeNull();
    expect(await montarDetalheDoCliente({ de: TERCA, ate: TERCA }, TELEFONE)).toBeNull();
  });
});

// =============================================================================
// A rota do painel
// =============================================================================

describe("GET /api/admin/relatorios", () => {
  it("recusa quem nao tem sessao de admin", async () => {
    const resposta = await getRelatorios(
      pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA }),
    );

    expect(resposta.status).toBe(401);
  });

  it("devolve os numeros do periodo pedido", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const corpo = await (
      await getRelatorios(
        pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA }, { cookie }),
      )
    ).json();

    expect(corpo.atual.total).toBe(1);
    expect(corpo.anterior.total).toBe(0);
  });

  it("a rota de busca e a de UM cliente exigem sessão de admin", async () => {
    // As portas novas. Uma delas devolve nome e telefone de cliente — nao pode
    // responder para quem nao esta logado no painel.
    const busca = await getRelatorios(
      pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA, cliente: "maria" }),
    );
    const detalhe = await getRelatorios(
      pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA, telefone: TELEFONE }),
    );

    expect(busca.status).toBe(401);
    expect(detalhe.status).toBe(401);
  });

  it("pela ROTA, só a resposta de um cliente carrega dinheiro", async () => {
    // A garantia real: o texto cru que sai pela rede. Se o valor escapar da
    // lista fechada no relatorio geral ou na busca, ele aparece aqui — e nao
    // adianta a tela nao desenhar o numero.
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "Maria" });

    const semDinheiro = await Promise.all([
      getRelatorios(pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA }, { cookie })),
      getRelatorios(
        pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA, cliente: "maria" }, { cookie }),
      ),
    ]);

    for (const resposta of semDinheiro) {
      const texto = JSON.stringify(await resposta.json());

      expect(texto).not.toContain("valor");
      expect(texto).not.toContain("40.00");
      expect(texto).not.toContain("4000");
      expect(texto).not.toMatch(/receita|faturamento/i);
    }

    // O individual, sim: liberado pelo dono em 07/10/2026.
    const corpo = await (
      await getRelatorios(
        pedidoGet("/api/admin/relatorios", { de: SEGUNDA, ate: SEGUNDA, telefone: TELEFONE }, { cookie }),
      )
    ).json();

    expect(corpo.detalheDoCliente.faturamentoCentavos).toBe(4_000);
    // E so o total: o preco de cada reserva continua fora da resposta.
    expect(JSON.stringify(corpo.detalheDoCliente.reservas)).not.toContain("valor");
  });

  it("a busca por telefone pela rota devolve o cliente certo", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "11:00", nome: "Maria" });

    const corpo = await (
      await getRelatorios(
        pedidoGet(
          "/api/admin/relatorios",
          { de: SEGUNDA, ate: SEGUNDA, cliente: "(11) 90000-0789" },
          { cookie },
        ),
      )
    ).json();

    expect(corpo.clientes).toHaveLength(1);
    expect(corpo.clientes[0].nome).toBe("Maria");
    expect(corpo.clientes[0].horas).toBe(2);
  });

  it("devolve 404 para cliente sem reserva no período", async () => {
    const resposta = await getRelatorios(
      pedidoGet(
        "/api/admin/relatorios",
        { de: SEGUNDA, ate: SEGUNDA, telefone: TELEFONE },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(404);
  });

  it("recusa periodo invertido", async () => {
    const resposta = await getRelatorios(
      pedidoGet(
        "/api/admin/relatorios",
        { de: "2026-11-10", ate: "2026-11-01" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("recusa periodo maior que um ano", async () => {
    const resposta = await getRelatorios(
      pedidoGet(
        "/api/admin/relatorios",
        { de: "2020-01-01", ate: "2026-12-31" },
        { cookie },
      ),
    );

    expect(resposta.status).toBe(422);
  });

  it("aceita um periodo de comparacao escolhido a mao", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const corpo = await (
      await getRelatorios(
        pedidoGet(
          "/api/admin/relatorios",
          {
            de: SEGUNDA,
            ate: SEGUNDA,
            compararDe: somarDias(SEGUNDA, -7),
            compararAte: somarDias(SEGUNDA, -7),
          },
          { cookie },
        ),
      )
    ).json();

    expect(corpo.anterior.periodo).toEqual({
      de: somarDias(SEGUNDA, -7),
      ate: somarDias(SEGUNDA, -7),
    });
  });
});

/**
 * O PERIODO COM QUE A TELA ABRE (27/10/2026).
 *
 * Isto nao e detalhe de estilo. Com sete dias, o dono do coworking leu
 * "poucas horas" da Toca Imoveis achando que era o total — era so a ultima
 * semana, e as horas estavam todas no banco. Se alguem voltar o padrao para
 * sete dias, o mesmo mal-entendido volta com ele, e sem erro aparecer em
 * lugar nenhum.
 */
describe("o período com que o relatório abre", () => {
  it("abre em 30 dias, não em 7", () => {
    expect(ATALHO_PADRAO.id).toBe("30dias");

    const periodo = ATALHO_PADRAO.calcular("2026-10-27");

    expect(periodo).toEqual({ de: "2026-09-28", ate: "2026-10-27" });
  });

  it("os três atalhos continuam na tela, na ordem de leitura", () => {
    expect(ATALHOS.map((atalho) => atalho.id)).toEqual(["7dias", "30dias", "mes"]);
  });
});

// -----------------------------------------------------------------------------
// EMPRESAS NO RELATORIO (27/10/2026)
//
// O problema real: a Prestare usa tres telefones e a Toca dois. Para a equipe
// e um cliente so; para o relatorio eram cinco clientes, cada um com uma
// fatia das horas.
// -----------------------------------------------------------------------------

describe("horas por empresa", () => {
  it("soma os vários telefones da mesma empresa num total só", async () => {
    const dela = await empresa();

    await reserva({
      dia: SEGUNDA, inicio: "09:00", fim: "11:00", empresaId: dela.id,
    });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "15:00", telefone: TELEFONE_B,
      nome: "Outra pessoa da equipe", empresaId: dela.id, salaId: salaContainer,
    });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });
    const linha = relatorio.horasPorEmpresa.find((item) => item.id === dela.id);

    expect(linha?.horas).toBe(3);
    expect(linha?.reservas).toBe(2);
  });

  it("cancelada não conta como hora usada", async () => {
    const dela = await empresa();

    await reserva({
      dia: SEGUNDA, inicio: "09:00", fim: "10:00", empresaId: dela.id,
    });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "16:00", empresaId: dela.id,
      status: "CANCELADA", salaId: salaContainer,
    });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.horasPorEmpresa.find((item) => item.id === dela.id)?.horas).toBe(1);
  });

  it("a reserva ANTIGA, sem empresa gravada, entra pelo vínculo do telefone", async () => {
    // As reservas criadas antes da pergunta existir tem empresa nula.
    // Preencher um valor nelas seria inventar resposta que o cliente nunca
    // deu, entao a empresa delas vem do vinculo marcado no painel.
    const dela = await empresa();

    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", empresaId: null });
    await bancoDeTeste.telefoneDaEmpresa.create({
      data: { telefone: TELEFONE, empresaId: dela.id },
    });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.horasPorEmpresa.find((item) => item.id === dela.id)?.horas).toBe(1);
  });

  it("a reserva de OUTRA empresa não é puxada pelo vínculo do telefone", async () => {
    // A armadilha: o telefone esta vinculado a A, mas a reserva foi
    // respondida como B. O que o cliente disse naquele dia vale mais do que
    // o vinculo de hoje — senao quem trocou de empresa levaria as reservas
    // antigas com ele.
    const a = await empresa(" A");
    const b = await empresa(" B");

    await bancoDeTeste.telefoneDaEmpresa.create({
      data: { telefone: TELEFONE, empresaId: a.id },
    });
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", empresaId: b.id });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.horasPorEmpresa.find((item) => item.id === b.id)?.horas).toBe(1);
    expect(relatorio.horasPorEmpresa.find((item) => item.id === a.id)).toBeUndefined();
  });

  it("quem não é de empresa não aparece", async () => {
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00" });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });

    expect(relatorio.horasPorEmpresa).toHaveLength(0);
  });
});

describe("o relatório de UMA empresa", () => {
  it("soma o faturamento do valor JÁ GRAVADO, em centavos", async () => {
    // Tres reservas de R$ 33,33 precisam dar R$ 99,99: somar reais em ponto
    // flutuante acumula diferenca de centavo.
    const dela = await empresa();

    for (const hora of ["08:00", "10:00", "14:00"]) {
      await reserva({
        dia: SEGUNDA, inicio: hora, fim: `${Number(hora.slice(0, 2)) + 1}:00`.padStart(5, "0"),
        empresaId: dela.id, valor: "33.33",
      });
    }

    const detalhe = await montarDetalheDaEmpresa({ de: SEGUNDA, ate: SEGUNDA }, dela.id);

    expect(detalhe?.faturamentoCentavos).toBe(9999);
    expect(detalhe?.horas).toBe(3);
  });

  it("cancelada não entra no faturamento", async () => {
    const dela = await empresa();

    await reserva({
      dia: SEGUNDA, inicio: "09:00", fim: "10:00", empresaId: dela.id, valor: "40.00",
    });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "15:00", empresaId: dela.id, valor: "999.00",
      status: "CANCELADA", salaId: salaContainer,
    });

    const detalhe = await montarDetalheDaEmpresa({ de: SEGUNDA, ate: SEGUNDA }, dela.id);

    expect(detalhe?.faturamentoCentavos).toBe(4000);
    // A cancelada continua contando como RESERVA: ela aconteceu na agenda.
    expect(detalhe?.totalDeReservas).toBe(2);
  });

  it("lista quem reservou, com o telefone inteiro", async () => {
    const dela = await empresa();

    await reserva({
      dia: SEGUNDA, inicio: "09:00", fim: "11:00", nome: "Karen", empresaId: dela.id,
    });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "15:00", nome: "Dani", telefone: TELEFONE_B,
      empresaId: dela.id, salaId: salaContainer,
    });

    const detalhe = await montarDetalheDaEmpresa({ de: SEGUNDA, ate: SEGUNDA }, dela.id);

    expect(detalhe?.pessoas).toHaveLength(2);
    // Do que mais usou para o que menos usou.
    expect(detalhe?.pessoas[0]?.nome).toBe("Karen");
    expect(detalhe?.pessoas[0]?.telefoneVisivel).toBe(TELEFONE);
  });

  it("é nulo quando a empresa não tem nada no período", async () => {
    const dela = await empresa();

    expect(
      await montarDetalheDaEmpresa({ de: SEGUNDA, ate: SEGUNDA }, dela.id),
    ).toBeNull();
  });

  it("NÃO manda o preço de cada reserva, só o total", async () => {
    // O dono liberou a METRICA por empresa, e nao o preco reserva a reserva.
    const dela = await empresa();

    await reserva({
      dia: SEGUNDA, inicio: "09:00", fim: "10:00", empresaId: dela.id, valor: "77.77",
    });

    const detalhe = await montarDetalheDaEmpresa({ de: SEGUNDA, ate: SEGUNDA }, dela.id);
    const texto = JSON.stringify(detalhe);

    expect(detalhe?.faturamentoCentavos).toBe(7777);
    expect(texto).not.toContain("77.77");
    expect(texto).not.toContain('"valor"');
  });
});

describe("a fronteira do dinheiro continua de pé", () => {
  it("o relatório GERAL não leva dinheiro nenhum, nem com empresa na jogada", async () => {
    const dela = await empresa();

    await reserva({
      dia: SEGUNDA, inicio: "09:00", fim: "10:00", empresaId: dela.id, valor: "123.45",
    });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });
    const texto = JSON.stringify(relatorio);

    expect(texto).not.toContain("123.45");
    expect(texto).not.toContain("12345");
    expect(texto).not.toContain('"valor"');
    expect(texto).not.toContain("faturamento");
    // E a empresa esta la, com horas — so sem dinheiro.
    expect(relatorio.horasPorEmpresa.find((item) => item.id === dela.id)?.horas).toBe(1);
  });
});

describe("editar o nome NÃO cria um cliente novo", () => {
  it("dois nomes no mesmo telefone continuam sendo um cliente só", async () => {
    // O dono desconfiou disso ao ver o painel: dois nomes no mesmo numero
    // parecem dois clientes. Nao sao — o agrupamento sempre foi pelo telefone,
    // e o que troca e so o rotulo, que mostra o nome da reserva mais recente.
    await reserva({ dia: SEGUNDA, inicio: "09:00", fim: "10:00", nome: "Toca" });
    await reserva({
      dia: SEGUNDA, inicio: "14:00", fim: "15:00", nome: "Toca Imóveis",
      salaId: salaContainer,
    });

    const relatorio = await montarRelatorio({ de: SEGUNDA, ate: SEGUNDA });
    const doTelefone = relatorio.horasPorCliente.filter(
      (cliente) => cliente.telefone === TELEFONE,
    );

    expect(doTelefone).toHaveLength(1);
    expect(doTelefone[0]?.horas).toBe(2);
    expect(doTelefone[0]?.reservas).toBe(2);
    // O nome mostrado e o da reserva mais recente.
    expect(doTelefone[0]?.nome).toBe("Toca Imóveis");
  });
});
