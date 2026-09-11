/**
 * MODELOS DE MENSAGEM DO WHATSAPP (Fase 11, mais o convite para avaliar).
 *
 * O que estes testes protegem:
 *  1. so a equipe logada edita as mensagens;
 *  2. cada mensagem aceita SUAS variaveis. Uma variavel de outra mensagem faz
 *     o cliente receber "{{link}}" escrito no meio da frase — e ninguem do
 *     coworking veria isso antes dele;
 *  3. {{ nome }} com espacos e recusado: quem troca as variaveis no envio so
 *     reconhece a forma coladinha;
 *  4. os textos que vem do seed obedecem as proprias listas — se um dia a
 *     lista e o texto padrao discordarem, este teste avisa.
 *
 * Precisa do banco no ar e com o seed carregado.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { GET as getTemplates } from "@/app/api/admin/templates/route";
import { PATCH as patchTemplate } from "@/app/api/admin/templates/[chave]/route";
import { TEMPLATES, previaDe, validarTemplate } from "@/lib/templates-admin";
import { assinarToken, COOKIE_ADMIN } from "@/lib/sessao-admin";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";
import { pedidoGet, pedidoPatch } from "./apoio/requisicao";

const USUARIO = "teste.fase11.mensagens";

let cookie: string;
/** Os textos como estavam antes do teste, para devolver tudo no fim. */
let originais: Map<string, string>;

beforeAll(async () => {
  await aquecerConexao();

  const linhas = await bancoDeTeste.templateMensagem.findMany();
  originais = new Map(linhas.map((linha) => [linha.chave, linha.texto]));
});

async function restaurar(): Promise<void> {
  for (const [chave, texto] of originais) {
    await bancoDeTeste.templateMensagem.update({
      where: { chave: chave as never },
      data: { texto },
    });
  }
}

beforeEach(async () => {
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });

  const admin = await bancoDeTeste.usuario.create({
    data: {
      nome: "Admin de Teste",
      usuario: USUARIO,
      senhaHash: await bcrypt.hash("senha-boa-12345", 10),
    },
    select: { id: true },
  });

  cookie = `${COOKIE_ADMIN}=${await assinarToken(admin.id)}`;
  await restaurar();
});

afterEach(async () => {
  await restaurar();
  await bancoDeTeste.usuario.deleteMany({ where: { usuario: USUARIO } });
});

afterAll(async () => {
  await bancoDeTeste.$disconnect();
});

function contexto(chave: string) {
  return { params: Promise.resolve({ chave }) };
}

async function gravar(chave: string, texto: string) {
  const resposta = await patchTemplate(
    pedidoPatch(`/api/admin/templates/${chave}`, { texto }, { cookie }),
    contexto(chave),
  );

  return { status: resposta.status, corpo: await resposta.json() };
}

// -----------------------------------------------------------------------------

describe("quem pode mexer", () => {
  it("recusa ler sem sessao de admin", async () => {
    expect((await getTemplates(pedidoGet("/api/admin/templates"))).status).toBe(401);
  });

  it("recusa gravar sem sessao de admin", async () => {
    const resposta = await patchTemplate(
      pedidoPatch("/api/admin/templates/reserva_confirmada", { texto: "Oi." }),
      contexto("reserva_confirmada"),
    );

    expect(resposta.status).toBe(401);
  });
});

