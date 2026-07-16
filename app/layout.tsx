import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodeProof AI — Measure Understanding. Build Real Skills.",
  description: "A local, evidence-based code understanding assessment for learners.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
