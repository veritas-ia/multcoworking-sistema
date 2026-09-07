/**
 * Testes das ROTAS DA AREA PUBLICA (Fase 4).
 *
 * As rotas sao chamadas direto, sem subir servidor. O relogio fica congelado.
 * O WhatsApp roda em MODO SIMULADO: nenhuma mensagem sai de verdade.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as getDisponibilidade } from "@/app/api/publico/disponibilidade/route";
import { POST as postReservas } from "@/app/api/publico/reservas/route";
import { GET as getSalas } from "@/app/api/publico/salas/route";
import { GET as getTerminos } from "@/app/api/publico/terminos/route";
import { POST as postConfirmar } from "@/app/api/publico/verificacao/confirmar/route";
import { POST as postEnviar } from "@/app/api/publico/verificacao/enviar/route";
import { OrigemReserva } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { COOKIE_SESSAO, criarSessao } from "@/lib/sessao-cliente";
import { instanteDe } from "@/lib/tempo";
import { aguardarEnviosPendentes, renderizarTemplate } from "@/lib/whatsapp";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPost } from "./apoio/requisicao";

/** Segunda-feira, 09:00 em Sao Paulo. */
const AGORA = new Date("2026-10-05T12:00:00.000Z");
const TERCA = "2026-10-06";
const QUARTA = "2026-10-07";

const TELEFONE = "+5511900000001";
const TELEFONE_DIGITADO = "(11) 90000-0001";
const OUTRO_TELEFONE = "+5511900000002";

let salaCI: string;
let salaContainer: string;

async function limpar(): Promise<void> {
  // Nenhum envio pode estar no ar durante a limpeza: senao o INSERT do log
  // e o DELETE da reserva disputam a mesma linha e a suite trava.
  await aguardarEnviosPendentes();
  await bancoDeTeste.logMensagem.deleteMany({
    where: { telefone: { in: [TELEFONE, OUTRO_TELEFONE] } },
  });
  await bancoDeTeste.reserva.deleteMany({
    where: { telefone: { in: [TELEFONE, OUTRO_TELEFONE] } },
  });
  await bancoDeTeste.codigoVerificacao.deleteMany({
    where: { telefone: { in: [TELEFONE, OUTRO_TELEFONE] } },
  });
  await bancoDeTeste.sessaoCliente.deleteMany({
    where: { telefone: { in: [TELEFONE, OUTRO_TELEFONE] } },
  });
}

/** Cria uma sessao ja verificada e devolve o cabecalho de cookie. */
async function cookieDeSessao(telefone = TELEFONE): Promise<string> {
  const sessao = await criarSessao(telefone);
  return `${COOKIE_SESSAO}=${sessao.token}`;
}

function corpoDeReserva(extra: Record<string, unknown> = {}) {
  return {
    salaId: salaCI,
    data: TERCA,
    inicio: "10:00",
    fim: "11:00",
    nome: "Cliente de Teste",
    aceitePolitica: true,
    ...extra,
  };
}

beforeAll(async () => {
  await aquecerConexao();

  const salas = await bancoDeTeste.sala.findMany({
    where: { slug: { in: ["sala-ci", "sala-container"] } },
  });
  const porSlug = new Map(salas.map((s) => [s.slug, s.id]));
  const ci = porSlug.get("sala-ci");
  const container = porSlug.get("sala-container");

  if (!ci || !container) {
    throw new Error('Salas do seed nao encontradas. Rode "npm run db:seed".');
  }
  salaCI = ci;
  salaContainer = container;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  // Garante o modo simulado, para nenhum teste tentar falar com a internet.
  vi.stubEnv("EVOLUTION_URL", "");
  await limpar();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await limpar();
  // As rotas usam o cliente da aplicacao; ele tambem precisa ser solto,
  // senao sobram conexoes abertas para o proximo arquivo de teste.
  await prisma.$disconnect();
  await bancoDeTeste.$disconnect();
});

// =============================================================================

