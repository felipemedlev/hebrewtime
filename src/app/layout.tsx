import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter, Noto_Serif_Hebrew } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansHebrew = Noto_Serif_Hebrew({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600"], variable: "--font-hebrew" });

export const metadata: Metadata = {
  title: "HebrewTales",
  description: "Read and listen to Hebrew stories, explore translations, and build your vocabulary.",
  icons: {
    icon: { url: "/brand/hebrewtales-mark.svg", type: "image/svg+xml" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${notoSansHebrew.variable}`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
