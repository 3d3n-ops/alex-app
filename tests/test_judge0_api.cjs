'use strict'

/**
 * Test Judge0 API Integration
 * 
 * Tests:
 * 1. Environment variables configuration
 * 2. Direct Judge0 API connection (using runCode function)
 * 3. /api/execute endpoint (requires server running)
 * 
 * Usage:
 *   node tests/test_judge0_api.cjs                    # Test all
 *   node tests/test_judge0_api.cjs --direct          # Test only direct API
 *   node tests/test_judge0_api.cjs --endpoint        # Test only /api/execute endpoint
 */

const http = require('http')
const https = require('https')
const { URL } = require('url')
const path = require('path')
const fs = require('fs')

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const endpoint = process.env.TEST_ENDPOINT || 'http://localhost:3000'
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

// Test code samples
const testCases = {
  python: {
    code: 'print("Hello, World!")',
    languageId: 71,
    expectedOutput: 'Hello, World!'
  },
  javascript: {
    code: 'console.log("Hello from Node.js!");',
    languageId: 63,
    expectedOutput: 'Hello from Node.js!'
  },
  java: {
    code: `public class Main {
  public static void main(String[] args) {
    System.out.println("Hello, Java!");
  }
}`,
    languageId: 62,
    expectedOutput: 'Hello, Java!'
  }
}

// Helper to make HTTP requests
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

// Test 1: Check environment variables
function testEnvironmentVariables() {
  console.log('\n🔍 Testing Environment Variables')
  console.log('='.repeat(60))
  
  const missing = []
  if (!RAPIDAPI_HOST) missing.push('RAPIDAPI_HOST')
  if (!RAPIDAPI_KEY) missing.push('RAPIDAPI_KEY')
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:')
    missing.forEach(v => console.log(`   - ${v}`))
    console.log('\n💡 Please add these to your .env.local file:')
    console.log('   RAPIDAPI_HOST=judge0-ce.p.rapidapi.com')
    console.log('   RAPIDAPI_KEY=your_rapidapi_key_here')
    return false
  }
  
  console.log('✅ RAPIDAPI_HOST:', RAPIDAPI_HOST)
  console.log('✅ RAPIDAPI_KEY:', RAPIDAPI_KEY.substring(0, 10) + '...' + RAPIDAPI_KEY.substring(RAPIDAPI_KEY.length - 4))
  return true
}

// Test 2: Get available languages
async function getAvailableLanguages() {
  const axios = require('axios')
  const BASE_URL = `https://${RAPIDAPI_HOST}`
  
  try {
    const response = await axios.get(`${BASE_URL}/languages`, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      timeout: 10000
    })
    return response.data || []
  } catch (error) {
    console.log(`   ⚠️  Could not fetch languages: ${error.message}`)
    return []
  }
}

