# Judge0 Setup Instructions

## What Has Been Implemented

### ✅ Completed:
1. **Judge0 API Endpoint** (`/app/api/execute/route.ts`)
   - Submits code to Judge0
   - Polls for execution results
   - Handles errors and timeouts
   - Returns formatted results

2. **Code Editor Integration** (`components/code-editor.tsx`)
   - Updated `executeCode()` to use Judge0 API
   - Displays execution results in terminal
   - Shows compilation errors, runtime errors, and success messages
   - Displays execution time and memory usage

3. **Language Support**
   - Python 3 (ID: 71)
   - Node.js (ID: 63)
   - Java (ID: 62)
   - C++ (ID: 54)
   - Rust (ID: 73)

## What Still Needs to Be Done

### 1. Environment Variables Setup

Add these to your `.env.local` file:

```bash
# Option 1: Using RapidAPI (Free tier: 10 requests/minute)
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key_here
JUDGE0_RAPIDAPI_HOST=judge0-ce.p.rapidapi.com

# Option 2: Using Self-Hosted Judge0 (No API key needed)
# JUDGE0_API_URL=http://localhost:2358
```

### 2. Get Judge0 API Access

**Option A: RapidAPI (Quick Setup)**
1. Sign up at https://rapidapi.com
2. Subscribe to "Judge0 Community Edition" API
3. Get your API key from RapidAPI dashboard
4. Free tier: 10 requests/minute

**Option B: Self-Hosted Judge0 (Better for Production)**
1. Follow guide: https://github.com/judge0/judge0/blob/master/CHANGELOG.md
2. Deploy using Docker Compose
3. No rate limits (based on your server)
4. More control over execution environment

### 3. Testing

Once environment variables are set:

1. Open code editor
2. Write a simple Python script:
   ```python
   print("Hello, World!")
   ```
3. Click the Run button (▶️)
4. Check terminal for output

## Current Execution Flow

```
User clicks Run
  ↓
Code saved to workspace
  ↓
/api/execute called with code + language ID
  ↓
Submits to Judge0 API
  ↓
Polls every 1 second (max 30 seconds)
  ↓
Results displayed in terminal:
  - ✅ Success: stdout, time, memory
  - ❌ Compilation Error: compile_output
  - ⚠️ Runtime Error: stderr
```

## Features

### ✅ Implemented:
- Code submission to Judge0
- Polling mechanism
- Error handling (compilation, runtime, timeout)
- Result display in terminal
- Execution time and memory display
- Authentication (requires logged-in user)

### 🔄 Can Be Enhanced:
- **Input (stdin) support** - For interactive programs
- **Multiple test cases** - Run code against multiple inputs
- **Custom timeouts** - Per-language timeout settings
- **File upload** - For multi-file projects
- **Better error formatting** - Syntax highlighting for errors
- **Execution history** - Save previous executions

## Troubleshooting

### "Failed to submit code to Judge0"
- Check `JUDGE0_API_URL` is correct
- Verify `JUDGE0_API_KEY` if using RapidAPI
- Check network connectivity

### "Execution timeout"
- Code took > 30 seconds (default timeout)
- Increase `maxAttempts` in `/api/execute/route.ts` if needed
- Or reduce code complexity

### "Language not supported"
- Check `languageConfigs` has entry for your language
- Verify `judge0Id` is correct for Judge0 version
- Some languages may need different IDs depending on Judge0 version

### Rate Limits
- RapidAPI free tier: 10 requests/minute
- Solutions:
  - Upgrade RapidAPI plan
  - Self-host Judge0
  - Add request queuing/throttling

## Next Steps

1. **Set up environment variables** (required)
2. **Test with simple code** (Python "Hello World")
3. **Verify all languages work** (Python, JS, Java, C++, Rust)
4. **Consider self-hosting** for production (recommended)

## Hybrid Approach (Recommended)

- **Code Execution** → Use Judge0 (sandboxed, secure)
- **Terminal Commands** → Use PTY (file operations, git, etc.)
- **Best of both worlds**: Secure code execution + flexible terminal

