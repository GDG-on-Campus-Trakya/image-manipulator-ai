import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PasswordProtection from "@/components/PasswordProtection";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Image Manipulator - Stand",
  description: "Upload photos from mobile, process with AI on desktop",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PasswordProtection>
          {children}
        </PasswordProtection>
      </body>
    </html>
  );
}
