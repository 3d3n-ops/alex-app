import fs from 'node:fs/promises'
import path from 'node:path'

export type AgentId = 'alexExplore' | 'alexTutor'

export type AgentConfig = {
	agentId: AgentId
	systemPrompt: string
	toolsMeta: unknown
}

const ROOT = process.cwd()

export async function loadAgentConfig(agentId: AgentId): Promise<AgentConfig> {
	const agentDir = path.join(ROOT, 'agent', agentId)
	const promptPath = path.join(agentDir, 'prompt.md')
	const toolsPath = path.join(agentDir, 'tools.json')

	const [promptBuf, toolsBuf] = await Promise.all([
		fs.readFile(promptPath),
		fs.readFile(toolsPath)
	])

	const systemPrompt = promptBuf.toString('utf8')
	const toolsMeta = JSON.parse(toolsBuf.toString('utf8'))

	return { agentId, systemPrompt, toolsMeta }
}

export function normalizeAgent(input?: string | null): AgentId {
	if (input === 'alexTutor' || input === 'learn' || input === 'tutor') return 'alexTutor'
	return 'alexExplore'
}