describe("leitura", () => {
  it("devolve as oito mensagens com suas variaveis e a previa", async () => {
    const corpo = await (
      await getTemplates(pedidoGet("/api/admin/templates", {}, { cookie }))
    ).json();

    expect(corpo.templates).toHaveLength(8);

    const lembrete = corpo.templates.find(
      (template: { chave: string }) => template.chave === "lembrete_13h",
    );
    const confirmada = corpo.templates.find(
      (template: { chave: string }) => template.chave === "reserva_confirmada",
    );

    // O link so existe nos lembretes; o valor so nas mensagens com preco.
    expect(lembrete.variaveis).toContain("link");
    expect(confirmada.variaveis).not.toContain("link");
    expect(confirmada.variaveis).toContain("valor");

    // Na avaliacao o {{link}} e o do GOOGLE, e nao o da area do cliente: cada
    // mensagem tem a sua lista, entao o mesmo nome vale coisas diferentes.
    const avaliacao = corpo.templates.find(
      (template: { chave: string }) => template.chave === "avaliacao_pos_uso",
    );
    expect(avaliacao.variaveis).toContain("link");
    expect(avaliacao.variaveis).not.toContain("valor");
  });

  it("a previa nao deixa nenhuma variavel por trocar", async () => {
    const corpo = await (
      await getTemplates(pedidoGet("/api/admin/templates", {}, { cookie }))
    ).json();

    for (const template of corpo.templates) {
      expect(template.previa, `previa de ${template.chave}`).not.toContain("{{");
    }
  });
});

describe("os textos que vem do seed", () => {
  it("so usam variaveis que a propria mensagem aceita", async () => {
    const linhas = await bancoDeTeste.templateMensagem.findMany();

    for (const definicao of TEMPLATES) {
      const linha = linhas.find((item) => item.chave === definicao.chave);
      expect(linha, `modelo ${definicao.chave} no banco`).toBeDefined();

      expect(
        validarTemplate(definicao, linha!.texto),
        `texto padrao de ${definicao.chave}`,
      ).toBeNull();
    }
  });
});

describe("gravacao", () => {
  it("grava um texto valido", async () => {
    const { status } = await gravar(
      "reserva_confirmada",
      "Oi, {{nome}}! Reserva confirmada na {{sala}} em {{data}}, {{inicio}} às {{fim}}. {{valor}}",
    );

    expect(status).toBe(200);

    const guardado = await bancoDeTeste.templateMensagem.findUniqueOrThrow({
      where: { chave: "reserva_confirmada" },
    });
    expect(guardado.texto).toContain("Reserva confirmada");
  });

  it("recusa variavel que pertence a outra mensagem", async () => {
    const { status, corpo } = await gravar(
      "reserva_confirmada",
      "Oi, {{nome}}! Acesse {{link}} para cancelar.",
    );

    expect(status).toBe(422);
    expect(corpo.erro).toContain("{{link}}");

    // Nada foi gravado.
    const guardado = await bancoDeTeste.templateMensagem.findUniqueOrThrow({
      where: { chave: "reserva_confirmada" },
    });
    expect(guardado.texto).not.toContain("{{link}}");
  });

  it("recusa variavel escrita com espacos dentro das chaves", async () => {
    const { status, corpo } = await gravar("reserva_confirmada", "Oi, {{ nome }}!");

    expect(status).toBe(422);
    expect(corpo.erro).toMatch(/sem espaços/i);
  });

  it("recusa variavel inventada", async () => {
    const { status, corpo } = await gravar("lembrete_3h", "Oi, {{apelido}}!");

    expect(status).toBe(422);
    expect(corpo.erro).toContain("{{apelido}}");
  });

  it("recusa mensagem vazia", async () => {
    const { status, corpo } = await gravar("lembrete_3h", "   ");

    expect(status).toBe(422);
    expect(corpo.erro).toMatch(/vazia/i);
  });

  it("recusa mensagem longa demais", async () => {
    const { status } = await gravar("lembrete_3h", "a".repeat(2_000));
    expect(status).toBe(422);
  });

  it("recusa mensagem que nao existe", async () => {
    const { status } = await gravar("mensagem_inventada", "Oi!");
    expect(status).toBe(404);
  });

  it("aceita texto sem nenhuma variavel", async () => {
    const { status } = await gravar(
      "lembrete_3h",
      "Sua reserva começa em breve. Até já!",
    );

    expect(status).toBe(200);
  });
});

describe("previa", () => {
  it("troca as variaveis por valores de exemplo", () => {
    const previa = previaDe("Oi, {{nome}}! {{sala}} às {{inicio}}.");

    expect(previa).not.toContain("{{");
    expect(previa).toContain("Maria");
  });
});
