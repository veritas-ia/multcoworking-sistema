/**
 * BUSCA DE CLIENTE NA RESERVA DO BALCAO — agora sobre o CADASTRO
 * (criada em 29/10/2026, reescrita na Fase 14, parte C, em 10/11/2026).
 *
 * O PROBLEMA REAL que isto conserta, medido em producao: o telefone do
 * atendimento comercial do coworking acumulou reservas de CINCO clientes
 * diferentes. O telefone e obrigatorio na reserva do balcao; quando a
 * recepcao nao tem o numero do cliente na mao, o unico sempre disponivel e o
 * da propria recepcao.
 *
 * Duas consequencias, e a segunda ninguem tinha visto: no relatorio aquilo
 * virou um "cliente" so com 28 horas, e as confirmacoes e lembretes daquelas
 * reservas foram todos para o WhatsApp da recepcao — porque as mensagens vao
 * para o telefone GRAVADO na reserva.
 *
 * A BUSCA OLHAVA AS RESERVAS SOLTAS ate 10/11/2026. Agora olha o CADASTRO, e
 * e essa a diferenca que faz o Rafael dos dois telefones aparecer UMA vez,
 * com os dois numeros para escolher.
 *
 * O que estes testes protegem:
 *  1. achar por um pedaco do nome, sem acento e sem maiuscula;
 *  2. achar pelo telefone, formatado ou so em digitos;
 *  3. achar tambem pelo nome escrito NA RESERVA, que pode nao ser o rotulo
 *     do cadastro;
 *  4. UM cadastro com DOIS telefones aparece uma vez, com os dois — o caso
 *     do Rafael;
 *  5. telefone de BALCAO nao aparece como numero para escolher, e a pessoa
 *     que so existe la dentro aparece SEM telefone, para a recepcao pedir;
 *  6. cadastros diferentes continuam diferentes;
 *  7. cliente desligado fica de fora;
 *  8. a rota exige login — ela devolve nome e telefone inteiro de cliente.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { GET as getClientes } from "@/app/api/admin/clientes/route";
import { criarReservaNaRecepcao } from "@/lib/agenda-admin";
import { procurarClientesCadastrados } from "@/lib/clientes";
import { juntarClientes } from "@/lib/clientes-painel";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { normalizarTelefone, telefoneVisivel } from "@/lib/telefone";
import { marcarTelefoneDeBalcao } from "@/lib/telefones-balcao";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";
import { pedidoGet } from "./apoio/requisicao";

/** O telefone "de balcao" do teste: varias pessoas no mesmo numero. */
const BALCAO = "+5511900000801";
const DO_RAFAEL = "+5511900000802";
const DA_CARLA = "+5511900000803";
/** O segundo número do Rafael, para o caso dos dois telefones. */
const DO_RAFAEL_2 = "+5511900000804";
const TELEFONES = [BALCAO, DO_RAFAEL, DA_CARLA, DO_RAFAEL_2];

function proximaSegunda(): string {
  const data = new Date();
  data.setUTCDate(data.getUTCDate() + 3);
  while (data.getUTCDay() !== 1) {
    data.setUTCDate(data.getUTCDate() + 1);
  }
  return data.toISOString().slice(0, 10);
}

const DIA = proximaSegunda();