describe("GET /api/publico/salas", () => {
  it("lista as salas ativas sem vazar dado nenhum de cliente", async () => {
    const resposta = await getSalas();
    const corpo = (await resposta.json()) as {
      salas: Record<string, unknown>[];
    };

    expect(resposta.status).toBe(200);
    expect(corpo.salas.length).toBeGreaterThanOrEqual(3);
    // Lista fechada de proposito: se um campo novo aparecer aqui sem passar
    // por esta linha, e porque alguem expos dado que a area publica nao pode
    // mostrar. O "slug" entrou na Fase 5, para o link ?sala=... funcionar; as
    // tarifas entraram no bloco de precos por faixa, para a tela calcular a
    // estimativa com o mesmo codigo do servidor. Preco nao e sigilo — nome,
    // telefone e motivo de bloqueio e que nao podem aparecer aqui.
    expect(Object.keys(corpo.salas[0] ?? {}).sort()).toEqual([
      "aceitaDiaria",
      "capacidade",
      "id",
      "nome",
      "pessoasParaGrupo",
      "precoDiaria",
      "precoPorHora",
      "precoPorHoraNoturno",
      "precoPorHoraNoturnoGrupo",
      "slug",
    ]);
  });
});

describe("GET /api/publico/disponibilidade", () => {
  it("devolve os blocos do dia só com horário e disponibilidade", async () => {
    const resposta = await getDisponibilidade(
      pedidoGet("/api/publico/disponibilidade", { salaId: salaCI, data: TERCA }),
    );
    const corpo = (await resposta.json()) as {
      blocos: Record<string, unknown>[];
    };

    expect(resposta.status).toBe(200);
    // 08:00 as 22:00 em blocos de 30 min = 28 blocos. O expediente foi
    // ampliado no bloco de precos por faixa, para existir horario noturno.
    expect(corpo.blocos).toHaveLength(28);
    expect(Object.keys(corpo.blocos[0] ?? {}).sort()).toEqual([
      "disponivelParaInicio",
      "horario",
    ]);
  });

  it("recusa data em formato errado", async () => {
    const resposta = await getDisponibilidade(
      pedidoGet("/api/publico/disponibilidade", { salaId: salaCI, data: "06/10/2026" }),
    );

    expect(resposta.status).toBe(400);
  });

  it("não revela o motivo de um bloqueio administrativo", async () => {
    const bloqueio = await bancoDeTeste.bloqueio.create({
      data: {
        salaId: salaCI,
        inicio: instanteDe(TERCA, "14:00"),
        fim: instanteDe(TERCA, "15:00"),
        motivo: "reforma do ar-condicionado",
      },
    });

    try {
      const resposta = await getDisponibilidade(
        pedidoGet("/api/publico/disponibilidade", { salaId: salaCI, data: TERCA }),
      );
      const texto = await resposta.text();

      expect(texto).not.toContain("reforma");
      expect(texto).not.toContain("ar-condicionado");
    } finally {
      await bancoDeTeste.bloqueio.delete({ where: { id: bloqueio.id } });
    }
  });
});

describe("GET /api/publico/terminos", () => {
  it("devolve os términos possíveis para um início", async () => {
    const resposta = await getTerminos(
      pedidoGet("/api/publico/terminos", {
        salaId: salaCI,
        data: TERCA,
        inicio: "17:00",
      }),
    );
    const corpo = (await resposta.json()) as { terminos: string[] };

    expect(resposta.status).toBe(200);
    // Comecando as 17:00, os terminos possiveis vao ate o fechamento (22:00),
    // de meia em meia hora, respeitando a duracao minima de 1 hora.
    expect(corpo.terminos[0]).toBe("18:00");
    expect(corpo.terminos.at(-1)).toBe("22:00");
  });
});

describe("POST /api/publico/verificacao/enviar", () => {
  it("aceita telefone digitado com máscara e responde de forma genérica", async () => {
    const resposta = await postEnviar(
      pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE_DIGITADO }),
    );
    const corpo = (await resposta.json()) as { mensagem: string };

    expect(resposta.status).toBe(200);
    expect(corpo.mensagem).toContain("Se o número estiver correto");

    const guardados = await bancoDeTeste.codigoVerificacao.findMany({
      where: { telefone: TELEFONE },
    });
    expect(guardados).toHaveLength(1);
  });

  it("guarda o código embaralhado, nunca em texto puro", async () => {
    await postEnviar(
      pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE }),
    );

    const registro = await bancoDeTeste.codigoVerificacao.findFirst({
      where: { telefone: TELEFONE },
    });

    expect(registro?.codigoHash).toMatch(/^\$2[aby]\$/);
    expect(registro?.codigoHash).not.toMatch(/^\d{6}$/);
  });

  it("recusa telefone inválido", async () => {
    const resposta = await postEnviar(
      pedidoPost("/api/publico/verificacao/enviar", { telefone: "123" }),
    );

    expect(resposta.status).toBe(400);
  });

  it("bloqueia o segundo pedido dentro do mesmo minuto", async () => {
    await postEnviar(pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE }));
    const segunda = await postEnviar(
      pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE }),
    );
    const corpo = (await segunda.json()) as { codigo: string };

    expect(segunda.status).toBe(429);
    expect(corpo.codigo).toBe("MUITO_RAPIDO");
  });

  it("bloqueia o sexto pedido na mesma hora", async () => {
    for (let i = 0; i < 5; i += 1) {
      vi.setSystemTime(new Date(AGORA.getTime() + i * 120_000));
      const resposta = await postEnviar(
        pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE }),
      );
      expect(resposta.status).toBe(200);
    }

    vi.setSystemTime(new Date(AGORA.getTime() + 5 * 120_000));
    const sexta = await postEnviar(
      pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE }),
    );
    const corpo = (await sexta.json()) as { codigo: string };

    expect(sexta.status).toBe(429);
    expect(corpo.codigo).toBe("LIMITE_DO_NUMERO");
  });
});

