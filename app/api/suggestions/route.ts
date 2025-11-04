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
    const recentMessages: string[] = Array.isArray(body.recentMessages) ? body.recentMessages : []

    // Get user profile context
    const user = await currentUser()
    const userProfileContext = user ? `
User profile:
- Programming level: ${user.publicMetadata?.programmingLevel || 'Not specified'}
- Languages: ${Array.isArray(user.publicMetadata?.languages) ? user.publicMetadata.languages.join(', ') : 'Not specified'}
` : ''

    // Build context from recent messages
    const chatContext = recentMessages.length > 0
      ? `Recent learning topics from user's chat history:\n${recentMessages.slice(-5).map((msg, i) => `${i + 1}. ${msg.substring(0, 200)}`).join('\n')}`
      : 'User has no chat history yet.'

    const systemPrompt = `You are an AI learning assistant that suggests personalized learning paths based on a user's previous learning activities.

${userProfileContext}

${chatContext}

Generate exactly 3 learning suggestions. Each suggestion should have:
1. A short title (max 50 characters) - e.g., "Website building: HTML, CSS & Javascript"
2. An enriched, detailed prompt that will be used as the chat question

The enriched prompt format should be:
"[Title]: [Detailed instruction/question]"

For example:
"Website building: HTML, CSS & Javascript: Instruct me on the basics of website building with HTML & CSS & Javascript. Walk me through key concepts like css design, how the dom works, and the basics of javascript for web development"

The enriched prompts should:
- Build upon topics the user has already explored (if they have chat history)
- Be relevant to their programming level and interests
- Be specific and actionable
- Include the title followed by a colon, then a detailed learning request
- Cover key concepts the user should learn about that topic

Return ONLY a JSON array of exactly 3 objects, each with "title" and "prompt" fields. Example:
[
  {
    "title": "Learn to code in Python",
    "prompt": "Learn to code in Python: Teach me Python programming from the ground up. Walk me through fundamental concepts like variables, data types, control flow, functions, and object-oriented programming. Include practical examples and exercises."
  },
  {
    "title": "Making REST APIs",
    "prompt": "Making REST APIs: Guide me through building REST APIs. Explain HTTP methods, request/response formats, status codes, authentication, and best practices. Show me how to create endpoints and handle different types of requests."
  },
  {
    "title": "Website building: HTML, CSS & Javascript",
    "prompt": "Website building: HTML, CSS & Javascript: Instruct me on the basics of website building with HTML & CSS & Javascript. Walk me through key concepts like css design, how the dom works, and the basics of javascript for web development"
  }
]`

    const messages: ORMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: 'Generate 3 personalized learning suggestions based on my chat history and profile.'
      }
    ]

    const response = await openRouterChatOnce({
      model: 'anthropic/claude-sonnet-4.5',
      messages,
      temperature: 0.7,
      maxTokens: 800
    })

    const content = response?.choices?.[0]?.message?.content || ''
    
    // Default enriched suggestions
    const defaultSuggestions = [
      {
        title: "Learn to code in Python",
        prompt: "Learn to code in Python: Teach me Python programming from the ground up. Walk me through fundamental concepts like variables, data types, control flow, functions, and object-oriented programming. Include practical examples and exercises."
      },
      {
        title: "Making REST APIs",
        prompt: "Making REST APIs: Guide me through building REST APIs. Explain HTTP methods, request/response formats, status codes, authentication, and best practices. Show me how to create endpoints and handle different types of requests."
      },
      {
        title: "Website building: HTML, CSS & Javascript",
        prompt: "Website building: HTML, CSS & Javascript: Instruct me on the basics of website building with HTML & CSS & Javascript. Walk me through key concepts like css design, how the dom works, and the basics of javascript for web development"
      }
    ]
    
    // Try to parse JSON from the response
    let suggestions: Array<{ title: string; prompt: string }> = []
    try {
      // Extract JSON array from the response (might have markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          suggestions = parsed
            .filter((s: any) => s && typeof s === 'object' && s.title && s.prompt)
            .map((s: any) => ({
              title: String(s.title).trim(),
              prompt: String(s.prompt).trim()
            }))
            .filter((s: { title: string; prompt: string }) => s.title.length > 0 && s.prompt.length > 0)
        }
      } else {
        // Fallback: try parsing the whole content
        const parsed = JSON.parse(content)
        if (Array.isArray(parsed)) {
          suggestions = parsed
            .filter((s: any) => s && typeof s === 'object' && s.title && s.prompt)
            .map((s: any) => ({
              title: String(s.title).trim(),
              prompt: String(s.prompt).trim()
            }))
            .filter((s: { title: string; prompt: string }) => s.title.length > 0 && s.prompt.length > 0)
        }
      }
      
      // Validate and ensure we have exactly 3 suggestions
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('Invalid suggestions format')
      }
      
      // Ensure we have exactly 3
      while (suggestions.length < 3) {
        suggestions.push(defaultSuggestions[suggestions.length])
      }
      
      suggestions = suggestions.slice(0, 3)
    } catch (parseError) {
      console.error('Failed to parse AI suggestions:', parseError)
      // Return default suggestions on parse error
      suggestions = defaultSuggestions
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Error generating suggestions:', error)
    // Return default suggestions on error
    return new Response(JSON.stringify({
      suggestions: [
        {
          title: "Learn to code in Python",
          prompt: "Learn to code in Python: Teach me Python programming from the ground up. Walk me through fundamental concepts like variables, data types, control flow, functions, and object-oriented programming. Include practical examples and exercises."
        },
        {
          title: "Making REST APIs",
          prompt: "Making REST APIs: Guide me through building REST APIs. Explain HTTP methods, request/response formats, status codes, authentication, and best practices. Show me how to create endpoints and handle different types of requests."
        },
        {
          title: "Website building: HTML, CSS & Javascript",
          prompt: "Website building: HTML, CSS & Javascript: Instruct me on the basics of website building with HTML & CSS & Javascript. Walk me through key concepts like css design, how the dom works, and the basics of javascript for web development"
        }
      ]
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

