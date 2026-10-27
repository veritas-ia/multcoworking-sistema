/**
 * AS AREAS DE ATUACAO EDITAVEIS NO PAINEL (27/10/2026).
 *
 * Antes a lista estava escrita no codigo e so um programador mexia nela. O
 * dono pediu para a equipe acrescentar e tirar sozinha, e pediu o bloqueio
 * como botao, para destravar o Juridico no dia em que o contrato de
 * exclusividade com a advocacia acabar.
 *
 * O que estes testes protegem:
 *  1. criar, renomear, desligar, bloquear e reordenar;
 *  2. renomear troca o nome TAMBEM nas reservas antigas, sem mexer nelas;
 *  3. desligar e bloquear MANTEM o historico — nao existe excluir;
 *  4. a ultima area que pode reservar nao se desliga nem se bloqueia: sem
 *     nenhuma, o formulario nao fecha e NINGUEM consegue reservar;
 *  5. o nome interno (slug) nunca muda, porque e ele que amarra a area ao que
 *     ja esta gravado.
 *
 * Precisa do banco no ar e com as migracoes aplicadas.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  criarProfissao,
  editarProfissao,
  listarProfissoesDoPainel,
  listarProfissoesParaEscolher,
  moverProfissao,
  recusaDaProfissao,
} from "@/lib/profissoes";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

const PREFIXO = "ZZ Area";
const TELEFONE = "+5511900000811";

let salaId: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaId = sala.id;
});

async function limpar(): Promise<void> {
  // A ORDEM IMPORTA: a reserva aponta para a area com ON DELETE RESTRICT.
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.profissao.deleteMany({ where: { nome: { startsWith: PREFIXO } } });

  // Devolve a ordem e o estado das cinco de producao, que alguns testes
  // mexem de proposito.
  const originais: [string, number, boolean][] = [
    ["MARKETING", 1, false],
    ["JURIDICO", 2, true],
    ["CONTABIL", 3, false],
    ["SAUDE", 4, false],
    ["OUTROS", 5, false],
  ];

  for (const [slug, ordem, bloqueada] of originais) {
    await bancoDeTeste.profissao.update({
      where: { slug },
      data: { ordem, bloqueada, ativa: true },
    });
  }
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

async function areaDeTeste(nome = `${PREFIXO} Tecnologia`) {
  const resultado = await criarProfissao(nome);

  if (!resultado.ok) {
    throw new Error(`Nao criou: ${resultado.falha.motivo}`);
  }

  return resultado.dados;
}

/** Uma reserva com a area escolhida, gravada direto no banco. */
async function reservaCom(profissaoId: string, hora = "09:00") {
  return bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: "Cliente de Teste",
      telefone: TELEFONE,
      profissaoId,
      inicio: instanteDe("2026-11-10", hora),
      fim: instanteDe("2026-11-10", `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`),
      duracaoMinutos: 60,
      valor: "40.00",
      origem: "PUBLICO",
      confirmacaoEnviadaEm: new Date(),
    },
    select: { id: true },
  });
}

// -----------------------------------------------------------------------------

describe("criar", () => {
  it("cria e entra no fim da lista", async () => {
    const criada = await areaDeTeste();

    expect(criada.nome).toBe(`${PREFIXO} Tecnologia`);
    expect(criada.ativa).toBe(true);
    expect(criada.bloqueada).toBe(false);
    expect(criada.reservas).toBe(0);

    const lista = await listarProfissoesDoPainel();
    expect(lista[lista.length - 1]?.id).toBe(criada.id);
  });

  it("o nome interno sai do nome, sem acento nem espaço", async () => {
    const criada = await areaDeTeste(`${PREFIXO} Educação Física`);

    expect(criada.slug).toBe("ZZ_AREA_EDUCACAO_FISICA");
  });

  it("recusa nome repetido e nome curto", async () => {
    await areaDeTeste();

    expect((await criarProfissao(`${PREFIXO} Tecnologia`)).ok).toBe(false);
    expect((await criarProfissao("A")).ok).toBe(false);
  });

  it("recusa nome sem letra nem número", async () => {
    // Sem isso o nome interno sairia vazio, e duas areas assim colidiriam.
    expect((await criarProfissao("...")).ok).toBe(false);
  });

  it("já aparece para o cliente escolher", async () => {
    const criada = await areaDeTeste();

    expect(
      (await listarProfissoesParaEscolher()).some((opcao) => opcao.id === criada.id),
    ).toBe(true);
  });
});

