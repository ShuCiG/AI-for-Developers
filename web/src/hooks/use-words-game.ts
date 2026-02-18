import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { generateWordsGameText } from '@/lib/ai-service'

export interface UseWordsGameReturn {
  textWithPlaceholders: string | null
  wordsInOrder: string[]
  words: string[]
  loading: boolean
  error: Error | null
  startGame: () => Promise<void>
  checkAnswer: (placements: Record<string, string>) => boolean
  resetGame: () => void
}

/**
 * Hook for the Words game: fetch 3 random words, generate text with placeholders,
 * and check user's answer.
 */
export function useWordsGame(): UseWordsGameReturn {
  const [textWithPlaceholders, setTextWithPlaceholders] = useState<string | null>(null)
  const [wordsInOrder, setWordsInOrder] = useState<string[]>([])
  const [words, setWords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const startGame = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setTextWithPlaceholders(null)
      setWordsInOrder([])
      setWords([])

      // Only use seed words (user_id IS NULL) for the words game
      const { data: randomWords, error: wordsError } = await supabase
        .from('words')
        .select('*')
        .is('user_id', null) // Only seed words, not user-specific words
        .limit(100)

      if (wordsError) {
        // If error is about missing column, try without filter (backward compatibility)
        if (wordsError.message?.includes('user_id') || wordsError.message?.includes('does not exist') || wordsError.message?.includes('column')) {
          console.warn('user_id column might not exist, fetching all words without filter')
          const { data: fallbackWords, error: fallbackError } = await supabase
            .from('words')
            .select('*')
            .limit(100)
          
          if (fallbackError) {
            throw new Error(`Failed to fetch words: ${fallbackError.message}`)
          }
          
          if (!fallbackWords || fallbackWords.length < 3) {
            throw new Error('Need at least 3 words in the database')
          }
          
          const shuffled = [...fallbackWords].sort(() => 0.5 - Math.random())
          const selectedWords = shuffled.slice(0, 3)
          const wordStrings = selectedWords.map((w) => w.word)
          setWords(wordStrings)
          
          const response = await generateWordsGameText(wordStrings)
          setTextWithPlaceholders(response.text_with_placeholders)
          setWordsInOrder(response.words_in_order)
          return
        }
        throw new Error(`Failed to fetch words: ${wordsError.message}`)
      }

      if (!randomWords || randomWords.length < 3) {
        throw new Error('Need at least 3 words in the database')
      }

      const shuffled = [...randomWords].sort(() => 0.5 - Math.random())
      const selectedWords = shuffled.slice(0, 3)
      const wordStrings = selectedWords.map((w) => w.word)

      setWords(wordStrings)

      const response = await generateWordsGameText(wordStrings)

      setTextWithPlaceholders(response.text_with_placeholders)
      setWordsInOrder(response.words_in_order)
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('An unknown error occurred')
      setError(errorObj)
      console.error('Error starting words game:', errorObj)
    } finally {
      setLoading(false)
    }
  }, [])

  const checkAnswer = useCallback(
    (placements: Record<string, string>): boolean => {
      if (wordsInOrder.length === 0) return false

      const slotIds = Object.keys(placements).sort()
      if (slotIds.length !== wordsInOrder.length) return false

      for (let i = 0; i < wordsInOrder.length; i++) {
        const slotId = `slot-${i}`
        if (placements[slotId] !== wordsInOrder[i]) {
          return false
        }
      }
      return true
    },
    [wordsInOrder]
  )

  const resetGame = useCallback(() => {
    setTextWithPlaceholders(null)
    setWordsInOrder([])
    setWords([])
    setError(null)
  }, [])

  return {
    textWithPlaceholders,
    wordsInOrder,
    words,
    loading,
    error,
    startGame,
    checkAnswer,
    resetGame,
  }
}
