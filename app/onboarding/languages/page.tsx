"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function OnboardingLanguagesPage() {
  const router = useRouter()
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [inputValue, setInputValue] = useState("")

  const suggestedLanguages = ["Python", "Javascript", "Typescript"]

  const toggleLanguage = (language: string) => {
    setSelectedLanguages((prev) => (prev.includes(language) ? prev.filter((l) => l !== language) : [...prev, language]))
  }

  const handleContinue = () => {
    // Store in localStorage or database
    localStorage.setItem("languages", JSON.stringify(selectedLanguages))
    // Navigate to dashboard or next step
    router.push("/dashboard")
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
            placeholder="Type a language..."
            className="w-full bg-[#2A2622] border-none text-white placeholder:text-white/40 font-mono mb-4 px-4 py-6 rounded-lg"
          />

          {/* Suggested languages */}
          <div className="flex flex-wrap gap-3 mb-8">
            {suggestedLanguages.map((language) => (
              <Button
                key={language}
                onClick={() => toggleLanguage(language)}
                className={`font-mono font-bold px-4 py-2 rounded-full text-sm ${
                  selectedLanguages.includes(language)
                    ? "bg-[#C9B59A] text-[#161210] hover:bg-[#B8A589]"
                    : "bg-[#3A3632] text-white hover:bg-[#4A4642]"
                }`}
              >
                {language}
              </Button>
            ))}
          </div>

          {/* Continue button */}
          <Button
            onClick={handleContinue}
            className="w-full bg-white text-[#161210] hover:bg-white/90 font-mono font-bold px-6 py-3 rounded-lg"
          >
            Continue
          </Button>
        </div>
      </div>

      {/* Right side - Beige area */}
      <div className="hidden md:block w-1/2 bg-[#C9B59A]" />
    </div>
  )
}
