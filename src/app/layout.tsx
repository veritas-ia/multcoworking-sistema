import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { NOME_DA_MARCA } from "@/lib/marca";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `Reservar sala | ${NOME_DA_MARCA}`,
  description:
    "Reserve a Sala CI, a Sala de Reunião ou a Sala Container em poucos toques.",
};

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
