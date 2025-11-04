import { auth, currentUser } from "@clerk/nextjs/server"
import { openRouterChatOnce } from "@/lib/openrouter"
import type { ORMessage } from "@/lib/openrouter"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const streakDays: number = typeof body.streakDays === 'number' ? body.streakDays : 0
    const lastActiveDate: number | null = body.lastActiveDate || null

    // Get user profile context
    const user = await currentUser()
    const firstName = user?.firstName || 'there'
    
    // Determine notification tone based on streak and activity
    let toneContext = ''
    if (streakDays === 0) {
      toneContext = 'The user has no active streak. Use a motivating, encouraging tone to get them started.'
    } else if (streakDays >= 7) {
      toneContext = `The user has an impressive ${streakDays}-day streak! Use a celebratory, encouraging tone.`
    } else if (lastActiveDate) {
      const daysSinceLastActive = Math.floor((Date.now() - lastActiveDate) / (1000 * 60 * 60 * 24))
      if (daysSinceLastActive > 1) {
        toneContext = `The user hasn't been active for ${daysSinceLastActive} days. Use a mix of concern, humor, and gentle encouragement. Be a bit snarky but still friendly.`
      } else {
        toneContext = `The user has a ${streakDays}-day streak. Keep them motivated with positivity and encouragement.`
      }
    } else {
      toneContext = `The user has a ${streakDays}-day streak. Keep them motivated.`
    }

    const systemPrompt = `You are a friendly, motivational learning assistant that sends daily reminders to users. Your personality is:

- Fun and engaging (like Duolingo)
- Sometimes playful and slightly snarky when users miss days
- Encouraging and celebratory for streaks
- Personal and relatable
- Never mean or harsh - always supportive

Generate a short, engaging notification message (max 60 characters) that:
1. Encourages the user to continue learning
2. References their name (${firstName}) if appropriate
3. Uses emojis sparingly (1-2 max)
4. Is conversational and fun
5. Adapts to the context: ${toneContext}

Examples of good notifications:
- "Hey ${firstName}! Your ${streakDays}-day streak is 🔥 Keep it going!"
- "We miss you! Come back and continue learning today 💪"
- "Your code is calling... time to learn something new!"
- "Don't break the chain! ${streakDays} days strong 🎯"

Return ONLY the notification message text, no quotes or additional formatting.`

    const messages: ORMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: 'Generate a daily notification message for the user.'
      }
    ]

    const response = await openRouterChatOnce({
      model: 'anthropic/claude-sonnet-4.5',
      messages,
      temperature: 0.8,
      maxTokens: 100
    })

    const content = response?.choices?.[0]?.message?.content || ''
    
    // Clean up the response (remove quotes, extra whitespace)
    let notificationText = content.trim()
    notificationText = notificationText.replace(/^["']|["']$/g, '') // Remove surrounding quotes
    notificationText = notificationText.trim()
    
    // Fallback if AI response is empty or too long
    if (!notificationText || notificationText.length > 100) {
      if (streakDays === 0) {
        notificationText = `Hey ${firstName}! Ready to start your learning journey? 🚀`
      } else if (streakDays >= 7) {
        notificationText = `Amazing ${streakDays}-day streak! Keep it going 🔥`
      } else {
        notificationText = `Don't break your ${streakDays}-day streak! Come back today 💪`
      }
    }

    return new Response(JSON.stringify({ notification: notificationText }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error generating notification:', error)
    // Return default notification
    const user = await currentUser()
    const firstName = user?.firstName || 'there'
    return new Response(JSON.stringify({
      notification: `Hey ${firstName}! Time to continue learning 🎯`
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

