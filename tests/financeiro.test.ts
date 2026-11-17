/**
 * O FINANCEIRO — Fase 16, Parte A (17/11/2026).
 *
 * O QUE ESTES TESTES PROTEGEM, e por que cada coisa precisa de teste
 *
 *  1. O SINAL NUNCA ESTÁ NO VALOR. O valor é sempre positivo e o lado vem da
 *     categoria. Um valor negativo aceito viraria "entrada de -200"
 *     subtraindo do caixa, e a linha continuaria parecendo certa na lista.
 *
 *  2. "ATRASADO" É CALCULADO, não gravado. Não existe coluna de situação: ela
 *     sai do vencimento e da data de pagamento. Se um dia alguém acrescentar
 *     a coluna, estes testes é que vão estourar.
 *
 *  3. A SOMA É EM CENTAVOS. Três contas de R$ 33,33 precisam dar R$ 99,99 —
 *     em ponto flutuante dariam R$ 99,990000000000009.
 *
 *  4. EXCLUIR DEIXA EVIDÊNCIA, na mesma transação. Sem isso ninguém explicaria
 *     por que o caixa de um mês fechado mudou.
 *
 * TODA DATA AQUI É FIXA E O "hoje" ENTRA COMO PARÂMETRO. Teste de atraso que
 * dependa do relógio passa num dia e falha no outro — defeito que este projeto
 * já teve duas vezes, uma delas hoje mesmo, nos testes do empório.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listarAcoes, TipoDeAcao } from "@/lib/acoes";
import {
  criarCategoria,
  criarFornecedor,
  editarCategoria,
  editarFornecedor,
  editarLancamento,
  excluirLancamento,
  lancar,
  listarCategorias,
  listarFornecedores,
  listarLancamentos,
  marcarPagamento,
  reordenarCategorias,
  resumir,
  situacaoDe,
  TipoDeLancamento,
} from "@/lib/financeiro";

import { aquecerConexao, bancoDeTeste, idDoCliente } from "./apoio/banco";

const USUARIO = "zz.financeiro";
const NOME = "ZZ Financeiro";
const TELEFONE = "+5511900009100";
const FORNECEDOR = "ZZ Energia do Bairro";

/** Um "hoje" FIXO. Nenhum teste aqui olha o relógio de verdade. */
const HOJE = "2026-11-17";
const AGORA = new Date("2026-11-17T15:00:00.000Z");

let operador: { id: string; nome: string };
let clienteId: string;

beforeAll(async () => {
  await aquecerConexao();
});

async function limpar(): Promise<void> {
  /*
   * A LIMPEZA PROCURA PELO NOME GRAVADO, e não só pelo usuário ligado.
   *
   * Um dos testes aqui APAGA o usuário de propósito, para provar que o nome
   * sobrevive na evidência (a chave é SET NULL). Feito isso, a linha de ação
   * fica órfã: procurando só pela relação, a limpeza não a encontra, ela
   * atravessa para o teste seguinte e a contagem de ações dá um número a mais
   * — uma falha que não tem nada a ver com a regra sendo testada.
   */
  await bancoDeTeste.acaoRegistrada.deleteMany({
    where: {
      OR: [{ usuario: { usuario: USUARIO } }, { usuarioNome: NOME }],
    },
  });
  /*
   * TODOS OS LANÇAMENTOS SAEM, e não só os que começam com "ZZ ".
   *
   * POR QUE ISTO É O CERTO AQUI: `lancamentos` NÃO entra em
   * `preparar-banco-de-teste.sh`, então o banco de teste nasce com a tabela
   * vazia — não existe lançamento de produção para preservar.
   *
   * E POR QUE A VERSÃO ANTERIOR ESTAVA ERRADA: ela filtrava por nome, e
   * qualquer lançamento que escapasse do filtro travava, por RESTRICT, a
   * remoção da categoria, do fornecedor e do cliente logo abaixo. A limpeza
   * parava no meio e o resto dela não rodava — o usuário ficava para trás, o
   * `create` do beforeEach seguinte estourava por nome repetido, e o número de
   * testes vermelhos MUDAVA A CADA EXECUÇÃO. É o mesmo defeito que este
   * projeto já teve duas vezes (consumos_emporio e demonstrativos), e nenhuma
   * das mensagens aponta para a causa.
   */
  await bancoDeTeste.lancamento.deleteMany({});
  await bancoDeTeste.fornecedor.deleteMany({
    where: { nome: { startsWith: "ZZ " } },
  });
  await bancoDeTeste.categoriaFinanceira.deleteMany({
    where: { nome: { startsWith: "ZZ " } },
  });

  /*
   * TODA CATEGORIA VOLTA LIGADA.
   *
   * O teste da "última categoria ativa" precisa DESLIGAR as outras do mesmo
   * lado para chegar na fronteira — e elas são as categorias que a migração
   * criou, compartilhadas por todos os testes do arquivo. Religar no fim do
   * próprio teste não basta: se ele falhar antes disso, as categorias ficam
   * desligadas e os testes seguintes passam a levar "categoria desligada",
   * numa falha que não tem nada a ver com a regra deles.
   *
   * Religar aqui faz disso uma INVARIANTE: todo teste começa com tudo ligado,
   * aconteça o que acontecer no anterior.
   */
  await bancoDeTeste.categoriaFinanceira.updateMany({ data: { ativa: true } });
  await bancoDeTeste.telefoneDoCliente.deleteMany({
    where: { telefone: TELEFONE },
  });
  await bancoDeTeste.cliente.deleteMany({
    where: {
      reservas: { none: {} },
      telefones: { none: {} },
      consumosEmporio: { none: {} },
      demonstrativos: { none: {} },
      lancamentos: { none: {} },
    },
  });
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
}

