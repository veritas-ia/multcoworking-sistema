/**
 * Testes das ROTAS NOVAS DA FASE 5: sessao, agenda e o slug em /salas.
 *
 * Sao as tres pecas que a tela publica precisa e a Fase 4 nao tinha.
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { GET as getAgenda } from "@/app/api/publico/agenda/route";
import { GET as getSalas } from "@/app/api/publico/salas/route";
import {
  DELETE as deleteSessao,
  GET as getSessao,
} from "@/app/api/publico/sessao/route";
import {
  COOKIE_SESSAO,
  criarSessao,
  embaralhar,
} from "@/lib/sessao-cliente";
import { formatarEnquantoDigita, mascararTelefone } from "@/lib/telefone";
import { variavelParecidaPreenchida } from "@/lib/whatsapp";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoDelete, pedidoGet } from "./apoio/requisicao";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");

const TELEFONE = "+5511900000001";

beforeAll(aquecerConexao);

afterEach(async () => {
  vi.useRealTimers();
  await bancoDeTeste.sessaoCliente.deleteMany({ where: { telefone: TELEFONE } });
});

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

async function cookieDeSessao(): Promise<string> {
  const sessao = await criarSessao(TELEFONE);
  return `${COOKIE_SESSAO}=${sessao.token}`;
}

// -----------------------------------------------------------------------------

describe("GET /api/publico/sessao", () => {
  it("diz que ninguem esta identificado quando nao ha cookie", async () => {
    const resposta = await getSessao(pedidoGet("/api/publico/sessao"));

    expect(resposta.status).toBe(200);
    await expect(resposta.json()).resolves.toEqual({
      identificado: false,
      telefoneMascarado: null,
    });
  });

  it("devolve o telefone MASCARADO de quem tem cookie valido", async () => {
    const resposta = await getSessao(
      pedidoGet("/api/publico/sessao", {}, { cookie: await cookieDeSessao() }),
    );
    const corpo = await resposta.json();

    expect(corpo.identificado).toBe(true);
    expect(corpo.telefoneMascarado).toBe("(11) 9****-0001");
  });

  it("nunca deixa o telefone inteiro vazar na resposta", async () => {
    const resposta = await getSessao(
      pedidoGet("/api/publico/sessao", {}, { cookie: await cookieDeSessao() }),
    );

    const texto = JSON.stringify(await resposta.json());
    expect(texto).not.toContain("900000001");
    expect(texto).not.toContain(TELEFONE);
  });

  it("nao identifica ninguem com cookie inventado", async () => {
    const resposta = await getSessao(
      pedidoGet("/api/publico/sessao", {}, { cookie: `${COOKIE_SESSAO}=nao-existe` }),
    );

    await expect(resposta.json()).resolves.toMatchObject({ identificado: false });
  });

  it("nao identifica ninguem com sessao vencida", async () => {
    const sessao = await criarSessao(TELEFONE);
    await bancoDeTeste.sessaoCliente.update({
      where: { tokenHash: embaralhar(sessao.token) },
      data: { expiraEm: new Date(Date.now() - 1_000) },
    });

    const resposta = await getSessao(
      pedidoGet(
        "/api/publico/sessao",
        {},
        { cookie: `${COOKIE_SESSAO}=${sessao.token}` },
      ),
    );

    await expect(resposta.json()).resolves.toMatchObject({ identificado: false });
  });
});

describe("DELETE /api/publico/sessao (o 'trocar numero')", () => {
  it("apaga a sessao do banco e manda o navegador jogar o cookie fora", async () => {
    const sessao = await criarSessao(TELEFONE);
    const cookie = `${COOKIE_SESSAO}=${sessao.token}`;

    const resposta = await deleteSessao(
      pedidoDelete("/api/publico/sessao", { cookie }),
    );

    expect(resposta.status).toBe(200);

    const cookieDeVolta = resposta.cookies.get(COOKIE_SESSAO);
    expect(cookieDeVolta?.value).toBe("");
    expect(cookieDeVolta?.maxAge).toBe(0);

    const noBanco = await bancoDeTeste.sessaoCliente.findUnique({
      where: { tokenHash: embaralhar(sessao.token) },
    });
    expect(noBanco).toBeNull();

    // E o cookie antigo nao vale mais nem se alguem guardou o valor.
    const depois = await getSessao(pedidoGet("/api/publico/sessao", {}, { cookie }));
    await expect(depois.json()).resolves.toMatchObject({ identificado: false });
  });

  it("nao reclama quando nao havia sessao nenhuma", async () => {
    const resposta = await deleteSessao(pedidoDelete("/api/publico/sessao"));
    expect(resposta.status).toBe(200);
  });
});

describe("GET /api/publico/agenda", () => {
  it("lista os dias fechados: hoje, so o domingo", async () => {
    const corpo = await (await getAgenda()).json();

    // A sexta abriu junto com a ampliacao do expediente ate as 22h.
    expect(corpo.diasFechados).toContain(0);
    expect(corpo.diasFechados).not.toContain(5);
    expect(corpo.diasFechados).not.toContain(1);
    expect(corpo.diasFechados).not.toContain(6);
  });

  it("abre a janela de reserva a partir da antecedencia minima", async () => {
    vi.useFakeTimers();
    // 23:30 em Sao Paulo: somando 60 min de antecedencia, o primeiro dia
    // possivel ja e o dia SEGUINTE. E o caso que pega erro de fuso.
    vi.setSystemTime(new Date("2026-10-06T02:30:00.000Z"));

    const corpo = await (await getAgenda()).json();

    expect(corpo.primeiraData).toBe("2026-10-06");
    expect(corpo.antecedenciaMinimaMinutos).toBe(60);
  });

  it("fecha a janela na antecedencia maxima de 60 dias", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);

    const corpo = await (await getAgenda()).json();

    expect(corpo.primeiraData).toBe("2026-10-05");
    expect(corpo.ultimaData).toBe("2026-12-04");
    expect(corpo.antecedenciaMaximaDias).toBe(60);
  });

  it("entrega a regra das 12h para a tela mostrar a politica", async () => {
    const corpo = await (await getAgenda()).json();

    expect(corpo.janelaCancelamentoHoras).toBe(12);
    expect(corpo.duracaoMinimaMinutos).toBe(60);
  });

  it("informa o horario de cada dia aberto", async () => {
    const corpo = await (await getAgenda()).json();

    expect(corpo.diasAbertos).toContainEqual({
      diaDaSemana: 1,
      horaAbertura: "08:00",
      horaFechamento: "22:00",
    });
    expect(corpo.diasAbertos).toContainEqual({
      diaDaSemana: 6,
      horaAbertura: "09:00",
      horaFechamento: "13:00",
    });
  });
});

describe("GET /api/publico/salas", () => {
  it("devolve o slug, para o link ?sala=... funcionar", async () => {
    const corpo = await (await getSalas()).json();
    const slugs = corpo.salas.map((sala: { slug: string }) => sala.slug);

    expect(slugs).toContain("sala-container");
    expect(slugs).toContain("sala-ci");
    expect(slugs).toContain("sala-de-reuniao");
  });
});

describe("telefone na tela", () => {
  it("esconde o miolo do numero", () => {
    expect(mascararTelefone("+5511987654321")).toBe("(11) 9****-4321");
    expect(mascararTelefone("11987654321")).toBe("(11) 9****-4321");
  });

  it("devolve vazio quando o numero nao tem o tamanho certo", () => {
    expect(mascararTelefone("+551198765")).toBe("");
  });

  it("vai formatando enquanto a pessoa digita", () => {
    expect(formatarEnquantoDigita("1")).toBe("1");
    expect(formatarEnquantoDigita("11")).toBe("11");
    expect(formatarEnquantoDigita("119")).toBe("(11) 9");
    expect(formatarEnquantoDigita("1198765")).toBe("(11) 98765");
    expect(formatarEnquantoDigita("11987654321")).toBe("(11) 98765-4321");
  });

  it("ignora o que passar de 11 digitos e o que nao for numero", () => {
    expect(formatarEnquantoDigita("(11) 98765-4321999")).toBe("(11) 98765-4321");
  });
});

describe("armadilha do nome da variável do WhatsApp", () => {
  it("avisa quando o .env tem EVOLUTION_API_URL em vez de EVOLUTION_URL", () => {
    expect(
      variavelParecidaPreenchida({
        EVOLUTION_API_URL: "https://evolution.exemplo.com.br",
      }),
    ).toBe("EVOLUTION_API_URL");
  });

  it("fica quieto quando EVOLUTION_URL está preenchida de verdade", () => {
    expect(
      variavelParecidaPreenchida({
        EVOLUTION_URL: "https://evolution.exemplo.com.br",
        EVOLUTION_API_URL: "https://evolution.exemplo.com.br",
      }),
    ).toBeNull();
  });

  it("fica quieto quando não há nada configurado (modo simulado normal)", () => {
    expect(variavelParecidaPreenchida({})).toBeNull();
  });

  it("não se confunde com variável preenchida só de espaços", () => {
    expect(variavelParecidaPreenchida({ EVOLUTION_API_URL: "   " })).toBeNull();
  });
});
