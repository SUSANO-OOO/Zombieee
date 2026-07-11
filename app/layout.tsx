import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASHFALL OUTPOST Ver.1.1 — Wasteland Defense",
  description:
    "Command survivors, defend the crawler, and break through the infected wasteland.",
  openGraph: {
    title: "ASHFALL OUTPOST",
    description: "Hold the line in an original wasteland defense game.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "ASHFALL OUTPOST — Wasteland Defense" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ASHFALL OUTPOST",
    description: "Hold the line in an original wasteland defense game.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