describe("POST /api/publico/verificacao/confirmar", () => {
  /** Cria um codigo conhecido, sem passar pelo sorteio. */
  async function prepararCodigo(codigo: string, telefone = TELEFONE): Promise<void> {
    const bcrypt = await import("bcryptjs");
    await bancoDeTeste.codigoVerificacao.create({
      data: {
        telefone,
        codigoHash: await bcrypt.default.hash(codigo, 10),
        expiraEm: new Date(Date.now() + 10 * 60_000),
      },
    });
  }

  it("confirma o código certo e devolve o cookie httpOnly", async () => {
    await prepararCodigo("123456");

    const resposta = await postConfirmar(
      pedidoPost("/api/publico/verificacao/confirmar", {
        telefone: TELEFONE,
        codigo: "123456",
      }),
    );

    expect(resposta.status).toBe(200);

    const cookie = resposta.cookies.get(COOKIE_SESSAO);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
  });

  it("guarda a sessão embaralhada: o valor do cookie não aparece no banco", async () => {
    await prepararCodigo("123456");

    const resposta = await postConfirmar(
      pedidoPost("/api/publico/verificacao/confirmar", {
        telefone: TELEFONE,
        codigo: "123456",
      }),
    );
    const valorDoCookie = resposta.cookies.get(COOKIE_SESSAO)?.value ?? "";

    const sessoes = await bancoDeTeste.sessaoCliente.findMany({
      where: { telefone: TELEFONE },
    });

    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]?.tokenHash).not.toBe(valorDoCookie);
    expect(sessoes[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o código só vale uma vez", async () => {
    await prepararCodigo("123456");

    const primeira = await postConfirmar(
      pedidoPost("/api/publico/verificacao/confirmar", {
        telefone: TELEFONE,
        codigo: "123456",
      }),
    );
    const segunda = await postConfirmar(
      pedidoPost("/api/publico/verificacao/confirmar", {
        telefone: TELEFONE,
        codigo: "123456",
      }),
    );

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(401);
  });

  it("errar 5 vezes mata o código e bloqueia o número por 15 minutos", async () => {
    await prepararCodigo("123456");

    for (let tentativa = 1; tentativa <= 4; tentativa += 1) {
      const resposta = await postConfirmar(
        pedidoPost("/api/publico/verificacao/confirmar", {
          telefone: TELEFONE,
          codigo: "000000",
        }),
      );
      expect(resposta.status).toBe(401);
    }

    const quinta = await postConfirmar(
      pedidoPost("/api/publico/verificacao/confirmar", {
        telefone: TELEFONE,
        codigo: "000000",
      }),
    );
    const corpoQuinta = (await quinta.json()) as { codigo: string };

    expect(quinta.status).toBe(429);
    expect(corpoQuinta.codigo).toBe("NUMERO_BLOQUEADO");

    // Agora nem o codigo CERTO funciona mais.
    const comCodigoCerto = await postConfirmar(
      pedidoPost("/api/publico/verificacao/confirmar", {
        telefone: TELEFONE,
        codigo: "123456",
      }),
    );
    expect(comCodigoCerto.status).toBe(429);

    // E nem da para pedir um codigo novo.
    const novoPedido = await postEnviar(
      pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE }),
    );
    const corpoNovo = (await novoPedido.json()) as { codigo: string };
    expect(novoPedido.status).toBe(429);
    expect(corpoNovo.codigo).toBe("NUMERO_BLOQUEADO");
  });

  it("passados os 15 minutos, o número volta a funcionar", async () => {
    await prepararCodigo("123456");

    for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
      await postConfirmar(
        pedidoPost("/api/publico/verificacao/confirmar", {
          telefone: TELEFONE,
          codigo: "000000",
        }),
      );
    }

    vi.setSystemTime(new Date(AGORA.getTime() + 16 * 60_000));

    const resposta = await postEnviar(
      pedidoPost("/api/publico/verificacao/enviar", { telefone: TELEFONE }),
    );
    expect(resposta.status).toBe(200);
  });

  it("código expirado não vale", async () => {
    await prepararCodigo("123456");
    vi.setSystemTime(new Date(AGORA.getTime() + 11 * 60_000));

    const resposta = await postConfirmar(
      pedidoPost("/api/publico/verificacao/confirmar", {
        telefone: TELEFONE,
        codigo: "123456",
      }),
    );

    expect(resposta.status).toBe(401);
  });
});

