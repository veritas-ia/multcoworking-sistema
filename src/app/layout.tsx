import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { FaixaDePrevia } from "@/components/ui/faixa-de-previa";
import { DESCRICAO_DO_SITE, metadadosPublicos } from "@/lib/metadados";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = metadadosPublicos({
  titulo: "Reservar sala",
  descricao: DESCRICAO_DO_SITE,
  caminho: "/",
  indexar: true,
});

// A maior parte do trafego chega pelo navegador de dentro do Instagram e do
// WhatsApp. "maximumScale" fica de fora de proposito: bloquear o zoom quebra a
// acessibilidade de quem precisa aumentar o texto.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FFC700",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // As variaveis de fonte ficam no <html> porque e nele que o Tailwind
    // aplica a familia padrao. No <body> elas chegariam tarde demais.
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      {/* A faixa da previa fica ANTES de tudo, no layout raiz, para valer
          tambem no painel: e la que o acidente de lancar reserva no sistema
          errado aconteceria. Em producao ela nao desenha nada. */}
      <body className="antialiased">
        <FaixaDePrevia />
        {children}
      </body>
    </html>
  );
}
