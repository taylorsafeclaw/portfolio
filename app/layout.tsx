import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Substrate } from "@/components/substrate/Substrate";

const monaspaceNeon = localFont({
  src: [
    { path: "../public/fonts/MonaspaceNeon-Regular.woff2", weight: "400" },
    { path: "../public/fonts/MonaspaceNeon-Medium.woff2", weight: "500" },
  ],
  variable: "--font-mono",
  display: "swap",
});

const monaspaceXenon = localFont({
  src: [
    { path: "../public/fonts/MonaspaceXenon-Regular.woff2", weight: "400" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taylor Allen",
  description:
    "Builder from the Bay. Repeat founder. Shipped a startup, gone deep on enterprise systems, now back to building.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${monaspaceNeon.variable} ${monaspaceXenon.variable}`}
    >
      <body className="min-h-screen antialiased">
        <Substrate />
        {children}
      </body>
    </html>
  );
}