let salaId: string;
let salaContainer: string;
let operador: { id: string; nome: string };
let cookie: string;

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
    where: { usuario: "zz.busca.cliente" },
    create: { nome: "Admin de Teste", usuario: "zz.busca.cliente", senhaHash: "x" },
    update: {},
    select: { id: true, nome: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(operador.id)}`;
});

let proxima = 8;

async function reserva(telefone: string, nome: string, sala = salaId) {
  const hora = proxima++;

  const criada = await criarReservaNaRecepcao({
    salaId: sala,
    telefone,
    nomeCliente: nome,
    profissaoId: await idDaProfissao("OUTROS"),
    inicio: instanteDe(DIA, `${String(hora).padStart(2, "0")}:00`),
    fim: instanteDe(DIA, `${String(hora + 1).padStart(2, "0")}:00`),
    operador,
  });

  if (!criada.ok) {
    throw new Error(`Não criou a reserva de teste: ${criada.falha.motivo}`);
  }

  return criada.dados.id;
}

async function cadastroDe(telefone: string) {
  return bancoDeTeste.telefoneDoCliente.findUnique({
    where: { telefone },
    select: { clienteId: true },
  });
}

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: { in: TELEFONES } } });
  await bancoDeTeste.telefoneDeBalcao.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
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
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.busca.cliente" } });
  await bancoDeTeste.$disconnect();
});

/** O caso de produção em miniatura: várias pessoas num número só. */
async function telefoneDeBalcao(): Promise<void> {
  await marcarTelefoneDeBalcao(BALCAO, "Atendimento comercial", operador.id);
  await reserva(BALCAO, "Toca");
  await reserva(BALCAO, "Prestare", salaContainer);
  await reserva(BALCAO, "Miguel");
}

// -----------------------------------------------------------------------------

describe("achar o cliente pelo nome", () => {
  it("acha por um pedaço do nome", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await procurarClientesCadastrados("passos");

    expect(achados.map((cliente) => cliente.nome)).toContain("Rafael dos Passos");
  });

  it("não diferencia maiúscula nem acento", async () => {
    await reserva(DA_CARLA, "Carla Ornélas");

    for (const digitado of ["ORNELAS", "ornélas", "Ornelas", "oRnElAs"]) {
      const achados = await procurarClientesCadastrados(digitado);
      expect(
        achados.flatMap((cliente) => cliente.telefones),
        `procurando "${digitado}"`,
      ).toContain(DA_CARLA);
    }
  });

  it("acha pelo nome escrito NA RESERVA, e não só pelo oficial", async () => {
    // Quem atende lembra do nome que o cliente usou, que pode não ser o
    // rótulo do cadastro.
    await reserva(DO_RAFAEL, "Rafael dos Passos");
    const cadastro = await cadastroDe(DO_RAFAEL);
    await bancoDeTeste.cliente.update({
      where: { id: cadastro!.clienteId },
      data: { nome: "Zoroastro Oficial" },
    });

    const achados = await procurarClientesCadastrados("passos");

    expect(achados.map((cliente) => cliente.nome)).toContain("Zoroastro Oficial");
  });

  it("não devolve a base inteira quando a recepção digitou uma letra só", async () => {
    await reserva(DA_CARLA, "Carla Ornelas");

    expect(await procurarClientesCadastrados("c")).toEqual([]);
    expect(await procurarClientesCadastrados(" ")).toEqual([]);
    expect(await procurarClientesCadastrados("")).toEqual([]);
  });
});

describe("achar o cliente pelo telefone", () => {
  it("acha pelo número formatado, como a recepção digita", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await procurarClientesCadastrados("(11) 90000-0802");

    expect(achados.flatMap((cliente) => cliente.telefones)).toContain(DO_RAFAEL);
  });

  it("acha por um pedaço do número", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await procurarClientesCadastrados("0000802");

    expect(achados.flatMap((cliente) => cliente.telefones)).toContain(DO_RAFAEL);
  });
});

describe("o nome só serve para achar o cadastro", () => {
  it("achado o cadastro, vem ele inteiro e não só o que bateu", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");
    await reserva(DO_RAFAEL, "Rafael Passos", salaContainer);
    await reserva(DO_RAFAEL, "rafael");

    const achados = await procurarClientesCadastrados("dos passos");
    const dele = achados.find((cliente) => cliente.telefones.includes(DO_RAFAEL));

    expect(dele?.reservas).toBe(3);
  });

  it("mostra o nome oficial e os outros ao lado", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");
    await reserva(DO_RAFAEL, "Rafael Passos", salaContainer);

    const achados = await procurarClientesCadastrados("rafael");
    const dele = achados.find((cliente) => cliente.telefones.includes(DO_RAFAEL));

    expect(dele?.nome).toBe("Rafael dos Passos");
    expect(dele?.outrosNomes).toContain("Rafael Passos");
  });
});

describe("UM cadastro com DOIS telefones", () => {
  it("aparece UMA vez, com os dois números para escolher", async () => {
    // É o caso do Rafael, e é a diferença que a Fase 14 trouxe: antes ele
    // aparecia duas vezes, como se fossem duas pessoas.
    await reserva(DO_RAFAEL, "Rafael dos Passos");
    await reserva(DO_RAFAEL_2, "Rafael Passos", salaContainer);

    const principal = await cadastroDe(DO_RAFAEL);
    const outro = await cadastroDe(DO_RAFAEL_2);
    await juntarClientes(principal!.clienteId, outro!.clienteId);

    const achados = await procurarClientesCadastrados("rafael");
    const dele = achados.filter((cliente) =>
      cliente.telefones.some((telefone) => TELEFONES.includes(telefone)),
    );

    expect(dele).toHaveLength(1);
    expect(dele[0]?.telefones.sort()).toEqual([DO_RAFAEL, DO_RAFAEL_2]);
    expect(dele[0]?.reservas).toBe(2);
  });
});

describe("telefone de balcão", () => {
  it("não aparece como número para escolher", async () => {
    // A recepção marcou aquele número justamente porque ele não é de um
    // cliente; escolhê-lo faria a reserva nova nascer nele outra vez.
    await telefoneDeBalcao();

    const achados = await procurarClientesCadastrados("toca");

    expect(achados.flatMap((cliente) => cliente.telefones)).not.toContain(BALCAO);
  });

  it("a pessoa que só existe lá dentro aparece SEM telefone", async () => {
    // Não some: a recepção precisa ver que o Miguel existe e que falta o
    // número dele — senão acharia que o sistema perdeu o cliente.
    await telefoneDeBalcao();

    const achados = await procurarClientesCadastrados("miguel");
    const miguel = achados.find((cliente) => cliente.nome === "Miguel");

    expect(miguel).toBeDefined();
    expect(miguel?.telefones).toEqual([]);
    expect(miguel?.reservas).toBe(1);
  });
});

describe("não junta demais", () => {
  it("telefones diferentes com sobrenome igual continuam dois cadastros", async () => {
    await reserva(DO_RAFAEL, "Rafael Passos");
    await reserva(DA_CARLA, "Carla Passos", salaContainer);

    const achados = await procurarClientesCadastrados("passos");
    const dosDois = achados.filter((cliente) =>
      cliente.telefones.some((telefone) => TELEFONES.includes(telefone)),
    );

    expect(dosDois).toHaveLength(2);
  });

  it("cliente desligado fica de fora da escolha", async () => {
    await reserva(DA_CARLA, "Carla Ornelas");
    const cadastro = await cadastroDe(DA_CARLA);
    await bancoDeTeste.cliente.update({
      where: { id: cadastro!.clienteId },
      data: { ativo: false },
    });

    const achados = await procurarClientesCadastrados("ornelas");

    expect(achados).toHaveLength(0);
  });
});

describe("o telefone do cliente escolhido chega inteiro no formulário", () => {
  it("vai e volta sem perder dígito", async () => {
    // A ARMADILHA, pega escrevendo este código: o banco guarda
    // "+5511900000802" e o campo da tela mostra "(11) 90000-0802". Usando o
    // formatador que roda a cada tecla, o número seria cortado no 11º dígito
    // e o "55" do país entraria como DDD — a reserva nasceria com o telefone
    // errado e o campo pareceria preenchido.
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await procurarClientesCadastrados("passos");
    const dele = achados.find((cliente) => cliente.telefones.includes(DO_RAFAEL));

    const noCampo = telefoneVisivel(dele!.telefones[0]!);

    expect(noCampo).toBe("(11) 90000-0802");
    expect(normalizarTelefone(noCampo)).toBe(DO_RAFAEL);
    // O campo só libera o botão de criar a partir de 14 caracteres.
    expect(noCampo.length).toBeGreaterThanOrEqual(14);
  });
});

describe("GET /api/admin/clientes", () => {
  it("devolve a lista para quem está logado", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const resposta = await getClientes(
      pedidoGet("/api/admin/clientes", { q: "passos" }, { cookie }),
    );
    const corpo = await resposta.json();

    expect(resposta.status).toBe(200);
    expect(
      corpo.clientes.map((cliente: { nome: string }) => cliente.nome),
    ).toContain("Rafael dos Passos");
  });

  it("não responde para quem não está logado", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const resposta = await getClientes(pedidoGet("/api/admin/clientes", { q: "passos" }));

    expect(resposta.status).toBe(401);
    expect(JSON.stringify(await resposta.json())).not.toContain("Rafael");
  });

  it("continua respondendo o uso antigo, por telefone exato", async () => {
    // A tela já usava isto para preencher o nome sozinha enquanto a recepção
    // digita o número. Trocar a busca não pode ter quebrado o caminho.
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const resposta = await getClientes(
      pedidoGet("/api/admin/clientes", { telefone: DO_RAFAEL }, { cookie }),
    );

    await expect(resposta.json()).resolves.toMatchObject({
      nome: "Rafael dos Passos",
    });
  });
});
