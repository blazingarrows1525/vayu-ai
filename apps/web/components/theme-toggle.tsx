"use client";

import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("vayu-theme", theme);
  } catch {
    /* storage unavailable (private mode) — theme still applies for the session */
  }
}

/** Dark/light switch. The no-flash boot script in layout.tsx sets the initial attribute before
 *  paint; this reflects it and flips it. */
export function ThemeToggle({
  className,
  size = "sm",
  tooltipSide = "bottom",
}: {
  className?: string;
  size?: "sm" | "md";
  tooltipSide?: "top" | "bottom";
}) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    if (document.documentElement.getAttribute("data-theme") === "light") setTheme("light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return (
    <IconButton
      label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      icon={theme === "dark" ? <Sun className="h-full w-full" /> : <Moon className="h-full w-full" />}
      size={size}
      tooltipSide={tooltipSide}
      onClick={toggle}
      className={className}
    />
  );
}
