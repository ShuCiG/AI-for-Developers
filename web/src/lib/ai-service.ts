import { supabase } from './supabase'

// Use empty string for same-origin (proxy) mode, otherwise explicit URL
const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL === ""
    ? ""
    : import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8000"

export interface RandomPhraseResponse {
  phrase: string
  words_used: string[]
}

export interface ExampleSentencesResponse {
  sentences: string[]
  word1: string
  word2: string
}

export interface DifficultyClassificationResponse {
  word1: string
  word2: string
  difficulty1: string
  difficulty2: string
  reasoning1: string
  reasoning2: string
}

export interface WordsGameResponse {
  text_with_placeholders: string
  words_in_order: string[]
}

// Chat API types
export interface ChatHistoryItem {
  role: "user" | "assistant"
  content: string
}

export interface WordCardPayload {
  word: string
  translation: string
  example_sentence: string
  definition: string
}

export interface SaveConfirmation {
  response_type: "save_confirmation"
  message: string
}

export type ChatResponse = 
  | { response_type: "text", content: string, raw?: string, tool_results?: SaveConfirmation[] }
  | { response_type: "word_card", payload: WordCardPayload, raw?: string, tool_results?: SaveConfirmation[] }
  | { response_type: "save_confirmation", message: string }

/**
 * Generate a random phrase using the AI service
 * @param words - Array of words to use in the phrase
 * @returns Promise with the generated phrase and words used
 */
export async function generateRandomPhrase(words: string[]): Promise<RandomPhraseResponse> {
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('User must be authenticated to generate phrases')
  }

  const response = await fetch(`${AI_SERVICE_URL}/api/random-phrase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ words }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to generate phrase: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Generate example sentences for a word pair using the AI service
 * @param word1 - First word from the word pair
 * @param word2 - Second word from the word pair
 * @returns Promise with the generated example sentences and words
 */
export async function generateExampleSentences(word1: string, word2: string): Promise<ExampleSentencesResponse> {
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('User must be authenticated to generate example sentences')
  }

  const response = await fetch(`${AI_SERVICE_URL}/api/example-sentences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ word1, word2 }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to generate example sentences: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Classify difficulty level for a word pair using the AI service
 * @param word1 - First word from the word pair
 * @param word2 - Second word from the word pair
 * @returns Promise with the difficulty classification and reasoning
 */
export async function classifyDifficulty(word1: string, word2: string): Promise<DifficultyClassificationResponse> {
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('User must be authenticated to classify difficulty')
  }

  const response = await fetch(`${AI_SERVICE_URL}/api/classify-difficulty`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ word1, word2 }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to classify difficulty: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Generate text with placeholders for the words game
 * @param words - Array of exactly 3 words
 * @returns Promise with text_with_placeholders and words_in_order
 */
export async function generateWordsGameText(words: string[]): Promise<WordsGameResponse> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('User must be authenticated to play the words game')
  }

  const response = await fetch(`${AI_SERVICE_URL}/api/words-game`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ words }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to generate words game: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Send a chat message to the language tutor
 * @param message - User's message
 * @param history - Conversation history
 * @param intent - Optional intent hint ("translation" | "vocabulary")
 * @returns Promise with structured chat response
 */
export async function sendChatMessage(
  message: string,
  history: ChatHistoryItem[] = [],
  intent?: "translation" | "vocabulary"
): Promise<ChatResponse> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('User must be authenticated to use chat')
  }

  let response: Response
  try {
    response = await fetch(`${AI_SERVICE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message,
        history,
        intent: intent || null
      }),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    })
  } catch (networkError) {
    // Handle network errors (connection refused, timeout, etc.)
    const errorMsg = networkError instanceof Error ? networkError.message : String(networkError)
    if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('Failed to fetch')) {
      throw new Error('Server temporarily unavailable. Please check that the AI service is running.')
    }
    if (errorMsg.includes('timeout') || errorMsg.includes('aborted')) {
      throw new Error('Request timeout. Please try again later.')
    }
    throw new Error(`Network error: ${errorMsg}`)
  }

  if (!response.ok) {
    let errorMessage = `Failed to send chat message: ${response.statusText}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.error || errorMessage
    } catch {
      // If response is not JSON, try to get text
      try {
        const text = await response.text()
        if (text) {
          errorMessage = text.length > 200 ? `${text.substring(0, 200)}...` : text
        }
      } catch {
        // If all else fails, use status-based message
        if (response.status === 0 || response.status >= 500) {
          errorMessage = 'Server temporarily unavailable. Please try again later.'
        } else if (response.status === 401) {
          errorMessage = 'Authentication required. Please sign in.'
        } else if (response.status === 404) {
          errorMessage = 'Endpoint not found. Please check server settings.'
        } else {
          errorMessage = `Error ${response.status}: ${response.statusText}`
        }
      }
    }
    throw new Error(errorMessage)
  }

  const data = await response.json()
  
  // Ensure response_type is set (fallback to 'text' if missing)
  if (!data.response_type) {
    // If payload exists, assume it's a word_card
    if (data.payload) {
      data.response_type = 'word_card'
    } else {
      data.response_type = 'text'
      if (!data.content && data.message) {
        data.content = data.message
      }
    }
  }
  
  return data as ChatResponse
}
