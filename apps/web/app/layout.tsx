import type { Metadata } from "next";
import { site } from "@/lib/site";
import { FloatingDock } from "@/components/floating-dock";
import "./globals.css";

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <FloatingDock />
      </body>
    </html>
  );
}
