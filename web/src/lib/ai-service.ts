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

/** Chat: history item for /api/chat */
export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

/** Chat API response: plain text */
export interface ChatContentResponse {
  content: string
}

/** Chat API response: word card for UI */
export interface ChatWordCardPayload {
  word: string
  translation: string
  example_sentence: string
  definition?: string | null
}

export interface ChatWordCardResponse {
  response_type: 'word_card'
  payload: ChatWordCardPayload
}

export type ChatApiResponse = ChatContentResponse | ChatWordCardResponse

/**
 * Send a chat message and get the assistant response.
 * @param chatId - Optional chat id (for ownership check if backend supports it)
 * @param message - User message text
 * @param history - Recent conversation history
 * @returns API response: { content } or { response_type: 'word_card', payload }
 */
export async function sendChatMessage(
  chatId: string | null,
  message: string,
  history: ChatHistoryItem[]
): Promise<ChatApiResponse> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('User must be authenticated to send chat messages')
  }

  const url = `${AI_SERVICE_URL}/api/chat`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 90_000) // 90s for LLM

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        chat_id: chatId || undefined,
        message,
        history,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(err.error || `Chat request failed: ${response.status}`)
    }

    return response.json()
  } catch (e) {
    clearTimeout(timeoutId)
    if (e instanceof Error) {
      if (e.name === 'AbortError') throw new Error('Request timed out')
      throw e
    }
    throw new Error('Failed to send chat message')
  }
}

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
