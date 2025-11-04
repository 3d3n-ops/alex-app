# Stress Test Suite

Comprehensive test suite for stress testing the agent API with 30-50 message conversations. Tests latency, performance, and response quality across diverse scenarios.

## Features

- **Multi-scenario testing**: Mixed conversations, code-heavy tasks, question-heavy dialogues, and tool-heavy operations
- **Comprehensive metrics**:
  - Latency tracking (total, first token, last token)
  - Response quality (content length, token estimates)
  - Tool usage metrics (call frequency, success rates)
  - Error tracking and success rates
- **Performance analysis**: P50, P95, P99 latency percentiles
- **Detailed reporting**: JSON reports with full conversation history

## Prerequisites

1. **Server must be running**: Start your Next.js dev server
   ```bash
   npm run dev
   ```

2. **Authentication**: The test suite requires a valid authentication session. You may need to:
   - Be logged into the application in your browser
   - Or configure a test authentication token (see Authentication below)

3. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

## Usage

### Basic Usage

Run the default test (mixed scenario, 40 messages):
```bash
npm run test:stress
```

### Run Specific Scenarios

```bash
# Mixed conversations (questions + code + tools)
npm run test:stress:mixed

# Code-heavy scenario (lots of file operations)
npm run test:stress:code

# Question-heavy scenario (conversational, minimal tools)
npm run test:stress:questions

# Tool-heavy scenario (maximum tool usage)
npm run test:stress:tools

# Run all scenarios
npm run test:stress:all
```

### Advanced Configuration

You can customize the test run using command-line arguments or environment variables:

```bash
# Using command-line arguments
tsx tests/stress-test-suite.ts --scenarios=mixed,codeHeavy --messages=50 --endpoint=http://localhost:3000 --agent=alexTutor

# Using environment variables
TEST_ENDPOINT=http://localhost:3000 \
TEST_AGENT=alexTutor \
TEST_MESSAGE_COUNT=50 \
TEST_SCENARIOS=mixed,codeHeavy \
TEST_USE_TOOLS=true \
npm run test:stress
```

### Available Options

| Option | Environment Variable | Default | Description |
|--------|---------------------|---------|-------------|
| `--scenarios` | `TEST_SCENARIOS` | `mixed` | Comma-separated list: `mixed`, `codeHeavy`, `questionHeavy`, `toolHeavy` |
| `--messages` | `TEST_MESSAGE_COUNT` | `40` | Number of messages per scenario |
| `--endpoint` | `TEST_ENDPOINT` | `http://localhost:3000` | API endpoint URL |
| `--agent` | `TEST_AGENT` | `alexTutor` | Agent ID (`alexTutor` or `alexExplore`) |
| `--tools` | `TEST_USE_TOOLS` | `true` | Enable/disable tools (`true` or `false`) |
| `--authCookie` | `TEST_AUTH_COOKIE` | - | Session cookie for authentication (e.g., `__session=value`) |
| `--authToken` | `TEST_AUTH_TOKEN` | - | Bearer token for authentication |

## Output

### Console Output

The test suite provides real-time progress updates:
- Message-by-message progress with latency and tool usage
- Per-scenario summaries
- Overall performance statistics

### JSON Report

After completion, a JSON report is saved to `stress-test-report-{timestamp}.json` containing:
- Complete conversation history
- All metrics for each message
- Summary statistics per scenario
- Overall performance metrics

Example report structure:
```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "endpoint": "http://localhost:3000",
  "agent": "alexTutor",
  "conversations": [
    {
      "scenario": "mixed",
      "messages": [...],
      "summary": {
        "totalMessages": 40,
        "totalDuration": 125000,
        "avgLatency": 3125,
        "minLatency": 1200,
        "maxLatency": 8500,
        "totalTokenCount": 15000,
        "totalToolCalls": 25,
        "errorCount": 0,
        "successRate": 100
      }
    }
  ],
  "overall": {
    "totalMessages": 40,
    "avgLatencyPerMessage": 3125,
    "p50Latency": 2800,
    "p95Latency": 7500,
    "p99Latency": 8500,
    "totalToolCalls": 25,
    "totalErrors": 0
  }
}
```

## Test Scenarios

### Mixed (`mixed`)
Balanced conversation with:
- Conceptual questions
- Code examples and explanations
- File creation requests
- Follow-up questions
- Tool usage when appropriate

### Code Heavy (`codeHeavy`)
Intensive file operations:
- Creating multiple files
- Reading and modifying code
- Creating tests and documentation
- Complex multi-file operations

### Question Heavy (`questionHeavy`)
Conversational focus:
- Primarily informational questions
- Minimal tool usage
- Deep discussions on programming concepts
- Testing conversational quality

