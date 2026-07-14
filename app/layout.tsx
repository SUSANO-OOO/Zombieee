import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./campaign.css";

export const viewport: Viewport = {
  // vinext 0.0.50 serializes the standard viewport fields but currently omits
  // Viewport.viewportFit. Keep one server-rendered viewport meta by carrying
  // the valid viewport-fit directive in the serialized width field as well.
  width: "device-width, viewport-fit=cover" as "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "西新世紀末物語｜アーリーアクセス版 0.6.0",
  description:
    "西新・早良区・百道浜を舞台に、3レーンの戦場を生き抜くアーリーアクセス版ストラテジー。",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "西新世紀末物語",
    description: "序章『新たな世界の始まり』を収録したアーリーアクセス版。",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "西新世紀末物語",
    description: "序章『新たな世界の始まり』を収録したアーリーアクセス版。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preload" as="image" href="/art/v060/title-key-visual-v1.webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/art/v060/mizuki-nana-portrait-v1.webp" />
        <link rel="preload" as="image" href="/art/v060/battle-nishijin-shopping-street-v1.webp" fetchPriority="high" />
        <link rel="preload" as="image" href="/crawler-fortress-v1.png" fetchPriority="high" />
        <link rel="preload" as="image" href="/infected-checkpoint-v1.png" fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  );
}
