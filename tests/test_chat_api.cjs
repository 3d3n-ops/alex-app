'use strict'

// Test the /api/chat endpoint in all three modes
// Requires the Next.js dev/server to be running (default: http://localhost:3000)
// Usage:
//   node tests/test_chat_api.cjs                    # Test all modes
//   node tests/test_chat_api.cjs --mode=conversation
//   node tests/test_chat_api.cjs --mode=clientIntents
//   node tests/test_chat_api.cjs --mode=tools

const http = require('http')
const https = require('https')
const { URL } = require('url')

const endpoint = 'http://localhost:3000'
const defaultAgent = 'alexTutor'
const defaultPrompt = 'Hello, can you explain what recursion is?'

// Helper to make HTTP requests (compatible with all Node versions)
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }

    const req = client.request(reqOptions, (res) => {
      const chunks = []
      
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
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
                }
              }
            }
          }
        })
      })
    })

    req.on('error', (err) => {
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
async function checkServer() {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(endpoint)
    const isHttps = urlObj.protocol === 'https:'
    const client = isHttps ? https : http
    
    const req = client.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: '/api/chat',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      res.on('data', () => {}) // Drain response
      res.on('end', () => resolve()) // Server responded, so it's reachable
    })

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        reject(new Error(`Cannot connect to ${endpoint}.\n\nPlease make sure:\n  1. The dev server is running (npm run dev)\n  2. The server is accessible at ${endpoint}`))
      } else {
        resolve() // Other errors might just mean endpoint doesn't accept GET, which is fine
      }
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Connection timeout to ${endpoint}`))
    })

    req.end()
  })
}

const modes = {
  conversation: {
    name: 'Conversation (streaming)',
    body: { agent: defaultAgent, messages: [{ role: 'user', content: defaultPrompt }] }
  },
  clientIntents: {
    name: 'Client Intents (JSON)',
    body: {
      agent: defaultAgent,
      messages: [{ role: 'user', content: 'Create a Python file called hello.py with print("Hello, world!")' }],
      clientIntents: true
    }
  }, 
  tools: {
    name: 'Server Tools (streaming)',
    body: {
      agent: defaultAgent,
      messages: [{ role: 'user', content: 'Create a Python file called hello.py with print("Hello, world!")' }],
      enableTools: true
    }
  }
}

async function testConversation(body) {
  console.log('\n📝 Testing conversation mode (streaming)...')
  const start = Date.now()
  const res = await makeRequest(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  if (!res.ok) {
    const text = await res.text()
    // Try to extract error message from response (might be JSON or HTML)
    let errorMsg = text
    try {
      const json = JSON.parse(text)
      errorMsg = json.message || json.error || JSON.stringify(json, null, 2)
    } catch {
      // If it's HTML, truncate it
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        errorMsg = 'Server returned HTML error page. Check server logs for details.'
      }
    }
    throw new Error(`Request failed: ${res.status}\n${errorMsg.substring(0, 500)}`)
  }

  const contentType = res.headers['content-type'] || ''
  if (!contentType.includes('event-stream')) {
    throw new Error('Expected text/event-stream but got: ' + contentType)
  }

  let content = ''
  const text = await res.text()
  const lines = text.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim()
      if (data === '[DONE]' || !data) continue
      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta?.content
        if (delta) {
          process.stdout.write(delta)
          content += delta
        }
      } catch {}
    }
  }

  console.log(`\n\n✅ Received ${content.length} chars in ${Date.now() - start}ms`)
  return { content, durationMs: Date.now() - start }
}

async function testClientIntents(body) {
  console.log('\n🔧 Testing client intents mode (JSON)...')
  const start = Date.now()
  const res = await makeRequest(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  if (!res.ok) {
    const text = await res.text()
    // Try to extract error message from response (might be JSON or HTML)
    let errorMsg = text
    try {
      const json = JSON.parse(text)
      errorMsg = json.message || json.error || JSON.stringify(json, null, 2)
    } catch {
      // If it's HTML, truncate it
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        errorMsg = 'Server returned HTML error page. Check server logs for details.'
      }
    }
    throw new Error(`Request failed: ${res.status}\n${errorMsg.substring(0, 500)}`)
  }

  const contentType = res.headers['content-type'] || ''
  if (!contentType.includes('json')) {
    throw new Error('Expected application/json but got: ' + contentType)
  }

  const data = await res.json()
  const content = data?.content || ''
  const toolIntents = Array.isArray(data?.toolIntents) ? data.toolIntents : []

  console.log(`\n📄 Assistant content (${content.length} chars):`)
  if (content) {
    console.log(indent(content, 2))
  } else {
    console.log(indent('(empty)', 2))
  }

  console.log(`\n🛠️  Tool intents (${toolIntents.length}):`)
  if (toolIntents.length > 0) {
    toolIntents.forEach((intent, i) => {
      console.log(`  ${i + 1}. ${intent.name || 'unknown'}`)
      if (intent.args && Object.keys(intent.args).length > 0) {
        console.log(indent(JSON.stringify(intent.args, null, 2), 6))
      }
    })
  } else {
    console.log('  (none)')
  }

  console.log(`\n✅ Received response in ${Date.now() - start}ms`)
  return { content, toolIntents, durationMs: Date.now() - start }
}

async function testTools(body) {
  console.log('\n⚙️  Testing server tools mode (streaming)...')
  const start = Date.now()
  const res = await makeRequest(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  
  if (!res.ok) {
    const text = await res.text()
    // Try to extract error message from response (might be JSON or HTML)
    let errorMsg = text
    try {
      const json = JSON.parse(text)
      errorMsg = json.message || json.error || JSON.stringify(json, null, 2)
    } catch {
      // If it's HTML, truncate it
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        errorMsg = 'Server returned HTML error page. Check server logs for details.'
      }
    }
    throw new Error(`Request failed: ${res.status}\n${errorMsg.substring(0, 500)}`)
  }

  const contentType = res.headers['content-type'] || ''
  if (!contentType.includes('event-stream')) {
    throw new Error('Expected text/event-stream but got: ' + contentType)
  }

  let content = ''
  const text = await res.text()
  const lines = text.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim()
      if (data === '[DONE]' || !data) continue
      try {
        const parsed = JSON.parse(data)
        const delta = parsed?.choices?.[0]?.delta?.content
        if (delta) {
          process.stdout.write(delta)
          content += delta
        }
      } catch {}
    }
  }

  console.log(`\n\n✅ Received ${content.length} chars in ${Date.now() - start}ms`)
  return { content, durationMs: Date.now() - start }
}

async function main() {
  const modeArg = process.argv.find(arg => arg.startsWith('--mode='))
  const requestedMode = modeArg ? modeArg.split('=')[1] : null

  if (requestedMode && !modes[requestedMode]) {
    console.error(`\n❌ Unknown mode: ${requestedMode}`)
    console.error(`Available modes: ${Object.keys(modes).join(', ')}`)
    process.exit(1)
  }

  const modesToTest = requestedMode ? [requestedMode] : Object.keys(modes)

  console.log(`\n🧪 Testing /api/chat endpoint`)
  console.log(`   Base URL: ${endpoint}`)
  console.log(`   Agent: ${defaultAgent}`)
  console.log(`   Testing modes: ${modesToTest.join(', ')}`)

  // Check if server is running
  console.log('\n🔍 Checking server connection...')
  try {
    await checkServer()
    console.log('✅ Server is reachable')
  } catch (err) {
    console.error(`\n❌ ${err.message}`)
    process.exit(1)
  }

  const results = []

  for (const modeKey of modesToTest) {
    const mode = modes[modeKey]
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Mode: ${mode.name}`)
    console.log(`Prompt: ${mode.body.messages[0].content}`)
    console.log(`${'='.repeat(60)}`)

    try {
      let result
      if (modeKey === 'conversation') {
        result = await testConversation(mode.body)
      } else if (modeKey === 'clientIntents') {
        result = await testClientIntents(mode.body)
      } else if (modeKey === 'tools') {
        result = await testTools(mode.body)
      }

      results.push({ mode: modeKey, ...result })
    } catch (err) {
      console.error(`\n❌ Error testing ${modeKey}:`, err.message)
      results.push({ mode: modeKey, error: err.message })
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 Summary')
  console.log(`${'='.repeat(60)}`)
  results.forEach(r => {
    if (r.error) {
      console.log(`  ❌ ${r.mode}: ERROR - ${r.error}`)
    } else {
      const contentLen = r.content?.length || 0
      const intentCount = r.toolIntents?.length || 0
      const extras = intentCount > 0 ? ` (${intentCount} intents)` : ''
      console.log(`  ✅ ${r.mode}: ${r.durationMs}ms, ${contentLen} chars${extras}`)
    }
  })
  console.log()
}

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return String(text).split('\n').map(l => pad + l).join('\n')
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})

