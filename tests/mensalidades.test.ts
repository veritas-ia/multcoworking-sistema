/**
 * ESPAÇOS MENSAIS E MENSALIDADES — Fase 16, Parte C (17/11/2026).
 *
 * O QUE ESTA PARTE TRAZ: as salas privativas alugadas por MÊS, de onde vem a
 * maior parte do dinheiro do coworking e que o sistema nunca viu — ele cuidava
 * das 3 salas alugadas por HORA.
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 *  1. **GERAR DUAS VEZES NÃO COBRA EM DOBRO.** É o mais importante daqui: sem
 *     a trava, dois cliques em "gerar dezembro" dobrariam a receita do mês e
 *     cada linha continuaria parecendo certa — o erro só apareceria no extrato
 *     do cliente.
 *  2. **A COBRANÇA NASCE PENDENTE**, nunca paga. O sistema não tem como saber
 *     que o Pix caiu; quem sabe é quem olhou a conta.
 *  3. **REAJUSTAR NÃO RETROAGE.** O valor viaja para a cobrança e congela lá.
 *     Se retroagisse, o faturamento de um mês fechado mudaria sozinho.
 *  4. **O MESMO ESPAÇO NÃO TEM DOIS CONTRATOS AO MESMO TEMPO.** Dois
 *     mensalistas na mesma sala é problema físico, e ninguém descobriria pelo
 *     sistema: as duas cobranças sairiam certas, todo mês.
 *  5. **O DIA 31 EM FEVEREIRO** cai no último dia do mês — não no 1º de março,
 *     que mudaria a competência.
 *
 * TODA DATA AQUI É FIXA e o "hoje" entra como parâmetro: teste que dependa do
 * relógio passa num dia e falha no outro.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cobrancasDoContrato,
  criarContrato,
  criarEspaco,
  desvincular,
  editarContrato,
  editarEspaco,
  gerarMensalidades,
  listarContratos,
  listarEspacos,
  listarLancamentos,
  reordenarEspacos,
  resumir,
  vencimentoDaCompetencia,
} from "@/lib/financeiro";

import { aquecerConexao, bancoDeTeste, idDoCliente } from "./apoio/banco";

const ZZ = "ZZ Mensal";
const USUARIO = "zz.mensal";
const TELEFONE = "+5511900009300";

/**
 * Um "hoje" FIXO: 17/11/2026. Nenhum teste aqui olha o relógio de verdade —
 * teste de atraso que dependa do relógio passa num dia e falha no outro.
 */
const AGORA = new Date("2026-11-17T15:00:00.000Z");

