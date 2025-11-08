/**
 * Agent Evaluation System
 * Tests tool call correctness, error rates, and agent performance
 */

import 'dotenv/config'
import { openRouterChatOnce, type ORMessage, type ORTool } from '@/lib/openrouter'
import { buildTools, buildORToolsFromRegistry, buildClientUITools, buildEditorTools } from '@/lib/tools'
import { loadAgentConfig, normalizeAgent } from '@/lib/agents'

// Ensure OPENROUTER_API_KEY is available
if (!process.env.OPENROUTER_API_KEY) {
  console.error('❌ Error: OPENROUTER_API_KEY environment variable is not set')
  console.error('Please set it in your .env file or export it before running the eval:')
  console.error('  export OPENROUTER_API_KEY=your_key_here')
  process.exit(1)
}

export type EvalResult = {
  testName: string
  passed: boolean
  error?: string
  metrics: {
    toolCallCount: number
    toolCallErrors: number
    toolCallErrorRate: number
    responseTime: number
    toolExecutionTime: number
    invalidToolCalls: Array<{ tool: string; reason: string }>
    toolUseIdMismatches: number
  }
  details: {
    messages: ORMessage[]
    toolCalls: Array<{ name: string; args: any; callId: string }>
    toolResults: Array<{ callId: string; success: boolean; error?: string }>
  }
}

export type EvalSuite = {
  name: string
  tests: Array<{
    name: string
    description: string
    messages: ORMessage[]
    expectedTools?: string[]
    shouldFail?: boolean
  }>
}

/**
 * Validate tool_use_id matching between tool_calls and tool_results
 */
function validateToolUseIds(messages: ORMessage[]): number {
  let mismatches = 0
  let lastAssistantToolCallIds: string[] = []

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    
    if (msg.role === 'assistant' && 'tool_calls' in msg && msg.tool_calls) {
      // Extract all tool call IDs from this assistant message
      lastAssistantToolCallIds = []
      for (const call of msg.tool_calls) {
        const callId = (call as any)?.id || (call as any)?.call_id || (call as any)?.tool_use_id
        if (callId) {
          lastAssistantToolCallIds.push(callId)
        }
      }
    } else if (msg.role === 'tool') {
      // Check if this tool result has a matching tool_call_id
      const toolCallId = msg.tool_call_id
      if (toolCallId && !lastAssistantToolCallIds.includes(toolCallId)) {
        mismatches++
      }
    }
  }

  return mismatches
}

/**
 * Extract tool call IDs from assistant message
 */
function extractToolCallIds(assistantMessage: any): string[] {
  const ids: string[] = []
  if (assistantMessage.tool_calls && Array.isArray(assistantMessage.tool_calls)) {
    for (const call of assistantMessage.tool_calls) {
      const callId = call?.id || call?.call_id || call?.tool_use_id
      if (callId) {
        ids.push(callId)
      }
    }
  }
  return ids
}

/**
 * Run a single eval test
 */
