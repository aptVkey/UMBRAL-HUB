import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Umbral · Hub",
  description: "Centro de informação do grupo Umbral. Alojamentos, tipologias, tarifas, operadores e regras num único lugar.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-PT">
      <body className="antialiased">{children}</body>
    </html>
  );
}