let operador: { id: string; nome: string };
let clienteId: string;
let empresaId: string;

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  await bancoDeTeste.acaoRegistrada.deleteMany({
    where: { OR: [{ usuario: { usuario: USUARIO } }, { usuarioNome: ZZ }] },
  });
  // Todos os lançamentos saem: a tabela nasce vazia no banco de teste, e um
  // que escapasse travaria por RESTRICT a remoção do contrato e do cliente —
  // a limpeza pararia no meio e o número de vermelhos mudaria a cada execução.
  await bancoDeTeste.lancamento.deleteMany({});
  await bancoDeTeste.contratoMensal.deleteMany({});
  await bancoDeTeste.espaco.deleteMany({ where: { nome: { startsWith: ZZ } } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.cliente.deleteMany({
    where: {
      reservas: { none: {} },
      telefones: { none: {} },
      consumosEmporio: { none: {} },
      demonstrativos: { none: {} },
      lancamentos: { none: {} },
      contratos: { none: {} },
    },
  });
  await bancoDeTeste.empresa.deleteMany({ where: { nome: { startsWith: ZZ } } });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  await bancoDeTeste.categoriaFinanceira.updateMany({ data: { ativa: true } });
}

beforeEach(async () => {
  await limpar();

  const usuario = await bancoDeTeste.usuario.create({
    data: { usuario: USUARIO, nome: ZZ, senhaHash: "x" },
  });
  operador = { id: usuario.id, nome: usuario.nome };
  clienteId = await idDoCliente(TELEFONE, `${ZZ} Cliente`);

  const empresa = await bancoDeTeste.empresa.create({
    data: { nome: `${ZZ} Toca` },
  });
  empresaId = empresa.id;
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

async function espaco(nome: string): Promise<string> {
  const feito = await criarEspaco({ nome: `${ZZ} ${nome}` });
  if (!feito.ok) throw new Error(feito.falha.motivo);
  return feito.dados.id;
}

// -----------------------------------------------------------------------------

describe("os espaços mensais são separados das salas da agenda", () => {
  /**
   * O TESTE QUE PROTEGE A AGENDA.
   *
   * "salas" é a tabela da AGENDA: uma linha ali aparece no site público para
   * qualquer um reservar, entra na grade de disponibilidade e nas travas de
   * sobreposição. Se os espaços mensais entrassem lá, um cliente poderia
   * reservar por hora a sala que outro aluga por mês.
   */
  it("criar espaço NÃO cria sala, e as três salas continuam as mesmas", async () => {
    const antes = await bancoDeTeste.sala.findMany({ select: { id: true } });

    await espaco("Privativa 7");

    const depois = await bancoDeTeste.sala.findMany({ select: { id: true } });

    expect(depois).toEqual(antes);
  });

  it("nasce livre, e fica ocupado quando há contrato vigente", async () => {
    const espacoId = await espaco("Privativa 7");

    const antes = await listarEspacos({ agora: AGORA });
    expect(antes.find((um) => um.id === espacoId)?.ocupado).toBe(false);

    await criarContrato(
      {
        clienteId,
        espacoId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-11-01",
      },
      AGORA,
    );

    const depois = await listarEspacos({ agora: AGORA });
    expect(depois.find((um) => um.id === espacoId)?.ocupado).toBe(true);
  });

  /**
   * CONTRATO QUE TERMINOU NÃO OCUPA MAIS.
   *
   * Mostrar como ocupado um espaço cujo contrato acabou em março faria a
   * equipe deixar de alugá-lo — e ninguém desconfiaria do número.
   */
  it("contrato encerrado deixa o espaço livre", async () => {
    const espacoId = await espaco("Privativa 7");

    await criarContrato(
      {
        clienteId,
        espacoId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-01-01",
        fim: "2026-03-31",
      },
      AGORA,
    );

    const lista = await listarEspacos({ agora: AGORA });
    expect(lista.find((um) => um.id === espacoId)?.ocupado).toBe(false);
  });

  it("espaço com contrato vigente não se desliga", async () => {
    const espacoId = await espaco("Privativa 7");

    await criarContrato(
      {
        clienteId,
        espacoId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-11-01",
      },
      AGORA,
    );

    const feito = await editarEspaco(espacoId, { ativo: false }, AGORA);

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("ESPACO_OCUPADO");

    // E continua ligado depois da recusa — não é só a mensagem.
    const lista = await listarEspacos({ agora: AGORA });
    expect(lista.find((um) => um.id === espacoId)?.ativo).toBe(true);
  });

  it("reordenar grava a lista inteira, sem duas posições iguais", async () => {
    const primeiro = await espaco("Privativa 1");
    const segundo = await espaco("Privativa 2");

    const feito = await reordenarEspacos([segundo, primeiro]);
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const lista = (await listarEspacos({ agora: AGORA })).filter((um) =>
      um.nome.startsWith(ZZ),
    );

    expect(lista.map((um) => um.id)).toEqual([segundo, primeiro]);
    expect(new Set(lista.map((um) => um.ordem)).size).toBe(2);
  });
});

describe("o contrato tem UM pagador, e exatamente um", () => {
  /**
   * NENHUM pagador deixaria a cobrança sem dono — ela nasceria no caixa sem
   * dizer de quem é, e o relatório por cliente não a veria. OS DOIS deixariam
   * a tela sem saber para quem emitir.
   */
  it("sem pagador e com os dois são recusados", async () => {
    const semNinguem = await criarContrato(
      { valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-11-01" },
      AGORA,
    );

    expect(semNinguem.ok).toBe(false);
    if (semNinguem.ok) throw new Error("deveria recusar");
    expect(semNinguem.falha.codigo).toBe("PAGADOR_INVALIDO");

    const osDois = await criarContrato(
      {
        clienteId,
        empresaId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-11-01",
      },
      AGORA,
    );

    expect(osDois.ok).toBe(false);
    if (osDois.ok) throw new Error("deveria recusar");
    expect(osDois.falha.codigo).toBe("PAGADOR_INVALIDO");
  });

  it("o banco também recusa os dois pagadores", async () => {
    await expect(
      bancoDeTeste.contratoMensal.create({
        data: {
          clienteId,
          empresaId,
          valorMensal: "2400.00",
          diaVencimento: 10,
          inicio: new Date("2026-11-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("empresa desligada é recusada", async () => {
    await bancoDeTeste.empresa.update({
      where: { id: empresaId },
      data: { ativa: false },
    });

    const feito = await criarContrato(
      { empresaId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-11-01" },
      AGORA,
    );

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("EMPRESA_DESLIGADA");
  });

  /**
   * COTA ZERO É RECUSADA, e não tratada como "sem cota".
   *
   * Quem não tem horas inclusas deixa o campo em BRANCO. Um zero gravado diria
   * "tem plano com zero hora" — e a tela leria como "tem plano" e mostraria
   * "0 de 0 usadas".
   */
  it("cota de horas zero ou negativa é recusada; em branco é aceita", async () => {
    for (const cotaHoras of [0, -5]) {
      const feito = await criarContrato(
        {
          clienteId,
          valorMensal: "2400,00",
          diaVencimento: 10,
          cotaHoras,
          inicio: "2026-11-01",
        },
        AGORA,
      );

      expect(feito.ok).toBe(false);
      if (feito.ok) throw new Error(`deveria recusar ${cotaHoras}`);
      expect(feito.falha.codigo).toBe("COTA_INVALIDA");
    }

    const semCota = await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-11-01" },
      AGORA,
    );

    if (!semCota.ok) throw new Error(semCota.falha.motivo);
    expect(semCota.dados.cotaHoras).toBeNull();
  });

  it("dia de vencimento fora de 1 a 31 é recusado", async () => {
    for (const diaVencimento of [0, 32, 1.5]) {
      const feito = await criarContrato(
        { clienteId, valorMensal: "2400,00", diaVencimento, inicio: "2026-11-01" },
        AGORA,
      );

      expect(feito.ok).toBe(false);
      if (feito.ok) throw new Error(`deveria recusar ${diaVencimento}`);
      expect(feito.falha.codigo).toBe("DIA_INVALIDO");
    }
  });

  it("fim antes do início é recusado", async () => {
    const feito = await criarContrato(
      {
        clienteId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-11-01",
        fim: "2026-10-01",
      },
      AGORA,
    );

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("FIM_INVALIDO");
  });
});

describe("o mesmo espaço não tem dois contratos ao mesmo tempo", () => {
  /**
   * DOIS MENSALISTAS NA MESMA SALA é problema físico, não de cadastro — e
   * ninguém descobriria pelo sistema: as duas cobranças sairiam certas, todo
   * mês, e o conflito apareceria na porta da sala.
   */
  it("o segundo contrato no mesmo período é recusado, e diz de quem é o espaço", async () => {
    const espacoId = await espaco("Privativa 7");

    await criarContrato(
      {
        clienteId,
        espacoId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-11-01",
      },
      AGORA,
    );

    const segundo = await criarContrato(
      {
        empresaId,
        espacoId,
        valorMensal: "2600,00",
        diaVencimento: 5,
        inicio: "2026-12-01",
      },
      AGORA,
    );

    expect(segundo.ok).toBe(false);
    if (segundo.ok) throw new Error("deveria recusar");
    expect(segundo.falha.codigo).toBe("ESPACO_OCUPADO");
    // A mensagem diz QUEM está lá: sem isso a equipe não sabe o que fazer.
    expect(segundo.falha.motivo).toContain(`${ZZ} Cliente`);
  });

  /**
   * MAS PERÍODOS QUE NÃO SE CRUZAM PASSAM.
   *
   * Um contrato que terminou em março não atrapalha outro que começa em abril
   * — e recusar faria a equipe não conseguir alugar a sala vazia.
   */
  it("contrato que começa depois do outro terminar é aceito", async () => {
    const espacoId = await espaco("Privativa 7");

    await criarContrato(
      {
        clienteId,
        espacoId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-01-01",
        fim: "2026-03-31",
      },
      AGORA,
    );

    const segundo = await criarContrato(
      {
        empresaId,
        espacoId,
        valorMensal: "2600,00",
        diaVencimento: 5,
        inicio: "2026-04-01",
      },
      AGORA,
    );

    expect(segundo.ok).toBe(true);
  });

  it("editar o próprio contrato não acusa conflito com ele mesmo", async () => {
    const espacoId = await espaco("Privativa 7");

    const criado = await criarContrato(
      {
        clienteId,
        espacoId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-11-01",
      },
      AGORA,
    );
    if (!criado.ok) throw new Error("deveria criar");

    const salvo = await editarContrato(
      criado.dados.id,
      { valorMensal: "2500,00" },
      AGORA,
    );

    if (!salvo.ok) throw new Error(salvo.falha.motivo);
    expect(salvo.dados.valorMensal).toBe("2500.00");
  });
});

describe("gerar a mensalidade do mês", () => {
  it("nasce PENDENTE, com o valor e o vencimento do contrato", async () => {
    const espacoId = await espaco("Privativa 7");

    await criarContrato(
      {
        clienteId,
        espacoId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-11-01",
      },
      AGORA,
    );

    const feito = await gerarMensalidades({
      competencia: "2026-12",
      operador,
      agora: AGORA,
    });

    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.criadas).toBe(1);
    expect(feito.dados.totalCentavos).toBe(240_000);

    const lista = await listarLancamentos({
      de: "2026-12-01",
      ate: "2026-12-31",
      agora: AGORA,
    });

    expect(lista).toHaveLength(1);
    expect(lista[0]?.valor).toBe("2400.00");
    expect(lista[0]?.vencimento).toBe("2026-12-10");
    expect(lista[0]?.tipo).toBe("ENTRADA");
    expect(lista[0]?.origem).toBe("MENSALIDADE");
    // NASCE PENDENTE: o sistema não tem como saber que o Pix caiu.
    expect(lista[0]?.situacao).toBe("PENDENTE");
    expect(lista[0]?.pagoEm).toBeNull();
    // A descrição se explica sozinha na lista do caixa.
    expect(lista[0]?.descricao).toContain("dezembro");
    expect(lista[0]?.descricao).toContain("Privativa 7");
  });

  /**
   * O TESTE MAIS IMPORTANTE DESTE ARQUIVO.
   *
   * Sem a trava, dois cliques em "gerar dezembro" dobrariam a receita do mês e
   * CADA LINHA CONTINUARIA PARECENDO CERTA — o erro só apareceria no extrato
   * do cliente, meses depois.
   */
  it("gerar duas vezes NÃO cobra em dobro", async () => {
    await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-11-01" },
      AGORA,
    );

    const primeira = await gerarMensalidades({ competencia: "2026-12", operador });
    const segunda = await gerarMensalidades({ competencia: "2026-12", operador });

    if (!primeira.ok || !segunda.ok) throw new Error("deveria aceitar as duas");

    expect(primeira.dados.criadas).toBe(1);
    expect(segunda.dados.criadas).toBe(0);
    expect(segunda.dados.jaExistiam).toBe(1);

    const lista = await listarLancamentos({
      de: "2026-12-01",
      ate: "2026-12-31",
      agora: AGORA,
    });

    expect(lista).toHaveLength(1);
    expect(resumir(lista).aReceberCentavos).toBe(240_000);
  });

  it("o banco também recusa a segunda cobrança do mesmo mês", async () => {
    const criado = await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-11-01" },
      AGORA,
    );
    if (!criado.ok) throw new Error("deveria criar");

    await gerarMensalidades({ competencia: "2026-12", operador });

    const categoria = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow({
      where: { slug: "mensalidades" },
      select: { id: true },
    });

    await expect(
      bancoDeTeste.lancamento.create({
        data: {
          descricao: "ZZ pela porta dos fundos",
          valor: "2400.00",
          categoriaId: categoria.id,
          clienteId,
          vencimento: new Date("2026-12-10T00:00:00.000Z"),
          contratoId: criado.dados.id,
          competencia: "2026-12",
        },
      }),
    ).rejects.toThrow();
  });

  /**
   * REAJUSTAR NÃO RETROAGE.
   *
   * O valor viaja para a cobrança e congela lá — mesma regra do valor da
   * reserva e do preço do empório. Se retroagisse, o faturamento de um mês
   * fechado mudaria sozinho quando a equipe reajustasse a mensalidade.
   */
  it("aumentar a mensalidade não muda as cobranças já geradas", async () => {
    const criado = await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-11-01" },
      AGORA,
    );
    if (!criado.ok) throw new Error("deveria criar");

    await gerarMensalidades({ competencia: "2026-11", operador });

    const antes = await bancoDeTeste.lancamento.findFirstOrThrow({
      where: { contratoId: criado.dados.id, competencia: "2026-11" },
    });

    await editarContrato(criado.dados.id, { valorMensal: "2900,00" }, AGORA);

    const depois = await bancoDeTeste.lancamento.findFirstOrThrow({
      where: { contratoId: criado.dados.id, competencia: "2026-11" },
    });

    // A LINHA INTEIRA fica intacta: reajustar não é gancho para mexer em
    // cobrança nenhuma.
    expect(depois).toEqual(antes);

    // E o mês seguinte sai pelo valor novo.
    await gerarMensalidades({ competencia: "2026-12", operador });

    const dezembro = await bancoDeTeste.lancamento.findFirstOrThrow({
      where: { contratoId: criado.dados.id, competencia: "2026-12" },
    });

    expect(dezembro.valor.toFixed(2)).toBe("2900.00");
  });

  /**
   * O CONTRATO PRECISA ESTAR VIGENTE **DENTRO DAQUELE MÊS**, e não hoje.
   *
   * É isto que permite gerar um mês passado esquecido, e o que impede gerar
   * dezembro para um contrato que terminou em março. Comparar com "hoje" faria
   * as duas coisas erradas ao mesmo tempo.
   */
  it("contrato encerrado antes do mês é pulado, com o motivo", async () => {
    await criarContrato(
      {
        clienteId,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-01-01",
        fim: "2026-03-31",
      },
      AGORA,
    );

    const feito = await gerarMensalidades({ competencia: "2026-12", operador });
    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.criadas).toBe(0);
    expect(feito.dados.pulados).toHaveLength(1);
    expect(feito.dados.pulados[0]?.motivo).toContain("terminou");
  });

  it("contrato que começa depois do mês é pulado, com o motivo", async () => {
    await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2027-03-01" },
      AGORA,
    );

    const feito = await gerarMensalidades({ competencia: "2026-12", operador });
    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.criadas).toBe(0);
    expect(feito.dados.pulados[0]?.motivo).toContain("começa");
  });

  it("gerar um mês PASSADO esquecido funciona", async () => {
    await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-01-01" },
      AGORA,
    );

    const feito = await gerarMensalidades({ competencia: "2026-02", operador });
    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.criadas).toBe(1);
  });

  it("contrato desligado não gera cobrança", async () => {
    const criado = await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-11-01" },
      AGORA,
    );
    if (!criado.ok) throw new Error("deveria criar");

    await editarContrato(criado.dados.id, { ativo: false }, AGORA);

    const feito = await gerarMensalidades({ competencia: "2026-12", operador });
    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.criadas).toBe(0);
    // Nem entra no relatório de pulados: ele está desligado, não é um caso a
    // explicar — a equipe desligou de propósito.
    expect(feito.dados.pulados).toHaveLength(0);
  });

  it("mês escrito errado é recusado", async () => {
    for (const competencia of ["2026-13", "2026", "dezembro", "2026-00"]) {
      const feito = await gerarMensalidades({ competencia, operador });

      expect(feito.ok).toBe(false);
      if (feito.ok) throw new Error(`deveria recusar ${competencia}`);
      expect(feito.falha.codigo).toBe("COMPETENCIA_INVALIDA");
    }
  });
});