### Tool Heavy (`toolHeavy`)
Maximum tool stress:
- Extensive file listing and searching
- Multiple read/write operations
- Pattern searching
- Testing tool execution performance

## Metrics Explained

### Latency Metrics
- **Total Latency**: Time from request sent to complete response received
- **First Token Latency**: Time to first chunk/character (streaming)
- **Last Token Latency**: Time to last chunk/character (streaming)
- **P50/P95/P99**: Percentile latencies across all messages

### Performance Metrics
- **Content Length**: Number of characters in response
- **Token Count**: Estimated tokens (characters / 4)
- **Streaming Chunks**: Number of SSE chunks received

### Tool Metrics
- **Tool Calls**: Number of tools executed server-side
- **Tool Intents**: Number of tools returned for client execution
- **Tool Success Rate**: Percentage of successful tool executions

### Quality Metrics
- **Success Rate**: Percentage of requests without errors
- **Error Count**: Total number of failed requests
- **Response Coherence**: (Qualitative - review responses manually)

## Authentication

The API requires authentication via Clerk. The test suite supports authentication through environment variables or command-line arguments.

### Option 1: Using Session Cookie (Recommended)

1. **Get your session cookie**:
   - Log into your application in a browser
   - Open DevTools (F12)
   - Go to Application > Cookies > `http://localhost:3000` (or your domain)
   - Copy the value of `__session` cookie (or similar Clerk session cookie)

2. **Run test with cookie**:
   ```bash
   # Using environment variable
   TEST_AUTH_COOKIE="__session=your-cookie-value" npm run test:stress

   # Using command-line argument
   npm run test:stress -- --authCookie="__session=your-cookie-value"
   ```

### Option 2: Using Auth Token

If your API supports Bearer tokens:
```bash
TEST_AUTH_TOKEN="your-token" npm run test:stress
# Or
npm run test:stress -- --authToken="your-token"
```

### Option 3: Bypass Auth in Development

For local development, you can temporarily modify the API route to bypass authentication (not recommended for production).

## Troubleshooting

### Connection Refused
```
Error: Connection refused. Is the server running at http://localhost:3000?
```
**Solution**: Make sure your Next.js dev server is running (`npm run dev`)

### Authentication Errors
```
Request failed: 401 Unauthorized
```
**Solution**: Configure authentication (see Authentication section above)

### Timeout Errors
```
Connection timeout to http://localhost:3000
```
**Solution**: 
- Check if server is accessible
- Increase timeout in the test suite
- Check server logs for errors

### High Latency
If you're seeing very high latencies:
- Check API provider rate limits
- Monitor server CPU/memory usage
- Check network conditions
- Consider reducing message count for initial testing

## Next Steps: Judge0 Integration

This test suite focuses on API and agent performance. For testing code execution with Judge0 API, you'll want to:

1. Create separate test scenarios that generate executable code
2. Add Judge0 API integration to execute generated code
3. Validate code execution results
4. Measure execution time and success rates

The stress test suite provides a foundation for adding Judge0 execution testing.

## Example Output

```
🚀 Starting Stress Test Suite
   Endpoint: http://localhost:3000
   Agent: alexTutor
   Messages per scenario: 40
   Tools enabled: true
   Scenarios: mixed

🔍 Checking server connection...
✅ Server is reachable

============================================================
Running scenario: mixed
Messages: 40
============================================================

[1/40] Testing: "Hello! Can you explain what recursion is?"
  ✅ Latency: 2341ms | Content: 542 chars | Tools: 0

[2/40] Testing: "Can you show me a Python example?"
  ✅ Latency: 1892ms | Content: 387 chars | Tools: 1

...

================================================================================
📊 STRESS TEST REPORT
================================================================================
Timestamp: 2024-01-01T00:00:00.000Z
Endpoint: http://localhost:3000
Agent: alexTutor
Total Conversations: 1
Total Messages: 40

Overall Performance:
  Average Latency: 3125.45ms
  P50 Latency: 2800ms
  P95 Latency: 7500ms
  P99 Latency: 8500ms
  Total Tool Calls: 25
  Total Errors: 0

--------------------------------------------------------------------------------
Per-Scenario Breakdown:
--------------------------------------------------------------------------------

📋 Scenario: mixed
  Messages: 40
  Duration: 125000ms
  Avg Latency: 3125.00ms
  Min Latency: 1200ms
  Max Latency: 8500ms
  Estimated Tokens: 3750
  Tool Calls: 25
  Tool Intents: 25
  Errors: 0
  Success Rate: 100.00%

================================================================================

💾 Report saved to: stress-test-report-1704067200000.json

✅ Stress test complete!
```

