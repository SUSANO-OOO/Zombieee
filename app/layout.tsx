import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASHFALL OUTPOST — Early Access 0.5.0",
  description:
    "Early Access 0.5.0 — command six specialized survivors, defeat TAKUYA, and breach the infected checkpoint across three routes.",
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
      <head>
        <link rel="preload" as="image" href="/battlefield-v4.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/crawler-fortress-v1.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/infected-checkpoint-v1.png" fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  );
}