describe("o dia 31 em fevereiro", () => {
  /**
   * O contrato que vence dia 31 não tem onde cair em fevereiro.
   *
   * Cai no ÚLTIMO dia do mês — e não no 1º de março, que mudaria a
   * competência da cobrança, nem no dia 28 fixo, que atrasaria o vencimento
   * nos meses de 30 e 31 dias.
   */
  it("a conta do vencimento, isolada", () => {
    expect(vencimentoDaCompetencia("2026-12", 10)).toBe("2026-12-10");
    expect(vencimentoDaCompetencia("2026-12", 31)).toBe("2026-12-31");
    // Fevereiro de 2026 tem 28 dias.
    expect(vencimentoDaCompetencia("2026-02", 31)).toBe("2026-02-28");
    expect(vencimentoDaCompetencia("2026-02", 30)).toBe("2026-02-28");
    // 2028 é bissexto: 29 dias.
    expect(vencimentoDaCompetencia("2028-02", 31)).toBe("2028-02-29");
    // Abril tem 30.
    expect(vencimentoDaCompetencia("2026-04", 31)).toBe("2026-04-30");
  });

  it("a cobrança de fevereiro de quem vence dia 31 fica em 28/02", async () => {
    await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 31, inicio: "2026-01-01" },
      AGORA,
    );

    await gerarMensalidades({ competencia: "2026-02", operador });

    const lista = await listarLancamentos({
      de: "2026-02-01",
      ate: "2026-02-28",
      agora: AGORA,
    });

    expect(lista).toHaveLength(1);
    expect(lista[0]?.vencimento).toBe("2026-02-28");
  });
});

