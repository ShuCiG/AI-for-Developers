import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type WordPair = Database['public']['Tables']['word_pairs']['Row']

const MAX_CARDS = 10

export interface UseCardGameReturn {
  wordPairs: WordPair[]
  currentIndex: number
  isFlipped: boolean
  hasSeenBack: boolean
  correctCount: number
  wrongCount: number
  gameStarted: boolean
  gameFinished: boolean
  loading: boolean
  error: Error | null
  startGame: () => Promise<void>
  flipCard: () => void
  markAnswer: (correct: boolean) => void
  resetGame: () => void
  currentPair: WordPair | null
}

/**
 * Hook for the Card Game: fetch word pairs, manage game state, and track statistics
 */
export function useCardGame(): UseCardGameReturn {
  const [wordPairs, setWordPairs] = useState<WordPair[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [hasSeenBack, setHasSeenBack] = useState(false) // Track if user has seen the back side
  const [correctCount, setCorrectCount] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameFinished, setGameFinished] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const startGame = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setGameStarted(false)
      setGameFinished(false)
      setCurrentIndex(0)
      setIsFlipped(false)
      setCorrectCount(0)
      setWrongCount(0)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Fetch all word pairs for the user
      const { data: pairs, error: pairsError } = await supabase
        .from('word_pairs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (pairsError) {
        throw new Error(`Failed to fetch word pairs: ${pairsError.message}`)
      }

      if (!pairs || pairs.length === 0) {
        throw new Error('No word pairs available. Create some word pairs first!')
      }

      // Shuffle and take up to MAX_CARDS pairs
      const shuffled = shuffleArray(pairs)
      const selectedPairs = shuffled.slice(0, Math.min(MAX_CARDS, shuffled.length))

      setWordPairs(selectedPairs)
      setGameStarted(true)
      setGameFinished(false)
      setHasSeenBack(false)
      setIsFlipped(false)
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('An unknown error occurred')
      setError(errorObj)
      console.error('Error starting card game:', errorObj)
    } finally {
      setLoading(false)
    }
  }, [])

  const flipCard = useCallback(() => {
    if (!gameStarted || gameFinished) return
    setIsFlipped((prev) => {
      const newFlipped = !prev
      // Mark that user has seen the back side at least once
      if (newFlipped) {
        setHasSeenBack(true)
      }
      return newFlipped
    })
  }, [gameStarted, gameFinished])

  const markAnswer = useCallback((correct: boolean) => {
    if (!gameStarted || gameFinished) return

    if (correct) {
      setCorrectCount((prev) => prev + 1)
    } else {
      setWrongCount((prev) => prev + 1)
    }

    // First flip the card back to front
    setIsFlipped(false)
    setHasSeenBack(false)

    // Then move to next card after animation completes (0.6s)
    setTimeout(() => {
      const nextIndex = currentIndex + 1
      
      if (nextIndex >= wordPairs.length) {
        // Game finished
        setGameFinished(true)
      } else {
        setCurrentIndex(nextIndex)
      }
    }, 600) // Wait for flip animation to complete
  }, [gameStarted, gameFinished, currentIndex, wordPairs.length])

  const resetGame = useCallback(() => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setHasSeenBack(false)
    setCorrectCount(0)
    setWrongCount(0)
    setGameStarted(false)
    setGameFinished(false)
    setError(null)
  }, [])

  const currentPair = gameStarted && wordPairs.length > 0 && currentIndex < wordPairs.length
    ? wordPairs[currentIndex]
    : null

  return {
    wordPairs,
    currentIndex,
    isFlipped,
    hasSeenBack,
    correctCount,
    wrongCount,
    gameStarted,
    gameFinished,
    loading,
    error,
    startGame,
    flipCard,
    markAnswer,
    resetGame,
    currentPair,
  }
}
