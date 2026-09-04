import type { Metadata } from "next";

import { metadadosPublicos } from "@/lib/metadados";
import { AreaDoCliente } from "@/components/minhas-reservas/area-do-cliente";

export const dynamic = "force-dynamic";

/**
 * Area pessoal do cliente.
 *
 * Fora dos buscadores de proposito: e uma pagina para quem ja tem reserva e
 * chega pelo link do lembrete. O cartao de compartilhamento continua valendo —
 * e exatamente esse link que e colado no WhatsApp.
 */
export const metadata: Metadata = metadadosPublicos({
  titulo: "Minhas reservas",
  descricao: "Veja, remarque ou cancele suas reservas.",
  caminho: "/minhas-reservas",
  indexar: false,
});

export default function PaginaMinhasReservas() {
  return <AreaDoCliente />;
}