export async function runEvalTest(
  testName: string,
  messages: ORMessage[],
  tools: ORTool[],
  model: string = 'anthropic/claude-sonnet-4.5'
): Promise<EvalResult> {
  const startTime = Date.now()
  const metrics = {
    toolCallCount: 0,
    toolCallErrors: 0,
    toolCallErrorRate: 0,
    responseTime: 0,
    toolExecutionTime: 0,
    invalidToolCalls: [] as Array<{ tool: string; reason: string }>,
    toolUseIdMismatches: 0,
  }

  const details = {
    messages: [] as ORMessage[],
    toolCalls: [] as Array<{ name: string; args: any; callId: string }>,
    toolResults: [] as Array<{ callId: string; success: boolean; error?: string }>,
  }

  let error: string | undefined
  let passed = false

  try {
    // Build tool registries
    const serverRegistry = buildTools()
    const editorRegistry = buildEditorTools()
    const allRegistry = { ...serverRegistry, ...editorRegistry }

    // Start with initial messages
    let turnMessages: ORMessage[] = [...messages]
    const maxTurns = 6
    let toolExecutionStart = 0

    for (let turn = 0; turn < maxTurns; turn++) {
      const responseStart = Date.now()
      const resJson = await openRouterChatOnce({
        model,
        messages: turnMessages,
        tools,
        temperature: 0.2,
        maxTokens: 1200,
      })

      metrics.responseTime += Date.now() - responseStart

      const choice = resJson?.choices?.[0]
      if (!choice || choice?.error) {
        error = choice?.error?.message || resJson?.error?.message || 'API error'
        break
      }

      const msg = choice?.message
      const assistantContent: string = msg?.content || ''
      const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []

      // Track tool calls
      const assistantToolCallIds = extractToolCallIds(msg)
      for (const call of toolCalls) {
        const name: string | undefined = call?.function?.name || call?.name
        const argsRaw: string | object | undefined = call?.function?.arguments || call?.arguments
        const callId: string | undefined = call?.id || call?.call_id

        if (callId) {
          details.toolCalls.push({
            name: name || 'unknown',
            args: typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw,
            callId,
          })
          metrics.toolCallCount++
        }

        // Validate tool exists
        if (name && !allRegistry[name] && !buildClientUITools().find(t => t.function.name === name)) {
          metrics.invalidToolCalls.push({
            tool: name,
            reason: 'Tool not found in registry',
          })
        }
      }

      // Add assistant message to conversation
      turnMessages.push({
        role: 'assistant',
        content: assistantContent || '',
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      })

      details.messages.push(turnMessages[turnMessages.length - 1])

      if (toolCalls.length === 0) {
        // No more tool calls, done
        break
      }

      // Execute tools
      toolExecutionStart = Date.now()
      for (const call of toolCalls) {
        const name: string | undefined = call?.function?.name || call?.name
        const argsRaw: string | object | undefined = call?.function?.arguments || call?.arguments
        const callId: string | undefined = call?.id || call?.call_id

        // Skip UI tools (client-side only)
        if (name && buildClientUITools().find(t => t.function.name === name)) {
          continue
        }

        const spec = name ? allRegistry[name] : undefined
        if (!name || !spec) {
          metrics.toolCallErrors++
          turnMessages.push({
            role: 'tool',
            content: `Tool not found: ${name || 'unknown'}`,
            tool_call_id: callId || 'unknown',
          })
          details.toolResults.push({
            callId: callId || 'unknown',
            success: false,
            error: `Tool not found: ${name || 'unknown'}`,
          })
          continue
        }

        let parsed: unknown = {}
        try {
          const asObj = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : (argsRaw || {})
          parsed = spec.zodSchema.parse(asObj)
        } catch (e: any) {
          metrics.toolCallErrors++
          const errorMsg = `Invalid args: ${e?.message || e}`
          turnMessages.push({
            role: 'tool',
            content: errorMsg,
            tool_call_id: callId || 'unknown',
          })
          details.toolResults.push({
            callId: callId || 'unknown',
            success: false,
            error: errorMsg,
          })
          continue
        }

        try {
          const out = await spec.execute(parsed)
          turnMessages.push({
            role: 'tool',
            content: JSON.stringify(out),
            tool_call_id: callId || 'unknown',
          })
          details.toolResults.push({
            callId: callId || 'unknown',
            success: true,
          })
        } catch (e: any) {
          metrics.toolCallErrors++
          const errorMsg = `Execution error: ${e?.message || e}`
          turnMessages.push({
            role: 'tool',
            content: errorMsg,
            tool_call_id: callId || 'unknown',
          })
          details.toolResults.push({
            callId: callId || 'unknown',
            success: false,
            error: errorMsg,
          })
        }
      }
      metrics.toolExecutionTime += Date.now() - toolExecutionStart
    }

    // Validate tool_use_id matching
    metrics.toolUseIdMismatches = validateToolUseIds(turnMessages)

    // Calculate error rate
    metrics.toolCallErrorRate =
      metrics.toolCallCount > 0 ? metrics.toolCallErrors / metrics.toolCallCount : 0

    // Test passes if no critical errors
    passed = !error && metrics.toolUseIdMismatches === 0

    details.messages = turnMessages
  } catch (e: any) {
    error = e?.message || String(e)
    passed = false
  }

  metrics.responseTime = Date.now() - startTime

  return {
    testName,
    passed,
    error,
    metrics,
    details,
  }
}

/**
 * Run a suite of eval tests
 */
