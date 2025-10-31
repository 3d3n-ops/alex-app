import type { AgentId } from './agents'

/**
 * Splits a long message into multiple conversational bubbles.
 * More conversational (smaller chunks) for Tutor mode, less conversational (larger chunks) for Explore mode.
 */
export function splitMessageIntoBubbles(text: string, agentMode: AgentId): string[] {
  if (!text || text.trim().length === 0) return []

  // Configuration based on agent mode
  const config = agentMode === 'alexTutor'
    ? {
        // Tutor: More conversational, break at natural pauses more frequently
        minChunkLength: 50,   // Minimum characters per bubble
        maxChunkLength: 200,  // Maximum characters per bubble
        preferredLength: 120, // Preferred length for better UX
        breakOnNewlines: true, // Break on paragraph breaks
        breakOnSentences: true, // Break on sentence endings
      }
    : {
        // Explore: Less conversational, larger chunks
        minChunkLength: 150,
        maxChunkLength: 400,
        preferredLength: 250,
        breakOnNewlines: true,
        breakOnSentences: false, // Less likely to break mid-thought
      }

  const chunks: string[] = []
  let remaining = text.trim()

  // First, split by double newlines (paragraphs)
  const paragraphs = remaining.split(/\n\n+/)
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim()
    if (!para) continue

    // If paragraph is short enough, add it as-is
    if (para.length <= config.maxChunkLength) {
      // But try to combine with next if it would still be under max
      if (i < paragraphs.length - 1) {
        const nextPara = paragraphs[i + 1].trim()
        const combined = para + (nextPara ? '\n\n' + nextPara : '')
        if (combined.length <= config.maxChunkLength) {
          chunks.push(combined)
          i++ // Skip next paragraph as we've combined it
          continue
        }
      }
      chunks.push(para)
      continue
    }

    // Paragraph is too long, split it further
    let paraRemaining = para
    
    while (paraRemaining.length > config.maxChunkLength) {
      // Try to find a good breaking point
      let breakPoint = config.maxChunkLength
      
      // Look for sentence endings (., !, ?) within the preferred range
      if (config.breakOnSentences) {
        const sentenceEndRegex = /[.!?]\s+/g
        let match
        let bestBreak = -1
        
        // Look backwards from maxChunkLength
        for (let pos = config.maxChunkLength; pos >= config.preferredLength; pos--) {
          const substr = paraRemaining.substring(0, pos)
          const lastMatch = [...substr.matchAll(sentenceEndRegex)].pop()
          if (lastMatch && lastMatch.index !== undefined) {
            bestBreak = lastMatch.index + lastMatch[0].length
            break
          }
        }
        
        if (bestBreak >= config.minChunkLength) {
          breakPoint = bestBreak
        }
      }
      
      // If no good sentence break, try to break at word boundaries
      if (breakPoint === config.maxChunkLength) {
        // Look backwards from breakPoint to find a space
        for (let pos = config.maxChunkLength; pos >= config.minChunkLength; pos--) {
          if (paraRemaining[pos] === ' ' || paraRemaining[pos] === '\n') {
            breakPoint = pos + 1
            break
          }
        }
      }
      
      // Extract chunk
      const chunk = paraRemaining.substring(0, breakPoint).trim()
      if (chunk.length >= config.minChunkLength) {
        chunks.push(chunk)
        paraRemaining = paraRemaining.substring(breakPoint).trim()
      } else {
        // Force break if we couldn't find a good spot
        chunks.push(paraRemaining.substring(0, config.maxChunkLength))
        paraRemaining = paraRemaining.substring(config.maxChunkLength).trim()
      }
    }
    
    // Add remaining part of paragraph
    if (paraRemaining.length > 0) {
      chunks.push(paraRemaining)
    }
  }

  // Merge very small chunks with previous ones if possible
  const merged: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    
    if (chunk.length < config.minChunkLength && merged.length > 0) {
      // Try to merge with previous chunk
      const prevChunk = merged[merged.length - 1]
      const combined = prevChunk + '\n\n' + chunk
      if (combined.length <= config.maxChunkLength) {
        merged[merged.length - 1] = combined
        continue
      }
    }
    
    merged.push(chunk)
  }

  return merged.length > 0 ? merged : [text] // Fallback to original if splitting failed
}

