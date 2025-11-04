'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

export function FaviconSwitcher() {
  const { theme, resolvedTheme } = useTheme()

  useEffect(() => {
    // Use resolvedTheme to get the actual theme (handles system theme)
    const currentTheme = resolvedTheme || theme || 'dark'
    
    // Light logo for dark mode, dark logo for light mode
    const faviconPath = currentTheme === 'dark' 
      ? '/alex-logo-light.png'
      : '/alex-logo-dark.png'

    // Update or create favicon - use PNG directly (modern browsers support PNG favicons)
    // Remove old favicon links first
    const oldFavicons = document.querySelectorAll("link[rel*='icon']")
    oldFavicons.forEach(link => link.remove())

    // Create new favicon link
    const faviconLink = document.createElement('link')
    faviconLink.rel = 'icon'
    faviconLink.href = faviconPath
    faviconLink.type = 'image/png'
    document.head.appendChild(faviconLink)

    // Also add shortcut icon for compatibility
    const shortcutIcon = document.createElement('link')
    shortcutIcon.rel = 'shortcut icon'
    shortcutIcon.href = faviconPath
    shortcutIcon.type = 'image/png'
    document.head.appendChild(shortcutIcon)

    // Update apple touch icon to use the same logo
    const oldAppleIcon = document.querySelector("link[rel='apple-touch-icon']")
    if (oldAppleIcon) oldAppleIcon.remove()
    
    const appleLink = document.createElement('link')
    appleLink.rel = 'apple-touch-icon'
    appleLink.href = faviconPath
    document.head.appendChild(appleLink)
  }, [theme, resolvedTheme])

  return null
}

