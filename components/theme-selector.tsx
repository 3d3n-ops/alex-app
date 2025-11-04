"use client"

import { useTheme } from "next-themes"
import { Monitor, Sun, Moon } from "lucide-react"
import { useEffect, useState } from "react"

export function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const currentTheme = theme || "system"

  return (
    <div className="flex items-center gap-1 bg-background border border-border rounded-lg p-1.5 shadow-lg">
      <button
        onClick={() => setTheme("system")}
        className={`p-2 rounded-full transition-all ${
          currentTheme === "system"
            ? "bg-white dark:bg-[#2a2622] text-foreground border border-border"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="System"
      >
        <Monitor className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("light")}
        className={`p-2 rounded-full transition-all ${
          currentTheme === "light"
            ? "bg-white dark:bg-[#2a2622] text-foreground border border-border"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Light"
      >
        <Sun className="h-4 w-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`p-2 rounded-full transition-all ${
          currentTheme === "dark"
            ? "bg-white dark:bg-[#2a2622] text-foreground border border-border"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Dark"
      >
        <Moon className="h-4 w-4" />
      </button>
    </div>
  )
}

