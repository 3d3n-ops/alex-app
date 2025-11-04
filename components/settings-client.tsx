"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import GeneralSettings from "@/components/settings/general"
import AccountSettings from "@/components/settings/account"
import PrivacySettings from "@/components/settings/privacy"
import BillingSettings from "@/components/settings/billing"
import { ThemeSelector } from "@/components/theme-selector"

type SettingsTab = 'general' | 'account' | 'privacy' | 'billing'

export default function SettingsClient() {
  const router = useRouter()
  const { user } = useUser()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
      }
    } catch (error) {
      console.error('Failed to load profile:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const tabs = [
    { id: 'general' as const, label: 'General' },
    { id: 'account' as const, label: 'Account' },
    { id: 'privacy' as const, label: 'Privacy' },
    { id: 'billing' as const, label: 'Billing' },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex h-screen">
        {/* Left Sidebar - Tabs */}
        <div className="w-64 border-r border-border bg-card p-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="text-foreground/80 hover:text-foreground hover:bg-muted font-mono mb-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-lg font-mono text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto">
            {activeTab === 'general' && <GeneralSettings profile={profile} onProfileUpdate={loadProfile} />}
            {activeTab === 'account' && <AccountSettings user={user} />}
            {activeTab === 'privacy' && <PrivacySettings profile={profile} onProfileUpdate={loadProfile} />}
            {activeTab === 'billing' && <BillingSettings />}
          </div>
        </div>
      </div>
      <ThemeSelector />
    </div>
  )
}

