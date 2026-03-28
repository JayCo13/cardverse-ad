import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Force all pages to dynamic rendering — prevents prerender failures on Netlify
export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CardVerse Admin Dashboard",
  description: "Internal portal for managing the CardVerse ecosystem",
};

import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-white text-black dark:bg-black dark:text-white antialiased transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