// Test 3: Direct Judge0 API test
async function testDirectJudge0API() {
  console.log('\n🧪 Testing Direct Judge0 API Connection')
  console.log('='.repeat(60))
  
  if (!RAPIDAPI_HOST || !RAPIDAPI_KEY) {
    console.log('❌ Skipping: Environment variables not configured')
    return false
  }
  
  const axios = require('axios')
  const BASE_URL = `https://${RAPIDAPI_HOST}`
  
  // First, try to get available languages to find correct IDs
  console.log('\n🔍 Fetching available languages from Judge0...')
  const languages = await getAvailableLanguages()
  
  if (languages.length > 0) {
    console.log(`\n📋 Found ${languages.length} available languages:`)
    // Find Python, JavaScript, Java, C++, Rust
    const targetLanguages = ['python', 'javascript', 'java', 'cpp', 'c++', 'rust', 'node']
    const foundLanguages = []
    
    // Show all languages (first 20) for debugging
    console.log('\n   All available languages (showing first 20):')
    languages.slice(0, 20).forEach(lang => {
      console.log(`      ${lang.id}: ${lang.name || 'Unknown'}`)
    })
    if (languages.length > 20) {
      console.log(`      ... and ${languages.length - 20} more`)
    }
    
    languages.forEach(lang => {
      const name = (lang.name || '').toLowerCase()
      const id = lang.id
      targetLanguages.forEach(target => {
        if (name.includes(target) && !foundLanguages.find(l => l.id === id)) {
          foundLanguages.push({ id, name: lang.name || name, target })
        }
      })
    })
    
    if (foundLanguages.length > 0) {
      console.log(`\n   🎯 Matching languages we need:`)
      foundLanguages.forEach(lang => {
        console.log(`      ✅ ${lang.name}: ID ${lang.id} (for ${lang.target})`)
      })
    }
    
    // Update test case with correct Python ID if found
    const pythonLang = foundLanguages.find(l => l.target === 'python')
    if (pythonLang) {
      console.log(`\n💡 Using Python ID: ${pythonLang.id} (instead of ${testCases.python.languageId})`)
      testCases.python.languageId = pythonLang.id
    } else {
      console.log(`\n⚠️  Python not found in available languages. Trying ID ${testCases.python.languageId}...`)
    }
  } else {
    console.log('   ⚠️  Could not fetch languages, using default IDs')
  }
  
  // Test with Python "Hello, World!"
  const testCase = testCases.python
  const sourceCode = testCase.code
  const languageId = testCase.languageId
  
  console.log(`\n📝 Test Code (Python):`)
  console.log(`   ${sourceCode}`)
  console.log(`\n📤 Submitting to Judge0...`)
  
  try {
    // Encode to base64
    const encodeBase64 = (str) => Buffer.from(str).toString('base64')
    
    // Submit
    const submission = await axios.post(
      `${BASE_URL}/submissions?base64_encoded=true&wait=false`,
      {
        source_code: encodeBase64(sourceCode),
        language_id: languageId,
        stdin: encodeBase64(''),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
        timeout: 10000
      }
    )
    
    const token = submission.data.token
    console.log(`✅ Submission successful! Token: ${token}`)
    console.log(`\n⏳ Polling for results...`)
    
    // Poll for result
    let result = null
    let attempts = 0
    const maxAttempts = 20
    
    for (let i = 0; i < maxAttempts; i++) {
      attempts++
      const res = await axios.get(`${BASE_URL}/submissions/${token}?base64_encoded=true`, {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': RAPIDAPI_HOST,
        },
        timeout: 10000
      })
      
      result = res.data
      const statusId = result.status?.id || 0
      const statusDesc = result.status?.description || 'Unknown'
      
      console.log(`   Attempt ${attempts}: Status ${statusId} (${statusDesc})`)
      
      if (statusId >= 3) break // 1=In Queue, 2=Processing, >=3 means done
      
      await new Promise((resolve) => setTimeout(resolve, 700))
    }
    
    // Decode results
    const decodeBase64 = (str) => (str ? Buffer.from(str, 'base64').toString('utf8') : '')
    
    const stdout = decodeBase64(result.stdout)
    const stderr = decodeBase64(result.stderr)
    const compileOutput = decodeBase64(result.compile_output)
    const statusId = result.status?.id || 0
    const statusDesc = result.status?.description || 'Unknown'
    
    console.log(`\n📊 Results:`)
    console.log(`   Status: ${statusId} (${statusDesc})`)
    
    if (stdout) {
      console.log(`   ✅ stdout: ${stdout.trim()}`)
    }
    if (stderr) {
      console.log(`   ⚠️  stderr: ${stderr.trim()}`)
    }
    if (compileOutput) {
      console.log(`   📝 compile_output: ${compileOutput.trim()}`)
    }
    
    if (statusId === 3 && stdout && stdout.trim() === testCase.expectedOutput) {
      console.log(`\n✅ Test PASSED! Got expected output: "${testCase.expectedOutput}"`)
      return true
    } else if (statusId === 3) {
      console.log(`\n⚠️  Execution completed but output doesn't match expected`)
      console.log(`   Expected: "${testCase.expectedOutput}"`)
      console.log(`   Got: "${stdout.trim()}"`)
      return false
    } else {
      console.log(`\n❌ Execution failed with status: ${statusDesc}`)
      if (stderr) console.log(`   Error: ${stderr}`)
      if (compileOutput) console.log(`   Compilation: ${compileOutput}`)
      return false
    }
    
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`)
    if (error.response) {
      console.log(`   Status: ${error.response.status}`)
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`)
    }
    return false
  }
}

