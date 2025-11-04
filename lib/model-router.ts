/**
 * Model Router with Automatic Fallback
 * 
 * Tracks model performance and automatically switches to faster models
 * when current model becomes slow or fails.
 */

export interface ModelConfig {
	name: string
	priority: number // Lower number = higher priority
	speed: 'fast' | 'medium' | 'slow' // Expected speed category
	timeout?: number // Custom timeout in ms (default: 30000)
}

// Model configuration with priority order
export const MODEL_CONFIGS: ModelConfig[] = [
	// Primary: Claude models (high uptime, good quality)
	// Try with provider prefix first (most common OpenRouter format)
	{
		name: 'anthropic/claude-sonnet-4-5@20250929',
		priority: 1,
		speed: 'medium',
		timeout: 45000, // 45s timeout for Claude
	},
	{
		name: 'anthropic/claude-sonnet-4-5-20250929',
		priority: 2,
		speed: 'medium',
		timeout: 45000,
	},
	// Fallback: GPT-5 (good quality, slower)
	{
		name: 'openai/gpt-5',
		priority: 3,
		speed: 'slow',
		timeout: 60000, // 60s for GPT-5
	},
	// Fast fallbacks
	{
		name: 'x-ai/grok-code-fast-1',
		priority: 4,
		speed: 'fast',
		timeout: 20000, // 20s for Grok
	},
	{
		name: 'deepseek-ai/DeepSeek-V3-0324',
		priority: 5,
		speed: 'fast',
		timeout: 15000, // 15s for DeepSeek (fastest)
	},
]

// Performance tracking per model
interface ModelPerformance {
	model: string
	lastResponseTime: number | null
	averageResponseTime: number | null
	successCount: number
	failureCount: number
	timeoutCount: number
	lastUsed: number
	isSlow: boolean // Marked as slow if consistently slow
}

// In-memory performance store (in production, could be persisted)
const performanceStore = new Map<string, ModelPerformance>()

// Initialize performance tracking for all models
MODEL_CONFIGS.forEach(config => {
	if (!performanceStore.has(config.name)) {
		performanceStore.set(config.name, {
			model: config.name,
			lastResponseTime: null,
			averageResponseTime: null,
			successCount: 0,
			failureCount: 0,
			timeoutCount: 0,
			lastUsed: 0,
			isSlow: false,
		})
	}
})

// Thresholds for determining if a model is slow
const SLOW_THRESHOLD_MS = 30000 // 30 seconds
const TIMEOUT_THRESHOLD_MS = 45000 // 45 seconds
const CONSECUTIVE_SLOW_COUNT = 2 // Mark as slow after 2 slow responses

/**
 * Record performance metrics for a model
 */
export function recordModelPerformance(
	model: string,
	responseTime: number,
	success: boolean,
	timedOut: boolean = false
) {
	const perf = performanceStore.get(model)
	if (!perf) return

	perf.lastResponseTime = responseTime
	perf.lastUsed = Date.now()

	if (timedOut) {
		perf.timeoutCount++
		perf.failureCount++
	} else if (success) {
		perf.successCount++
	} else {
		perf.failureCount++
	}

	// Update average response time (simple moving average)
	if (perf.averageResponseTime === null) {
		perf.averageResponseTime = responseTime
	} else {
		// Weighted average: 70% old, 30% new
		perf.averageResponseTime = perf.averageResponseTime * 0.7 + responseTime * 0.3
	}

	// Mark as slow if response time exceeds threshold
	if (responseTime > SLOW_THRESHOLD_MS) {
		// Check if we've had consecutive slow responses
		if (perf.lastResponseTime && perf.lastResponseTime > SLOW_THRESHOLD_MS) {
			perf.isSlow = true
		}
	} else {
		// Reset slow flag if response is fast
		if (perf.isSlow && responseTime < SLOW_THRESHOLD_MS * 0.7) {
			perf.isSlow = false
		}
	}
}

/**
 * Get the best available model based on performance
 * Returns models in priority order, skipping slow ones
 */
export function getBestModel(skipSlow: boolean = true): string {
	const sorted = [...MODEL_CONFIGS].sort((a, b) => a.priority - b.priority)

	for (const config of sorted) {
		const perf = performanceStore.get(config.name)
		if (!perf) continue

		// Skip slow models if requested
		if (skipSlow && perf.isSlow) {
			continue
		}

		// Skip if recently had timeout
		if (perf.timeoutCount > 0 && Date.now() - perf.lastUsed < 60000) {
			continue
		}

		return config.name
	}

	// Fallback: return the highest priority model even if slow
	return sorted[0].name
}

/**
 * Get fallback models in priority order
 */
export function getFallbackModels(currentModel: string): string[] {
	const currentIndex = MODEL_CONFIGS.findIndex(m => m.name === currentModel)
	if (currentIndex === -1) {
		return MODEL_CONFIGS.map(m => m.name)
	}

	// Return models after current in priority order
	return MODEL_CONFIGS
		.slice(currentIndex + 1)
		.map(m => m.name)
}

/**
 * Get model config by name
 */
export function getModelConfig(modelName: string): ModelConfig | undefined {
	return MODEL_CONFIGS.find(m => m.name === modelName)
}

/**
 * Get performance stats for a model
 */
export function getModelPerformance(model: string): ModelPerformance | undefined {
	return performanceStore.get(model)
}

/**
 * Reset performance tracking for a model (useful for testing or manual reset)
 */
export function resetModelPerformance(model: string) {
	const perf = performanceStore.get(model)
	if (perf) {
		perf.lastResponseTime = null
		perf.averageResponseTime = null
		perf.successCount = 0
		perf.failureCount = 0
		perf.timeoutCount = 0
		perf.isSlow = false
		perf.lastUsed = 0
	}
}

/**
 * Get all performance stats (for debugging/monitoring)
 */
export function getAllPerformanceStats(): Map<string, ModelPerformance> {
	return new Map(performanceStore)
}

