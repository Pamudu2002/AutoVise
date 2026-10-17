"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Toaster>{children}</Toaster>
    </ThemeProvider>
  );
}
