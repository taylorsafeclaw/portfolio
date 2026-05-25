import type { Metadata } from "next";
import localFont from "next/font/local";
import { Instrument_Serif } from "next/font/google";
import { AsciiGrid } from "@/components/ascii/AsciiGrid";
import "./globals.css";


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

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Taylor Allen",
  description:
    "Builder from the Bay. Repeat founder. Shipped startups from 0 → 1, gone deep on enterprise systems, now back to building.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${monaspaceNeon.variable} ${monaspaceXenon.variable} ${instrumentSerif.variable}`}
    >
      {/* prettier-ignore */}
      {/*
        ████████  █████  ██    ██ ██       ██████  ██████
           ██    ██   ██  ██  ██  ██      ██    ██ ██   ██
           ██    ███████   ████   ██      ██    ██ ██████
           ██    ██   ██    ██    ██      ██    ██ ██   ██
           ██    ██   ██    ██    ██████   ██████  ██   ██
        you found the source. hi. — taylor
      */}
      <body className="min-h-screen antialiased">
        {/* Static inline script — no user input, no XSS vector. Runs synchronously before hydration to prevent browser scroll restoration from showing below-hero content during intro animation. */}
        <script dangerouslySetInnerHTML={{__html:`(function(){try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;history.scrollRestoration='manual';window.scrollTo(0,0);document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';}catch(e){}})();`}} />
        <AsciiGrid />
        {children}
      </body>
    </html>
  );
}