export async function runEvalSuite(
  suite: EvalSuite,
  model: string = 'anthropic/claude-sonnet-4.5'
): Promise<EvalResult[]> {
  const { systemPrompt } = await loadAgentConfig(normalizeAgent('alexTutor'))
  
  // Build all tools
  const uiTools = buildClientUITools()
  const editorTools = buildORToolsFromRegistry(buildEditorTools())
  const serverTools = buildORToolsFromRegistry(buildTools())
  const allTools = [...editorTools, ...serverTools, ...uiTools]

  const results: EvalResult[] = []

  for (const test of suite.tests) {
    const messages: ORMessage[] = [
      { role: 'system', content: systemPrompt },
      ...test.messages,
    ]

    const result = await runEvalTest(test.name, messages, allTools, model)
    results.push(result)

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return results
}

/**
 * Built-in test suites
 */
export const evalSuites = {
  /**
   * Tests basic tool call functionality
   */
  basicToolCalls: (): EvalSuite => ({
    name: 'Basic Tool Calls',
    tests: [
      {
        name: 'list_files',
        description: 'Agent should successfully call listFiles tool',
        messages: [
          {
            role: 'user',
            content: 'List all files in the workspace',
          },
        ],
        expectedTools: ['listFiles'],
      },
      {
        name: 'read_file',
        description: 'Agent should successfully read a file',
        messages: [
          {
            role: 'user',
            content: 'Read the package.json file if it exists',
          },
        ],
        expectedTools: ['readFile'],
      },
      {
        name: 'grep_search',
        description: 'Agent should search for code patterns',
        messages: [
          {
            role: 'user',
            content: 'Search for "function" in TypeScript files',
          },
        ],
        expectedTools: ['grepFile'],
      },
    ],
  }),

  /**
   * Tests tool_use_id matching (critical for the error we're fixing)
   */
  toolUseIdMatching: (): EvalSuite => ({
    name: 'Tool Use ID Matching',
    tests: [
      {
        name: 'multiple_tools_same_turn',
        description: 'Agent should handle multiple tool calls in one turn with correct IDs',
        messages: [
          {
            role: 'user',
            content: 'List files and then search for "import" in the codebase',
          },
        ],
        expectedTools: ['listFiles', 'grepFile'],
      },
      {
        name: 'react_loop_tool_chaining',
        description: 'Agent should maintain correct tool_use_ids across ReAct loop',
        messages: [
          {
            role: 'user',
            content:
              'Find all Python files, then read one of them, then search for function definitions in it',
          },
        ],
        expectedTools: ['globFile', 'readFile', 'grepFile'],
      },
    ],
  }),

  /**
   * Tests error handling
   */
  errorHandling: (): EvalSuite => ({
    name: 'Error Handling',
    tests: [
      {
        name: 'invalid_tool_name',
        description: 'Should handle invalid tool names gracefully',
        messages: [
          {
            role: 'user',
            content: 'Call a tool that does not exist',
          },
        ],
      },
      {
        name: 'invalid_file_path',
        description: 'Should handle invalid file paths gracefully',
        messages: [
          {
            role: 'user',
            content: 'Read a file at path "/nonexistent/file.txt"',
          },
        ],
        expectedTools: ['readFile'],
      },
    ],
  }),

  /**
   * Tests tool call efficiency
   */
  efficiency: (): EvalSuite => ({
    name: 'Tool Call Efficiency',
    tests: [
      {
        name: 'minimal_tool_calls',
        description: 'Agent should use minimal tool calls to answer simple questions',
        messages: [
          {
            role: 'user',
            content: 'What is 2+2?',
          },
        ],
        expectedTools: [], // Should not need tools
      },
      {
        name: 'targeted_tool_use',
        description: 'Agent should use targeted tool calls, not exploratory',
        messages: [
          {
            role: 'user',
            content: 'Read the README.md file',
          },
        ],
        expectedTools: ['readFile'],
      },
    ],
  }),
}

/**
 * Generate eval report
 */
export function generateEvalReport(results: EvalResult[]): string {
  const totalTests = results.length
  const passedTests = results.filter((r) => r.passed).length
  const failedTests = totalTests - passedTests

  const totalToolCalls = results.reduce((sum, r) => sum + r.metrics.toolCallCount, 0)
  const totalToolErrors = results.reduce((sum, r) => sum + r.metrics.toolCallErrors, 0)
  const totalMismatches = results.reduce((sum, r) => sum + r.metrics.toolUseIdMismatches, 0)
  const avgResponseTime =
    results.reduce((sum, r) => sum + r.metrics.responseTime, 0) / totalTests

  let report = `# Agent Evaluation Report\n\n`
  report += `## Summary\n\n`
  report += `- **Total Tests**: ${totalTests}\n`
  report += `- **Passed**: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)\n`
  report += `- **Failed**: ${failedTests}\n`
  report += `- **Tool Call Error Rate**: ${((totalToolErrors / totalToolCalls) * 100).toFixed(2)}%\n`
  report += `- **Tool Use ID Mismatches**: ${totalMismatches}\n`
  report += `- **Average Response Time**: ${avgResponseTime.toFixed(0)}ms\n\n`

  report += `## Test Results\n\n`
  for (const result of results) {
    const status = result.passed ? '✅' : '❌'
    report += `### ${status} ${result.testName}\n\n`
    if (result.error) {
      report += `**Error**: ${result.error}\n\n`
    }
    report += `- Tool Calls: ${result.metrics.toolCallCount}\n`
    report += `- Tool Errors: ${result.metrics.toolCallErrors}\n`
    report += `- ID Mismatches: ${result.metrics.toolUseIdMismatches}\n`
    report += `- Response Time: ${result.metrics.responseTime}ms\n`
    if (result.metrics.invalidToolCalls.length > 0) {
      report += `- Invalid Tool Calls:\n`
      for (const invalid of result.metrics.invalidToolCalls) {
        report += `  - ${invalid.tool}: ${invalid.reason}\n`
      }
    }
    report += `\n`
  }

  return report
}

