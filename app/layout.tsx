import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import TopNav from "@/components/nav/TopNav";
import "./globals.css";

/*
 * Typography is swappable HERE ONLY (spec.md > Look and Feel):
 * change these two imports and every component follows via --font-ui / --font-evidence.
 */
const uiFont = Source_Sans_3({
  subsets: ["latin", "greek"],
  weight: ["400", "600"],
  variable: "--font-ui-family",
  display: "swap",
});
const evidenceFont = Source_Serif_4({
  subsets: ["latin", "greek"],
  weight: ["400", "600"],
  variable: "--font-evidence-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Medical History",
  description: "Evidence-linked medical history — proof of concept with synthetic data only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${uiFont.variable} ${evidenceFont.variable}`}>
      <body>
        <TopNav />
        {children}
      </body>
    </html>
  );
}
