import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "@/providers/query-provider";
import { Navbar } from "@/components/organisms/Navbar";

export const metadata: Metadata = {
  title: "Encontro Pirituba",
  description: "Marketplace local de profissionais e vouchers em Pirituba",
  icons: {
    icon: '/src/app/icon.ico',
    shortcut: '/src/app/icon.ico',
    apple: '/src/app/icon.ico',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/src/app/icon.ico" />
        <link rel="shortcut icon" href="/src/app/icon.ico" />
      </head>
      <body>
        <QueryProvider>
          <Navbar />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
