// TODO Task 10: add DM Serif Display + Inter via next/font/google
import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "CogniPrep",
  description: "AI-powered adaptive exam preparation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
