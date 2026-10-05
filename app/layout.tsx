import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Source_Sans_3, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const sans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CILI Scheduler",
  description: "In-line inspection scheduling and milestone tracking",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-white font-sans text-cy-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
