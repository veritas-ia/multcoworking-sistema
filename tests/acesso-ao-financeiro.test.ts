/**
 * ACESSO À PARTE FINANCEIRA (17/11/2026).
 *
 * Pedido dos donos do coworking: poder criar um usuário do painel que vê tudo
 * MENOS o Financeiro — o caso da recepcionista.
 *
 * O QUE ESTES TESTES PROTEGEM, e por que cada ponto é perigoso:
 *
 *  1. **A tranca é do SERVIDOR.** Esconder os itens na barra lateral não para
 *     ninguém: basta digitar o endereço, ou mandar o pedido direto para a
 *     rota. Se a recusa vivesse só na tela, o filtro não existiria — e
 *     ninguém perceberia, porque a tela continuaria bonita.
 *
 *  2. **Quem não vê o financeiro não administra usuários.** Esta é a
 *     amarração que faz o filtro valer: sem ela, a pessoa entra em
 *     Configurações → Usuários e se promove sozinha, ou cria uma conta nova
 *     com acesso total. O filtro viraria enfeite.
 *
 *  3. **Ninguém tira o próprio acesso.** Perder o financeiro é perder junto a
 *     tela de usuários: quem se rebaixasse por engano NÃO TERIA COMO SE
 *     DEVOLVER o acesso.
 *
 *  4. **A última pessoa com o acesso não o perde nem é desligada.** Sem ela,
 *     o painel inteiro ficaria sem Financeiro e sem administração de
 *     usuários, e o jeito de voltar seria mexer no banco à mão.
 *
 *  5. **"Recebi no balcão" continua liberado** — decisão do dono. É a
 *     recepcionista quem recebe o dinheiro no balcão; ela registra que
 *     recebeu sem enxergar o caixa.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { GET as getCategorias } from "@/app/api/admin/financeiro/categorias/route";
import { GET as getPainel } from "@/app/api/admin/financeiro/painel/route";
import { POST as postLancamento } from "@/app/api/admin/financeiro/lancamentos/route";
import { POST as postRecebimento } from "@/app/api/admin/reservas/[id]/recebimento/route";
import {
  GET as getUsuarios,
  POST as postUsuario,
} from "@/app/api/admin/usuarios/route";
import { PATCH as patchUsuario } from "@/app/api/admin/usuarios/[id]/route";
import { adminDoToken } from "@/lib/admin";
import { listarCategorias } from "@/lib/financeiro";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { instanteDe, dataLocalDe } from "@/lib/tempo";
import {
  criarUsuario,
  definirAcessoFinanceiro,
  ligarOuDesligarUsuario,
} from "@/lib/usuarios-admin";

import { aquecerConexao, bancoDeTeste, idDaProfissao, idDoCliente } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

const PREFIXO = "zz.acesso";
const CHEFE = `${PREFIXO}.chefe`;
const RECEPCAO = `${PREFIXO}.recepcao`;
const TELEFONE = "+5511900009300";
const NOME_DO_CLIENTE = "ZZ Acesso Cliente";

let chefeId: string;
let recepcaoId: string;
let cookieDoChefe: string;
let cookieDaRecepcao: string;
let salaId: string;

/** O dia da ficha é sempre do passado: o motor recusa lançamento no futuro. */
const ONTEM = dataLocalDe(new Date(Date.now() - 24 * 60 * 60 * 1000));

beforeAll(async () => {
  await aquecerConexao();

  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    where: { ativa: true },
    select: { id: true },
  });
  salaId = sala.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.lancamento.deleteMany({});
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: TELEFONE } });
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
  await bancoDeTeste.tentativaLogin.deleteMany({
    where: { usuario: { startsWith: PREFIXO } },
  });
  await bancoDeTeste.usuario.deleteMany({
    where: { usuario: { startsWith: PREFIXO } },
  });
}

