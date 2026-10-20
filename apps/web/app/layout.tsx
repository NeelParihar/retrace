import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Header } from "@/components/shell/Header";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "retrace — agent traces & replay",
  description: "Trace every step, tool call, token and dollar of an LLM agent. Replay it. Fork it from any step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans">
        <Header />
        <main className="mx-auto max-w-[1400px] px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