beforeEach(async () => {
  await limpar();

  const usuario = await bancoDeTeste.usuario.create({
    data: { usuario: USUARIO, nome: NOME, senhaHash: "x" },
  });
  operador = { id: usuario.id, nome: usuario.nome };
  clienteId = await idDoCliente(TELEFONE, "ZZ Cliente do Caixa");
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** A categoria de saída que a migração criou. */
async function categoriaDeSaida(slug = "energia"): Promise<string> {
  const categoria = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });

  return categoria.id;
}

async function categoriaDeEntrada(slug = "mensalidades"): Promise<string> {
  const categoria = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow({
    where: { slug },
    select: { id: true },
  });

  return categoria.id;
}

// -----------------------------------------------------------------------------

describe("as categorias vêm pela migração, não pelo seed", () => {
  /**
   * O deploy roda `migrate deploy` e NAO roda o seed. Categoria só no seed
   * deixaria a tela de lançamento sem opção nenhuma em produção, e o primeiro
   * lançamento seria impossível.
   */
  it("as 14 saídas e as 4 entradas já existem", async () => {
    const saidas = await listarCategorias({ tipo: TipoDeLancamento.SAIDA });
    const entradas = await listarCategorias({ tipo: TipoDeLancamento.ENTRADA });

    expect(saidas.length).toBeGreaterThanOrEqual(14);
    expect(entradas.length).toBeGreaterThanOrEqual(4);

    // As que o dono listou, pelo nome interno — que nunca muda.
    const slugs = saidas.map((categoria) => categoria.slug);
    expect(slugs).toContain("aluguel");
    expect(slugs).toContain("funcionarios");
    expect(slugs).toContain("taxas-cartao");

    expect(entradas.map((categoria) => categoria.slug)).toContain("mensalidades");
  });

  it("criar categoria nasce no fim do lado dela, e o slug sai do nome", async () => {
    const feito = await criarCategoria({
      nome: "ZZ Jardinagem",
      tipo: TipoDeLancamento.SAIDA,
    });

    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.slug).toBe("zz-jardinagem");
    expect(feito.dados.tipo).toBe(TipoDeLancamento.SAIDA);

    const saidas = await listarCategorias({ tipo: TipoDeLancamento.SAIDA });
    expect(saidas.at(-1)?.nome).toBe("ZZ Jardinagem");
  });

  it("nome repetido no MESMO lado é recusado", async () => {
    await criarCategoria({ nome: "ZZ Água mineral", tipo: TipoDeLancamento.SAIDA });
    const outra = await criarCategoria({
      nome: "ZZ Água mineral",
      tipo: TipoDeLancamento.SAIDA,
    });

    expect(outra.ok).toBe(false);
    if (outra.ok) throw new Error("deveria recusar");
    expect(outra.falha.codigo).toBe("REPETIDA");
  });

  /**
   * RENOMEAR TROCA O RÓTULO TAMBÉM NOS LANÇAMENTOS ANTIGOS, e isso é o
   * desejado: eles apontam para a categoria e não guardam o texto, então
   * categoria que mudou de nome não vira duas no relatório.
   */
  it("renomear não toca no lançamento, e o rótulo troca nos antigos", async () => {
    const criada = await criarCategoria({
      nome: "ZZ Cafezinho",
      tipo: TipoDeLancamento.SAIDA,
    });
    if (!criada.ok) throw new Error("deveria criar");

    const feito = await lancar(
      {
        descricao: "ZZ pó de café",
        valor: "80,00",
        categoriaId: criada.dados.id,
        vencimento: "2026-11-20",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const antes = await bancoDeTeste.lancamento.findUniqueOrThrow({
      where: { id: feito.dados.id },
    });

    const salva = await editarCategoria(criada.dados.id, { nome: "ZZ Cozinha" });
    if (!salva.ok) throw new Error(salva.falha.motivo);

    const depois = await bancoDeTeste.lancamento.findUniqueOrThrow({
      where: { id: feito.dados.id },
    });

    // A LINHA INTEIRA fica intacta: renomear não é gancho para mexer em
    // lançamento nenhum.
    expect(depois).toEqual(antes);

    // Mas o rótulo que a tela mostra acompanha.
    const lista = await listarLancamentos({
      de: "2026-11-01",
      ate: "2026-11-30",
      agora: AGORA,
    });
    const nossa = lista.find((linha) => linha.id === feito.dados.id);
    expect(nossa?.categoria.nome).toBe("ZZ Cozinha");
  });

  it("o slug NUNCA muda ao renomear", async () => {
    const criada = await criarCategoria({
      nome: "ZZ Seguro",
      tipo: TipoDeLancamento.SAIDA,
    });
    if (!criada.ok) throw new Error("deveria criar");

    await editarCategoria(criada.dados.id, { nome: "ZZ Seguro predial" });

    const depois = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow({
      where: { id: criada.dados.id },
    });

    // É o slug que amarra a categoria ao que já está gravado. Mudando, um
    // relatório antigo deixaria de bater com a lista.
    expect(depois.slug).toBe("zz-seguro");
    expect(depois.nome).toBe("ZZ Seguro predial");
  });

  /**
   * A ÚLTIMA CATEGORIA ATIVA DE UM LADO NÃO SE DESLIGA.
   *
   * Sem nenhuma escolhível, o formulário não fecha e ninguém consegue lançar
   * daquele lado. O erro apareceria como "escolha a categoria" numa lista
   * vazia, e ninguém ligaria uma coisa à outra.
   */
  it("a última categoria ativa de um lado não se desliga", async () => {
    const entradas = await listarCategorias({
      tipo: TipoDeLancamento.ENTRADA,
      somenteAtivas: true,
    });

    // Desliga todas menos uma.
    for (const categoria of entradas.slice(1)) {
      const feito = await editarCategoria(categoria.id, { ativa: false });
      expect(feito.ok).toBe(true);
    }

    const ultima = await editarCategoria(entradas[0]!.id, { ativa: false });

    expect(ultima.ok).toBe(false);
    if (ultima.ok) throw new Error("deveria recusar");
    expect(ultima.falha.codigo).toBe("ULTIMA_ATIVA");

    // E ela continua LIGADA depois da recusa — não é só a mensagem.
    const conferir = await bancoDeTeste.categoriaFinanceira.findUniqueOrThrow({
      where: { id: entradas[0]!.id },
    });
    expect(conferir.ativa).toBe(true);

    // Devolve as outras, para não atrapalhar os testes seguintes.
    for (const categoria of entradas.slice(1)) {
      await editarCategoria(categoria.id, { ativa: true });
    }
  });

  it("reordenar misturando entrada e saída é recusado", async () => {
    const umaEntrada = await categoriaDeEntrada();
    const umaSaida = await categoriaDeSaida();

    const feito = await reordenarCategorias([umaEntrada, umaSaida]);

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("LADOS_MISTURADOS");
  });
});

describe("o valor é sempre positivo, e o lado vem da categoria", () => {
  it("o lado do lançamento é o da categoria, não um campo da tela", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ conta de luz",
        valor: "430,25",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-11-25",
      },
      operador,
      AGORA,
    );

    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.tipo).toBe(TipoDeLancamento.SAIDA);
    expect(feito.dados.valor).toBe("430.25");
  });

  it("valor zero e valor negativo são recusados", async () => {
    const categoriaId = await categoriaDeSaida();

    for (const valor of ["0", "0,00", "-50", "-0,01"]) {
      const feito = await lancar(
        { descricao: "ZZ torto", valor, categoriaId, vencimento: "2026-11-25" },
        operador,
        AGORA,
      );

      expect(feito.ok).toBe(false);
      if (feito.ok) throw new Error(`deveria recusar ${valor}`);
      expect(feito.falha.codigo).toBe("VALOR_INVALIDO");
    }
  });

  /**
   * A TRAVA É DO BANCO, não só da aplicação.
   *
   * Se um dia alguém escrever um caminho novo que grave direto, o Postgres
   * recusa. É o mesmo desenho da sobreposição de reservas.
   */
  it("o banco recusa valor negativo mesmo por fora da aplicação", async () => {
    const categoriaId = await categoriaDeSaida();

    await expect(
      bancoDeTeste.lancamento.create({
        data: {
          descricao: "ZZ pela porta dos fundos",
          valor: "-100.00",
          categoriaId,
          vencimento: new Date("2026-11-25T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("cliente e fornecedor juntos é recusado, e o banco também recusa", async () => {
    const fornecedor = await criarFornecedor({ nome: FORNECEDOR });
    if (!fornecedor.ok) throw new Error("deveria criar");

    const categoriaId = await categoriaDeSaida();

    const feito = await lancar(
      {
        descricao: "ZZ dos dois lados",
        valor: "10,00",
        categoriaId,
        clienteId,
        fornecedorId: fornecedor.dados.id,
        vencimento: "2026-11-25",
      },
      operador,
      AGORA,
    );

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("CLIENTE_E_FORNECEDOR");

    await expect(
      bancoDeTeste.lancamento.create({
        data: {
          descricao: "ZZ pela porta dos fundos",
          valor: "10.00",
          categoriaId,
          clienteId,
          fornecedorId: fornecedor.dados.id,
          vencimento: new Date("2026-11-25T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("categoria desligada recusa lançamento NOVO", async () => {
    const criada = await criarCategoria({
      nome: "ZZ Desligada",
      tipo: TipoDeLancamento.SAIDA,
    });
    if (!criada.ok) throw new Error("deveria criar");

    await editarCategoria(criada.dados.id, { ativa: false });

    const feito = await lancar(
      {
        descricao: "ZZ tentativa",
        valor: "10,00",
        categoriaId: criada.dados.id,
        vencimento: "2026-11-25",
      },
      operador,
      AGORA,
    );

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("CATEGORIA_DESLIGADA");
  });

  /**
   * MAS O LANÇAMENTO ANTIGO DELA CONTINUA EDITÁVEL.
   *
   * Sem esta ressalva, corrigir o valor de uma despesa antiga ficaria
   * impossível depois de a equipe desligar a categoria — e a mensagem falaria
   * de categoria, que não é o que a pessoa está tentando mudar.
   */
  it("lançamento de categoria desligada ainda pode ser corrigido", async () => {
    const criada = await criarCategoria({
      nome: "ZZ Vai desligar",
      tipo: TipoDeLancamento.SAIDA,
    });
    if (!criada.ok) throw new Error("deveria criar");

    const feito = await lancar(
      {
        descricao: "ZZ despesa antiga",
        valor: "100,00",
        categoriaId: criada.dados.id,
        vencimento: "2026-11-20",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    await editarCategoria(criada.dados.id, { ativa: false });

    const corrigido = await editarLancamento(
      feito.dados.id,
      { valor: "120,00" },
      AGORA,
    );

    if (!corrigido.ok) throw new Error(corrigido.falha.motivo);
    expect(corrigido.dados.valor).toBe("120.00");
  });
});

describe("pendente, pago e atrasado saem de DUAS datas", () => {
  /**
   * NÃO EXISTE COLUNA DE SITUAÇÃO. Este teste é a vigia disso: se alguém
   * acrescentar a coluna e passar a gravá-la, estes casos continuam
   * funcionando só enquanto as duas coisas concordarem — e a primeira
   * divergência aparece aqui.
   */
  it("a conta da situação, isolada", () => {
    expect(
      situacaoDe({ vencimento: "2026-11-20", pagoEm: null }, HOJE).situacao,
    ).toBe("PENDENTE");

    expect(
      situacaoDe({ vencimento: "2026-11-10", pagoEm: null }, HOJE).situacao,
    ).toBe("ATRASADO");

    // Pago é pago, mesmo com o vencimento no passado.
    expect(
      situacaoDe({ vencimento: "2026-11-10", pagoEm: "2026-11-12" }, HOJE).situacao,
    ).toBe("PAGO");

    // VENCE HOJE AINDA NÃO ESTÁ ATRASADO. A conta é "vencimento < hoje", e
    // não "<=": quem vence hoje tem o dia todo para pagar.
    expect(
      situacaoDe({ vencimento: HOJE, pagoEm: null }, HOJE).situacao,
    ).toBe("PENDENTE");
  });

  it("os dias de atraso são contados, e zeram quando não há atraso", () => {
    expect(
      situacaoDe({ vencimento: "2026-11-10", pagoEm: null }, HOJE).diasDeAtraso,
    ).toBe(7);

    expect(
      situacaoDe({ vencimento: "2026-11-20", pagoEm: null }, HOJE).diasDeAtraso,
    ).toBe(0);

    expect(
      situacaoDe({ vencimento: "2026-01-01", pagoEm: "2026-06-01" }, HOJE)
        .diasDeAtraso,
    ).toBe(0);
  });

  it("marcar e desmarcar o pagamento muda só isso", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ aluguel",
        valor: "3500,00",
        categoriaId: await categoriaDeSaida("aluguel"),
        vencimento: "2026-11-10",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    // Vencido e não pago: atrasado.
    expect(feito.dados.situacao).toBe("ATRASADO");
    expect(feito.dados.diasDeAtraso).toBe(7);

    const pago = await marcarPagamento(
      feito.dados.id,
      { pagoEm: "2026-11-12" },
      AGORA,
    );
    if (!pago.ok) throw new Error(pago.falha.motivo);

    expect(pago.dados.situacao).toBe("PAGO");
    expect(pago.dados.pagoEm).toBe("2026-11-12");
    // Nada mais mudou.
    expect(pago.dados.valor).toBe("3500.00");
    expect(pago.dados.vencimento).toBe("2026-11-10");

    // DESMARCAR devolve a linha ao estado anterior: marcar errado acontece.
    const desmarcado = await marcarPagamento(
      feito.dados.id,
      { pagoEm: null },
      AGORA,
    );
    if (!desmarcado.ok) throw new Error(desmarcado.falha.motivo);

    expect(desmarcado.dados.situacao).toBe("ATRASADO");
    expect(desmarcado.dados.pagoEm).toBeNull();
  });

  /**
   * O VENCIMENTO NÃO PODE VOLTAR UM DIA NA LEITURA.
   *
   * A coluna é DATE e o Prisma a entrega como meia-noite UTC. Lida com a
   * regra de fuso de São Paulo, ela daria o DIA ANTERIOR — meia-noite UTC é
   * 21h do dia de antes aqui —, e todo vencimento apareceria um dia mais cedo
   * na tela. Teste de ida e volta.
   */
  it("o dia gravado é o dia lido, sem escorregar pelo fuso", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ dia exato",
        valor: "1,00",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-12-01",
        pagoEm: "2026-12-01",
      },
      operador,
      AGORA,
    );

    if (!feito.ok) throw new Error(feito.falha.motivo);

    expect(feito.dados.vencimento).toBe("2026-12-01");
    expect(feito.dados.pagoEm).toBe("2026-12-01");

    const lista = await listarLancamentos({
      de: "2026-12-01",
      ate: "2026-12-01",
      agora: AGORA,
    });

    expect(lista.map((linha) => linha.id)).toContain(feito.dados.id);
  });
});

describe("a soma é em centavos", () => {
  /**
   * Três de R$ 33,33 precisam dar R$ 99,99.
   *
   * Em ponto flutuante: 33.33 + 33.33 + 33.33 = 99.99000000000001. Um caixa
   * com um centavo de diferença faz a equipe desconfiar do número inteiro.
   */
  it("três lançamentos de R$ 33,33 dão R$ 99,99", async () => {
    const categoriaId = await categoriaDeEntrada();

    for (let i = 0; i < 3; i += 1) {
      const feito = await lancar(
        {
          descricao: `ZZ terço ${i + 1}`,
          valor: "33,33",
          categoriaId,
          vencimento: "2026-11-15",
          pagoEm: "2026-11-15",
        },
        operador,
        AGORA,
      );
      if (!feito.ok) throw new Error(feito.falha.motivo);
    }

    const lista = await listarLancamentos({
      de: "2026-11-15",
      ate: "2026-11-15",
      agora: AGORA,
    });

    const resumo = resumir(lista.filter((l) => l.descricao.startsWith("ZZ ")));

    expect(resumo.entradasCentavos).toBe(9_999);
  });

  it("entrada e saída são somadas separadas, e o saldo é a diferença", async () => {
    await lancar(
      {
        descricao: "ZZ mensalidade da sala 4",
        valor: "2400,00",
        categoriaId: await categoriaDeEntrada(),
        vencimento: "2026-11-05",
        pagoEm: "2026-11-05",
      },
      operador,
      AGORA,
    );

    await lancar(
      {
        descricao: "ZZ energia de outubro",
        valor: "430,25",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-11-08",
        pagoEm: "2026-11-08",
      },
      operador,
      AGORA,
    );

    const lista = (
      await listarLancamentos({ de: "2026-11-01", ate: "2026-11-30", agora: AGORA })
    ).filter((linha) => linha.descricao.startsWith("ZZ "));

    const resumo = resumir(lista);

    expect(resumo.entradasCentavos).toBe(240_000);
    expect(resumo.saidasCentavos).toBe(43_025);
    expect(resumo.saldoCentavos).toBe(196_975);
  });

  /**
   * PAGO ENTRA NO CAIXA; PENDENTE ENTRA EM "A PAGAR"/"A RECEBER".
   *
   * Somar os dois juntos diria que o dinheiro já entrou, e a equipe tomaria
   * decisão em cima de um saldo que não existe.
   */
  it("o que não foi pago não conta no saldo, e aparece separado", async () => {
    await lancar(
      {
        descricao: "ZZ mensalidade atrasada",
        valor: "2400,00",
        categoriaId: await categoriaDeEntrada(),
        vencimento: "2026-11-05",
      },
      operador,
      AGORA,
    );

    await lancar(
      {
        descricao: "ZZ internet a vencer",
        valor: "199,90",
        categoriaId: await categoriaDeSaida("internet"),
        vencimento: "2026-11-28",
      },
      operador,
      AGORA,
    );

    const lista = (
      await listarLancamentos({ de: "2026-11-01", ate: "2026-11-30", agora: AGORA })
    ).filter((linha) => linha.descricao.startsWith("ZZ "));

    const resumo = resumir(lista);

    expect(resumo.entradasCentavos).toBe(0);
    expect(resumo.saidasCentavos).toBe(0);
    expect(resumo.saldoCentavos).toBe(0);

    expect(resumo.aReceberCentavos).toBe(240_000);
    expect(resumo.aPagarCentavos).toBe(19_990);

    // A mensalidade venceu dia 5 e hoje é 17: está atrasada. A internet vence
    // dia 28: ainda não.
    expect(resumo.atrasadoAReceberCentavos).toBe(240_000);
    expect(resumo.atrasadoAPagarCentavos).toBe(0);
  });
});

describe("o período: contas ou caixa, nunca os dois misturados", () => {
  /**
   * Uma conta de outubro paga em novembro é DESPESA DE OUTUBRO e CAIXA DE
   * NOVEMBRO. Misturar as duas visões num filtro só daria um número que não
   * bate com nenhuma das duas.
   */
  it("a mesma conta aparece em outubro por vencimento e em novembro por caixa", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ energia de outubro",
        valor: "430,25",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-10-28",
        pagoEm: "2026-11-03",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const porVencimento = await listarLancamentos({
      de: "2026-10-01",
      ate: "2026-10-31",
      base: "vencimento",
      agora: AGORA,
    });

    const porCaixa = await listarLancamentos({
      de: "2026-11-01",
      ate: "2026-11-30",
      base: "pagamento",
      agora: AGORA,
    });

    expect(porVencimento.map((l) => l.id)).toContain(feito.dados.id);
    expect(porCaixa.map((l) => l.id)).toContain(feito.dados.id);

    // E NÃO aparece no caixa de outubro: ali não saiu dinheiro nenhum.
    const caixaDeOutubro = await listarLancamentos({
      de: "2026-10-01",
      ate: "2026-10-31",
      base: "pagamento",
      agora: AGORA,
    });
    expect(caixaDeOutubro.map((l) => l.id)).not.toContain(feito.dados.id);
  });

  it("na visão de caixa, o que nunca foi pago não entra", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ nunca paga",
        valor: "50,00",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-11-10",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const porCaixa = await listarLancamentos({
      de: "2026-11-01",
      ate: "2026-11-30",
      base: "pagamento",
      agora: AGORA,
    });

    expect(porCaixa.map((l) => l.id)).not.toContain(feito.dados.id);
  });

  it("filtrar por situação acha o atrasado", async () => {
    await lancar(
      {
        descricao: "ZZ atrasada",
        valor: "100,00",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-11-01",
      },
      operador,
      AGORA,
    );

    await lancar(
      {
        descricao: "ZZ em dia",
        valor: "100,00",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-11-30",
      },
      operador,
      AGORA,
    );

    const atrasadas = (
      await listarLancamentos({
        de: "2026-11-01",
        ate: "2026-11-30",
        situacao: "ATRASADO",
        agora: AGORA,
      })
    ).filter((linha) => linha.descricao.startsWith("ZZ "));

    expect(atrasadas.map((linha) => linha.descricao)).toEqual(["ZZ atrasada"]);
  });
});

describe("o fornecedor", () => {
  it("nasce, é renomeado e desligado — nunca excluído", async () => {
    const criado = await criarFornecedor({
      nome: FORNECEDOR,
      observacao: "ZZ conta 123",
    });
    if (!criado.ok) throw new Error(criado.falha.motivo);

    const salvo = await editarFornecedor(criado.dados.id, {
      nome: "ZZ Energia da Cidade",
    });
    if (!salvo.ok) throw new Error(salvo.falha.motivo);
    expect(salvo.dados.nome).toBe("ZZ Energia da Cidade");
    // A observação não foi mandada: ela não pode ser apagada em silêncio.
    expect(salvo.dados.observacao).toBe("ZZ conta 123");

    const desligado = await editarFornecedor(criado.dados.id, { ativo: false });
    if (!desligado.ok) throw new Error(desligado.falha.motivo);

    // Desligado SAI da lista de escolha, mas continua no painel.
    const paraEscolher = await listarFornecedores({ somenteAtivos: true });
    expect(paraEscolher.map((f) => f.id)).not.toContain(criado.dados.id);

    const noPainel = await listarFornecedores();
    expect(noPainel.map((f) => f.id)).toContain(criado.dados.id);
  });

  it("fornecedor desligado recusa lançamento novo", async () => {
    const criado = await criarFornecedor({ nome: FORNECEDOR });
    if (!criado.ok) throw new Error("deveria criar");

    await editarFornecedor(criado.dados.id, { ativo: false });

    const feito = await lancar(
      {
        descricao: "ZZ tentativa",
        valor: "10,00",
        categoriaId: await categoriaDeSaida(),
        fornecedorId: criado.dados.id,
        vencimento: "2026-11-25",
      },
      operador,
      AGORA,
    );

    expect(feito.ok).toBe(false);
    if (feito.ok) throw new Error("deveria recusar");
    expect(feito.falha.codigo).toBe("FORNECEDOR_DESLIGADO");
  });

  /**
   * O BANCO RECUSA APAGAR fornecedor com lançamento (RESTRICT). Não há tela
   * para isso, mas se um dia houver, a trava é do banco — apagar tiraria as
   * despesas dele do relatório em silêncio.
   */
  it("o banco recusa apagar fornecedor que tem lançamento", async () => {
    const criado = await criarFornecedor({ nome: FORNECEDOR });
    if (!criado.ok) throw new Error("deveria criar");

    await lancar(
      {
        descricao: "ZZ conta dele",
        valor: "10,00",
        categoriaId: await categoriaDeSaida(),
        fornecedorId: criado.dados.id,
        vencimento: "2026-11-25",
      },
      operador,
      AGORA,
    );

    await expect(
      bancoDeTeste.fornecedor.delete({ where: { id: criado.dados.id } }),
    ).rejects.toThrow();
  });
});

describe("editar é livre — é dinheiro que a própria equipe digitou", () => {
  it("corrigir valor, descrição, data e categoria", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ errado",
        valor: "100,00",
        categoriaId: await categoriaDeSaida("energia"),
        vencimento: "2026-11-10",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const salvo = await editarLancamento(
      feito.dados.id,
      {
        descricao: "ZZ certo",
        valor: "137,45",
        categoriaId: await categoriaDeSaida("agua"),
        vencimento: "2026-11-18",
      },
      AGORA,
    );

    if (!salvo.ok) throw new Error(salvo.falha.motivo);

    expect(salvo.dados.descricao).toBe("ZZ certo");
    expect(salvo.dados.valor).toBe("137.45");
    expect(salvo.dados.vencimento).toBe("2026-11-18");
    expect(salvo.dados.categoria.nome).toBe("Água");
    // Vence amanhã: voltou a pendente.
    expect(salvo.dados.situacao).toBe("PENDENTE");
  });

  /**
   * A CONFERÊNCIA OLHA O LANÇAMENTO COMO ELE FICARIA, e não só o que veio na
   * mudança. Trocar só o cliente, numa linha que já tem fornecedor, continua
   * sendo cliente e fornecedor juntos.
   */
  it("pôr cliente numa linha que já tem fornecedor é recusado", async () => {
    const fornecedor = await criarFornecedor({ nome: FORNECEDOR });
    if (!fornecedor.ok) throw new Error("deveria criar");

    const feito = await lancar(
      {
        descricao: "ZZ do fornecedor",
        valor: "10,00",
        categoriaId: await categoriaDeSaida(),
        fornecedorId: fornecedor.dados.id,
        vencimento: "2026-11-25",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const salvo = await editarLancamento(feito.dados.id, { clienteId }, AGORA);

    expect(salvo.ok).toBe(false);
    if (salvo.ok) throw new Error("deveria recusar");
    expect(salvo.falha.codigo).toBe("CLIENTE_E_FORNECEDOR");
  });
});

describe("excluir deixa evidência, e na mesma transação", () => {
  it("o motivo é obrigatório, e sem ele a linha fica intacta", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ duplicada",
        valor: "100,00",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-11-20",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const semMotivo = await excluirLancamento({
      id: feito.dados.id,
      motivo: "  ",
      operador,
    });

    expect(semMotivo.ok).toBe(false);
    if (semMotivo.ok) throw new Error("deveria recusar");
    expect(semMotivo.falha.codigo).toBe("MOTIVO_OBRIGATORIO");

    // A LINHA CONTINUA LÁ. Conferir a mensagem não bastaria: o que importa é
    // que nada foi apagado.
    const ainda = await bancoDeTeste.lancamento.findUnique({
      where: { id: feito.dados.id },
    });
    expect(ainda).not.toBeNull();
  });

  it("excluir apaga a linha e grava o retrato dela", async () => {
    const fornecedor = await criarFornecedor({ nome: FORNECEDOR });
    if (!fornecedor.ok) throw new Error("deveria criar");

    const feito = await lancar(
      {
        descricao: "ZZ lançada em dobro",
        valor: "430,25",
        categoriaId: await categoriaDeSaida(),
        fornecedorId: fornecedor.dados.id,
        vencimento: "2026-11-20",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    const excluido = await excluirLancamento({
      id: feito.dados.id,
      motivo: "lancei duas vezes a mesma conta",
      operador,
    });

    if (!excluido.ok) throw new Error(excluido.falha.motivo);

    // A linha some.
    const sumiu = await bancoDeTeste.lancamento.findUnique({
      where: { id: feito.dados.id },
    });
    expect(sumiu).toBeNull();

    // E a prova fica.
    const acoes = await listarAcoes({ tipo: TipoDeAcao.LANCAMENTO_EXCLUIDO });
    const nossa = acoes.find((acao) => acao.usuarioNome === NOME);

    expect(nossa).toBeDefined();
    expect(nossa?.motivo).toBe("lancei duas vezes a mesma conta");

    /*
     * O RESUMO É CONGELADO: a linha não existe mais para ser consultada, e a
     * categoria dela pode ser renomeada depois. Ele precisa se explicar
     * sozinho.
     */
    expect(nossa?.resumo).toContain("Saída");
    expect(nossa?.resumo).toContain("430,25");
    expect(nossa?.resumo).toContain("ZZ lançada em dobro");
    expect(nossa?.resumo).toContain("não estava paga");

    // O retrato completo, para quem precisar reconstruir a linha.
    expect(nossa?.dados.fornecedor).toBe("ZZ Energia do Bairro");
    expect(nossa?.dados.valor).toBe("430.25");
    expect(nossa?.dados.vencimento).toBe("2026-11-20");
  });

  /**
   * O NOME DE QUEM FEZ FICA, mesmo se o usuário for desligado depois.
   *
   * A chave estrangeira é SET NULL; o nome vai gravado na linha. Sem ele, a
   * evidência viraria "alguém fez isso".
   */
  it("o nome de quem excluiu sobrevive ao usuário ser apagado", async () => {
    const feito = await lancar(
      {
        descricao: "ZZ some junto",
        valor: "10,00",
        categoriaId: await categoriaDeSaida(),
        vencimento: "2026-11-20",
      },
      operador,
      AGORA,
    );
    if (!feito.ok) throw new Error(feito.falha.motivo);

    await excluirLancamento({
      id: feito.dados.id,
      motivo: "engano da recepcao",
      operador,
    });

    await bancoDeTeste.usuario.delete({ where: { id: operador.id } });

    const acoes = await listarAcoes({ tipo: TipoDeAcao.LANCAMENTO_EXCLUIDO });
    const nossa = acoes.find((acao) => acao.motivo === "engano da recepcao");

    expect(nossa?.usuarioNome).toBe(NOME);
  });

  /**
   * O HISTÓRICO NUNCA SE APAGA — e o lançamento excluído não leva o registro
   * junto. Este teste existe porque um registro de evidência que desaparece
   * com o que ele registra não é evidência nenhuma.
   */
  it("excluir um lançamento não apaga registros anteriores", async () => {
    const categoriaId = await categoriaDeSaida();

    for (const descricao of ["ZZ primeira", "ZZ segunda"]) {
      const feito = await lancar(
        { descricao, valor: "10,00", categoriaId, vencimento: "2026-11-20" },
        operador,
        AGORA,
      );
      if (!feito.ok) throw new Error(feito.falha.motivo);

      const excluido = await excluirLancamento({
        id: feito.dados.id,
        motivo: `apagando ${descricao}`,
        operador,
      });
      if (!excluido.ok) throw new Error(excluido.falha.motivo);
    }

    const acoes = await listarAcoes({ tipo: TipoDeAcao.LANCAMENTO_EXCLUIDO });
    const nossas = acoes.filter((acao) => acao.usuarioNome === NOME);

    expect(nossas).toHaveLength(2);
  });
});
