import type { Metadata, Viewport } from "next";
import { RELEASE_TITLE } from "./releaseIdentity.js";
import { V075_VISUAL_PROFILES } from "./visualProfiles.js";
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
  title: RELEASE_TITLE,
  description:
    "Stage 20、Survival Mode、16名の固有アビリティを収録。移動拠点CRAWLERと生存者部隊を率いるリアルタイム戦略・防衛ゲーム。",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "西新世紀末物語",
    description: "Stage 20、Survival Mode、16名の固有アビリティを収録したアーリーアクセス版。",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "西新世紀末物語",
    description: "Stage 20、Survival Mode、16名の固有アビリティを収録したアーリーアクセス版。",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <head>
        <link rel="preload" as="image" href="/art/v060/title-key-visual-v1.webp" fetchPriority="high" />
        <link rel="preload" as="image" href={V075_VISUAL_PROFILES.ikura.eventPortrait.path} />
        <link rel="preload" as="image" href="/art/v060/battle-nishijin-shopping-street-v1.webp" fetchPriority="high" />
        <link rel="preload" as="image" href={V075_VISUAL_PROFILES.crawler.closed.path} fetchPriority="high" />
        <link rel="preload" as="image" href={V075_VISUAL_PROFILES.crawler.open.path} />
        <link rel="preload" as="image" href={V075_VISUAL_PROFILES.enemyBase.intact.path} fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  );
}
