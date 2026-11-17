"use client";

import {
  ArrowLeftRight,
  Briefcase,
  Building2,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Clock,
  DoorClosed,
  DoorOpen,
  FileText,
  History,
  Landmark,
  Menu,
  MessageSquare,
  Package,
  Phone,
  ScrollText,
  ShoppingBasket,
  SlidersHorizontal,
  Tags,
  Truck,
  UserCog,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { estaAceso, MENU, type NomeDoIcone } from "@/lib/menu-admin";
import { cn } from "@/lib/utils";

/** Nome do ícone -> desenho. O mapa do menu não conhece React. */
const DESENHOS: Record<NomeDoIcone, typeof CalendarDays> = {
  CalendarDays,
  FileText,
  ChartColumn,
  Users,
  Building2,
  DoorOpen,
  Briefcase,
  Phone,
  Clock,
  SlidersHorizontal,
  ScrollText,
  MessageSquare,
  UserCog,
  History,
  ShoppingBasket,
  ClipboardList,
  Package,
  ArrowLeftRight,
  Wallet,
  Tags,
  Truck,
  Landmark,
  DoorClosed,
};

/**
 * O estado "a barra está aberta?", compartilhado.
 *
 * POR QUE CONTEXTO, e não um estado solto: o BOTÃO de abrir fica no cabeçalho
 * do celular e a BARRA é uma coluna da página — dois lugares distantes da
 * árvore. Sem compartilhar, seriam duas barras com dois estados, e o botão
 * abriria uma que não é a que aparece.
 */
const Contexto = createContext<{
  aberta: boolean;
  abrir: () => void;
  fechar: () => void;
} | null>(null);

function useBarra() {
  const valor = useContext(Contexto);

  if (!valor) {
    throw new Error("Use dentro do ProvedorDaBarra.");
  }

  return valor;
}

export function ProvedorDaBarra({ children }: { children: ReactNode }) {
  const [aberta, setAberta] = useState(false);

  return (
    <Contexto.Provider
      value={{
        aberta,
        abrir: () => setAberta(true),
        fechar: () => setAberta(false),
      }}
    >
      {children}
    </Contexto.Provider>
  );
}

/** O botão que abre o menu. Só aparece onde a barra não cabe fixa. */
export function BotaoDoMenu() {
  const { aberta, abrir } = useBarra();

  return (
    <button
      type="button"
      aria-label="Abrir o menu"
      aria-expanded={aberta}
      onClick={abrir}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-bg-primary text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black lg:hidden"
    >
      <Menu aria-hidden className="size-5" />
    </button>
  );
}

/**
 * A BARRA LATERAL DO PAINEL.
 *
 * POR QUE ELA EXISTE: até 16/11/2026 cada tela do painel tinha a própria
 * cópia de um cabeçalho, e trocar de seção exigia voltar à tela inicial. As
 * onze abas de Configurações ficavam escondidas atrás de um cartão só.
 *
 * NO CELULAR E NO TABLET EM PÉ ela fica escondida e abre por botão. A
 * referência que inspirou esta tela é um sistema de monitor, e a recepção
 * trabalha no tablet: uma barra fixa de quinze itens comeria metade da tela
 * em pé.
 */
export function BarraLateral({ nomeDoAdmin }: { nomeDoAdmin: string }) {
  const { aberta, fechar } = useBarra();
  const caminho = usePathname();
  const aba = useSearchParams().get("aba");

  // Trocar de tela FECHA a barra. Sem isto, no celular, a pessoa escolhe um
  // item e continua olhando o menu em cima do que acabou de pedir.
  useEffect(() => {
    fechar();
    // "fechar" é recriado a cada render do provedor; depender dele faria o
    // efeito rodar sempre e a barra nunca abriria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caminho, aba]);

  return (
    <>
      {/* O véu. Fechar ao tocar fora é o gesto que todo mundo tenta. */}
      {aberta ? (
        <button
          type="button"
          aria-label="Fechar o menu"
          onClick={fechar}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      <nav
        aria-label="Seções do painel"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-bg-primary transition-transform duration-200",
          // No monitor ela deixa de flutuar e vira uma coluna da página.
          "lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:translate-x-0",
          aberta ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            <span aria-hidden className="h-2 w-8 rounded-full bg-brand" />
            <span className="text-base font-bold text-text-primary">Painel</span>
          </Link>

          <button
            type="button"
            aria-label="Fechar o menu"
            onClick={fechar}
            className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md text-text-secondary lg:hidden"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-3 py-4">
          {MENU.map((grupo) => (
            <div key={grupo.titulo} className="flex flex-col gap-0.5">
              <h2 className="px-3 pb-1 text-xs font-semibold tracking-wide text-text-secondary uppercase">
                {grupo.titulo}
              </h2>

              {grupo.itens.map((item) => {
                const aceso = estaAceso(item, caminho, aba);
                const Desenho = DESENHOS[item.icone];

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={aceso ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
                      aceso
                        ? // O DESTAQUE: faixa amarela + fundo claro + preto em
                          // negrito. A linha inteira amarela brigaria com os
                          // botões amarelos da tela, e o olho deixaria de
                          // saber o que é clicável.
                          "bg-bg-secondary font-bold text-text-primary"
                        : "text-text-secondary hover:bg-bg-secondary hover:text-text-primary",
                    )}
                  >
                    {aceso ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand"
                      />
                    ) : null}
                    <Desenho aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{item.rotulo}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-3 text-sm text-text-secondary">
          {nomeDoAdmin}
        </div>
      </nav>
    </>
  );
}
