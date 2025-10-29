import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'

export type ModelProvider = 'openai' | 'anthropic'

export function getModel(provider?: ModelProvider | string) {
	const p = (provider as ModelProvider) ?? 'openai'
	if (p === 'anthropic') {
		// Sonnet 4.5 (adjust if provider naming differs)
		return anthropic('claude-3-5-sonnet-202410')
	}
	// GPT-5 (adjust if provider naming differs)
	return openai('gpt-5')
}

