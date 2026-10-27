import type { Metadata, Viewport } from "next";
import { Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Space Note · kreativni portal",
  description: "Lični kreativni prostor za čitanje, pisanje i beleške.",
  applicationName: "Space Note",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Space Note",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#090c16",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sr"
      className={`${spaceGrotesk.variable} ${orbitron.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden bg-[#090c16] text-[#f2f1ff]">
        {children}
      </body>
    </html>
  );
}
