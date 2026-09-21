import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stickies Core",
  description: "All notes. Read one, delete one.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
