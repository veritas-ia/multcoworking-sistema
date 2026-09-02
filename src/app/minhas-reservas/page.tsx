import type { Metadata } from "next";

import { AreaDoCliente } from "@/components/minhas-reservas/area-do-cliente";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Minhas reservas | Coworking",
  description: "Veja, remarque ou cancele suas reservas.",
};

export default function PaginaMinhasReservas() {
  return <AreaDoCliente />;
}
