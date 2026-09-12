import { NextResponse } from "next/server";

import { enderecoDaFoto } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/publico/salas — as salas que aceitam reserva.
 *
 * Leva junto as tarifas porque a tela precisa mostrar a estimativa ANTES de
 * confirmar, e ela usa o mesmo calculo do servidor ("precos.ts"). Preco nao e
 * dado sigiloso: e o que esta na parede do coworking.
 */
export async function GET(): Promise<NextResponse> {
  const salas = await prisma.sala.findMany({
    where: { ativa: true },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      slug: true,
      nome: true,
      capacidade: true,
      precoPorHora: true,
      precoPorHoraNoturno: true,
      precoPorHoraNoturnoGrupo: true,
      pessoasParaGrupo: true,
      aceitaDiaria: true,
      precoDiaria: true,
      fotos: { orderBy: { ordem: "asc" }, select: { id: true, url: true } },
    },
  });

  return NextResponse.json({
    salas: salas.map((sala) => ({
      id: sala.id,
      slug: sala.slug,
      nome: sala.nome,
      capacidade: sala.capacidade,
      precoPorHora: sala.precoPorHora.toFixed(2),
      precoPorHoraNoturno: sala.precoPorHoraNoturno.toFixed(2),
      precoPorHoraNoturnoGrupo: sala.precoPorHoraNoturnoGrupo?.toFixed(2) ?? null,
      pessoasParaGrupo: sala.pessoasParaGrupo,
      aceitaDiaria: sala.aceitaDiaria,
      precoDiaria: sala.precoDiaria?.toFixed(2) ?? null,
      // O endereco ja sai pedindo o tamanho ao Cloudinary: o celular baixa
      // uma imagem de celular, e nao a foto original inteira.
      fotos: sala.fotos.map((foto) => ({
        id: foto.id,
        url: enderecoDaFoto(foto.url, 800),
      })),
    })),
  });
}