describe("POST /api/publico/reservas", () => {
  it("recusa reserva sem sessão", async () => {
    const resposta = await postReservas(
      pedidoPost("/api/publico/reservas", corpoDeReserva()),
    );
    const corpo = (await resposta.json()) as { codigo: string };

    expect(resposta.status).toBe(401);
    expect(corpo.codigo).toBe("SEM_SESSAO");
    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(0);
  });

  it("recusa reserva com cookie inventado", async () => {
    const resposta = await postReservas(
      pedidoPost("/api/publico/reservas", corpoDeReserva(), {
        cookie: `${COOKIE_SESSAO}=token-falso-qualquer`,
      }),
    );

    expect(resposta.status).toBe(401);
  });

  it("cria a reserva e congela o valor", async () => {
    const resposta = await postReservas(
      pedidoPost("/api/publico/reservas", corpoDeReserva(), {
        cookie: await cookieDeSessao(),
      }),
    );
    const corpo = (await resposta.json()) as {
      id: string;
      valorEstimado: string;
      status: string;
    };

    expect(resposta.status).toBe(201);
    // Privativa (ex-Sala CI) a R$40/h de dia, 1 hora.
    expect(corpo.valorEstimado).toBe("40.00");
    expect(corpo.status).toBe("CONFIRMADA");

    const gravada = await bancoDeTeste.reserva.findUnique({ where: { id: corpo.id } });
    expect(gravada?.telefone).toBe(TELEFONE);
    expect(gravada?.valor.toFixed(2)).toBe("40.00");
  });

  it("IGNORA o telefone enviado no corpo e usa o da sessão", async () => {
    const resposta = await postReservas(
      pedidoPost(
        "/api/publico/reservas",
        corpoDeReserva({ telefone: OUTRO_TELEFONE }),
        { cookie: await cookieDeSessao(TELEFONE) },
      ),
    );

    expect(resposta.status).toBe(201);

    expect(await bancoDeTeste.reserva.count({ where: { telefone: TELEFONE } })).toBe(1);
    expect(
      await bancoDeTeste.reserva.count({ where: { telefone: OUTRO_TELEFONE } }),
    ).toBe(0);
  });

  it("exige o aceite da política", async () => {
    const resposta = await postReservas(
      pedidoPost("/api/publico/reservas", corpoDeReserva({ aceitePolitica: false }), {
        cookie: await cookieDeSessao(),
      }),
    );
    const corpo = (await resposta.json()) as { erro: string };

    expect(resposta.status).toBe(400);
    expect(corpo.erro).toContain("política");
  });

  it("devolve 409 quando o horário já está ocupado", async () => {
    // Alguem reservou o mesmo horario antes.
    await bancoDeTeste.reserva.create({
      data: {
        salaId: salaCI,
        nomeCliente: "Outra Pessoa",
        telefone: OUTRO_TELEFONE,
        inicio: instanteDe(TERCA, "10:00"),
        fim: instanteDe(TERCA, "11:00"),
        duracaoMinutos: 60,
        valor: "50.00",
        origem: OrigemReserva.PUBLICO,
      },
    });

    const resposta = await postReservas(
      pedidoPost("/api/publico/reservas", corpoDeReserva(), {
        cookie: await cookieDeSessao(),
      }),
    );
    const corpo = (await resposta.json()) as { erro: string; codigo: string };

    expect(resposta.status).toBe(409);
    expect(corpo.codigo).toBe("HORARIO_OCUPADO");
  });

  it("duas pessoas reservando o mesmo horário ao mesmo tempo: uma passa, a outra leva 409", async () => {
    // A corrida de verdade: as duas validam com a agenda livre e so entao
    // tentam gravar. Quem decide e a trava do banco (Fase 2).
    const cookieA = await cookieDeSessao(TELEFONE);
    const cookieB = await cookieDeSessao(OUTRO_TELEFONE);

    const [respostaA, respostaB] = await Promise.all([
      postReservas(
        pedidoPost("/api/publico/reservas", corpoDeReserva(), { cookie: cookieA }),
      ),
      postReservas(
        pedidoPost("/api/publico/reservas", corpoDeReserva(), { cookie: cookieB }),
      ),
    ]);

    const status = [respostaA.status, respostaB.status].sort();
    expect(status).toEqual([201, 409]);

    const recusada = respostaA.status === 409 ? respostaA : respostaB;
    const corpo = (await recusada.json()) as { erro: string; codigo: string };
    expect(corpo.codigo).toBe("HORARIO_TOMADO");
    expect(corpo.erro).toContain("acabou de ser reservado");

    // So uma reserva existe de verdade.
    expect(
      await bancoDeTeste.reserva.count({
        where: { salaId: salaCI, inicio: instanteDe(TERCA, "10:00") },
      }),
    ).toBe(1);
  });

  it("recusa a quarta reserva ativa do mesmo telefone", async () => {
    const cookie = await cookieDeSessao();

    const horarios = [
      { data: TERCA, inicio: "10:00", fim: "11:00", salaId: salaCI },
      { data: TERCA, inicio: "14:00", fim: "15:00", salaId: salaCI },
      { data: QUARTA, inicio: "10:00", fim: "11:00", salaId: salaCI },
    ];

    for (const horario of horarios) {
      const resposta = await postReservas(
        pedidoPost("/api/publico/reservas", corpoDeReserva(horario), { cookie }),
      );
      expect(resposta.status).toBe(201);
    }

    const quarta = await postReservas(
      pedidoPost(
        "/api/publico/reservas",
        corpoDeReserva({ data: QUARTA, inicio: "14:00", fim: "15:00", salaId: salaContainer }),
        { cookie },
      ),
    );
    const corpo = (await quarta.json()) as { erro: string; codigo: string };

    expect(quarta.status).toBe(409);
    expect(corpo.codigo).toBe("LIMITE_DE_RESERVAS");
    expect(corpo.erro).toContain("3 reservas ativas");
  });

  it("revalida as regras de agenda no servidor (30 min é recusado)", async () => {
    const resposta = await postReservas(
      pedidoPost("/api/publico/reservas", corpoDeReserva({ fim: "10:30" }), {
        cookie: await cookieDeSessao(),
      }),
    );
    const corpo = (await resposta.json()) as { codigo: string };

    expect(resposta.status).toBe(422);
    expect(corpo.codigo).toBe("DURACAO_MINIMA");
  });

  it("registra o envio da confirmação em LogMensagem", async () => {
    const resposta = await postReservas(
      pedidoPost("/api/publico/reservas", corpoDeReserva(), {
        cookie: await cookieDeSessao(),
      }),
    );
    expect(resposta.status).toBe(201);

    // O envio e disparado sem esperar; aqui esperamos ele terminar.
    await aguardarEnviosPendentes();

    const registros = await bancoDeTeste.logMensagem.findMany({
      where: { telefone: TELEFONE },
    });

    expect(registros).toHaveLength(1);
    expect(registros[0]?.tipo).toBe("reserva_confirmada");
    expect(registros[0]?.status).toBe("ENVIADA");
  });
});

describe("montagem do texto das mensagens", () => {
  it("troca as variáveis pelos valores", () => {
    const texto = renderizarTemplate(
      "Oi, {{nome}}! {{sala}} às {{inicio}} por {{valor}}.",
      { nome: "Ana", sala: "Sala CI", inicio: "10:00", valor: "R$ 50,00" },
    );

    expect(texto).toBe("Oi, Ana! Sala CI às 10:00 por R$ 50,00.");
  });

  it("deixa visível uma variável que não existe, para a equipe notar o erro", () => {
    expect(renderizarTemplate("Oi, {{nomee}}!", { nome: "Ana" })).toBe("Oi, {{nomee}}!");
  });
});

