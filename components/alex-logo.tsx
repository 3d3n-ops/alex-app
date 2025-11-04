'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

interface AlexLogoProps {
  className?: string
  height?: number
  width?: number
}

export function AlexLogo({ className = '', height = 32, width = 32 }: AlexLogoProps) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return placeholder to prevent layout shift
    return (
      <div 
        className={className}
        style={{ width, height }}
        aria-label="Alex Logo"
      />
    )
  }

  const currentTheme = resolvedTheme || theme || 'dark'
  // Light logo for dark mode, dark logo for light mode
  const logoSrc = currentTheme === 'dark' 
    ? '/alex-logo-light.png'
    : '/alex-logo-dark.png'

  return (
    <img
      src={logoSrc}
      alt="Alex Logo"
      width={width}
      height={height}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  )
}

