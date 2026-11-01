import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import { RegisterServiceWorker } from "@/components/pwa/register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Meme Market", template: "%s · Meme Market" },
  description:
    "A free game for South Africans 18 and over. Launch meme coins and trade them with fake rand. FR has no cash value.",
  applicationName: "Meme Market",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Meme Market", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1c1a33",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA">
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
