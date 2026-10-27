/**
 * AREA BLOQUEADA — o contrato de exclusividade com a advocacia.
 *
 * O BLOQUEIO VIROU COLUNA em 27/10/2026, editavel no painel: o dono quer
 * destravar o Juridico sozinho quando o contrato acabar. Antes era uma
 * constante no codigo. O Juridico ja nasce bloqueado pela migracao, do jeito
 * que estava em producao.
 *
 * O que estes testes protegem:
 *  1. o SERVIDOR recusa, e nao so a tela. Esconder o botao nao para quem
 *     manda o pedido direto — e a recusa precisa valer nas TRES portas que
 *     criam reserva: site, recepcao e serie recorrente;
 *  2. as outras categorias reservam normalmente. Uma trava que barra demais
 *     seria pior do que trava nenhuma;
 *  3. reserva de Juridico que JA EXISTE continua de pe, e a equipe continua
 *     podendo remarcar — a regra vale so para reserva nova;
 *  4. o aviso que chega a tela e o texto DA PROPRIA AREA, e nao um erro
 *     tecnico nem uma frase escrita no codigo;
 *  5. desbloquear no painel libera a reserva na hora — e o dia em que o
 *     contrato acabar.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { POST as postReservaAdmin } from "@/app/api/admin/reservas/route";
import { reagendarComoAdmin } from "@/lib/agenda-admin";
import {
  listarProfissoesParaEscolher,
  recusaDaProfissao,
} from "@/lib/profissoes";
import { criarSerie } from "@/lib/recorrencias";
import { criarReservaPublica } from "@/lib/reservas";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";
import { pedidoPost } from "./apoio/requisicao";

/**
 * O RELOGIO E CONGELADO nestes testes.
 *
 * Sem isso o arquivo tinha prazo de validade: ele reserva na TERCA as 10h, e
 * no dia 27/10/2026, passadas as 10h, a antecedencia minima passou a recusar
 * a reserva — o teste quebrava sozinho, sem nada no sistema ter mudado. Foi o
 * mesmo defeito que pegou o "diaria.test.ts".
 */
const AGORA = new Date("2026-10-27T09:00:00.000Z");

const TERCA = "2026-10-27";
const QUARTA = "2026-10-28";
const TELEFONE = "+5511900000777";
const USUARIO = "zz.bloqueio";

const OPERADOR = { id: "", nome: "Recepção de Teste" };
let salaId: string;
let cookie: string;
const ID: Record<string, string> = {};
/** O aviso que a propria area carrega, lido do banco. */
let avisoDoJuridico: string;

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findUniqueOrThrow({
    where: { slug: "sala-container" },
    select: { id: true },
  });
  salaId = sala.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: USUARIO },
    create: { nome: "Recepção de Teste", usuario: USUARIO, senhaHash: "x" },
    update: {},
    select: { id: true },
  });

  OPERADOR.id = admin.id;
  cookie = `${COOKIE_ADMIN}=${await assinarToken(admin.id)}`;

  for (const slug of ["MARKETING", "JURIDICO", "CONTABIL", "SAUDE", "OUTROS"]) {
    ID[slug] = await idDaProfissao(slug);
  }

  const juridico = await bancoDeTeste.profissao.findUniqueOrThrow({
    where: { slug: "JURIDICO" },
    select: { avisoBloqueio: true },
  });
  avisoDoJuridico = juridico.avisoBloqueio!;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
  await bancoDeTeste.recorrencia.deleteMany({ where: { telefone: TELEFONE } });
}

beforeEach(() => {
  // Congela apenas o relogio; o banco continua normal.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
});

afterEach(async () => {
  vi.useRealTimers();
  await limpar();
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
  await bancoDeTeste.$disconnect();
});

/** Corpo de um pedido de reserva pelo painel. */
function corpoDoPainel(profissaoId: string, hora = "10:00") {
  return {
    salaId,
    telefone: TELEFONE,
    nome: "Cliente de Teste",
    profissaoId,
    data: TERCA,
    inicio: hora,
    fim: `${String(Number(hora.slice(0, 2)) + 1).padStart(2, "0")}:00`,
  };
}

// -----------------------------------------------------------------------------

describe("quem esta bloqueado hoje", () => {
  it("so o Juridico, e as outras quatro reservam", async () => {
    const lista = await listarProfissoesParaEscolher();

    for (const opcao of lista) {
      expect(opcao.bloqueada, opcao.nome).toBe(opcao.nome === "Jurídico");
    }
  });

  it("a recusa traz o aviso DA AREA, nao um texto do codigo", async () => {
    const recusa = await recusaDaProfissao(ID.JURIDICO!);

    expect(recusa?.motivo).toBe(avisoDoJuridico);
    expect(recusa?.motivo).toMatch(/área jurídica/i);
  });

  it("area que reserva normalmente nao devolve recusa", async () => {
    expect(await recusaDaProfissao(ID.CONTABIL!)).toBeNull();
  });
});

