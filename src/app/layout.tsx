import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter, Source_Serif_4, Tiro_Devanagari_Sanskrit } from "next/font/google";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { DrawerProvider } from "@/components/verse/Drawer";
import { Overlays } from "@/components/layout/Overlays";
import { GlossaryProvider } from "@/components/ui/Glossary";
import { PlayerBar } from "@/components/verse/PlayerBar";
import { getIndex } from "@/lib/server/data";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], axes: ["opsz"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin", "latin-ext"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-source-serif", display: "swap" });
const tiro = Tiro_Devanagari_Sanskrit({ subsets: ["devanagari", "latin", "latin-ext"], weight: "400", style: ["normal", "italic"], variable: "--font-tiro", display: "swap" });

const SITE = process.env.NEXT_PUBLIC_SITE_URL;
export const metadata: Metadata = {
  metadataBase: new URL(SITE || "http://localhost:3210"),
  title: { default: "UpaSārathi · Modern AI is trained to please you. The Upanishads were written to wake you up.", template: "%s · UpaSārathi" },
  description:
    "All 13 Principal Upanishads, rooted in their Vedas: Devanagari, IAST, translation, chant and Śaṅkara’s commentary as a living knowledge graph; and a three-way harness that tests whether an AI chooses the pleasant over the good.",
  openGraph: { type: "website", siteName: "UpaSārathi", images: [{ url: "/og", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/og"] },
  applicationName: "UpaSārathi",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { color: "#0a0c0b" },
  ],
};

// Before first paint: the pinned theme (dark unless the reader chose light); capture mode for video (?capture=1, also ?theme=light|dark).
const boot = `try{var q=new URLSearchParams(location.search),d=document.documentElement,p=q.get('theme')||localStorage.getItem('upasarathi:theme');d.dataset.theme=p==='light'?'light':'dark';if(q.get('capture')==='1')d.dataset.capture='1';var h=localStorage.getItem('upasarathi:hide');if(h)d.dataset.hide=h}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { glossary } = getIndex();
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${inter.variable} ${serif.variable} ${tiro.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body>
        <GlossaryProvider terms={glossary}>
          <DrawerProvider>
            <TopNav />
            <main className="min-h-[70vh]">{children}</main>
            <Footer />
            <PlayerBar />
            <Overlays />
          </DrawerProvider>
        </GlossaryProvider>
        <Analytics />
      </body>
    </html>
  );
}