beforeEach(async () => {
  await limpar();

  const chefe = await bancoDeTeste.usuario.create({
    data: {
      nome: "ZZ Chefe",
      usuario: CHEFE,
      senhaHash: "x",
      acessoFinanceiro: true,
    },
    select: { id: true },
  });

  const recepcao = await bancoDeTeste.usuario.create({
    data: {
      nome: "ZZ Recepção",
      usuario: RECEPCAO,
      senhaHash: "x",
      acessoFinanceiro: false,
    },
    select: { id: true },
  });

  chefeId = chefe.id;
  recepcaoId = recepcao.id;
  cookieDoChefe = `${COOKIE_ADMIN}=${await assinarToken(chefeId)}`;
  cookieDaRecepcao = `${COOKIE_ADMIN}=${await assinarToken(recepcaoId)}`;
});

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

function contexto(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** Uma reserva gravada direto, como a recepção lança. */
async function umaReserva(): Promise<string> {
  const criada = await bancoDeTeste.reserva.create({
    data: {
      salaId,
      clienteId: await idDoCliente(TELEFONE, NOME_DO_CLIENTE),
      profissaoId: await idDaProfissao(),
      nomeCliente: NOME_DO_CLIENTE,
      telefone: TELEFONE,
      inicio: instanteDe(ONTEM, "09:00"),
      fim: instanteDe(ONTEM, "10:00"),
      duracaoMinutos: 60,
      valor: "40.00",
      status: "CONFIRMADA",
      origem: "ADMIN",
    },
    select: { id: true },
  });

  return criada.id;
}

// -----------------------------------------------------------------------------

describe("o nível vem do banco, a cada pedido", () => {
  /**
   * Guardado no cookie, tirar o acesso de alguém só valeria no próximo login
   * dela — e até lá ela continuaria entrando no Financeiro. É a mesma razão
   * de "ativo" ser lido do banco.
   */
  it("a sessão diz quem vê o financeiro", async () => {
    expect((await adminDoToken(await assinarToken(chefeId)))?.acessoFinanceiro).toBe(true);
    expect((await adminDoToken(await assinarToken(recepcaoId)))?.acessoFinanceiro).toBe(
      false,
    );
  });

  it("tirar o acesso vale na hora, sem trocar o cookie", async () => {
    const token = await assinarToken(chefeId);
    expect((await adminDoToken(token))?.acessoFinanceiro).toBe(true);

    // A recepção ganha o acesso ANTES, senão o chefe seria o último a tê-lo e
    // a trava recusaria — a regra certa, mas não a que este teste mede.
    await definirAcessoFinanceiro({
      alvoId: recepcaoId,
      euId: chefeId,
      acessoFinanceiro: true,
    });

    await definirAcessoFinanceiro({
      alvoId: chefeId,
      euId: recepcaoId,
      acessoFinanceiro: false,
    });

    expect((await adminDoToken(token))?.acessoFinanceiro).toBe(false);
  });
});

describe("as rotas do Financeiro recusam quem não tem acesso", () => {
  it("recusa ler as categorias", async () => {
    const resposta = await getCategorias(
      pedidoGet("/api/admin/financeiro/categorias", {}, { cookie: cookieDaRecepcao }),
    );

    expect(resposta.status).toBe(403);
    expect((await resposta.json()).codigo).toBe("SEM_ACESSO_FINANCEIRO");
  });

  it("recusa abrir o painel do financeiro", async () => {
    const resposta = await getPainel(
      pedidoGet("/api/admin/financeiro/painel", {}, { cookie: cookieDaRecepcao }),
    );

    expect(resposta.status).toBe(403);
  });

  /**
   * NÃO BASTA A MENSAGEM: o que importa é que nada foi gravado. Uma recusa
   * que responde 403 depois de lançar a conta seria pior do que nenhuma.
   */
  it("recusa lançar uma conta, e nada é gravado", async () => {
    const categorias = await listarCategorias({ somenteAtivas: true });
    const antes = await bancoDeTeste.lancamento.count();

    const resposta = await postLancamento(
      pedidoPost(
        "/api/admin/financeiro/lancamentos",
        {
          descricao: "conta que não devia existir",
          valor: "100.00",
          categoriaId: categorias[0]?.id,
          vencimento: ONTEM,
        },
        { cookie: cookieDaRecepcao },
      ),
    );

    expect(resposta.status).toBe(403);
    expect(await bancoDeTeste.lancamento.count()).toBe(antes);
  });

  it("é 403, e não 401: a pessoa ESTÁ logada", async () => {
    // Com 401 a tela a mandaria para o login, ela entraria de novo, seria
    // recusada de novo — um laço sem explicação.
    const semSessao = await getCategorias(pedidoGet("/api/admin/financeiro/categorias"));
    expect(semSessao.status).toBe(401);
  });

  it("quem tem acesso total passa normalmente", async () => {
    const resposta = await getCategorias(
      pedidoGet("/api/admin/financeiro/categorias", {}, { cookie: cookieDoChefe }),
    );

    expect(resposta.status).toBe(200);
  });
});

describe("quem não vê o financeiro não administra usuários", () => {
  /**
   * A AMARRAÇÃO QUE FAZ O FILTRO VALER. Sem ela a recepcionista se promove
   * sozinha, e o controle inteiro vira enfeite.
   */
  it("recusa listar os usuários", async () => {
    const resposta = await getUsuarios(
      pedidoGet("/api/admin/usuarios", {}, { cookie: cookieDaRecepcao }),
    );

    expect(resposta.status).toBe(403);
  });

  it("recusa criar um acesso novo, e nenhuma conta nasce", async () => {
    const resposta = await postUsuario(
      pedidoPost(
        "/api/admin/usuarios",
        { nome: "Conta Pirata", usuario: `${PREFIXO}.pirata`, senha: "senha-boa-12345" },
        { cookie: cookieDaRecepcao },
      ),
    );

    expect(resposta.status).toBe(403);
    expect(
      await bancoDeTeste.usuario.count({ where: { usuario: `${PREFIXO}.pirata` } }),
    ).toBe(0);
  });

  it("recusa se promover sozinha, e o nível fica como estava", async () => {
    const resposta = await patchUsuario(
      pedidoPost(
        `/api/admin/usuarios/${recepcaoId}`,
        { acessoFinanceiro: true },
        { cookie: cookieDaRecepcao },
      ),
      contexto(recepcaoId),
    );

    expect(resposta.status).toBe(403);
    expect(
      (
        await bancoDeTeste.usuario.findUniqueOrThrow({
          where: { id: recepcaoId },
          select: { acessoFinanceiro: true },
        })
      ).acessoFinanceiro,
    ).toBe(false);
  });

  it("mas quem tem acesso total administra normalmente", async () => {
    const resposta = await getUsuarios(
      pedidoGet("/api/admin/usuarios", {}, { cookie: cookieDoChefe }),
    );

    expect(resposta.status).toBe(200);
  });
});

describe('"Recebi no balcão" continua liberado', () => {
  /**
   * DECISÃO DO DONO: é a recepcionista quem recebe o dinheiro no balcão. Ela
   * registra que recebeu — e continua sem enxergar o caixa.
   */
  it("a recepção registra o recebimento de uma reserva", async () => {
    const reservaId = await umaReserva();

    const resposta = await postRecebimento(
      pedidoPost(`/api/admin/reservas/${reservaId}/recebimento`, {}, {
        cookie: cookieDaRecepcao,
      }),
      contexto(reservaId),
    );

    expect(resposta.status).toBeLessThan(300);
    expect(await bancoDeTeste.lancamento.count({ where: { reservaId } })).toBe(1);
  });

  it("e mesmo assim não consegue abrir o caixa", async () => {
    const resposta = await getPainel(
      pedidoGet("/api/admin/financeiro/painel", {}, { cookie: cookieDaRecepcao }),
    );

    expect(resposta.status).toBe(403);
  });
});

describe("as travas que impedem a equipe de se trancar do lado de fora", () => {
  it("ninguém tira o próprio acesso, e ele fica intacto", async () => {
    const antes = await bancoDeTeste.usuario.findUniqueOrThrow({
      where: { id: chefeId },
    });

    const resultado = await definirAcessoFinanceiro({
      alvoId: chefeId,
      euId: chefeId,
      acessoFinanceiro: false,
    });

    expect(resultado.ok).toBe(false);
    expect(await bancoDeTeste.usuario.findUniqueOrThrow({ where: { id: chefeId } })).toEqual(
      antes,
    );
  });

  it("a última pessoa com o acesso não o perde — mas com duas, passa", async () => {
    // A PREMISSA, dita em voz alta: neste banco o chefe é a única pessoa
    // ativa com o acesso. Se um dia outro arquivo de teste deixar um usuário
    // para trás, é aqui que isso aparece — e com o motivo na cara.
    expect(
      await bancoDeTeste.usuario.count({
        where: { ativo: true, acessoFinanceiro: true },
      }),
    ).toBe(1);

    const recusado = await definirAcessoFinanceiro({
      alvoId: chefeId,
      euId: recepcaoId,
      acessoFinanceiro: false,
    });

    expect(recusado.ok).toBe(false);
    expect(
      (
        await bancoDeTeste.usuario.findUniqueOrThrow({
          where: { id: chefeId },
          select: { acessoFinanceiro: true },
        })
      ).acessoFinanceiro,
    ).toBe(true);

    // Com DUAS pessoas, a MESMA ação passa: a trava não é "ninguém perde o
    // acesso", é "não pode sobrar ninguém".
    await definirAcessoFinanceiro({
      alvoId: recepcaoId,
      euId: chefeId,
      acessoFinanceiro: true,
    });

    const permitido = await definirAcessoFinanceiro({
      alvoId: chefeId,
      euId: recepcaoId,
      acessoFinanceiro: false,
    });

    expect(permitido.ok).toBe(true);
  });

  it("a última pessoa com o acesso não é desligada", async () => {
    expect(
      await bancoDeTeste.usuario.count({
        where: { ativo: true, acessoFinanceiro: true },
      }),
    ).toBe(1);

    const resultado = await ligarOuDesligarUsuario({
      alvoId: chefeId,
      euId: recepcaoId,
      ativo: false,
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toContain("financeira");
    }

    expect(
      (
        await bancoDeTeste.usuario.findUniqueOrThrow({
          where: { id: chefeId },
          select: { ativo: true },
        })
      ).ativo,
    ).toBe(true);
  });
});

describe("criar acesso", () => {
  it("nasce SEM o financeiro quando a tela diz que não", async () => {
    const criado = await criarUsuario(
      {
        nome: "ZZ Nova",
        usuario: `${PREFIXO}.nova`,
        senha: "senha-boa-12345",
        acessoFinanceiro: false,
      },
      chefeId,
    );

    expect(criado.ok).toBe(true);
    if (criado.ok) {
      expect(criado.dados.acessoFinanceiro).toBe(false);
    }
  });

  /**
   * Em branco vale SIM, que é o que o sistema sempre fez: nenhuma chamada
   * antiga passa a criar gente sem acesso de um dia para o outro.
   */
  it("sem dizer nada, nasce com acesso total", async () => {
    const criado = await criarUsuario(
      { nome: "ZZ Outra", usuario: `${PREFIXO}.outra`, senha: "senha-boa-12345" },
      chefeId,
    );

    expect(criado.ok).toBe(true);
    if (criado.ok) {
      expect(criado.dados.acessoFinanceiro).toBe(true);
    }
  });
});
