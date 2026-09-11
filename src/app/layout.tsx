import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter, Manrope, Poppins, Nunito_Sans, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

// All UI fonts are bundled at build time via next/font (self-hosted).
// Nothing is fetched from Google Fonts at runtime. The restaurant's
// configured font (config.appearance.font) selects among these.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], display: "swap", weight: ["300", "400", "500", "600", "700"] });
const nunito = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin"], display: "swap" });
const dmsans = DM_Sans({ variable: "--font-dmsans", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "ServeHub — Restaurant Operations",
  description: "ServeHub is a self-hosted restaurant management and operations platform for Windows, Android and the web.",
  keywords: ["ServeHub", "restaurant", "operations", "orders", "POS", "kitchen", "waiter"],
  authors: [{ name: "ServeHub" }],
  icons: { icon: "/logo.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${inter.variable} ${manrope.variable} ${poppins.variable} ${nunito.variable} ${dmsans.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <SonnerToaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
