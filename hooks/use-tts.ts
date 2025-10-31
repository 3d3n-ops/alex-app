'use client'

import { useRef, useCallback, useState } from 'react'

interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  speed?: number
  model?: 'tts-1' | 'tts-1-hd'
}

/**
 * Hook for text-to-speech functionality with streaming support
 */
export function useTTS(options: TTSOptions = {}) {
  const audioQueueRef = useRef<HTMLAudioElement[]>([])
  const isPlayingRef = useRef(false)
  const [isEnabled, setIsEnabled] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  const speak = useCallback(async (text: string, immediate = false) => {
    if (!isEnabled || !text?.trim()) return

    // Cancel any ongoing TTS requests
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voice: options.voice || 'alloy',
          speed: options.speed || 1.0,
          model: options.model || 'tts-1',
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        console.error('TTS request failed:', response.status)
        return
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)

      // Clean up URL when done
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(audioUrl)
        audioQueueRef.current = audioQueueRef.current.filter(a => a !== audio)
        isPlayingRef.current = false
      })

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e)
        URL.revokeObjectURL(audioUrl)
        audioQueueRef.current = audioQueueRef.current.filter(a => a !== audio)
        isPlayingRef.current = false
      })

      if (immediate) {
        // Stop current audio and play immediately
        audioQueueRef.current.forEach(a => {
          a.pause()
          a.currentTime = 0
        })
        audioQueueRef.current = []
        isPlayingRef.current = false
      }

      audioQueueRef.current.push(audio)

      if (!isPlayingRef.current) {
        playNext()
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled, ignore
        return
      }
      console.error('TTS error:', error)
    }
  }, [isEnabled, options.voice, options.speed, options.model])

  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false
      return
    }

    const audio = audioQueueRef.current[0]
    isPlayingRef.current = true

    audio.addEventListener('ended', () => {
      audioQueueRef.current.shift()
      playNext()
    }, { once: true })

    audio.play().catch((error) => {
      console.error('Failed to play audio:', error)
      audioQueueRef.current.shift()
      playNext()
    })
  }, [])

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    audioQueueRef.current.forEach(a => {
      a.pause()
      a.currentTime = 0
    })
    audioQueueRef.current = []
    isPlayingRef.current = false
  }, [])

  return {
    speak,
    stop,
    isEnabled,
    setIsEnabled,
  }
}

/**
 * Streaming TTS - speaks text as it comes in, chunking by sentences
 */
export function useStreamingTTS(options: TTSOptions = {}) {
  const tts = useTTS(options)
  const bufferRef = useRef('')
  const sentenceEndRegex = /[.!?]\s+/g

  const addText = useCallback((textChunk: string) => {
    if (!tts.isEnabled || !textChunk) return

    bufferRef.current += textChunk

    // Check for sentence endings
    const sentences: string[] = []
    let lastIndex = 0
    let match

    // Reset regex lastIndex
    sentenceEndRegex.lastIndex = 0

    while ((match = sentenceEndRegex.exec(bufferRef.current)) !== null) {
      const sentence = bufferRef.current.substring(lastIndex, match.index + match[0].length).trim()
      if (sentence) {
        sentences.push(sentence)
      }
      lastIndex = match.index + match[0].length
    }

    // If we found complete sentences, speak them
    if (sentences.length > 0) {
      sentences.forEach(sentence => tts.speak(sentence, false))
      bufferRef.current = bufferRef.current.substring(lastIndex)
    }
  }, [tts])

  const flush = useCallback(() => {
    if (bufferRef.current.trim()) {
      tts.speak(bufferRef.current.trim(), false)
      bufferRef.current = ''
    }
  }, [tts])

  return {
    addText,
    flush,
    stop: tts.stop,
    isEnabled: tts.isEnabled,
    setIsEnabled: tts.setIsEnabled,
  }
}

