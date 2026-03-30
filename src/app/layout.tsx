import type { Metadata } from "next";
import { Inter, Noto_Serif_Hebrew } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoSansHebrew = Noto_Serif_Hebrew({ subsets: ["hebrew", "latin"], weight: ["400", "500", "600"], variable: "--font-hebrew" });

export const metadata: Metadata = {
  title: "Hebrew Time",
  description: "Bilingual reader for Hebrew Time podcast.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${notoSansHebrew.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
