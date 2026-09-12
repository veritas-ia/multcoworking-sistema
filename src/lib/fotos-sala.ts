/**
 * AS FOTOS DE CADA SALA.
 *
 * O arquivo vai para o Cloudinary; aqui fica a referencia e a ordem do
 * carrossel. Toda conferencia (tipo, tamanho e o limite por sala) acontece no
 * SERVIDOR: a tela tambem confere, mas para avisar cedo — quem manda e aqui,
 * porque a tela pode ser contornada.
 */
import {
  MAXIMO_DE_FOTOS,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_ACEITOS,
  apagarImagem,
  cloudinaryConfigurado,
  enviarImagem,
} from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export type FotoDaSala = {
  id: string;
  url: string;
  ordem: number;
};

export type FalhaDeFoto = {
  codigo: "REGRA" | "NAO_ENCONTRADA" | "SEM_CLOUDINARY";
  motivo: string;
};

export type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: FalhaDeFoto };

const SEM_CLOUDINARY: FalhaDeFoto = {
  codigo: "SEM_CLOUDINARY",
  motivo:
    "O envio de fotos não está disponível: falta configurar o Cloudinary no servidor.",
};

export async function listarFotos(salaId: string): Promise<FotoDaSala[]> {
  const fotos = await prisma.fotoDaSala.findMany({
    where: { salaId },
    orderBy: { ordem: "asc" },
    select: { id: true, url: true, ordem: true },
  });

  return fotos;
}

/**
 * Recebe o arquivo e guarda a referencia.
 *
 * A ordem de acontecer importa: PRIMEIRO conferimos os limites, DEPOIS
 * mandamos para o Cloudinary. Ao contrario, um arquivo grande demais subiria
 * para so entao ser recusado — e ficaria la, ocupando espaco, sem ninguem
 * saber que existe.
 */
export async function adicionarFoto(entrada: {
  salaId: string;
  arquivo: Blob;
  tipo: string;
  tamanho: number;
}): Promise<Resultado<FotoDaSala>> {
  if (!cloudinaryConfigurado()) {
    return { ok: false, falha: SEM_CLOUDINARY };
  }

  const sala = await prisma.sala.findUnique({
    where: { id: entrada.salaId },
    select: { id: true },
  });

  if (!sala) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Sala não encontrada." } };
  }

  if (!TIPOS_ACEITOS.includes(entrada.tipo as (typeof TIPOS_ACEITOS)[number])) {
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: "Envie uma imagem JPG, PNG ou WEBP.",
      },
    };
  }

  if (entrada.tamanho > TAMANHO_MAXIMO_BYTES) {
    const limite = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: `Cada foto pode ter no máximo ${limite} MB. Esta está maior.`,
      },
    };
  }

  const quantas = await prisma.fotoDaSala.count({ where: { salaId: entrada.salaId } });

  if (quantas >= MAXIMO_DE_FOTOS) {
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: `Cada sala aceita no máximo ${MAXIMO_DE_FOTOS} fotos. Remova uma antes de enviar outra.`,
      },
    };
  }

  const envio = await enviarImagem(entrada.arquivo);

  if (!envio.ok) {
    return { ok: false, falha: { codigo: "REGRA", motivo: envio.motivo } };
  }

  const ultima = await prisma.fotoDaSala.findFirst({
    where: { salaId: entrada.salaId },
    orderBy: { ordem: "desc" },
    select: { ordem: true },
  });

  const criada = await prisma.fotoDaSala.create({
    data: {
      salaId: entrada.salaId,
      publicId: envio.foto.publicId,
      url: envio.foto.url,
      ordem: (ultima?.ordem ?? 0) + 1,
    },
    select: { id: true, url: true, ordem: true },
  });

  return { ok: true, dados: criada };
}

export type RemocaoDaFoto = {
  /** Verdadeiro quando o arquivo continuou no Cloudinary. */
  ficouNoCloudinary: boolean;
  fotos: FotoDaSala[];
};

/**
 * Tira a foto do site.
 *
 * Decisao do dono: se o Cloudinary recusar a remocao, a foto SAI DO SITE
 * mesmo assim e a tela avisa que o arquivo pode ter ficado la. O que o
 * cliente ve importa mais — uma instabilidade do Cloudinary nao pode deixar
 * no ar uma foto que a equipe quer fora.
 */
export async function removerFoto(entrada: {
  salaId: string;
  fotoId: string;
}): Promise<Resultado<RemocaoDaFoto>> {
  const foto = await prisma.fotoDaSala.findFirst({
    where: { id: entrada.fotoId, salaId: entrada.salaId },
    select: { id: true, publicId: true },
  });

  if (!foto) {
    return { ok: false, falha: { codigo: "NAO_ENCONTRADA", motivo: "Foto não encontrada." } };
  }

  const apagou = await apagarImagem(foto.publicId);

  await prisma.fotoDaSala.delete({ where: { id: foto.id } });
  await renumerar(entrada.salaId);

  return {
    ok: true,
    dados: {
      ficouNoCloudinary: !apagou,
      fotos: await listarFotos(entrada.salaId),
    },
  };
}

/**
 * Grava a ordem nova do carrossel.
 *
 * Exige a lista COMPLETA das fotos da sala. Receber so as que mudaram
 * deixaria espaco para ordens repetidas ou buracos, e o carrossel ficaria
 * numa ordem que ninguem pediu.
 */
export async function reordenarFotos(entrada: {
  salaId: string;
  ids: string[];
}): Promise<Resultado<FotoDaSala[]>> {
  const atuais = await prisma.fotoDaSala.findMany({
    where: { salaId: entrada.salaId },
    select: { id: true },
  });

  const conhecidos = new Set(atuais.map((foto) => foto.id));
  const pedidos = new Set(entrada.ids);

  if (pedidos.size !== entrada.ids.length) {
    return {
      ok: false,
      falha: { codigo: "REGRA", motivo: "A mesma foto apareceu duas vezes na ordem." },
    };
  }

  if (
    entrada.ids.length !== atuais.length ||
    entrada.ids.some((id) => !conhecidos.has(id))
  ) {
    return {
      ok: false,
      falha: {
        codigo: "REGRA",
        motivo: "A ordem enviada não bate com as fotos desta sala. Recarregue a página.",
      },
    };
  }

  await prisma.$transaction(
    entrada.ids.map((id, posicao) =>
      prisma.fotoDaSala.update({ where: { id }, data: { ordem: posicao + 1 } }),
    ),
  );

  return { ok: true, dados: await listarFotos(entrada.salaId) };
}

/** Fecha os buracos depois de uma remocao: 1, 2, 3... sem pular numero. */
async function renumerar(salaId: string): Promise<void> {
  const fotos = await prisma.fotoDaSala.findMany({
    where: { salaId },
    orderBy: { ordem: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    fotos.map((foto, posicao) =>
      prisma.fotoDaSala.update({ where: { id: foto.id }, data: { ordem: posicao + 1 } }),
    ),
  );
}
