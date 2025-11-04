"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Save } from "lucide-react"

interface PrivacySettingsProps {
  profile: any
  onProfileUpdate: () => void
}

export default function PrivacySettings({ profile, onProfileUpdate }: PrivacySettingsProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [chatHistoryEnabled, setChatHistoryEnabled] = useState(profile?.chatHistoryEnabled ?? true)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistoryEnabled
        })
      })

      if (response.ok) {
        onProfileUpdate()
        alert('Privacy settings saved successfully!')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving privacy settings:', error)
      alert('Failed to save privacy settings. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono font-bold text-2xl mb-2">Privacy</h1>
        <p className="text-white/60 font-mono text-sm">Manage your privacy and data settings</p>
      </div>

      {/* Chat History */}
      <div className="bg-[#1E1A18] rounded-lg border border-white/10 p-6 space-y-6">
        <h2 className="font-mono font-bold text-lg">Chat History</h2>
        
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <Label className="font-mono text-white">Save chat history</Label>
            <p className="text-white/60 font-mono text-sm">
              When enabled, your conversations are saved locally in your browser for future reference. 
              When disabled, chat history will not be persisted after you close the browser.
            </p>
            <p className="text-white/40 font-mono text-xs mt-2">
              Note: Disabling this will clear existing chat history from your local storage.
            </p>
          </div>
          <Switch
            checked={chatHistoryEnabled}
            onCheckedChange={(checked) => setChatHistoryEnabled(checked)}
            className="data-[state=checked]:bg-[#C9B59A] mt-1"
          />
        </div>
      </div>

      {/* Privacy Policy */}
      <div className="bg-[#1E1A18] rounded-lg border border-white/10 p-6 space-y-4">
        <h2 className="font-mono font-bold text-lg">Privacy Policy</h2>
        
        <div className="space-y-4 text-white/80 font-mono text-sm leading-relaxed">
          <p>
            <strong className="text-white">Last Updated:</strong> {new Date().toLocaleDateString()}
          </p>
          
          <div className="space-y-3">
            <h3 className="font-bold text-white">Data Collection</h3>
            <p>
              We collect and store the following information:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Chat messages and conversations (stored locally in your browser when enabled)</li>
              <li>User profile information (programming level, languages, preferences)</li>
              <li>Usage analytics to improve our service</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-white">Data Storage</h3>
            <p>
              Your chat history is stored locally in your browser using IndexedDB. This data never leaves your device 
              unless you explicitly choose to share it. Your profile information is stored securely through our authentication provider.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-white">Third-Party Services</h3>
            <p>
              We use third-party AI services (OpenRouter, Anthropic) to process your chat messages. These services 
              may temporarily store your messages for processing purposes. Please refer to their privacy policies for more information.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-white">Your Rights</h3>
            <p>
              You have the right to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Disable chat history storage at any time</li>
              <li>Delete your account and associated data</li>
              <li>Request information about data we collect</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-white">Contact</h3>
            <p>
              If you have questions about this privacy policy, please contact us through your account settings.
            </p>
          </div>
        </div>
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

