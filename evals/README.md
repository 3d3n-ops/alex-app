# Agent Evaluation System

This directory contains tools for evaluating and testing the agent's tool call performance, error rates, and overall effectiveness.

## Overview

The eval system helps:
- **Test tool call correctness** - Ensure tool_use_id matching works correctly
- **Measure error rates** - Track how often tool calls fail
- **Identify issues** - Find tool call patterns that cause errors
- **Improve agent performance** - Use metrics to optimize tool usage

## Files

- `agent-evals.ts` - Core evaluation framework with test runners
- `run-evals.ts` - Script to execute eval suites
- `tool-analysis.md` - Analysis of current tools and recommendations
- `results/` - Directory for generated eval reports (gitignored)

## Running Evals

### Prerequisites

```bash
# Ensure you have OPENROUTER_API_KEY set
export OPENROUTER_API_KEY=your_key_here
```

### Run All Suites

```bash
npx tsx evals/run-evals.ts all
```

### Run Specific Suite

```bash
# Basic tool calls
npx tsx evals/run-evals.ts basic

# Tool use ID matching (critical for fixing the error)
npx tsx evals/run-evals.ts toolUseId

# Error handling
npx tsx evals/run-evals.ts errorHandling

# Efficiency
npx tsx evals/run-evals.ts efficiency
```

## Test Suites

### 1. Basic Tool Calls
Tests fundamental tool call functionality:
- `list_files` - List workspace files
- `read_file` - Read files
- `grep_search` - Search codebase

### 2. Tool Use ID Matching ⚠️ CRITICAL
Tests the fix for tool_use_id mismatch errors:
- `multiple_tools_same_turn` - Multiple tools in one turn
- `react_loop_tool_chaining` - Tool chaining across ReAct loop

### 3. Error Handling
Tests error scenarios:
- Invalid tool names
- Invalid file paths
- Tool execution errors

### 4. Efficiency
Tests tool usage efficiency:
- Minimal tool calls for simple questions
- Targeted tool usage

## Understanding Results

### Metrics

- **Tool Call Count**: Total number of tool calls made
- **Tool Call Errors**: Number of failed tool calls
- **Tool Call Error Rate**: Percentage of failed calls
- **Tool Use ID Mismatches**: ⚠️ Critical - should always be 0
- **Response Time**: Total time for the test
- **Tool Execution Time**: Time spent executing tools

### Report Format

Reports are generated as Markdown files in `evals/results/`:
- Individual suite reports: `suite-{name}-{timestamp}.md`
- Combined report: `combined-report-{timestamp}.md`

## Key Error: Tool Use ID Mismatch

### The Problem

The error you saw:
```
unexpected `tool_use_id` found in `tool_result` blocks: toolu_vrtx_01SiGfm4ULrVuoYYyQuTmLHr
```

This happens when:
1. Tool results reference IDs that don't exist in the previous assistant message
2. Tool call IDs are extracted incorrectly (using wrong field)
3. Assistant message isn't pushed before tool results

### The Fix

1. **Consistent ID extraction**: Use only `call?.id` (OpenRouter format)
2. **Message ordering**: Push assistant message before tool results
3. **Validation**: Skip orphaned tool messages in message cleaning

See `app/api/chat/route.ts` for the fixes.

## Adding New Tests

To add a new test:

```typescript
{
  name: 'test_name',
  description: 'What this test checks',
  messages: [
    {
      role: 'user',
      content: 'User message here'
    }
  ],
  expectedTools: ['toolName1', 'toolName2'], // Optional
  shouldFail: false // Optional
}
```

Add to one of the suites in `agent-evals.ts` or create a new suite.

## Continuous Monitoring

Consider running evals:
- After deploying changes to tool handling
- Before major releases
- Weekly to track error rates
- When investigating production errors

## Troubleshooting

### Eval fails with API error
- Check `OPENROUTER_API_KEY` is set
- Verify model is available
- Check API rate limits

### Tool Use ID mismatches still occurring
- Verify fixes in `app/api/chat/route.ts` are deployed
- Check message cleaning logic
- Review tool call ID extraction

### Tests timing out
- Increase timeout in `openRouterChatOnce`
- Check network connectivity
- Verify model availability

