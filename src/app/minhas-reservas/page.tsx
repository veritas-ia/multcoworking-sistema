import type { Metadata } from "next";

import { NOME_DA_MARCA } from "@/lib/marca";
import { AreaDoCliente } from "@/components/minhas-reservas/area-do-cliente";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Minhas reservas | ${NOME_DA_MARCA}`,
  description: "Veja, remarque ou cancele suas reservas.",
};

export default function PaginaMinhasReservas() {
  return <AreaDoCliente />;
}
