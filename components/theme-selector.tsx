"use client"

import { useTheme } from "@/lib/theme-context"
import { Monitor, Sun, Moon } from "lucide-react"

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="bg-card/80 backdrop-blur-sm border border-border rounded-full px-2 py-1.5 flex items-center gap-1 shadow-lg">
        <button
          onClick={() => setTheme("system")}
          className={`p-1.5 rounded-full transition-all ${
            theme === "system"
              ? "bg-accent/20 border border-border"
              : "hover:bg-accent/10"
          }`}
          title="System"
          aria-label="System theme"
        >
          <Monitor className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => setTheme("light")}
          className={`p-1.5 rounded-full transition-all ${
            theme === "light"
              ? "bg-accent/20 border border-border"
              : "hover:bg-accent/10"
          }`}
          title="Light"
          aria-label="Light theme"
        >
          <Sun className="h-4 w-4 text-foreground" />
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={`p-1.5 rounded-full transition-all ${
            theme === "dark"
              ? "bg-accent/20 border border-border"
              : "hover:bg-accent/10"
          }`}
          title="Dark"
          aria-label="Dark theme"
        >
          <Moon className="h-4 w-4 text-foreground" />
        </button>
      </div>
    </div>
  )
}

