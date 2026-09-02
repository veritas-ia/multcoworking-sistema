import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/publico/salas — as salas que aceitam reserva. */
export async function GET(): Promise<NextResponse> {
  const salas = await prisma.sala.findMany({
    where: { ativa: true },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      nome: true,
      capacidade: true,
      precoPorHora: true,
    },
  });

  return NextResponse.json({
    salas: salas.map((sala) => ({
      id: sala.id,
      nome: sala.nome,
      capacidade: sala.capacidade,
      precoPorHora: sala.precoPorHora.toFixed(2),
    })),
  });
}
