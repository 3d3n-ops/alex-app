/**
 * Comprehensive stress test suite for agent and tool calls
 * Tests 30-50 message conversations to measure:
 * - Latency (per message, per turn, total)
 * - Performance (token usage, tool call frequency)
 * - Response quality (length, coherence, tool usage correctness)
 */

import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'

// Parse command line arguments
function parseArgs() {
  const args: Record<string, string> = {}
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=')
      args[key] = value || 'true'
    }
  })
  return args
}

// Helper to display auth instructions
function showAuthInstructions() {
  console.log('\n⚠️  Authentication Required')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('Your API requires Clerk authentication.')
  console.log('\nTo get your session cookie:')
  console.log('1. Open your app in a browser while logged in')
  console.log('2. Open DevTools (F12) → Application tab → Cookies')
  console.log('3. Find the Clerk session cookie (usually named "__session")')
  console.log('4. Copy the cookie value')
  console.log('\nThen run:')
  console.log('  TEST_AUTH_COOKIE="__session=your-cookie-value" npm run test:stress')
  console.log('Or:')
  console.log('  npm run test:stress -- --authCookie="__session=your-cookie-value"')
  console.log('\nFor detailed instructions, see: tests/get-auth-cookie.md')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

const args = parseArgs()

// Configuration
const ENDPOINT = args.endpoint || process.env.TEST_ENDPOINT || 'http://localhost:3000'
const AGENT = args.agent || process.env.TEST_AGENT || 'alexTutor'
const NUM_MESSAGES = parseInt(args.messages || process.env.TEST_MESSAGE_COUNT || '40', 10)
const USE_TOOLS = args.tools !== 'false' && process.env.TEST_USE_TOOLS !== 'false' // Default true
const CONVERSATION_SCENARIOS = (args.scenarios || process.env.TEST_SCENARIOS || 'mixed').split(',')
// Optional: Add authentication cookie or token if needed
// Get this from your browser's dev tools (Application > Cookies) while logged into the app
const AUTH_COOKIE = args.authCookie || "__session=eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18zNGlZZjhIRnFxa2FlQjROQzBPY0RxU2lVNTkiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NjE5NDQ5ODYsImZ2YSI6WzAsLTFdLCJpYXQiOjE3NjE5NDQ5MjYsImlzcyI6Imh0dHBzOi8vZmluZS1za2luay02OC5jbGVyay5hY2NvdW50cy5kZXYiLCJuYmYiOjE3NjE5NDQ5MTYsInNpZCI6InNlc3NfMzRxZDdLVWtvSUVndXU5SlhzN3pGampmbTV5Iiwic3RzIjoiYWN0aXZlIiwic3ViIjoidXNlcl8zNGtPN1dyZk5qYjFjR1FDUTQyTVhXdWNmY1MiLCJ2IjoyfQ.MGXjzAvD74ptqRQgWrz2q-PF2MWVxRwV-bLCyTGtA0Tz5mlozf4YfiRNaXR9gs_ltgfB6q2zm08Sp-Wx8l_lv4pKV_f3wdXMRgKbGGLZjCCwnAV7hcOfHNJGU4HovHZcawZH8_BOnvTPaIdFMWxdbX-PEpPq2owrD8nHYyQRHpASls_UQuX9pneJmOcWrq-b-ppz0vxTJebGqQLu47M7MGxWjy4fb4gNy9FNSyH0GRy2syswGuJmZGPvv10HP6_78u15QXNniv1KVutcsQhmST_glgJVeritXz9q5MQnL7kd3ZSe_e0hBkUGEs5pPdFYPzRu2AyI9CsRj6ZBbQOYMQ"
const AUTH_TOKEN = args.authToken || process.env.TEST_AUTH_TOKEN || undefined

// Types
interface MessageMetrics {
  messageIndex: number
  userMessage: string
  timestamp: number
  latency: {
    total: number
    firstToken?: number
    lastToken?: number
  }
  response: {
    content: string
    contentLength: number
    toolCalls: ToolCall[]
    toolIntents: any[]
    streamingChunks: number
  }
  errors?: string[]
}

interface ToolCall {
  name: string
  args: any
  executionTime?: number
  success?: boolean
  error?: string
}

interface ConversationMetrics {
  scenario: string
  messages: MessageMetrics[]
  summary: {
    totalMessages: number
    totalDuration: number
    avgLatency: number
    minLatency: number
    maxLatency: number
    totalTokenCount: number // Estimated
    totalToolCalls: number
    totalToolIntents: number
    errorCount: number
    successRate: number
  }
}

interface TestReport {
  timestamp: string
  endpoint: string
  agent: string
  conversations: ConversationMetrics[]
  overall: {
    totalConversations: number
    totalMessages: number
    avgLatencyPerMessage: number
    p50Latency: number
    p95Latency: number
    p99Latency: number
    totalToolCalls: number
    totalErrors: number
  }
}

// Test scenarios - diverse conversation patterns
const SCENARIOS = {
  // Mixed conversation: questions, code requests, follow-ups
  mixed: [
    'Hello! Can you explain what recursion is?',
    'Can you show me a Python example?',
    'What about a recursive function to calculate factorial?',
    'Can you create a file with that example?',
    'Now can you modify it to add memoization?',
    'What is memoization?',
    'Can you search for other examples of memoization in the codebase?',
    'Explain the difference between recursion and iteration',
    'Create a Fibonacci function using both approaches',
    'Which one is more efficient?',
    'Can you explain time complexity?',
    'What about space complexity?',
    'Show me how to optimize the recursive version',
    'Can you read the file we created earlier?',
    'What is tail recursion?',
    'Can you implement a tail-recursive version?',
    'Explain when to use recursion vs iteration',
    'Show me examples from real codebases',
    'What are common pitfalls with recursion?',
    'Can you create a test file for the factorial function?',
    'Explain how the stack works with recursion',
    'What happens with deep recursion?',
    'Can you show me how to prevent stack overflow?',
    'What are the benefits of recursion?',
    'When is recursion the wrong choice?',
    'Can you write a function that uses recursion to traverse a tree?',
    'Explain how recursive algorithms can be parallelized',
    'What is dynamic programming and how does it relate to recursion?',
    'Can you show me a memoized version of a complex recursive problem?',
    'Explain the call stack in detail',
    'What are the memory implications?',
    'Can you create a visualization of how recursion works?',
    'Show me examples of mutual recursion',
    'What is indirect recursion?',
    'Can you explain recursive data structures?',
    'Show me how to implement a binary tree recursively',
    'What is backtracking and how does it use recursion?',
    'Can you create a sudoku solver using backtracking?',
    'Explain divide and conquer algorithms',
    'Show me merge sort as an example',
    'Can you compare iterative and recursive merge sort implementations?',
  ],
  
  // Code-heavy: lots of file operations and tool calls
  codeHeavy: [
    'Create a Python file called calculator.py with basic arithmetic functions',
    'Add a function to calculate the area of a circle',
    'Create a test file for the calculator',
    'Add error handling to the division function',
    'Create a class-based version of the calculator',
    'Add logging functionality',
    'Create a config file for the calculator settings',
    'Add command-line argument parsing',
    'Create a README explaining how to use it',
    'Add type hints to all functions',
    'Create a requirements.txt file',
    'Add docstrings to all functions',
    'Create a setup.py for packaging',
    'Add unit tests using pytest',
    'Create a Makefile with common tasks',
    'Add integration tests',
    'Create a Dockerfile',
    'Add CI/CD configuration',
    'Create a CHANGELOG',
    'Add code examples in the README',
    'Create a LICENSE file',
    'Add error handling tests',
    'Create performance benchmarks',
    'Add API documentation',
    'Create a web API version',
    'Add authentication to the API',
    'Create database models',
    'Add database migrations',
    'Create REST API endpoints',
    'Add API documentation with Swagger',
    'Create frontend components',
    'Add state management',
    'Create end-to-end tests',
    'Add monitoring and logging',
    'Create deployment scripts',
    'Add health check endpoints',
    'Create load testing scripts',
    'Add caching layer',
    'Create message queue integration',
    'Add WebSocket support',
    'Create microservices architecture',
  ],

  // Question-heavy: lots of conversational queries with minimal tools
  questionHeavy: [
    'What is object-oriented programming?',
    'Explain the four pillars of OOP',
    'What is encapsulation?',
    'Can you give me examples of encapsulation?',
    'What is inheritance?',
    'How does inheritance work in Python?',
    'What is polymorphism?',
    'Show me examples of polymorphism',
    'What is abstraction?',
    'How is abstraction different from encapsulation?',
    'What are design patterns?',
    'Explain the singleton pattern',
    'What are the pros and cons of singletons?',
    'Explain the factory pattern',
    'What is dependency injection?',
    'How does dependency injection work?',
    'What are SOLID principles?',
    'Explain the Single Responsibility Principle',
    'What is the Open/Closed Principle?',
    'Explain Liskov Substitution Principle',
    'What is Interface Segregation Principle?',
    'Explain Dependency Inversion Principle',
    'What is test-driven development?',
    'How do you write good tests?',
    'What is the difference between unit and integration tests?',
    'What is code coverage?',
    'What is refactoring?',
    'How do you refactor safely?',
    'What is technical debt?',
    'How do you manage technical debt?',
    'What is continuous integration?',
    'What is continuous deployment?',
    'What is DevOps?',
    'Explain microservices architecture',
    'What are the benefits of microservices?',
    'What are the challenges?',
    'What is REST?',
    'What is GraphQL?',
    'Compare REST and GraphQL',
    'What is caching?',
  ],

  // Tool-heavy: maximum tool usage for stress testing
  toolHeavy: [
    'List all files in the workspace',
    'Search for all Python files',
    'Read the package.json file',
    'Search for function definitions',
    'Create a new Python file',
    'List files again to verify',
    'Read the file you just created',
    'Search for import statements',
    'Create a test directory',
    'List files in the test directory',
    'Create multiple files',
    'Search for TODO comments',
    'Read multiple files',
    'Search for error handling patterns',
    'Create a configuration file',
    'Search for environment variables',
    'Read configuration files',
    'Create documentation files',
    'Search for deprecated code',
    'List all TypeScript files',
    'Search for type definitions',
    'Create utility functions',
    'Search for test files',
    'Read test files',
    'Create mock data files',
    'Search for API endpoints',
    'Read API route files',
    'Create API documentation',
    'Search for database queries',
    'Read database schema files',
    'Create migration files',
    'Search for authentication code',
    'Read authentication files',
    'Create middleware files',
    'Search for logging code',
    'Read logging configuration',
    'Create error handling utilities',
    'Search for validation code',
    'Read validation schemas',
    'Create API client files',
  ],
}

// Helper to make HTTP requests
function makeRequest(url: string, options: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http

    const headers: Record<string, string> = {
      ...(options.headers || {}),
    }

    // Add authentication if provided
    if (AUTH_COOKIE) {
      headers['Cookie'] = AUTH_COOKIE
    }
    if (AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
    }

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers,
    }

    const req = client.request(reqOptions, (res) => {
      const chunks: Buffer[] = []

      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        const statusCode: number = res.statusCode ?? 500
        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          statusText: res.statusMessage || 'Unknown',
          headers: res.headers,
          text: async () => body.toString('utf8'),
          json: async () => JSON.parse(body.toString('utf8')),
          body: {
            getReader: () => {
              let offset = 0
              return {
                read: () => {
                  if (offset >= body.length) {
                    return Promise.resolve({ done: true, value: undefined })
                  }
                  const chunk = body.slice(offset, Math.min(offset + 1024, body.length))
                  offset += chunk.length
                  return Promise.resolve({ done: false, value: chunk })
                },
              }
            },
          },
        })
      })
    })

    req.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error(`Connection refused. Is the server running at ${url}?`))
      } else {
        reject(err)
      }
    })

    if (options.body) {
      req.write(options.body)
    }

    req.end()
  })
}

