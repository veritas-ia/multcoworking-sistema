import { FluxoDeReserva } from "@/components/reserva/fluxo-de-reserva";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Pagina publica de reserva.
 *
 * Aceita ?sala=<slug> para ja entrar com a sala escolhida — e o que faz o QR
 * Code na porta da sala e o link do Instagram caírem direto na escolha da data.
 * Um slug que nao existe e simplesmente ignorado: o cliente escolhe na mao.
 */
export default async function PaginaInicial({ searchParams }: Props) {
  const parametros = await searchParams;
  const sala = parametros.sala;

  return (
    <FluxoDeReserva salaPreSelecionada={typeof sala === "string" ? sala : null} />
  );
}
