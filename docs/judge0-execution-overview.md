# Judge0 Code Execution Overview

## Current State

### What Exists:
1. **Language Configuration** - `components/code-editor.tsx` has `languageConfigs` with Judge0 language IDs:
   - Python 3 (ID: 71)
   - Node.js (ID: 63)
   - Java OpenJDK 13.0.1 (ID: 62)
   - C++ GCC 9.2.0 (ID: 54)
   - Rust 1.40.0 (ID: 73)

2. **PTY Terminal System** - Currently used for code execution:
   - `/api/pty/session` - Creates terminal sessions
   - `/api/pty/connect` - Connects to terminal (SSE stream)
   - `/api/pty/input` - Sends input to terminal
   - `/api/pty/resize` - Resizes terminal
   - Executes code locally via shell commands

3. **Code Editor Execution** - `executeCode()` function:
   - Currently saves file to workspace
   - Constructs shell commands (e.g., `python file.py`, `node file.js`)
   - Sends commands to PTY terminal for local execution
   - **NOT using Judge0 API**

## What Needs to Be Done

### 1. Create Judge0 API Endpoint
- **File**: `app/api/execute/route.ts`
- **Function**: Submit code to Judge0, poll for results, return output
- **Features**:
  - Accept code, language ID, stdin (optional)
  - Submit to Judge0 API
  - Poll for execution status
  - Handle compilation errors, runtime errors, timeouts
  - Return stdout, stderr, exit code, execution time

### 2. Update Code Editor
- **File**: `components/code-editor.tsx`
- **Change**: Update `executeCode()` to call `/api/execute` instead of PTY
- **Display**: Show execution results in terminal or output panel
- **Error Handling**: Display compilation errors, runtime errors clearly

### 3. Environment Variables
- Add `JUDGE0_API_URL` (e.g., `https://judge0-ce.p.rapidapi.com` or self-hosted)
- Add `JUDGE0_API_KEY` (if using RapidAPI)
- Optional: `JUDGE0_RAPIDAPI_HOST` header value

### 4. Execution Flow
```
User clicks Run Button
  ↓
Save code to workspace
  ↓
Call /api/execute with code + language
  ↓
Submit to Judge0 API
  ↓
Poll for status (In Queue → Processing → Completed)
  ↓
Display results (stdout, stderr, or errors)
```

### 5. Judge0 Status Handling
- Status 1: In Queue
- Status 2: Processing
- Status 3: Accepted (success)
- Status 4-11: Various error states (compilation error, runtime error, etc.)

## Implementation Plan

### Phase 1: Basic Execution
1. Create `/api/execute` endpoint
2. Implement Judge0 submission
3. Implement polling mechanism
4. Return basic results (stdout/stderr)

### Phase 2: Enhanced Features
1. Better error formatting
2. Execution time display
3. Memory usage (if available)
4. Timeout handling
5. Input (stdin) support for interactive programs

### Phase 3: Advanced Features
1. Multiple test cases support
2. Custom compile commands
3. File submission (for multi-file projects)
4. Execution limits (time, memory)

## Judge0 API Details

### Endpoints Needed:
- **POST** `/submissions` - Submit code
  - Body: `source_code`, `language_id`, `stdin`, `cpu_time_limit`, `memory_limit`
  
- **GET** `/submissions/{token}` - Get submission status
  - Response: `status`, `stdout`, `stderr`, `compile_output`, `message`, `time`, `memory`

### Authentication:
- RapidAPI: Requires `X-RapidAPI-Key` and `X-RapidAPI-Host` headers
- Self-hosted: No auth needed (or custom auth)

### Rate Limits:
- RapidAPI: 10 requests/minute (free tier)
- Self-hosted: Configurable

## Alternatives Considered

### Current PTY Approach:
- ✅ Works immediately
- ✅ No API limits
- ✅ Can run any command
- ❌ Not sandboxed (security risk)
- ❌ Requires local runtime environments
- ❌ Platform-specific

### Judge0 Approach:
- ✅ Sandboxed execution
- ✅ Multiple languages supported
- ✅ Consistent across platforms
- ✅ Better error handling
- ❌ API rate limits
- ❌ Requires Judge0 service
- ❌ Slight latency (polling)

## Recommended Hybrid Approach

Use **Judge0 for code execution**, keep **PTY for terminal interactions**:
- Code execution → Judge0 API
- Terminal commands, file operations → PTY
- Best of both worlds