describe("renomear", () => {
  it("troca o nome TAMBÉM na reserva antiga, sem mexer nela", async () => {
    const area = await areaDeTeste(`${PREFIXO} Antes`);
    const reserva = await reservaCom(area.id);

    const antes = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
    });

    await editarProfissao(area.id, { nome: `${PREFIXO} Depois` });

    // A LINHA DA RESERVA fica intacta: ela aponta para a area e nao guarda
    // o texto do nome.
    const depois = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
    });
    expect(depois).toEqual(antes);

    const comArea = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
      select: { profissao: { select: { nome: true } } },
    });
    expect(comArea.profissao?.nome).toBe(`${PREFIXO} Depois`);
  });

  it("o nome interno NÃO muda ao renomear", async () => {
    const area = await areaDeTeste(`${PREFIXO} Antes`);

    const renomeada = await editarProfissao(area.id, { nome: `${PREFIXO} Depois` });

    expect(renomeada.ok).toBe(true);
    if (!renomeada.ok) return;
    // E o slug que amarra a area ao que ja esta gravado: mudando, um
    // relatorio antigo deixaria de bater com a lista.
    expect(renomeada.dados.slug).toBe(area.slug);
  });

  it("recusa renomear para um nome que já existe", async () => {
    const primeira = await areaDeTeste(`${PREFIXO} Primeira`);
    await areaDeTeste(`${PREFIXO} Segunda`);

    expect(
      (await editarProfissao(primeira.id, { nome: `${PREFIXO} Segunda` })).ok,
    ).toBe(false);
  });
});

describe("desligar", () => {
  it("sai da lista do cliente, mas continua no painel", async () => {
    const area = await areaDeTeste();

    await editarProfissao(area.id, { ativa: false });

    expect(
      (await listarProfissoesParaEscolher()).some((opcao) => opcao.id === area.id),
    ).toBe(false);
    expect(
      (await listarProfissoesDoPainel()).find((opcao) => opcao.id === area.id)?.ativa,
    ).toBe(false);
  });

  it("a reserva antiga continua de pé, e a área conta o histórico", async () => {
    const area = await areaDeTeste();
    const reserva = await reservaCom(area.id);

    await editarProfissao(area.id, { ativa: false });

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: reserva.id },
      select: { profissaoId: true },
    });
    expect(noBanco.profissaoId).toBe(area.id);

    const noPainel = (await listarProfissoesDoPainel()).find(
      (opcao) => opcao.id === area.id,
    );
    expect(noPainel?.reservas).toBe(1);
  });

  it("o servidor recusa reservar numa área desligada", async () => {
    const area = await areaDeTeste();
    await editarProfissao(area.id, { ativa: false });

    expect(await recusaDaProfissao(area.id)).not.toBeNull();
  });
});

describe("bloquear", () => {
  it("continua na lista do cliente, mas recusa a reserva", async () => {
    const area = await areaDeTeste();

    await editarProfissao(area.id, { bloqueada: true });

    // Na lista de proposito: escondida, a pessoa escolheria "Outros" e a
    // reserva passaria.
    expect(
      (await listarProfissoesParaEscolher()).some((opcao) => opcao.id === area.id),
    ).toBe(true);
    expect(await recusaDaProfissao(area.id)).not.toBeNull();
  });

  it("sem aviso próprio, usa o genérico", async () => {
    const area = await areaDeTeste();
    await editarProfissao(area.id, { bloqueada: true });

    const recusa = await recusaDaProfissao(area.id);

    expect(recusa?.motivo).toMatch(/esta área de atuação/i);
  });

  it("com aviso próprio, usa o texto escrito pela equipe", async () => {
    const area = await areaDeTeste();

    await editarProfissao(area.id, {
      bloqueada: true,
      avisoBloqueio: "Combinamos com outra empresa. Fale com a recepção.",
    });

    const recusa = await recusaDaProfissao(area.id);

    expect(recusa?.motivo).toBe("Combinamos com outra empresa. Fale com a recepção.");
  });

  it("aviso em branco volta ao genérico", async () => {
    const area = await areaDeTeste();
    await editarProfissao(area.id, { bloqueada: true, avisoBloqueio: "Texto próprio" });

    await editarProfissao(area.id, { avisoBloqueio: "   " });

    expect((await recusaDaProfissao(area.id))?.motivo).toMatch(
      /esta área de atuação/i,
    );
  });

  it("desbloquear libera na hora", async () => {
    const area = await areaDeTeste();
    await editarProfissao(area.id, { bloqueada: true });

    await editarProfissao(area.id, { bloqueada: false });

    expect(await recusaDaProfissao(area.id)).toBeNull();
  });
});

