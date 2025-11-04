import { auth } from '@clerk/nextjs/server'
import { runCode } from '@/lib/judge0'

export const runtime = 'nodejs'

/**
 * Judge0 Code Execution API
 * 
 * Submits code to Judge0 API and returns execution results
 */

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
    const { code, languageId, stdin, additionalFiles } = body

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

    // Use the Judge0 utility function
    const result = await runCode({
      sourceCode: code,
      languageId,
      stdin: stdin || '',
      base64: true,
      additionalFiles: additionalFiles || [],
    })

    // Handle errors from runCode - check if it's an API/configuration error
    if (result.stderr && !result.stdout && !result.compile_output && !result.status) {
      // This is likely an API error, not a code execution error
      return new Response(JSON.stringify({
        error: result.stderr,
        message: result.message || result.stderr,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Return execution results
    const statusId = result.status?.id || 0
    return new Response(JSON.stringify({
      success: statusId === 3,
      status: result.status?.description || 'Unknown',
      statusId,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compileOutput: result.compile_output || '',
      message: result.message || '',
    }), {
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

