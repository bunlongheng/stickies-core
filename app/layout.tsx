import type { Metadata } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({ weight: "400", subsets: ["latin"], variable: "--font-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face" });

export const metadata: Metadata = {
  title: "Stickies Core",
  description: "Browse folders, read a note, delete it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body className="font-mono text-[13px] antialiased">
        <div className="mx-auto min-h-dvh w-full max-w-3xl px-6 py-14 sm:px-10">{children}</div>
      </body>
    </html>
  );
}
