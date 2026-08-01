import type { Metadata, Viewport } from "next";
import { RELEASE_TITLE, RELEASE_VERSION } from "./releaseIdentity.js";
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
  themeColor: "#0b0d0d",
};

// Derived rather than written out, because a hand-maintained version string in
// share copy silently goes stale the moment it is not the thing being edited.
const SHARE_DESCRIPTION =
  `ホーム画面へ追加すると、ゲームデータを端末へ保存してオフラインでも遊べます。Version ${RELEASE_VERSION}。`;

export const metadata: Metadata = {
  title: RELEASE_TITLE,
  description:
    "全16名の戦闘アニメーション、VFX、スマートフォン描画、雇用導線を刷新。移動拠点CRAWLERと生存者部隊を率いるリアルタイム戦略・防衛ゲーム。",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "西新世紀末物語",
    description: SHARE_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "西新世紀末物語",
    description: SHARE_DESCRIPTION,
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
        {/*
          Absolute paths here on purpose: the GitHub Pages build rewrites
          root-absolute references to the /Zombieee base path and then verifies
          every one of them resolves to a real file. Runtime JS instead derives
          its URLs from location, so both layers stay base-path correct.
        */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="西新世紀末" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>{children}</body>
    </html>
  );
}
