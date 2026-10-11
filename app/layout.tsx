import { demoProfile } from "@/lib/demo/profile";
import { readRichRecord } from "@/lib/demo/store";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { readRichState } from "@/lib/rich/read";
import { navigationPatientName } from "@/lib/rich/navigation";
import { Montserrat, Source_Sans_3, Source_Serif_4 } from "next/font/google";
import AppNav from "@/components/shell/AppNav";
import shell from "@/components/shell/shell.module.css";
import { readState } from "@/lib/store/stateStore";
import "./globals.css";
import visual from "@/components/ui/recordbookVisual.module.css";

/*
 * Typography is swappable HERE ONLY (spec.md > Look and Feel):
 * change these two imports and every component follows via --font-ui / --font-evidence.
 * The third font connects the logo descriptor with the desktop header navigation only.
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
const brandFont = Montserrat({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-brand-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MRI — Medical Records Interlinked",
  applicationName: "MRI",
  description: "An evidence-linked personal health record — proof of concept with synthetic data only.",
};

export const dynamic = "force-dynamic";

async function patientName(): Promise<string> {
  try {
    return await navigationPatientName((await headers()).get("x-mri-render-profile"), async()=>demoProfile()==="rich" ? (await readRichRecord()).record : readState(), readRichState);
  } catch {
    return "";
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const name = await patientName();
  return (
    <html lang="en" className={`${uiFont.variable} ${evidenceFont.variable} ${brandFont.variable}`}>
      <body className={`${visual.proposalTheme} ${visual.appCanvas}`}>
        <div className={shell.shell}>
          <AppNav patientName={name} demoProfile={demoProfile()} />
          <div className={shell.main}>{children}</div>
        </div>
      </body>
    </html>
  );
}
