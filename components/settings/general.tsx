"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Save } from "lucide-react"
import { useUser } from "@clerk/nextjs"

interface GeneralSettingsProps {
  profile: any
  onProfileUpdate: () => void
}

export default function GeneralSettings({ profile, onProfileUpdate }: GeneralSettingsProps) {
  const { user } = useUser()
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    programmingLevel: profile?.programmingLevel || '',
    languages: profile?.languages || [],
    languageInput: '',
    preferences: profile?.preferences || '',
    notificationsEnabled: profile?.notificationsEnabled !== undefined ? profile.notificationsEnabled : true,
    notificationTime: profile?.notificationTime || '09:00',
  })

  useEffect(() => {
    if (profile) {
      setFormData({
        programmingLevel: profile.programmingLevel || '',
        languages: profile.languages || [],
        languageInput: '',
        preferences: profile.preferences || '',
        notificationsEnabled: profile.notificationsEnabled !== undefined ? profile.notificationsEnabled : true,
        notificationTime: profile.notificationTime || '09:00',
      })
    }
  }, [profile])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programmingLevel: formData.programmingLevel,
          languages: formData.languages,
          preferences: formData.preferences,
          notificationsEnabled: formData.notificationsEnabled,
          notificationTime: formData.notificationTime,
        })
      })

      if (response.ok) {
        onProfileUpdate()
        // Show success message (you can use toast here)
        alert('Settings saved successfully!')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('Failed to save settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const addLanguage = () => {
    if (formData.languageInput.trim() && !formData.languages.includes(formData.languageInput.trim())) {
      setFormData({
        ...formData,
        languages: [...formData.languages, formData.languageInput.trim()],
        languageInput: ''
      })
    }
  }

  const removeLanguage = (lang: string) => {
    setFormData({
      ...formData,
      languages: formData.languages.filter((l: string) => l !== lang)
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono font-bold text-2xl mb-2">General Settings</h1>
        <p className="text-white/60 font-mono text-sm">Manage your profile and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-[#1E1A18] rounded-lg border border-white/10 p-6 space-y-6">
        <h2 className="font-mono font-bold text-lg">Profile</h2>

        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName" className="font-mono text-white">Full name</Label>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#C9B59A] flex items-center justify-center text-[#161210] font-mono font-bold">
              {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || ''}
            </div>
            <Input
              id="fullName"
              value={`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
              disabled
              className="flex-1 bg-[#2A2622] border-white/10 text-white font-mono"
            />
          </div>
          <p className="text-white/40 font-mono text-xs">Name managed by your account provider</p>
        </div>

        {/* Programming Level */}
        <div className="space-y-2">
          <Label htmlFor="programmingLevel" className="font-mono text-white">
            What level of programming are you at?
          </Label>
          <Select
            value={formData.programmingLevel}
            onValueChange={(value) => setFormData({ ...formData, programmingLevel: value })}
          >
            <SelectTrigger className="w-full bg-[#2A2622] border-white/10 text-white font-mono">
              <SelectValue placeholder="Select your programming level" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E1A18] border-white/10">
              <SelectItem value="beginner" className="font-mono">Beginner</SelectItem>
              <SelectItem value="intermediate" className="font-mono">Intermediate</SelectItem>
              <SelectItem value="advanced" className="font-mono">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Languages */}
        <div className="space-y-2">
          <Label htmlFor="languages" className="font-mono text-white">
            What languages do you know or have experience with?
          </Label>
          <div className="flex gap-2">
            <Input
              id="languages"
              value={formData.languageInput}
              onChange={(e) => setFormData({ ...formData, languageInput: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
              placeholder="Type a language and press Enter"
              className="flex-1 bg-[#2A2622] border-white/10 text-white font-mono placeholder:text-white/40"
            />
            <Button
              onClick={addLanguage}
              className="bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210] font-mono"
            >
              Add
            </Button>
          </div>
          {formData.languages.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.languages.map((lang: string) => (
                <div
                  key={lang}
                  className="inline-flex items-center gap-2 bg-[#C9B59A] text-[#161210] font-mono font-bold px-3 py-1 rounded-full text-sm"
                >
                  <span>{lang}</span>
                  <button
                    onClick={() => removeLanguage(lang)}
                    className="hover:bg-[#B8A589] rounded-full p-0.5 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preferences */}
        <div className="space-y-2">
          <Label htmlFor="preferences" className="font-mono text-white">
            What personal preferences should Alex consider in responses?
          </Label>
          <Textarea
            id="preferences"
            value={formData.preferences}
            onChange={(e) => setFormData({ ...formData, preferences: e.target.value })}
            placeholder="Enter your preferences..."
            className="bg-[#2A2622] border-white/10 text-white font-mono placeholder:text-white/40 min-h-24"
          />
          <p className="text-white/40 font-mono text-xs">
            Your preferences will apply to all conversations, within our guidelines.
          </p>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-[#1E1A18] rounded-lg border border-white/10 p-6 space-y-6">
        <h2 className="font-mono font-bold text-lg">Notifications</h2>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="font-mono text-white">Daily learning reminders</Label>
            <p className="text-white/60 font-mono text-sm">
              Get notified daily to continue your learning streak. We'll send you personalized reminders to help you maintain your progress.
            </p>
          </div>
          <Switch
            checked={formData.notificationsEnabled}
            onCheckedChange={(checked) => setFormData({ ...formData, notificationsEnabled: checked })}
            className="data-[state=checked]:bg-[#C9B59A]"
          />
        </div>

        {formData.notificationsEnabled && (
          <div className="space-y-2">
            <Label htmlFor="notificationTime" className="font-mono text-white">
              Notification time
            </Label>
            <Input
              id="notificationTime"
              type="time"
              value={formData.notificationTime}
              onChange={(e) => setFormData({ ...formData, notificationTime: e.target.value })}
              className="w-32 bg-[#2A2622] border-white/10 text-white font-mono"
            />
            <p className="text-white/40 font-mono text-xs">
              Choose when you'd like to receive daily learning reminders to maintain your streak.
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210] font-mono font-bold"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}

