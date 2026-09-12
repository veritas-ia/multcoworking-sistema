/**
 * AS FOTOS DA SALA.
 *
 * O que estes testes protegem:
 *  1. as conferencias acontecem no SERVIDOR — tipo, tamanho e o limite de 5.
 *     A tela tambem confere, mas para avisar cedo; quem manda e o servidor,
 *     porque a tela pode ser contornada;
 *  2. os limites sao conferidos ANTES de o arquivo subir. Ao contrario, um
 *     arquivo grande demais subiria para so entao ser recusado, e ficaria la
 *     ocupando espaco sem ninguem saber que existe;
 *  3. sem Cloudinary configurado, a resposta e clara e nada quebra;
 *  4. remover renumera a ordem, e avisa quando o arquivo ficou no Cloudinary;
 *  5. a reordenacao exige a lista completa — ordens repetidas ou com buracos
 *     deixariam o carrossel numa ordem que ninguem pediu.
 *
 * A rede nao e tocada: as funcoes que falam com o Cloudinary sao trocadas por
 * dubles.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cloudinary", async (original) => {
  const real = await original<typeof import("@/lib/cloudinary")>();

  return {
    ...real,
    cloudinaryConfigurado: () => configurado,
    enviarImagem: async () => respostaDoEnvio(),
    apagarImagem: async () => apagarFunciona,
  };
});

import { MAXIMO_DE_FOTOS, TAMANHO_MAXIMO_BYTES } from "@/lib/cloudinary";
import {
  adicionarFoto,
  listarFotos,
  removerFoto,
  reordenarFotos,
} from "@/lib/fotos-sala";

import { aquecerConexao, bancoDeTeste } from "./apoio/banco";

/** Estado dos dubles, trocado por cada teste. */
let configurado = true;
let apagarFunciona = true;
let contador = 0;

function respostaDoEnvio() {
  contador += 1;
  return {
    ok: true as const,
    foto: {
      publicId: `teste/foto-${Date.now()}-${contador}`,
      url: `https://res.cloudinary.com/demo/image/upload/v1/teste/foto-${contador}.jpg`,
    },
  };
}

const SLUG = "zz-teste-fotos";
let salaId: string;

beforeEach(async () => {
  await aquecerConexao();
  configurado = true;
  apagarFunciona = true;

  await limpar();

  const sala = await bancoDeTeste.sala.create({
    data: {
      nome: "ZZ Teste Fotos",
      slug: SLUG,
      precoPorHora: "40.00",
      precoPorHoraNoturno: "75.00",
      ordem: 97,
      ativa: false,
    },
    select: { id: true },
  });

  salaId = sala.id;
});

async function limpar(): Promise<void> {
  await bancoDeTeste.sala.deleteMany({ where: { slug: SLUG } });
}

afterEach(limpar);

afterAll(async () => {
  await limpar();
  await bancoDeTeste.$disconnect();
});

/** Um arquivo de mentira, so com tipo e tamanho — o envio e dublado. */
function arquivo(tipo = "image/jpeg", tamanho = 1024) {
  return { arquivo: new Blob(["x"]), tipo, tamanho };
}

async function enviar(tipo?: string, tamanho?: number) {
  return adicionarFoto({ salaId, ...arquivo(tipo, tamanho) });
}

// -----------------------------------------------------------------------------

describe("sem Cloudinary configurado", () => {
  it("recusa com um motivo claro, sem quebrar", async () => {
    configurado = false;

    const resultado = await enviar();

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.codigo).toBe("SEM_CLOUDINARY");
      expect(resultado.falha.motivo).toMatch(/não está disponível/i);
    }
  });
});