describe("pelo site", () => {
  it("o SERVIDOR recusa Juridico, com o texto combinado", async () => {
    // Chama a funcao que a rota usa, sem passar pela tela nem pela sessao: e
    // exatamente o caminho de quem tenta burlar mandando o pedido direto.
    const resultado = await criarReservaPublica({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Advogado Teste",
      profissaoId: ID.JURIDICO!,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.criada).toBe(false);
    if (!resultado.criada && resultado.falha.tipo === "REGRA") {
      expect(resultado.falha.codigo).toBe("PROFISSAO_BLOQUEADA");
      expect(resultado.falha.motivo).toBe(avisoDoJuridico);
    } else {
      throw new Error("Esperava uma recusa de REGRA.");
    }

    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(0);
  });

  it("outra categoria passa pelo mesmo caminho", async () => {
    const resultado = await criarReservaPublica({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Cliente Teste",
      profissaoId: ID.CONTABIL!,
      inicio: instanteDe(TERCA, "10:00"),
      fim: instanteDe(TERCA, "11:00"),
    });

    expect(resultado.criada).toBe(true);
  });
});

describe("pelo painel", () => {
  it("recusa Juridico com o texto combinado", async () => {
    const resposta = await postReservaAdmin(
      pedidoPost("/api/admin/reservas", corpoDoPainel(ID.JURIDICO!), { cookie }),
    );

    expect(resposta.status).toBe(422);
    expect((await resposta.json()).erro).toBe(avisoDoJuridico);
    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(0);
  });

  it("as outras categorias reservam normalmente", async () => {
    const outras = (await listarProfissoesParaEscolher()).filter(
      (opcao) => !opcao.bloqueada,
    );

    for (const [indice, opcao] of outras.entries()) {
      // Horarios diferentes para nao esbarrarem umas nas outras.
      const hora = `${String(9 + indice * 2).padStart(2, "0")}:00`;

      const resposta = await postReservaAdmin(
        pedidoPost("/api/admin/reservas", corpoDoPainel(opcao.id, hora), { cookie }),
      );

      expect(resposta.status, opcao.nome).toBe(201);
    }

    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(
      outras.length,
    );
  });
});

describe("pela serie recorrente", () => {
  it("recusa Juridico antes de criar qualquer ocorrencia", async () => {
    // E a maior brecha das tres portas: uma serie cria muitas reservas de uma
    // vez so.
    const resultado = await criarSerie({
      salaId,
      telefone: TELEFONE,
      nomeCliente: "Escritório Teste",
      profissaoId: ID.JURIDICO!,
      horaInicio: "09:00",
      horaFim: "10:00",
      diasDaSemana: [2],
      frequencia: "SEMANAL",
      dataInicio: TERCA,
      dataFim: "2026-11-24",
      operador: OPERADOR,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toBe(avisoDoJuridico);
    }

    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(0);
  });
});

describe("reservas que ja existem", () => {
  it("continuam de pe, e a equipe ainda pode remarcar", async () => {
    // Gravada direto no banco, como as que ja existiam antes da regra.
    const antiga = await bancoDeTeste.reserva.create({
      data: {
        salaId,
        nomeCliente: "Cliente Antigo",
        telefone: TELEFONE,
        profissaoId: ID.JURIDICO!,
        inicio: instanteDe(TERCA, "14:00"),
        fim: instanteDe(TERCA, "15:00"),
        duracaoMinutos: 60,
        valor: "35.00",
        origem: "ADMIN",
      },
      select: { id: true },
    });

    const remarcada = await reagendarComoAdmin({
      reservaId: antiga.id,
      salaId,
      inicio: instanteDe(QUARTA, "14:00"),
      fim: instanteDe(QUARTA, "15:00"),
      operador: OPERADOR,
    });

    // A regra vale para reserva NOVA. Quem ja reservou nao fica preso.
    expect(remarcada.ok).toBe(true);

    const noBanco = await bancoDeTeste.reserva.findUniqueOrThrow({
      where: { id: antiga.id },
      include: { profissao: { select: { nome: true } } },
    });
    expect(noBanco.profissao?.nome).toBe("Jurídico");
    expect(noBanco.inicio).toEqual(instanteDe(QUARTA, "14:00"));
  });
});

describe("desbloquear no painel", () => {
  it("libera a reserva na hora — é o dia em que o contrato acabar", async () => {
    // Era isto que antes exigia mexer no codigo e publicar de novo. O dono
    // pediu o botao justamente para nao depender disso.
    await bancoDeTeste.profissao.update({
      where: { slug: "JURIDICO" },
      data: { bloqueada: false },
    });

    try {
      const resultado = await criarReservaPublica({
        salaId,
        telefone: TELEFONE,
        nomeCliente: "Advogado Teste",
        profissaoId: ID.JURIDICO!,
        inicio: instanteDe(TERCA, "10:00"),
        fim: instanteDe(TERCA, "11:00"),
      });

      expect(resultado.criada).toBe(true);
    } finally {
      // Devolve o estado de producao: o contrato ainda vale.
      await bancoDeTeste.profissao.update({
        where: { slug: "JURIDICO" },
        data: { bloqueada: true },
      });
    }
  });
});
