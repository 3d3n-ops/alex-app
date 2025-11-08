# Tool Analysis & Recommendations

## Current Tools Overview

### Server-Side Tools (Auto-executed)

#### 1. **todos**
- **Purpose**: Manage task lists for multi-step learning
- **Usage**: Create, update, track progress through teaching sessions
- **When to use**: Breaking down complex topics, tracking session progress
- **Status**: ✅ **KEEP** - Core pedagogical tool

#### 2. **globFile**
- **Purpose**: List files matching glob patterns
- **Usage**: Explore project structure
- **When to use**: Finding files, understanding project layout
- **Status**: ⚠️ **SIMPLIFY** - Overlaps with `listFiles`, consider consolidating

#### 3. **grepFile**
- **Purpose**: Search codebase for patterns
- **Usage**: Find code references, trace data flow
- **When to use**: Explaining how features work, finding usages
- **Status**: ✅ **KEEP** - Essential for code exploration

#### 4. **readFile**
- **Purpose**: Read workspace files
- **Usage**: Read file contents from filesystem
- **When to use**: Reading files from the actual workspace (not editor)
- **Status**: ⚠️ **CONFLICT** - Overlaps with `editor_readFile`, need clear distinction

#### 5. **listFiles**
- **Purpose**: List files in workspace directory
- **Usage**: See what files exist
- **When to use**: Before reading files
- **Status**: ⚠️ **SIMPLIFY** - Overlaps with `globFile`, could be unified

#### 6. **writeFile**
- **Purpose**: Write to workspace filesystem
- **Usage**: Create/overwrite files in actual workspace
- **When to use**: When files need to be accessible via readFile
- **Status**: ⚠️ **CONFLICT** - Overlaps with `editor_createFile`, confusing distinction

### Editor Tools (Server-side, thread-scoped)

#### 7. **editor_readFile**
- **Purpose**: Read files from thread-scoped CodeEditorDB
- **Usage**: Read files created with editor_createFile
- **When to use**: Reading files created in the current chat thread
- **Status**: ✅ **KEEP** - Clear purpose, thread-scoped

#### 8. **editor_listFiles**
- **Purpose**: List files in thread-scoped CodeEditorDB
- **Usage**: See what files exist in current thread's editor
- **When to use**: Before reading editor files
- **Status**: ✅ **KEEP** - Clear purpose, thread-scoped

### Client UI Tools (Returned as intents)

#### 9. **editor_setCode**
- **Purpose**: Replace entire editor content
- **Usage**: Set code in editor
- **Status**: ✅ **KEEP** - Useful for full replacements

#### 10. **editor_insertCode**
- **Purpose**: Insert code at cursor/position
- **Usage**: Add code at specific location
- **Status**: ✅ **KEEP** - Useful for incremental edits

#### 11. **editor_createFile**
- **Purpose**: Create file in thread-scoped editor
- **Usage**: Primary tool for creating code files
- **Status**: ✅ **KEEP** - Core tool, well-documented

#### 12. **editor_spotlight**
- **Purpose**: Highlight code lines with visual effect
- **Usage**: Draw attention to specific code
- **Status**: ✅ **KEEP** - Pedagogical tool

## Issues & Recommendations

### 🔴 Critical Issues

1. **Tool Overlap Confusion**
   - `readFile` vs `editor_readFile`: Users/agents may not know which to use
   - `writeFile` vs `editor_createFile`: Similar confusion
   - `globFile` vs `listFiles`: Overlapping functionality

2. **Tool Call ID Mismatches** (FIXED)
   - Issue: Using `call?.id || call?.call_id` caused mismatches
   - Fix: Use only `call?.id` (OpenRouter format)
   - Fix: Ensure assistant message is pushed before tool results

### ⚠️ Simplification Opportunities

1. **Consolidate File Listing Tools**
   - **Recommendation**: Merge `globFile` and `listFiles` into a single `listFiles` tool
   - Add `pattern` parameter (optional) for glob filtering
   - Keep `globFile` as alias for backward compatibility if needed

2. **Clarify Workspace vs Editor Tools**
   - **Current**: Two separate systems (workspace filesystem vs thread-scoped editor)
   - **Recommendation**: 
     - Keep both systems but improve naming/documentation
     - Add to descriptions: "Use `readFile` for workspace files, `editor_readFile` for thread-scoped editor files"
     - Consider deprecating `writeFile` in favor of `editor_createFile` if workspace writes aren't needed

3. **Reduce Tool Count**
   - **Current**: 12 tools
   - **Target**: 8-10 tools by consolidating
   - **Benefit**: Simpler for agent to choose, fewer errors

### ✅ Strengths

1. **Clear separation**: Editor tools vs workspace tools
2. **Pedagogical tools**: `todos` and `editor_spotlight` are well-designed
3. **Thread-scoping**: Editor tools properly scoped per thread

## Proposed Tool Set (Simplified)

### Server Tools (6)
1. `todos` - Task management
2. `listFiles` - Unified file listing (replaces globFile + listFiles)
3. `grepFile` - Code search
4. `readFile` - Read workspace files
5. `editor_readFile` - Read editor files (thread-scoped)
6. `editor_listFiles` - List editor files (thread-scoped)

### Client Tools (4)
1. `editor_createFile` - Create file in editor
2. `editor_setCode` - Replace editor content
3. `editor_insertCode` - Insert code at position
4. `editor_spotlight` - Highlight code

### Removed (2)
- ~~`writeFile`~~ - Use `editor_createFile` instead
- ~~`globFile`~~ - Merged into `listFiles`

## Tool Usage Statistics (To Collect)

Run evals to collect:
- Most frequently used tools
- Tool call error rates per tool
- Average tool execution time
- Most common tool call errors

## Next Steps

1. ✅ Fix tool_use_id mismatch errors
2. ✅ Create eval system
3. ⏳ Run evals to collect statistics
4. ⏳ Consolidate overlapping tools
5. ⏳ Improve tool descriptions
6. ⏳ Update agent prompts to clarify tool usage

