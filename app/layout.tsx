import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medical History",
  description: "Evidence-linked medical history — proof of concept with synthetic data only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
