/**
 * TTS API endpoint for streaming OpenAI TTS audio
 * Supports streaming text-to-speech as text comes in
 */

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const text = body.text || ''
    const model = body.model || 'tts-1' // 'tts-1' (fast) or 'tts-1-hd' (higher quality)
    const voice = body.voice || 'alloy' // alloy, echo, fable, onyx, nova, shimmer
    const speed = body.speed || 1.0 // 0.25 to 4.0
    
    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        speed,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      return new Response(JSON.stringify({ 
        error: 'OpenAI TTS error',
        details: errorText.substring(0, 500)
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Stream the audio response
    const audioBuffer = await response.arrayBuffer()
    
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'Content-Length': String(audioBuffer.byteLength),
      }
    })
  } catch (error: any) {
    console.error('TTS API error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error?.message || String(error)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

