import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { respostaErro } from "@/lib/api";
import { horariosDeTerminoValidos } from "@/lib/disponibilidade";

export const dynamic = "force-dynamic";

const Parametros = z.object({
  salaId: z.string().min(1, "Informe a sala."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a hora no formato HH:MM."),
});

/**
 * GET /api/publico/terminos?salaId=...&data=AAAA-MM-DD&inicio=HH:MM
 * Os horarios de termino permitidos para aquele inicio.
 */
export async function GET(requisicao: NextRequest): Promise<NextResponse> {
  const parametros = Parametros.safeParse({
    salaId: requisicao.nextUrl.searchParams.get("salaId") ?? "",
    data: requisicao.nextUrl.searchParams.get("data") ?? "",
    inicio: requisicao.nextUrl.searchParams.get("inicio") ?? "",
  });

  if (!parametros.success) {
    return respostaErro(400, parametros.error.issues[0]?.message ?? "Pedido inválido.");
  }

  const terminos = await horariosDeTerminoValidos(
    parametros.data.salaId,
    parametros.data.data,
    parametros.data.inicio,
  );

  return NextResponse.json({ inicio: parametros.data.inicio, terminos });
}
