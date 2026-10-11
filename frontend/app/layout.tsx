import type { Metadata } from "next";
import { Bricolage_Grotesque, Caveat, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import AiKeyDialog from "@/components/ai/AiKeyDialog";

// Interface and body text
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

// Headlines (font-serif)
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

// The red pencil: margin notes and annotations only (font-hand)
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "ResumeForge",
  description: "AI-powered Resume Builder & ATS Analyzer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${caveat.variable} antialiased`}
      // data-theme is set by THEME_INIT_SCRIPT before hydration
      suppressHydrationWarning
    >
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        {children}
        <AiKeyDialog />
      </body>
    </html>
  );
}