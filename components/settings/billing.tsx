"use client"

import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export default function BillingSettings() {
  // For now, everyone is on free plan
  const currentPlan = {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: [
      'Unlimited chat conversations',
      'AI-powered learning suggestions',
      'Code editor with execution',
      'Daily learning reminders',
      'Streak tracking',
    ],
    limits: {
      messages: 'Unlimited',
      threads: 'Unlimited',
    }
  }

  const upgradePlans = [
    {
      name: 'Pro',
      price: '$19',
      period: 'month',
      features: [
        'Everything in Free',
        'Priority AI responses',
        'Advanced code execution',
        'Extended chat history',
        'Custom notification schedules',
        'Priority support',
      ],
      popular: false,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      features: [
        'Everything in Pro',
        'Team collaboration',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantees',
      ],
      popular: false,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-mono font-bold text-2xl mb-2">Billing</h1>
        <p className="text-white/60 font-mono text-sm">Manage your subscription and billing</p>
      </div>

      {/* Current Plan */}
      <div className="bg-[#1E1A18] rounded-lg border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-mono font-bold text-xl text-white mb-1">Current Plan</h2>
            <p className="font-mono text-sm text-white/60">{currentPlan.name} Plan</p>
          </div>
          <div className="text-right">
            <p className="font-mono font-bold text-2xl text-white">{currentPlan.price}</p>
            <p className="font-mono text-xs text-white/60">/{currentPlan.period}</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <h3 className="font-mono font-bold text-white">Features:</h3>
          <ul className="space-y-2">
            {currentPlan.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="h-4 w-4 text-[#C9B59A] mt-0.5 flex-shrink-0" />
                <span className="font-mono text-sm text-white/80">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-4 border-t border-white/10">
          <p className="font-mono text-sm text-white/60 mb-2">Usage Limits:</p>
          <div className="flex gap-6">
            <div>
              <p className="font-mono text-xs text-white/40">Messages</p>
              <p className="font-mono font-bold text-white">{currentPlan.limits.messages}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-white/40">Threads</p>
              <p className="font-mono font-bold text-white">{currentPlan.limits.threads}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Plans */}
      <div>
        <h2 className="font-mono font-bold text-xl mb-4">Upgrade Plans</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {upgradePlans.map((plan) => (
            <div
              key={plan.name}
              className="bg-[#1E1A18] rounded-lg border border-white/10 p-6 space-y-4"
            >
              <div>
                <h3 className="font-mono font-bold text-lg text-white mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-bold text-2xl text-white">{plan.price}</span>
                  {plan.period && <span className="font-mono text-sm text-white/60">/{plan.period}</span>}
                </div>
              </div>

              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-[#C9B59A] mt-0.5 flex-shrink-0" />
                    <span className="font-mono text-sm text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210] font-mono font-bold"
                disabled
              >
                {plan.name === 'Enterprise' ? 'Contact Sales' : 'Coming Soon'}
              </Button>
            </div>
          ))}
        </div>
        <p className="font-mono text-xs text-white/40 mt-4">
          Upgrade options will be available soon. Stay tuned!
        </p>
      </div>
    </div>
  )
}

