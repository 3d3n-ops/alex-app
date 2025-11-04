"use client"

import { useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface AccountSettingsProps {
  user: any
}

export default function AccountSettings({ user: userProp }: AccountSettingsProps) {
  const { user } = useUser()

  const displayUser = userProp || user

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono font-bold text-2xl mb-2">Account</h1>
        <p className="text-white/60 font-mono text-sm">Manage your account information</p>
      </div>

      <div className="bg-[#1E1A18] rounded-lg border border-white/10 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-[#C9B59A] text-[#161210] font-mono font-bold text-lg">
              {displayUser?.firstName?.[0] || 'U'}{displayUser?.lastName?.[0] || ''}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-mono font-bold text-lg text-white">
              {displayUser?.firstName || ''} {displayUser?.lastName || ''}
            </p>
            <p className="font-mono text-sm text-white/60">{displayUser?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-white/10">
          <div className="space-y-2">
            <Label className="font-mono text-white">Email</Label>
            <Input
              value={displayUser?.primaryEmailAddress?.emailAddress || ''}
              disabled
              className="bg-[#2A2622] border-white/10 text-white font-mono"
            />
            <p className="text-white/40 font-mono text-xs">Email managed by your account provider</p>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-white">Account ID</Label>
            <Input
              value={displayUser?.id || ''}
              disabled
              className="bg-[#2A2622] border-white/10 text-white font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-white">Member since</Label>
            <Input
              value={displayUser?.createdAt ? new Date(displayUser.createdAt).toLocaleDateString() : 'N/A'}
              disabled
              className="bg-[#2A2622] border-white/10 text-white font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