describe("a inadimplência e o extrato do mensalista", () => {
  /**
   * "ATRASADO" É CALCULADO, não gravado — e aqui ele vale para a mensalidade
   * igual a qualquer conta: pendente cujo vencimento já passou.
   */
  it("a mensalidade vencida e não paga aparece como atrasada", async () => {
    await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-01-01" },
      AGORA,
    );

    // Novembro vence dia 10, e "hoje" no teste é 17/11.
    await gerarMensalidades({ competencia: "2026-11", operador });

    const atrasadas = await listarLancamentos({
      de: "2026-11-01",
      ate: "2026-11-30",
      situacao: "ATRASADO",
      agora: AGORA,
    });

    expect(atrasadas).toHaveLength(1);
    expect(atrasadas[0]?.diasDeAtraso).toBe(7);
    expect(resumir(atrasadas).atrasadoAReceberCentavos).toBe(240_000);
  });

  it("o extrato do contrato traz as cobranças, da mais recente para a mais antiga", async () => {
    const criado = await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-01-01" },
      AGORA,
    );
    if (!criado.ok) throw new Error("deveria criar");

    for (const competencia of ["2026-10", "2026-11", "2026-12"]) {
      await gerarMensalidades({ competencia, operador });
    }

    const extrato = await cobrancasDoContrato(criado.dados.id, AGORA);

    expect(extrato).toHaveLength(3);
    expect(extrato[0]?.vencimento).toBe("2026-12-10");
    expect(extrato[2]?.vencimento).toBe("2026-10-10");
  });

  /**
   * DESVINCULAR UM MÊS é a renegociação de uma cobrança específica.
   *
   * Solta, ela vira manual e editável, e o contrato segue intacto para os
   * meses seguintes. E o mês volta a poder ser gerado, porque a trava só olha
   * as linhas ainda ligadas ao contrato.
   */
  it("desvincular a mensalidade solta o mês, e o contrato segue intacto", async () => {
    const criado = await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-01-01" },
      AGORA,
    );
    if (!criado.ok) throw new Error("deveria criar");

    await gerarMensalidades({ competencia: "2026-12", operador });

    const cobranca = (await cobrancasDoContrato(criado.dados.id, AGORA))[0]!;
    const solta = await desvincular(cobranca.id, AGORA);

    if (!solta.ok) throw new Error(solta.falha.motivo);

    expect(solta.dados.origem).toBe("MANUAL");

    // O contrato não tem mais cobrança ligada naquele mês...
    expect(await cobrancasDoContrato(criado.dados.id, AGORA)).toHaveLength(0);

    // ...mas a linha do dinheiro continua no caixa.
    const lista = await listarLancamentos({
      de: "2026-12-01",
      ate: "2026-12-31",
      agora: AGORA,
    });
    expect(lista).toHaveLength(1);
    expect(lista[0]?.valor).toBe("2400.00");
  });

  /**
   * O CONTRATO APAGADO NÃO LEVA O DINHEIRO JUNTO.
   *
   * A chave é ON DELETE SET NULL. Levando a cobrança, o dinheiro recebido
   * desapareceria do caixa e o mês fechado mudaria sozinho.
   */
  it("apagar o contrato deixa as cobranças de pé, como manuais", async () => {
    const criado = await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-01-01" },
      AGORA,
    );
    if (!criado.ok) throw new Error("deveria criar");

    await gerarMensalidades({ competencia: "2026-12", operador });
    await bancoDeTeste.contratoMensal.delete({ where: { id: criado.dados.id } });

    const lista = await listarLancamentos({
      de: "2026-12-01",
      ate: "2026-12-31",
      agora: AGORA,
    });

    expect(lista).toHaveLength(1);
    expect(lista[0]?.valor).toBe("2400.00");
    expect(lista[0]?.origem).toBe("MANUAL");
  });
});

