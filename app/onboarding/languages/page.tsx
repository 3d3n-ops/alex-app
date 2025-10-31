"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useState, KeyboardEvent } from "react"
import { X } from "lucide-react"

export default function OnboardingLanguagesPage() {
  const router = useRouter()
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      addLanguage(inputValue.trim())
    }
  }

  const addLanguage = (language: string) => {
    const normalized = language.trim()
    if (normalized && !selectedLanguages.includes(normalized)) {
      setSelectedLanguages((prev) => [...prev, normalized])
      setInputValue("")
    }
  }

  const removeLanguage = (language: string) => {
    setSelectedLanguages((prev) => prev.filter((l) => l !== language))
  }

  const handleContinue = async () => {
    if (selectedLanguages.length === 0) {
      return // Don't allow continuing without at least one language
    }

    setIsSubmitting(true)
    try {
      // Get programming level from previous step
      const level = localStorage.getItem("programmingLevel")
      
      // Save to user profile via API
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programmingLevel: level || undefined,
          languages: selectedLanguages,
          onboardingCompleted: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save profile')
      }

      // Clear temporary localStorage
      localStorage.removeItem("programmingLevel")
      
      // Navigate to dashboard
      router.push("/dashboard")
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save your profile. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#161210] flex">
      {/* Left side - Question */}
      <div className="w-full md:w-1/2 flex flex-col p-6 md:p-12">
        {/* Header */}
        <div className="font-mono font-bold text-lg text-white mb-16">Alex</div>

        {/* Question */}
        <div className="flex-1 flex flex-col justify-center max-w-md">
          <h1 className="font-mono font-bold text-2xl md:text-3xl text-white mb-8 leading-tight">
            What languages do you know or have experience with?
          </h1>

          {/* Input field */}
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a language and press Enter..."
            className="w-full bg-[#2A2622] border-none text-white placeholder:text-white/40 font-mono mb-4 px-4 py-6 rounded-lg"
          />

          {/* Selected languages as chips */}
          {selectedLanguages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8 min-h-[3rem]">
              {selectedLanguages.map((language) => (
                <div
                  key={language}
                  className="inline-flex items-center gap-2 bg-[#C9B59A] text-[#161210] font-mono font-bold px-4 py-2 rounded-full text-sm"
                >
                  <span>{language}</span>
                  <button
                    onClick={() => removeLanguage(language)}
                    className="hover:bg-[#B8A589] rounded-full p-0.5 transition-colors"
                    aria-label={`Remove ${language}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Continue button */}
          <Button
            onClick={handleContinue}
            disabled={selectedLanguages.length === 0 || isSubmitting}
            className="w-full bg-white text-[#161210] hover:bg-white/90 font-mono font-bold px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Continue'}
          </Button>
        </div>
      </div>

      {/* Right side - Beige area */}
      <div className="hidden md:block w-1/2 bg-[#C9B59A]" />
    </div>
  )
}
