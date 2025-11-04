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

    // Determine the correct endpoint URL and format
    const isRapidAPI = judge0Url.includes('rapidapi')
    // Ensure URL doesn't have trailing slash (reuse for both submission and polling)
    const baseUrl = judge0Url.replace(/\/$/, '')
    const submissionsUrl = `${baseUrl}/submissions?base64_encoded=false&wait=false`

    // Retry logic for transient gateway errors
    let submitResponse: Response | null = null
    let lastError: any = null
    let cachedErrorText: string | null = null // Store error text we read during retry logic
    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        submitResponse = await fetch(submissionsUrl, {
          method: 'POST',
          headers: submitHeaders,
          body: JSON.stringify(submission),
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(15000), // 15 second timeout
        })

        // If we get a successful response, break out of retry loop
        if (submitResponse.ok) {
          break
        }

        // Read error text to check for gateway errors (including 500 with gateway message)
        const status = submitResponse.status
        let errorText = ''
        try {
          errorText = await submitResponse.text()
          cachedErrorText = errorText // Store for later use
        } catch {
          // Failed to read error text, continue with status check
        }

        // Check if it's a gateway error that we should retry
        // Gateway errors can be 502, 503, 504, or 500 with "gateway" in error text
        const isGatewayError = 
          status === 502 || 
          status === 503 || 
          status === 504 ||
          (status === 500 && errorText.toLowerCase().includes('gateway'))

        if (isGatewayError && retryCount < maxRetries - 1) {
          retryCount++
          console.warn(`Judge0 gateway error (${status}), retrying (${retryCount}/${maxRetries})...`)
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
          // Reset cached error text for next attempt
          cachedErrorText = null
          continue
        }

        // Non-retryable error or max retries reached, break
        break
      } catch (error: any) {
        lastError = error
        cachedErrorText = null // Reset on new attempt
        // If it's a timeout or network error and we have retries left, retry
        if (retryCount < maxRetries - 1 && (error.name === 'TimeoutError' || error.name === 'TypeError')) {
          retryCount++
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
          continue
        }
        // Otherwise, break and handle the error
        break
      }
    }

    if (!submitResponse || !submitResponse.ok) {
      let errorText = cachedErrorText || '' // Use cached error text if available
      let errorJson: any = null
      
      try {
        if (!cachedErrorText && submitResponse) {
          // Only try to read if we haven't already read it
          errorText = await submitResponse.text()
        } else if (cachedErrorText) {
          errorText = cachedErrorText
        } else if (lastError) {
          errorText = lastError.message || String(lastError)
        }
        
        // Try to parse as JSON
        if (errorText) {
          try {
            errorJson = JSON.parse(errorText)
          } catch {
            // Not JSON, use as text
          }
        }
      } catch {
        // Error reading response
        errorText = lastError?.message || cachedErrorText || 'Failed to connect to Judge0 API'
      }
      
      const status = submitResponse?.status || 500
      
      // Enhanced gateway detection for logging
      const isGatewayError = 
        status === 502 || 
        status === 503 || 
        status === 504 ||
        (status === 500 && errorText.toLowerCase().includes('gateway'))
      
      console.error('Judge0 submission error:', {
        status,
        statusText: submitResponse?.statusText || 'No response',
        errorText: errorText.substring(0, 1000),
        errorJson,
        url: submissionsUrl,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length || 0,
        retryCount,
        isGatewayError
      })
      
      // Provide more helpful error messages
      let errorMessage = 'Failed to submit code to Judge0'
      if (status === 401 || status === 403) {
        errorMessage = 'Judge0 API authentication failed. Please check your JUDGE0_API_KEY in environment variables.'
      } else if (status === 429) {
        errorMessage = 'Judge0 API rate limit exceeded. Please try again later or upgrade your plan.'
      } else if (isGatewayError) {
        errorMessage = `Judge0 API gateway error (${status}). This may be a temporary issue. Please try again in a moment.`
      } else if (!apiKey && isRapidAPI) {
        errorMessage = 'Judge0 API key is missing. Please set JUDGE0_API_KEY in your environment variables.'
      } else if (lastError?.name === 'TimeoutError') {
        errorMessage = 'Judge0 API request timed out. The service may be overloaded. Please try again later.'
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: errorJson?.message || errorText.substring(0, 500),
        status,
        suggestion: !apiKey && isRapidAPI 
          ? 'Make sure JUDGE0_API_KEY and JUDGE0_RAPIDAPI_HOST are set in .env.local'
          : isGatewayError
          ? 'Gateway errors are often temporary. The request was retried automatically. Wait a few moments and try again.'
          : undefined
      }), {
        status: status >= 400 && status < 500 ? status : 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    let submitData: Judge0Response
    try {
      submitData = await submitResponse.json()
    } catch (error) {
      const responseText = await submitResponse.text().catch(() => '')
      console.error('Failed to parse Judge0 response:', responseText)
      return new Response(JSON.stringify({ 
        error: 'Invalid response from Judge0 API',
        details: responseText.substring(0, 500)
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
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
    let consecutiveGatewayErrors = 0
    const maxConsecutiveGatewayErrors = 5 // Stop after 5 consecutive gateway errors

    // Reuse baseUrl from above (already defined without trailing slash)

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval))

      const resultHeaders: HeadersInit = {}
      if (apiKey) {
        resultHeaders['X-RapidAPI-Key'] = apiKey
        resultHeaders['X-RapidAPI-Host'] = rapidApiHost
      }

      let resultResponse: Response | null = null
      let result: Judge0Response | null = null

      try {
        resultResponse = await fetch(`${baseUrl}/submissions/${token}?base64_encoded=false`, {
          headers: resultHeaders,
          signal: AbortSignal.timeout(10000), // 10 second timeout for polling
        })

        if (!resultResponse.ok) {
          const status = resultResponse.status
          
          // Read error text to check for gateway errors in 500 responses
          let errorText = ''
          try {
            errorText = await resultResponse.text()
          } catch {
            // Failed to read error text
          }
          
          // Handle gateway errors during polling (502, 503, 504, or 500 with gateway message)
          const isGatewayError = 
            status === 502 || 
            status === 503 || 
            status === 504 ||
            (status === 500 && errorText.toLowerCase().includes('gateway'))
          
          if (isGatewayError) {
            consecutiveGatewayErrors++
            console.warn(`Judge0 polling gateway error (${status}), attempt ${attempts + 1}/${maxAttempts}, consecutive errors: ${consecutiveGatewayErrors}`)
            
            // If too many consecutive gateway errors, fail early
            if (consecutiveGatewayErrors >= maxConsecutiveGatewayErrors) {
              return new Response(JSON.stringify({
                error: `Judge0 API gateway errors during polling (${status}). The service may be experiencing issues.`,
                token,
                suggestion: 'Please try again in a few moments.'
              }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' }
              })
            }
            
            // Continue polling but with slightly longer delay for gateway errors
            attempts++
            continue
          }

          // For other errors, log and continue (might be temporary)
          console.warn(`Judge0 polling error: ${status} ${resultResponse.statusText}`)
          attempts++
          continue
        }

        // Reset consecutive gateway error counter on success
        consecutiveGatewayErrors = 0

        try {
          result = await resultResponse.json()
        } catch (parseError) {
          console.error('Failed to parse Judge0 polling response:', parseError)
          attempts++
          continue
        }

        // Check if result was parsed successfully
        if (!result) {
          attempts++
          continue
        }

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
      } catch (error: any) {
        // Handle timeout or network errors
        if (error.name === 'TimeoutError' || error.name === 'TypeError') {
          console.warn(`Judge0 polling timeout/network error, attempt ${attempts + 1}/${maxAttempts}`)
          attempts++
          continue
        }
        
        // Unexpected error, log and continue
        console.error('Judge0 polling unexpected error:', error)
        attempts++
      }
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

