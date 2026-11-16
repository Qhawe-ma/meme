import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Spline_Sans_Mono } from "next/font/google";
import "@fontsource-variable/figtree";
import { RegisterServiceWorker } from "@/components/pwa/register";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const spline = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-spline",
});

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
  themeColor: "#0b0b0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-ZA" className={`${geist.variable} ${geistMono.variable} ${spline.variable}`}>
      <body>
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