// Test 3: /api/execute endpoint test
async function testExecuteEndpoint() {
  console.log('\n🌐 Testing /api/execute Endpoint')
  console.log('='.repeat(60))
  
  console.log(`\n🔍 Checking server connection...`)
  try {
    // Try to connect to server
    await makeRequest(`${endpoint}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
  } catch (err) {
    if (err.message.includes('Connection refused')) {
      console.log(`\n❌ Cannot connect to server at ${endpoint}`)
      console.log(`   Please make sure the dev server is running:`)
      console.log(`   npm run dev`)
      return false
    }
  }
  
  const testCase = testCases.python
  
  console.log(`\n📝 Test Code (Python):`)
  console.log(`   ${testCase.code}`)
  console.log(`\n📤 Submitting to /api/execute...`)
  
  try {
    const start = Date.now()
    const res = await makeRequest(`${endpoint}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: testCase.code,
        languageId: testCase.languageId,
        stdin: ''
      })
    })
    
    const duration = Date.now() - start
    
    if (!res.ok) {
      let errorData
      try {
        errorData = await res.json()
      } catch {
        const text = await res.text()
        errorData = { error: text }
      }
      console.log(`\n❌ Request failed: ${res.status}`)
      console.log(`   Error: ${JSON.stringify(errorData, null, 2)}`)
      return false
    }
    
    const data = await res.json()
    
    console.log(`\n📊 Results (${duration}ms):`)
    console.log(`   Success: ${data.success ? '✅' : '❌'}`)
    console.log(`   Status: ${data.status || 'Unknown'}`)
    
    if (data.stdout) {
      console.log(`   ✅ stdout: ${data.stdout.trim()}`)
    }
    if (data.stderr) {
      console.log(`   ⚠️  stderr: ${data.stderr.trim()}`)
    }
    if (data.compileOutput) {
      console.log(`   📝 compile_output: ${data.compileOutput.trim()}`)
    }
    if (data.error) {
      console.log(`   ❌ error: ${data.error}`)
    }
    if (data.message) {
      console.log(`   💬 message: ${data.message}`)
    }
    
    if (data.success && data.stdout && data.stdout.trim() === testCase.expectedOutput) {
      console.log(`\n✅ Test PASSED! Got expected output: "${testCase.expectedOutput}"`)
      return true
    } else if (data.success) {
      console.log(`\n⚠️  Execution completed but output doesn't match expected`)
      console.log(`   Expected: "${testCase.expectedOutput}"`)
      console.log(`   Got: "${data.stdout ? data.stdout.trim() : '(empty)'}"`)
      return false
    } else {
      console.log(`\n❌ Execution failed`)
      return false
    }
    
  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`)
    return false
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2)
  const testDirect = !args.includes('--endpoint-only')
  const testEndpoint = !args.includes('--direct-only')
  
  console.log('\n🧪 Judge0 API Integration Test')
  console.log('='.repeat(60))
  console.log(`   Endpoint: ${endpoint}`)
  console.log(`   Tests: ${testDirect ? 'Direct API' : ''}${testDirect && testEndpoint ? ' + ' : ''}${testEndpoint ? 'Endpoint' : ''}`)
  
  const results = {}
  
  // Test 1: Environment variables
  results.env = testEnvironmentVariables()
  
  // Test 2: Direct API (if env vars are set)
  if (testDirect) {
    if (results.env) {
      results.direct = await testDirectJudge0API()
    } else {
      console.log('\n⏭️  Skipping direct API test (env vars not configured)')
      results.direct = null
    }
  }
  
  // Test 3: Endpoint
  if (testEndpoint) {
    // Update test case language ID if we found it in direct test
    if (results.direct !== null && results.direct !== undefined) {
      // Language ID was already updated in direct test
    }
    results.endpoint = await testExecuteEndpoint()
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`)
  console.log('📊 Test Summary')
  console.log('='.repeat(60))
  
  const envStatus = results.env ? '✅' : '❌'
  console.log(`   ${envStatus} Environment Variables`)
  
  if (testDirect) {
    if (results.direct === null) {
      console.log(`   ⏭️  Direct API (skipped)`)
    } else {
      const directStatus = results.direct ? '✅' : '❌'
      console.log(`   ${directStatus} Direct Judge0 API`)
    }
  }
  
  if (testEndpoint) {
    const endpointStatus = results.endpoint ? '✅' : '❌'
    console.log(`   ${endpointStatus} /api/execute Endpoint`)
  }
  
  console.log()
  
  // Exit with appropriate code
  const allPassed = Object.values(results).every(v => v === null || v === true)
  if (!allPassed) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err)
  process.exit(1)
})

