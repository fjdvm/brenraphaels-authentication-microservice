import { Suspense } from "react";

import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import { PageSkeleton } from "@/components/layout/shell-skeleton";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bren Raphael's | Enterprise Suite",
  description: "Central identity and access-control portal",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Toaster />
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
