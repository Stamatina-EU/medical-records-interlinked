import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import AppNav from "@/components/shell/AppNav";
import shell from "@/components/shell/shell.module.css";
import { readState } from "@/lib/store/stateStore";
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
  title: "MRI — Medical Records Interlinked",
  description: "An evidence-linked personal health record — proof of concept with synthetic data only.",
};

export const dynamic = "force-dynamic";

async function patientName(): Promise<string> {
  try {
    return (await readState()).patient.displayName;
  } catch {
    return "";
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const name = await patientName();
  return (
    <html lang="en" className={`${uiFont.variable} ${evidenceFont.variable}`}>
      <body>
        <div className={shell.shell}>
          <AppNav patientName={name} />
          <div className={shell.main}>{children}</div>
        </div>
      </body>
    </html>
  );
}