describe("a última que pode reservar", () => {
  /** Desliga todas menos a que sobrar. */
  async function deixarSoUma(): Promise<string> {
    const todas = await bancoDeTeste.profissao.findMany({
      where: { ativa: true, bloqueada: false },
      select: { id: true },
    });

    const [sobrevivente, ...resto] = todas;

    for (const outra of resto) {
      await bancoDeTeste.profissao.update({
        where: { id: outra.id },
        data: { ativa: false },
      });
    }

    return sobrevivente!.id;
  }

  it("não se desliga", async () => {
    // Sem nenhuma area escolhivel, o formulario de reserva nao fecha e
    // NINGUEM consegue marcar nada — nem no site, nem no balcao. O erro
    // apareceria como "escolha a area" numa lista vazia, e ninguem ligaria
    // uma coisa a outra.
    const ultima = await deixarSoUma();

    const resultado = await editarProfissao(ultima, { ativa: false });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.falha.codigo).toBe("ULTIMA_ATIVA");
  });

  it("não se bloqueia — bloquear todas tem o mesmo efeito", async () => {
    const ultima = await deixarSoUma();

    const resultado = await editarProfissao(ultima, { bloqueada: true });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.falha.codigo).toBe("ULTIMA_ATIVA");
  });

  it("mas desligar uma quando sobram outras funciona", async () => {
    const area = await areaDeTeste();

    expect((await editarProfissao(area.id, { ativa: false })).ok).toBe(true);
  });
});

describe("reordenar", () => {
  it("sobe uma posição", async () => {
    const antes = (await listarProfissoesDoPainel()).map((opcao) => opcao.slug);

    await moverProfissao(
      (await listarProfissoesDoPainel())[1]!.id,
      "SUBIR",
    );

    const depois = (await listarProfissoesDoPainel()).map((opcao) => opcao.slug);

    expect(depois[0]).toBe(antes[1]);
    expect(depois[1]).toBe(antes[0]);
  });

  it("desce uma posição", async () => {
    const antes = (await listarProfissoesDoPainel()).map((opcao) => opcao.slug);

    await moverProfissao((await listarProfissoesDoPainel())[0]!.id, "DESCER");

    const depois = (await listarProfissoesDoPainel()).map((opcao) => opcao.slug);

    expect(depois[0]).toBe(antes[1]);
    expect(depois[1]).toBe(antes[0]);
  });

  it("nas pontas não faz nada, e não é erro", async () => {
    const lista = await listarProfissoesDoPainel();
    const antes = lista.map((opcao) => opcao.slug);

    expect((await moverProfissao(lista[0]!.id, "SUBIR")).ok).toBe(true);
    expect((await moverProfissao(lista[lista.length - 1]!.id, "DESCER")).ok).toBe(true);

    expect((await listarProfissoesDoPainel()).map((opcao) => opcao.slug)).toEqual(antes);
  });

  it("nunca deixa duas com a mesma ordem", async () => {
    // Com numeros repetidos a ordem ficaria no ar, e a lista mudaria de
    // lugar sozinha entre uma visita e outra.
    await areaDeTeste();
    await moverProfissao((await listarProfissoesDoPainel())[2]!.id, "SUBIR");

    const ordens = (await listarProfissoesDoPainel()).map((opcao) => opcao.ordem);

    expect(new Set(ordens).size).toBe(ordens.length);
  });
});
