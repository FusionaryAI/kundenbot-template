import type { Metadata } from "next";
import { DM_Sans, Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// Markenschriften wie auf fusionaryai.de (Quelle der Wahrheit:
// Fusionary AI Website/app/layout.tsx): Geist für Text, Geist Mono für Labels,
// Newsreader (lokal, nur opsz-Achse) für Seitentitel.
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
  display: "swap",
});

const newsreader = localFont({
  src: [
    { path: "../assets/fonts/Newsreader-opsz-Regular.woff2", style: "normal" },
    { path: "../assets/fonts/Newsreader-opsz-Italic.woff2", style: "italic" },
  ],
  weight: "400",
  variable: "--font-newsreader",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

// Das Chat-Widget läuft auf Kundenwebsites und behält seine bisherige Schrift
// (app/embed, app/demo setzen sie per Layout); Markenwechsel des Dashboards
// dürfen dort nichts verändern.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Fusionary AI",
  description: "Ihr KI-gestützter Kundenassistent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font-Variablen auf <html>: Die @theme-Tokens (--font-sans …) werden auf
    // :root aufgelöst und kennen die Variablen sonst nicht.
    <html lang="de" className={`${geist.variable} ${geistMono.variable} ${newsreader.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