// Check if server is reachable
async function checkServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(ENDPOINT)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http

    const req = client.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: '/api/chat',
        method: 'GET',
        timeout: 2000,
      },
      (res) => {
        res.on('data', () => {})
        res.on('end', () => resolve())
      }
    )

    req.on('error', (err: any) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        reject(
          new Error(
            `Cannot connect to ${ENDPOINT}.\n\nPlease make sure:\n  1. The dev server is running (npm run dev)\n  2. The server is accessible at ${ENDPOINT}`
          )
        )
      } else {
        resolve()
      }
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Connection timeout to ${ENDPOINT}`))
    })

    req.end()
  })
}

// Test a single message
async function testMessage(
  userMessage: string,
  messageIndex: number,
  previousMessages: Array<{ role: string; content: string }>,
  threadId?: string
): Promise<MessageMetrics> {
  const startTime = Date.now()
  const metrics: MessageMetrics = {
    messageIndex,
    userMessage,
    timestamp: startTime,
    latency: { total: 0 },
    response: {
      content: '',
      contentLength: 0,
      toolCalls: [],
      toolIntents: [],
      streamingChunks: 0,
    },
    errors: [],
  }

  try {
    const messages = [
      ...previousMessages,
      { role: 'user', content: userMessage },
    ]

    const body = {
      agent: AGENT,
      messages,
      clientIntents: USE_TOOLS,
      threadId: threadId || `stress-test-${Date.now()}`,
    }

    const requestStart = Date.now()
    const res = await makeRequest(`${ENDPOINT}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      let errorMsg = text
      try {
        const json = JSON.parse(text)
        errorMsg = json.message || json.error || JSON.stringify(json, null, 2)
      } catch {
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          errorMsg = 'Server returned HTML error page. Check server logs for details.'
        }
      }
      
      // Special handling for different error types
      if (res.status === 401) {
        if (!AUTH_COOKIE && !AUTH_TOKEN) {
          errorMsg = `Unauthorized (401). Authentication required.\n${errorMsg.substring(0, 200)}\n\nSee tests/get-auth-cookie.md for instructions on getting your Clerk session cookie.`
        } else {
          errorMsg = `Unauthorized (401). The provided authentication cookie/token may be invalid or expired.\n${errorMsg.substring(0, 200)}\n\nTry getting a fresh session cookie from your browser.`
        }
      } else if (res.status === 404) {
        errorMsg = `Not Found (404). The /api/chat route may not be recognized by Next.js.\n${errorMsg.substring(0, 200)}\n\nTroubleshooting:\n- Make sure the dev server is running: npm run dev\n- Check that app/api/chat/route.ts exists\n- Try restarting the dev server\n- Check for compilation errors in the terminal`
      }
      
      throw new Error(`Request failed: ${res.status}\n${errorMsg.substring(0, 800)}`)
    }

    const contentType = res.headers['content-type'] || ''
    const isStreaming = contentType.includes('event-stream')
    const isJSON = contentType.includes('json')

    let firstTokenTime: number | undefined
    let lastTokenTime: number | undefined

    if (isStreaming) {
      // Handle streaming response
      const text = await res.text()
      const lines = text.split('\n')
      let content = ''
      let toolIntents: any[] = []

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]' || !data) continue

          try {
            const parsed = JSON.parse(data)

            // Check for tool intents
            if (parsed.type === 'toolIntents' && Array.isArray(parsed.toolIntents)) {
              toolIntents = parsed.toolIntents
            }

            // Check for content delta
            if (parsed.type === 'content' && parsed.delta) {
              if (!firstTokenTime) {
                firstTokenTime = Date.now() - requestStart
              }
              lastTokenTime = Date.now() - requestStart
              content += parsed.delta
              metrics.response.streamingChunks++
            }

            // Check for done message with full content
            if (parsed.type === 'done' && parsed.content) {
              content = parsed.content
            }

            // Handle OpenRouter SSE format
            const delta = parsed?.choices?.[0]?.delta?.content
            if (delta) {
              if (!firstTokenTime) {
                firstTokenTime = Date.now() - requestStart
              }
              lastTokenTime = Date.now() - requestStart
              content += delta
              metrics.response.streamingChunks++
            }
          } catch (e) {
            // Ignore parsing errors
          }
        }
      }

      metrics.response.content = content
      metrics.response.contentLength = content.length
      metrics.response.toolIntents = toolIntents
    } else if (isJSON) {
      // Handle JSON response
      const data = await res.json()
      metrics.response.content = data?.content || ''
      metrics.response.contentLength = metrics.response.content.length
      metrics.response.toolIntents = Array.isArray(data?.toolIntents) ? data.toolIntents : []
      firstTokenTime = Date.now() - requestStart
      lastTokenTime = firstTokenTime
    } else {
      throw new Error(`Unexpected content type: ${contentType}`)
    }

    const totalTime = Date.now() - startTime
    metrics.latency.total = totalTime
    metrics.latency.firstToken = firstTokenTime
    metrics.latency.lastToken = lastTokenTime

    // Extract tool calls from tool intents
    metrics.response.toolCalls = metrics.response.toolIntents.map((intent: any) => ({
      name: intent.name || 'unknown',
      args: intent.args || {},
    }))
  } catch (error: any) {
    metrics.errors = metrics.errors || []
    metrics.errors.push(error.message || String(error))
    metrics.latency.total = Date.now() - startTime
  }

  return metrics
}