describe("vários contratos de uma vez", () => {
  it("gera para todos os vigentes e soma o total", async () => {
    const umEspaco = await espaco("Privativa 1");
    const outroEspaco = await espaco("Privativa 2");

    await criarContrato(
      {
        clienteId,
        espacoId: umEspaco,
        valorMensal: "2400,00",
        diaVencimento: 10,
        inicio: "2026-01-01",
      },
      AGORA,
    );

    await criarContrato(
      {
        empresaId,
        espacoId: outroEspaco,
        valorMensal: "3600,00",
        diaVencimento: 5,
        inicio: "2026-01-01",
      },
      AGORA,
    );

    const feito = await gerarMensalidades({ competencia: "2026-12", operador });
    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.criadas).toBe(2);
    expect(feito.dados.totalCentavos).toBe(600_000);

    const lista = await listarLancamentos({
      de: "2026-12-01",
      ate: "2026-12-31",
      agora: AGORA,
    });

    // Cada um no vencimento dele.
    expect(lista.map((linha) => linha.vencimento)).toEqual([
      "2026-12-05",
      "2026-12-10",
    ]);
  });

  it("os contratos vigentes aparecem marcados como tal", async () => {
    await criarContrato(
      { clienteId, valorMensal: "2400,00", diaVencimento: 10, inicio: "2026-01-01" },
      AGORA,
    );

    await criarContrato(
      {
        empresaId,
        valorMensal: "3600,00",
        diaVencimento: 5,
        inicio: "2026-01-01",
        fim: "2026-03-31",
      },
      AGORA,
    );

    const todos = await listarContratos({ agora: AGORA });
    const vigentes = await listarContratos({ somenteVigentes: true, agora: AGORA });

    expect(todos).toHaveLength(2);
    expect(vigentes).toHaveLength(1);
    expect(vigentes[0]?.cliente?.nome).toBe(`${ZZ} Cliente`);
  });
});
