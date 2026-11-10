/**
 * BUSCA DE CLIENTE NA RESERVA DO BALCAO (29/10/2026).
 *
 * O PROBLEMA REAL que isto conserta, medido em producao: o telefone do
 * atendimento comercial do coworking acumulou 14 reservas de QUATRO clientes
 * diferentes (Toca, Prestare, Matheus Toca e Rafael Passos). O telefone e
 * obrigatorio na reserva do balcao; quando a recepcao nao tem o numero do
 * cliente na mao, o unico sempre disponivel e o da propria recepcao.
 *
 * Duas consequencias, e a segunda ninguem tinha visto: no relatorio aquilo
 * virou um "cliente" so com 28 horas, e as confirmacoes e lembretes das 14
 * reservas foram todos para o WhatsApp da recepcao — porque as mensagens vao
 * para o telefone GRAVADO na reserva.
 *
 * O que estes testes protegem:
 *  1. achar o cliente por um pedaco do nome, sem acento e sem maiuscula;
 *  2. achar pelo telefone, formatado ou so em digitos;
 *  3. O NOME SO SERVE PARA ACHAR O TELEFONE: achado o numero, vem o cliente
 *     INTEIRO, com todas as reservas dele — a mesma regra da busca do
 *     relatorio, que ja mentiu uma vez por somar so o que batia com o nome;
 *  4. os outros nomes do mesmo numero aparecem, porque e isso que mostra para
 *     a recepcao que aquele telefone e de varias pessoas;
 *  5. telefones diferentes continuam sendo clientes diferentes;
 *  6. termo curto demais nao devolve a base inteira;
 *  7. a rota exige login — ela devolve nome e telefone inteiro de cliente.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { GET as getClientes } from "@/app/api/admin/clientes/route";
import { procurarClientesConhecidos } from "@/lib/clientes";
import {
  desmarcarTelefoneDeBalcao,
  marcarTelefoneDeBalcao,
} from "@/lib/telefones-balcao";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";
import { normalizarTelefone, telefoneVisivel } from "@/lib/telefone";
import { instanteDe } from "@/lib/tempo";

import { aquecerConexao, bancoDeTeste, idDaProfissao } from "./apoio/banco";
import { pedidoGet } from "./apoio/requisicao";

/** O telefone "de balcao" do teste: varias pessoas no mesmo numero. */
const BALCAO = "+5511900000801";
const DO_RAFAEL = "+5511900000802";
const DA_CARLA = "+5511900000803";
const TELEFONES = [BALCAO, DO_RAFAEL, DA_CARLA];

const DIA = "2026-11-10";

let salaId: string;
let cookie: string;

