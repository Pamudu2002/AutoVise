"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/** Light / dark / system segmented control. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = mounted ? theme : undefined;
  const opts = [
    { v: "light", label: "Light theme", Icon: Sun },
    { v: "dark", label: "Dark theme", Icon: Moon },
    { v: "system", label: "Use system theme", Icon: Monitor },
  ] as const;
  return (
    <div className="seg" role="group" aria-label="Colour theme">
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          className={`seg-btn${current === v ? " on" : ""}`}
          aria-label={label}
          aria-pressed={current === v}
          onClick={() => setTheme(v)}
        >
          <Icon size={16} aria-hidden />
        </button>
      ))}
    </div>
  );
}
