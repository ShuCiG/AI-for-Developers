import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { generateRandomPhrase, type RandomPhraseResponse } from '@/lib/ai-service'
import type { Database } from '@/lib/database.types'

type Word = Database['public']['Tables']['words']['Row']
type WordPair = Database['public']['Tables']['word_pairs']['Row']

export interface UseRandomPhraseReturn {
  phrase: string | null
  words: Word[]
  wordPair: WordPair | null
  loading: boolean
  error: Error | null
  generatePhrase: () => Promise<void>
  generatePhraseFromPair: (pairId: string) => Promise<void>
}

/**
 * Custom hook to fetch three random words from Supabase and generate a phrase using AI
 */
export function useRandomPhrase(): UseRandomPhraseReturn {
  const [phrase, setPhrase] = useState<string | null>(null)
  const [words, setWords] = useState<Word[]>([])
  const [wordPair, setWordPair] = useState<WordPair | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const generatePhrase = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setPhrase(null)

      // Fetch three random words from Supabase
      // Only use seed words (user_id IS NULL) for phrase generation
      // Using a random ordering approach with limit
      const { data: randomWords, error: wordsError } = await supabase
        .from('words')
        .select('*')
        .is('user_id', null) // Only seed words, not user-specific words
        .limit(100) // Get a sample to pick from

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
          
          if (!fallbackWords || fallbackWords.length === 0) {
            throw new Error('No words found in the database')
          }
          
          // Pick 3 random words from the sample
          const shuffled = [...fallbackWords].sort(() => 0.5 - Math.random())
          const selectedWords = shuffled.slice(0, Math.min(3, fallbackWords.length))
          setWords(selectedWords)
          
          // Generate phrase using the AI service
          const wordStrings = selectedWords.map(w => w.word)
          const response: RandomPhraseResponse = await generateRandomPhrase(wordStrings)
          setPhrase(response.phrase)
          return
        }
        throw new Error(`Failed to fetch words: ${wordsError.message}`)
      }

      if (!randomWords || randomWords.length === 0) {
        throw new Error('No words found in the database')
      }

      // Pick 3 random words from the sample
      const shuffled = [...randomWords].sort(() => 0.5 - Math.random())
      const selectedWords = shuffled.slice(0, Math.min(3, randomWords.length))

      setWords(selectedWords)

      // Generate phrase using the AI service
      const wordStrings = selectedWords.map(w => w.word)
      const response: RandomPhraseResponse = await generateRandomPhrase(wordStrings)

      setPhrase(response.phrase)

    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      setError(error)
      console.error('Error generating phrase:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const generatePhraseFromPair = useCallback(async (pairId: string) => {
    try {
      setLoading(true)
      setError(null)
      setPhrase(null)
      setWords([])
      setWordPair(null)

      // Fetch word pair by ID
      const { data: pair, error: pairError } = await supabase
        .from('word_pairs')
        .select('*')
        .eq('id', pairId)
        .single()

      if (pairError) {
        throw new Error(`Failed to fetch word pair: ${pairError.message}`)
      }

      if (!pair) {
        throw new Error('Word pair not found')
      }

      // Create word objects from the word pair
      const pairWords: Word[] = [
        {
          id: `${pair.id}-word1`,
          word: pair.word1,
          created_at: pair.created_at,
        } as Word,
        {
          id: `${pair.id}-word2`,
          word: pair.word2,
          created_at: pair.created_at,
        } as Word,
      ]

      // Generate phrase using the AI service with the word pair
      const response: RandomPhraseResponse = await generateRandomPhrase([
        pair.word1,
        pair.word2,
      ])

      setPhrase(response.phrase)
      setWords(pairWords)
      setWordPair(pair)

    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      setError(error)
      console.error('Error generating phrase from word pair:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    phrase,
    words,
    wordPair,
    loading,
    error,
    generatePhrase,
    generatePhraseFromPair,
  }
}
