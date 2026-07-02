import type { Metadata } from "next";
import { site } from "@/lib/site";
import { FloatingDock } from "@/components/floating-dock";
import "./globals.css";

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
};

/** Sets data-theme before first paint so a stored "light" preference never flashes dark. */
const THEME_BOOT = `try{var t=localStorage.getItem("vayu-theme");if(t==="light"||(t===null&&window.matchMedia("(prefers-color-scheme: light)").matches)){document.documentElement.setAttribute("data-theme","light")}}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <FloatingDock />
      </body>
    </html>
  );
}