beforeAll(async () => {
  await aquecerConexao();
  const sala = await bancoDeTeste.sala.findFirstOrThrow({
    orderBy: { ordem: "asc" },
    select: { id: true },
  });
  salaId = sala.id;

  const admin = await bancoDeTeste.usuario.upsert({
    where: { usuario: "zz.busca.cliente" },
    create: { nome: "Admin de Teste", usuario: "zz.busca.cliente", senhaHash: "x" },
    update: {},
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(admin.id)}`;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.reserva.deleteMany({ where: { telefone: { in: TELEFONES } } });
  await bancoDeTeste.telefoneDeBalcao.deleteMany({
    where: { telefone: { in: TELEFONES } },
  });
  horaDoDia.clear();
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: "zz.busca.cliente" } });
  await bancoDeTeste.$disconnect();
});

/**
 * Uma reserva de um telefone com um nome.
 *
 * Cada chamada pega uma hora diferente DENTRO DO DIA: duas reservas no mesmo
 * horario e na mesma sala sao recusadas pelo banco. O contador e por dia para
 * nao estourar as 24 horas quando um teste cria varias reservas.
 */
const horaDoDia = new Map<string, number>();

async function reserva(telefone: string, nome: string, dia = DIA) {
  const proxima = horaDoDia.get(dia) ?? 8;
  horaDoDia.set(dia, proxima + 1);
  const hora = String(proxima).padStart(2, "0");

  return bancoDeTeste.reserva.create({
    data: {
      salaId,
      nomeCliente: nome,
      telefone,
      profissaoId: await idDaProfissao("OUTROS"),
      inicio: instanteDe(dia, `${hora}:00`),
      fim: instanteDe(dia, `${hora}:30`),
      duracaoMinutos: 30,
      valor: "20.00",
      origem: "ADMIN",
      confirmacaoEnviadaEm: new Date(),
    },
  });
}

/** A lista de escolha da busca, que e o que quase todo teste daqui olha. */
async function achadosDa(termo: string) {
  return (await procurarClientesConhecidos(termo)).clientes;
}

/** O caso de producao, em miniatura: quatro clientes num numero so. */
async function telefoneDeBalcao(): Promise<void> {
  await reserva(BALCAO, "Toca", "2026-11-10");
  await reserva(BALCAO, "Toca", "2026-11-11");
  await reserva(BALCAO, "Prestare", "2026-11-12");
  await reserva(BALCAO, "Rafael Passos", "2026-11-13");
}

// -----------------------------------------------------------------------------

describe("achar o cliente pelo nome", () => {
  it("acha por um pedaço do nome", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await achadosDa("passos");

    expect(achados.map((cliente) => cliente.telefone)).toContain(DO_RAFAEL);
  });

  it("não diferencia maiúscula nem acento", async () => {
    await reserva(DA_CARLA, "Carla Ornélas");

    for (const digitado of ["ORNELAS", "ornélas", "Ornelas", "oRnElAs"]) {
      const achados = await achadosDa(digitado);
      expect(
        achados.map((cliente) => cliente.telefone),
        `procurando "${digitado}"`,
      ).toContain(DA_CARLA);
    }
  });

  it("não devolve a base inteira quando a recepção digitou uma letra só", async () => {
    await reserva(DA_CARLA, "Carla Ornelas");

    expect(await achadosDa("c")).toEqual([]);
    expect(await achadosDa(" ")).toEqual([]);
    expect(await achadosDa("")).toEqual([]);
  });
});

describe("achar o cliente pelo telefone", () => {
  it("acha pelo número formatado, como a recepção digita", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await achadosDa("(11) 90000-0802");

    expect(achados.map((cliente) => cliente.telefone)).toContain(DO_RAFAEL);
  });

  it("acha por um pedaço do número", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await achadosDa("0000802");

    expect(achados.map((cliente) => cliente.telefone)).toContain(DO_RAFAEL);
  });
});

describe("o nome só serve para achar o telefone", () => {
  it("achado o número, vem o cliente INTEIRO e não só o que bateu", async () => {
    // Mesma armadilha que fez a busca do relatorio mentir em 29/10/2026:
    // filtrar as reservas pelo nome e contar so aquelas. Aqui a pessoa
    // escreveu o proprio nome de dois jeitos.
    await reserva(DO_RAFAEL, "Rafael dos Passos");
    await reserva(DO_RAFAEL, "Rafael Passos");
    await reserva(DO_RAFAEL, "rafael");

    const achados = await achadosDa("dos passos");
    const dele = achados.find((cliente) => cliente.telefone === DO_RAFAEL);

    expect(dele?.reservas).toBe(3);
  });

  it("mostra o nome da PRIMEIRA reserva e os outros ao lado", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos", "2026-11-10");
    await reserva(DO_RAFAEL, "Rafael Passos", "2026-11-11");

    const achados = await achadosDa("rafael");
    const dele = achados.find((cliente) => cliente.telefone === DO_RAFAEL);

    expect(dele?.nome).toBe("Rafael dos Passos");
    expect(dele?.outrosNomes).toContain("Rafael Passos");
  });
});

describe("o telefone de balcão aparece com a cara dele", () => {
  it("mostra os QUATRO nomes do mesmo número", async () => {
    // Sem isto a recepcao escolheria aquele numero sem perceber que ele e de
    // varias pessoas, e a reserva nova iria para o telefone errado de novo.
    await telefoneDeBalcao();

    const achados = await achadosDa("toca");
    const balcao = achados.find((cliente) => cliente.telefone === BALCAO);

    expect(balcao?.nome).toBe("Toca");
    expect(balcao?.outrosNomes).toContain("Prestare");
    expect(balcao?.outrosNomes).toContain("Rafael Passos");
    expect(balcao?.reservas).toBe(4);
  });

  it("procurar 'rafael' acha tanto o número dele quanto o do balcão", async () => {
    // Os dois precisam aparecer, e com o telefone inteiro na tela: e assim
    // que a recepcao escolhe o do cliente, e nao o da casa.
    await telefoneDeBalcao();
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await achadosDa("rafael");
    const telefones = achados.map((cliente) => cliente.telefone);

    expect(telefones).toContain(DO_RAFAEL);
    expect(telefones).toContain(BALCAO);
  });
});

describe("o telefone do cliente escolhido chega inteiro no formulário", () => {
  it("vai e volta sem perder dígito", async () => {
    // A ARMADILHA, pega escrevendo este codigo: o banco guarda
    // "+5511900000802" e o campo da tela mostra "(11) 90000-0802". Usando o
    // formatador que roda a cada tecla, o numero seria cortado no 11o digito
    // e o "55" do pais entraria como DDD — a reserva nasceria com o telefone
    // errado e ninguem repararia, porque o campo pareceria preenchido.
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const achados = await achadosDa("passos");
    const dele = achados.find((cliente) => cliente.telefone === DO_RAFAEL);

    const noCampo = telefoneVisivel(dele!.telefone);

    expect(noCampo).toBe("(11) 90000-0802");
    // E o que o servidor vai guardar a partir do campo e o MESMO numero.
    expect(normalizarTelefone(noCampo)).toBe(DO_RAFAEL);
    // O campo so libera o botao de criar a partir de 14 caracteres.
    expect(noCampo.length).toBeGreaterThanOrEqual(14);
  });

  it("o do balcão também, para a equipe reconhecer o número na lista", async () => {
    await telefoneDeBalcao();

    const achados = await achadosDa("prestare");
    const balcao = achados.find((cliente) => cliente.telefone === BALCAO);

    expect(telefoneVisivel(balcao!.telefone)).toBe("(11) 90000-0801");
  });
});

describe("telefone MARCADO como balcão sai da lista de escolha", () => {
  async function marcarOBalcao(): Promise<void> {
    const feito = await marcarTelefoneDeBalcao(
      BALCAO,
      "Atendimento comercial do coworking",
      null,
    );
    expect(feito.ok).toBe(true);
  }

  it("não oferece o número do balcão para escolher", async () => {
    // Escolher aquele numero faria a reserva nova nascer no telefone da
    // recepcao OUTRA VEZ — o erro que esta tela veio impedir.
    await telefoneDeBalcao();
    await marcarOBalcao();

    const achados = await achadosDa("toca");

    expect(achados.map((cliente) => cliente.telefone)).not.toContain(BALCAO);
  });

  it("avisa quando o nome só existe dentro do número do balcão", async () => {
    // O caso do "Miguel" em producao: uma reserva lancada no numero da casa
    // e nenhum telefone proprio. Sumir calado faria a recepcao achar que o
    // sistema perdeu o cliente.
    await telefoneDeBalcao();
    await marcarOBalcao();

    const resultado = await procurarClientesConhecidos("prestare");

    expect(resultado.clientes).toHaveLength(0);
    expect(resultado.soNoTelefoneDeBalcao).toContain("Prestare");
  });

  it("NÃO avisa quando a pessoa também tem telefone próprio", async () => {
    // Aqui a recepcao ja tem o que escolher: o aviso seria ruido.
    await telefoneDeBalcao();
    await reserva(DO_RAFAEL, "Rafael Passos");
    await marcarOBalcao();

    const resultado = await procurarClientesConhecidos("rafael");

    expect(resultado.clientes.map((cliente) => cliente.telefone)).toEqual([
      DO_RAFAEL,
    ]);
    expect(resultado.soNoTelefoneDeBalcao).toHaveLength(0);
  });

  it("os outros telefones continuam aparecendo normalmente", async () => {
    await telefoneDeBalcao();
    await reserva(DA_CARLA, "Carla Ornelas");
    await marcarOBalcao();

    const achados = await achadosDa("carla");

    expect(achados.map((cliente) => cliente.telefone)).toContain(DA_CARLA);
  });

  it("desmarcar devolve o número à lista", async () => {
    await telefoneDeBalcao();
    await marcarOBalcao();
    expect(await achadosDa("toca")).toHaveLength(0);

    await desmarcarTelefoneDeBalcao(BALCAO);

    expect((await achadosDa("toca")).map((cliente) => cliente.telefone)).toContain(
      BALCAO,
    );
  });
});

describe("não junta demais", () => {
  it("dois telefones diferentes com sobrenome igual continuam dois clientes", async () => {
    await reserva(DO_RAFAEL, "Rafael Passos");
    await reserva(DA_CARLA, "Carla Passos");

    const achados = await achadosDa("passos");
    const dosDois = achados.filter((cliente) =>
      [DO_RAFAEL, DA_CARLA].includes(cliente.telefone),
    );

    expect(dosDois).toHaveLength(2);
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
      corpo.clientes.map((cliente: { telefone: string }) => cliente.telefone),
    ).toContain(DO_RAFAEL);
  });

  it("não responde para quem não está logado", async () => {
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const resposta = await getClientes(pedidoGet("/api/admin/clientes", { q: "passos" }));

    expect(resposta.status).toBe(401);
    expect(JSON.stringify(await resposta.json())).not.toContain("Rafael");
  });

  it("continua respondendo o uso antigo, por telefone exato", async () => {
    // A tela ja usava isto para preencher o nome sozinha enquanto a recepcao
    // digita o numero. Acrescentar a busca nao pode ter quebrado o caminho.
    await reserva(DO_RAFAEL, "Rafael dos Passos");

    const resposta = await getClientes(
      pedidoGet("/api/admin/clientes", { telefone: DO_RAFAEL }, { cookie }),
    );

    await expect(resposta.json()).resolves.toMatchObject({
      nome: "Rafael dos Passos",
    });
  });
});
