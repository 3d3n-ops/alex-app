import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

/**
 * Judge0 Code Execution API
 * 
 * Submits code to Judge0 API and returns execution results
 */

interface Judge0Submission {
  source_code: string
  language_id: number
  stdin?: string
  cpu_time_limit?: number
  memory_limit?: number
}

interface Judge0Response {
  token: string
  status?: {
    id: number
    description: string
  }
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  message?: string | null
  time?: string | null
  memory?: number | null
}

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
    const { code, languageId, stdin, cpuTimeLimit = 2, memoryLimit = 128000 } = body

    if (!code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'Code is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!languageId || typeof languageId !== 'number') {
      return new Response(JSON.stringify({ error: 'Valid language ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const judge0Url = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com'
    const apiKey = process.env.JUDGE0_API_KEY
    const rapidApiHost = process.env.JUDGE0_RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com'

    // Prepare submission
    const submission: Judge0Submission = {
      source_code: code,
      language_id: languageId,
      stdin: stdin || '',
      cpu_time_limit: cpuTimeLimit,
      memory_limit: memoryLimit,
    }

    // Submit code to Judge0
    const submitHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      submitHeaders['X-RapidAPI-Key'] = apiKey
      submitHeaders['X-RapidAPI-Host'] = rapidApiHost
    }

    const submitResponse = await fetch(`${judge0Url}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: submitHeaders,
      body: JSON.stringify(submission),
    })

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text().catch(() => 'Unknown error')
      console.error('Judge0 submission error:', errorText)
      return new Response(JSON.stringify({ 
        error: 'Failed to submit code to Judge0',
        details: errorText.substring(0, 500)
      }), {
        status: submitResponse.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const submitData: Judge0Response = await submitResponse.json()
    const token = submitData.token

    if (!token) {
      return new Response(JSON.stringify({ error: 'No token received from Judge0' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Poll for results (with timeout)
    const maxAttempts = 30 // 30 seconds max
    const pollInterval = 1000 // 1 second
    let attempts = 0

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const resultHeaders: HeadersInit = {}
      if (apiKey) {
        resultHeaders['X-RapidAPI-Key'] = apiKey
        resultHeaders['X-RapidAPI-Host'] = rapidApiHost
      }

      const resultResponse = await fetch(`${judge0Url}/submissions/${token}?base64_encoded=false`, {
        headers: resultHeaders,
      })

      if (!resultResponse.ok) {
        attempts++
        continue
      }

      const result: Judge0Response = await resultResponse.json()

      // Status IDs:
      // 1 = In Queue, 2 = Processing
      // 3 = Accepted, 4+ = Various errors
      if (result.status) {
        const statusId = result.status.id

        if (statusId === 1 || statusId === 2) {
          // Still processing, continue polling
          attempts++
          continue
        }

        // Execution completed (success or error)
        return new Response(JSON.stringify({
          success: statusId === 3,
          status: result.status.description,
          statusId,
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          compileOutput: result.compile_output || '',
          message: result.message || '',
          time: result.time || null,
          memory: result.memory || null,
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      attempts++
    }

    // Timeout
    return new Response(JSON.stringify({
      error: 'Execution timeout - code took too long to execute',
      token,
    }), {
      status: 408,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('Execute API error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error?.message || String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

