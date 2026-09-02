export default function PaginaInicial() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg-secondary px-6 text-center">
      <span
        aria-hidden
        className="h-2 w-16 rounded-full bg-brand"
      />
      <h1 className="text-3xl font-bold tracking-tight text-text-primary sm:text-5xl">
        Sistema de Reservas
      </h1>
      <p className="text-sm text-text-secondary sm:text-base">
        Fase 1 concluida: o esqueleto do projeto esta no ar.
      </p>
      <div className="rounded-lg border border-border bg-bg-primary px-5 py-3">
        <span className="inline-flex items-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
          Amarelo da marca com texto preto
        </span>
      </div>
    </main>
  );
}