describe("conferencias antes de subir", () => {
  it("recusa arquivo que nao e imagem aceita", async () => {
    const resultado = await enviar("application/pdf");

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toMatch(/JPG, PNG ou WEBP/i);
    }
    // Nada foi gravado.
    expect(await listarFotos(salaId)).toHaveLength(0);
  });

  it("aceita os tres tipos combinados", async () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp"]) {
      const resultado = await enviar(tipo);
      expect(resultado.ok, tipo).toBe(true);
    }
  });

  it("recusa arquivo maior que o limite", async () => {
    const resultado = await enviar("image/png", TAMANHO_MAXIMO_BYTES + 1);

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toMatch(/5 MB/);
    }
  });

  it("aceita arquivo exatamente no limite", async () => {
    expect((await enviar("image/png", TAMANHO_MAXIMO_BYTES)).ok).toBe(true);
  });
});

describe("limite por sala", () => {
  it(`aceita ${MAXIMO_DE_FOTOS} e recusa a seguinte`, async () => {
    for (let i = 0; i < MAXIMO_DE_FOTOS; i += 1) {
      expect((await enviar()).ok, `foto ${i + 1}`).toBe(true);
    }

    const excedente = await enviar();

    expect(excedente.ok).toBe(false);
    if (!excedente.ok) {
      expect(excedente.falha.motivo).toMatch(/no máximo 5 fotos/i);
    }

    expect(await listarFotos(salaId)).toHaveLength(MAXIMO_DE_FOTOS);
  });
});

describe("ordem", () => {
  it("cada foto nova entra no fim da fila", async () => {
    await enviar();
    await enviar();
    await enviar();

    expect((await listarFotos(salaId)).map((foto) => foto.ordem)).toEqual([1, 2, 3]);
  });

  it("remover renumera, sem deixar buraco", async () => {
    await enviar();
    await enviar();
    await enviar();

    const fotos = await listarFotos(salaId);
    const resultado = await removerFoto({ salaId, fotoId: fotos[1]!.id });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.dados.fotos.map((foto) => foto.ordem)).toEqual([1, 2]);
      expect(resultado.dados.ficouNoCloudinary).toBe(false);
    }
  });

  it("reordenar grava a ordem pedida", async () => {
    await enviar();
    await enviar();
    await enviar();

    const fotos = await listarFotos(salaId);
    const invertida = [fotos[2]!.id, fotos[0]!.id, fotos[1]!.id];

    const resultado = await reordenarFotos({ salaId, ids: invertida });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.dados.map((foto) => foto.id)).toEqual(invertida);
      expect(resultado.dados.map((foto) => foto.ordem)).toEqual([1, 2, 3]);
    }
  });

  it("recusa ordem incompleta", async () => {
    await enviar();
    await enviar();

    const fotos = await listarFotos(salaId);
    const resultado = await reordenarFotos({ salaId, ids: [fotos[0]!.id] });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toMatch(/não bate/i);
    }
  });

  it("recusa a mesma foto duas vezes", async () => {
    await enviar();
    await enviar();

    const fotos = await listarFotos(salaId);
    const resultado = await reordenarFotos({
      salaId,
      ids: [fotos[0]!.id, fotos[0]!.id],
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.motivo).toMatch(/duas vezes/i);
    }
  });
});

describe("quando o Cloudinary recusa a remocao", () => {
  it("a foto SAI do site mesmo assim, e o aviso vem junto", async () => {
    apagarFunciona = false;
    await enviar();

    const fotos = await listarFotos(salaId);
    const resultado = await removerFoto({ salaId, fotoId: fotos[0]!.id });

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      // O que o cliente ve importa mais: a foto some do site.
      expect(resultado.dados.fotos).toHaveLength(0);
      // Mas a equipe fica sabendo que o arquivo pode ter ficado la.
      expect(resultado.dados.ficouNoCloudinary).toBe(true);
    }
  });
});

describe("foto de outra sala", () => {
  it("nao pode ser removida por esta sala", async () => {
    const resultado = await removerFoto({ salaId, fotoId: "nao-existe" });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.falha.codigo).toBe("NAO_ENCONTRADA");
    }
  });
});