// Run a full conversation
async function runConversation(
  scenario: string,
  messages: string[]
): Promise<ConversationMetrics> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Running scenario: ${scenario}`)
  console.log(`Messages: ${messages.length}`)
  console.log(`${'='.repeat(60)}`)

  const conversationStart = Date.now()
  const conversationMessages: MessageMetrics[] = []
  const threadId = `stress-test-${scenario}-${Date.now()}`

  // Build conversation history as we go
  const messageHistory: Array<{ role: string; content: string }> = []

  for (let i = 0; i < messages.length && i < NUM_MESSAGES; i++) {
    const userMessage = messages[i]
    console.log(`\n[${i + 1}/${Math.min(messages.length, NUM_MESSAGES)}] Testing: "${userMessage.substring(0, 50)}..."`)

    const metrics = await testMessage(userMessage, i, messageHistory, threadId)

    // Add user message and assistant response to history
    messageHistory.push({ role: 'user', content: userMessage })
    if (metrics.response.content) {
      messageHistory.push({ role: 'assistant', content: metrics.response.content })
    }

    conversationMessages.push(metrics)

    // Display quick stats
    const status = metrics.errors && metrics.errors.length > 0 ? '❌' : '✅'
    console.log(
      `  ${status} Latency: ${metrics.latency.total}ms | Content: ${metrics.response.contentLength} chars | Tools: ${metrics.response.toolCalls.length}`
    )

    // Small delay between messages to avoid overwhelming the server
    if (i < messages.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  const totalDuration = Date.now() - conversationStart

  // Calculate summary
  const latencies = conversationMessages.map((m) => m.latency.total).filter((l) => l > 0)
  const errors = conversationMessages.filter((m) => m.errors && m.errors.length > 0)

  const summary = {
    totalMessages: conversationMessages.length,
    totalDuration,
    avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    minLatency: latencies.length > 0 ? Math.min(...latencies) : 0,
    maxLatency: latencies.length > 0 ? Math.max(...latencies) : 0,
    totalTokenCount: conversationMessages.reduce((sum, m) => sum + m.response.contentLength, 0) / 4, // Rough estimate: 4 chars per token
    totalToolCalls: conversationMessages.reduce((sum, m) => sum + m.response.toolCalls.length, 0),
    totalToolIntents: conversationMessages.reduce((sum, m) => sum + m.response.toolIntents.length, 0),
    errorCount: errors.length,
    successRate: conversationMessages.length > 0 ? ((conversationMessages.length - errors.length) / conversationMessages.length) * 100 : 0,
  }

  return {
    scenario,
    messages: conversationMessages,
    summary,
  }
}

// Generate report
function generateReport(conversations: ConversationMetrics[]): TestReport {
  const allLatencies: number[] = []
  let totalMessages = 0
  let totalToolCalls = 0
  let totalErrors = 0

  conversations.forEach((conv) => {
    conv.messages.forEach((msg) => {
      if (msg.latency.total > 0) {
        allLatencies.push(msg.latency.total)
      }
      totalMessages++
      totalToolCalls += msg.response.toolCalls.length
      if (msg.errors && msg.errors.length > 0) {
        totalErrors++
      }
    })
  })

  allLatencies.sort((a, b) => a - b)

  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0
    const index = Math.ceil((p / 100) * arr.length) - 1
    return arr[Math.max(0, index)]
  }

  return {
    timestamp: new Date().toISOString(),
    endpoint: ENDPOINT,
    agent: AGENT,
    conversations,
    overall: {
      totalConversations: conversations.length,
      totalMessages,
      avgLatencyPerMessage: allLatencies.length > 0 ? allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length : 0,
      p50Latency: percentile(allLatencies, 50),
      p95Latency: percentile(allLatencies, 95),
      p99Latency: percentile(allLatencies, 99),
      totalToolCalls,
      totalErrors,
    },
  }
}

// Print report
function printReport(report: TestReport) {
  console.log(`\n${'='.repeat(80)}`)
  console.log('📊 STRESS TEST REPORT')
  console.log(`${'='.repeat(80)}`)
  console.log(`Timestamp: ${report.timestamp}`)
  console.log(`Endpoint: ${report.endpoint}`)
  console.log(`Agent: ${report.agent}`)
  console.log(`Total Conversations: ${report.overall.totalConversations}`)
  console.log(`Total Messages: ${report.overall.totalMessages}`)
  console.log(`\nOverall Performance:`)
  console.log(`  Average Latency: ${report.overall.avgLatencyPerMessage.toFixed(2)}ms`)
  console.log(`  P50 Latency: ${report.overall.p50Latency}ms`)
  console.log(`  P95 Latency: ${report.overall.p95Latency}ms`)
  console.log(`  P99 Latency: ${report.overall.p99Latency}ms`)
  console.log(`  Total Tool Calls: ${report.overall.totalToolCalls}`)
  console.log(`  Total Errors: ${report.overall.totalErrors}`)

  console.log(`\n${'-'.repeat(80)}`)
  console.log('Per-Scenario Breakdown:')
  console.log(`${'-'.repeat(80)}`)

  report.conversations.forEach((conv) => {
    console.log(`\n📋 Scenario: ${conv.scenario}`)
    console.log(`  Messages: ${conv.summary.totalMessages}`)
    console.log(`  Duration: ${conv.summary.totalDuration}ms`)
    console.log(`  Avg Latency: ${conv.summary.avgLatency.toFixed(2)}ms`)
    console.log(`  Min Latency: ${conv.summary.minLatency}ms`)
    console.log(`  Max Latency: ${conv.summary.maxLatency}ms`)
    console.log(`  Estimated Tokens: ${Math.round(conv.summary.totalTokenCount)}`)
    console.log(`  Tool Calls: ${conv.summary.totalToolCalls}`)
    console.log(`  Tool Intents: ${conv.summary.totalToolIntents}`)
    console.log(`  Errors: ${conv.summary.errorCount}`)
    console.log(`  Success Rate: ${conv.summary.successRate.toFixed(2)}%`)
  })

  console.log(`\n${'='.repeat(80)}`)
}

// Save report to file
async function saveReport(report: TestReport) {
  const fs = await import('fs/promises')
  const filename = `stress-test-report-${Date.now()}.json`
  await fs.writeFile(filename, JSON.stringify(report, null, 2))
  console.log(`\n💾 Report saved to: ${filename}`)
  return filename
}

// Main function
async function main() {
  console.log('\n🚀 Starting Stress Test Suite')
  console.log(`   Endpoint: ${ENDPOINT}`)
  console.log(`   Agent: ${AGENT}`)
  console.log(`   Messages per scenario: ${NUM_MESSAGES}`)
  console.log(`   Tools enabled: ${USE_TOOLS}`)
  console.log(`   Scenarios: ${CONVERSATION_SCENARIOS.join(', ')}`)

  // Check server
  console.log('\n🔍 Checking server connection...')
  try {
    await checkServer()
    console.log('✅ Server is reachable')
  } catch (err: any) {
    console.error(`\n❌ ${err.message}`)
    process.exit(1)
  }

  // Note: Auth is currently disabled in /api/chat for testing
  console.log('\nℹ️  Note: Authentication is disabled in /api/chat for stress testing.\n')

  // Run conversations
  const conversations: ConversationMetrics[] = []

  for (const scenarioName of CONVERSATION_SCENARIOS) {
    const scenarioMessages = SCENARIOS[scenarioName as keyof typeof SCENARIOS]
    if (!scenarioMessages) {
      console.warn(`⚠️  Unknown scenario: ${scenarioName}, skipping`)
      continue
    }

    try {
      const conversation = await runConversation(scenarioName, scenarioMessages)
      conversations.push(conversation)
    } catch (error: any) {
      console.error(`\n❌ Error in scenario ${scenarioName}:`, error.message)
    }
  }

  // Generate and print report
  const report = generateReport(conversations)
  printReport(report)

  // Save report
  await saveReport(report)

  console.log('\n✅ Stress test complete!')
}

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error('\n❌ Test failed:', err)
    process.exit(1)
  })
}

export { main, generateReport }
export type { TestReport, ConversationMetrics }

