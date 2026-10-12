import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Truecharts",
  description: "Advanced analytics and institutional options data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={{ fontSize: "80%" }}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#0a0a0f] text-neutral-100">{children}</body>
    </html>
  );
}
