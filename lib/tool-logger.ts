/**
 * Subtle logging utility for tool usage tracking
 */

type ToolLog = {
  tool: string
  args: any
  result?: any
  error?: string
  duration?: number
  threadId?: string
  timestamp: number
}

// Store recent logs in memory (last 100 entries)
const toolLogs: ToolLog[] = []
const MAX_LOGS = 100

function addLog(log: ToolLog) {
  toolLogs.push(log)
  if (toolLogs.length > MAX_LOGS) {
    toolLogs.shift()
  }
}

/**
 * Log tool execution with subtle console output
 */
export function logTool(tool: string, args: any, result?: any, error?: string, duration?: number, threadId?: string) {
  const log: ToolLog = {
    tool,
    args: typeof args === 'object' ? { ...args } : args, // Shallow copy to avoid mutating
    result: result !== undefined ? (typeof result === 'object' ? { ...result, _truncated: result.content ? 'content truncated' : undefined } : result) : undefined,
    error,
    duration,
    threadId,
    timestamp: Date.now()
  }
  
  addLog(log)
  
  // Subtle console logging (only in development or if DEBUG_TOOLS is set)
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
    const prefix = `[Tool:${tool}]`
    const threadPrefix = threadId ? `[Thread:${threadId.substring(0, 8)}...]` : ''
    
    if (error) {
      console.log(`%c${prefix} ${threadPrefix} ❌ Error`, 'color: #ef4444; font-weight: bold', {
        args: sanitizeArgs(args),
        error
      })
    } else {
      const resultSummary = summarizeResult(result)
      const durationStr = duration ? `(${duration}ms)` : ''
      console.log(`%c${prefix} ${threadPrefix} ✓ ${resultSummary} ${durationStr}`, 'color: #10b981; font-weight: normal', {
        args: sanitizeArgs(args),
        result: resultSummary
      })
    }
  }
}

function sanitizeArgs(args: any): any {
  if (typeof args !== 'object' || args === null) return args
  
  const sanitized: any = { ...args }
  // Truncate large content fields
  if (sanitized.content && typeof sanitized.content === 'string' && sanitized.content.length > 100) {
    sanitized.content = sanitized.content.substring(0, 100) + '... (truncated)'
  }
  return sanitized
}

function summarizeResult(result: any): string {
  if (!result || typeof result !== 'object') return 'OK'
  
  if (result.error) return `Error: ${result.error}`
  if (result.files) return `Found ${result.files.length} files`
  if (result.count !== undefined) return `Count: ${result.count}`
  if (result.content) return `Content: ${result.content.length} chars, ${result.lines || 0} lines`
  if (result.success === false) return 'Failed'
  if (result.success === true) return 'Success'
  
  return 'OK'
}

/**
 * Get recent tool logs (for debugging)
 */
export function getToolLogs(limit = 50): ToolLog[] {
  return toolLogs.slice(-limit)
}

/**
 * Clear tool logs
 */
export function clearToolLogs() {
  toolLogs.length = 0
}

