import type React from "react"
import type { Metadata } from "next"
import { Space_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "@/components/theme-provider"
import { FaviconSwitcher } from "@/components/favicon-switcher"
import "./globals.css"

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
})

export const metadata: Metadata = {
  title: "Alex - The AI Programming Tutor",
  description: "Built for the next generation of builders with AI, made for students and professionals",
  icons: {
    icon: [
      { url: '/alex-logo-dark.png', sizes: 'any', type: 'image/png' },
    ],
    apple: [
      { url: '/alex-logo-dark.png', sizes: 'any', type: 'image/png' },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`${spaceMono.variable} font-mono antialiased`}>
          <FaviconSwitcher />
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
