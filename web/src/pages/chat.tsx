import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { WordCard } from '@/components/word-card'
import { sendChatMessage, type ChatResponse, type ChatHistoryItem } from '@/lib/ai-service'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { IconCode, IconCopy, IconCheck, IconMessageCircle, IconPlus, IconPencil, IconX } from '@tabler/icons-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  response: ChatResponse
  timestamp: Date
}

interface Chat {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export default function ChatPage() {
  const [chats, setChats] = useState<Chat[]>([])
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [savedWordIds, setSavedWordIds] = useState<Set<string>>(new Set())
  const [copiedJsonId, setCopiedJsonId] = useState<string | null>(null)
  const [loadingChats, setLoadingChats] = useState(true)
  const [savingWordId, setSavingWordId] = useState<string | null>(null) // Track which word is being saved
  const [editingChatId, setEditingChatId] = useState<string | null>(null) // ID of chat being edited
  const [editingTitle, setEditingTitle] = useState<string>('') // Temporary title value during editing
  const [errorDialogOpen, setErrorDialogOpen] = useState(false) // Error dialog state
  const [errorMessage, setErrorMessage] = useState<string>('') // Current error message
  const [copiedError, setCopiedError] = useState(false) // Track if error was copied
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Debug: log when error dialog state changes
  useEffect(() => {
    if (errorDialogOpen) {
      console.log('Error dialog is OPEN, message:', errorMessage)
    } else {
      console.log('Error dialog is CLOSED')
    }
  }, [errorDialogOpen, errorMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load saved words from word_pairs on mount
  useEffect(() => {
    const loadSavedWords = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('word_pairs')
          .select('word1, word2')
          .eq('user_id', user.id)

        if (error) throw error

        if (data) {
          const savedKeys = new Set<string>()
          data.forEach((pair) => {
            // Normalize words (lowercase, trim) for consistent comparison
            const word1 = (pair.word1 || '').trim().toLowerCase()
            const word2 = (pair.word2 || '').trim().toLowerCase()
            const key1 = `${word1}:${word2}`
            const key2 = `${word2}:${word1}`
            savedKeys.add(key1)
            savedKeys.add(key2) // Both directions
          })
          setSavedWordIds(savedKeys)
        }
      } catch (e) {
        console.error('Failed to load saved words', e)
      }
    }

    loadSavedWords()
  }, [])

  // Load chats list
  useEffect(() => {
    const loadChats = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoadingChats(false)
          return
        }

        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })

        if (error) {
          console.error('Failed to load chats:', error)
          // Check if table doesn't exist
          if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
            console.warn('chats table may not exist. Creating migration may be needed.')
          }
          setLoadingChats(false)
          return
        }

        if (data && Array.isArray(data)) {
          setChats(data)
          // If no current chat selected and there are chats, select the first one
          if (!currentChatId && data.length > 0) {
            setCurrentChatId(data[0].id)
          }
        } else {
          setChats([])
        }
      } catch (e) {
        console.error('Failed to load chats', e)
        setChats([])
      } finally {
        setLoadingChats(false)
      }
    }

    loadChats()
  }, []) // Load only once on mount

  // Load messages for current chat
  useEffect(() => {
    if (!currentChatId) {
      setMessages([])
      return
    }

    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('chat_id', currentChatId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Failed to load messages:', error)
          setMessages([])
          return
        }

        if (data && Array.isArray(data)) {
          const formattedMessages: Message[] = data
            .map((msg) => {
              try {
                // Handle metadata - it might be null, string, or object
                let response: ChatResponse
                if (msg.metadata && typeof msg.metadata === 'object') {
                  response = msg.metadata as ChatResponse
                } else if (msg.metadata && typeof msg.metadata === 'string') {
                  try {
                    response = JSON.parse(msg.metadata) as ChatResponse
                  } catch {
                    // Fallback to text response if parsing fails
                    response = {
                      response_type: 'text',
                      content: msg.content || ''
                    }
                  }
                } else {
                  // Fallback if no metadata
                  response = {
                    response_type: 'text',
                    content: msg.content || ''
                  }
                }

                return {
                  id: msg.id,
                  role: msg.role as 'user' | 'assistant',
                  response,
                  timestamp: new Date(msg.created_at),
                }
              } catch (e) {
                console.error('Error formatting message:', e, msg)
                // Return a fallback message
                return {
                  id: msg.id,
                  role: msg.role as 'user' | 'assistant',
                  response: {
                    response_type: 'text',
                    content: msg.content || 'Error loading message'
                  },
                  timestamp: new Date(msg.created_at),
                }
              }
            })
            .filter((msg): msg is Message => msg !== null && msg !== undefined)
          
          setMessages(formattedMessages)
        } else {
          setMessages([])
        }
      } catch (e) {
        console.error('Failed to load messages', e)
        setMessages([])
      }
    }

    loadMessages()
  }, [currentChatId])

  const createNewChat = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Please sign in')
        return
      }

      const { data, error } = await supabase
        .from('chats')
        .insert({ user_id: user.id })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setChats((prev) => [data, ...prev])
        setCurrentChatId(data.id)
        setMessages([])
      }
    } catch (e) {
      console.error('Failed to create chat', e)
      toast.error('Failed to create chat')
    }
  }, [])

  const updateChatTitle = useCallback(async (chatId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ title: newTitle.trim() || null })
        .eq('id', chatId)

      if (error) throw error

      // Update local state
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId ? { ...chat, title: newTitle.trim() || null } : chat
        )
      )

      // Exit editing mode
      setEditingChatId(null)
      setEditingTitle('')
      toast.success('Chat title updated')
    } catch (e) {
      console.error('Failed to update chat title', e)
      toast.error('Failed to update chat title')
    }
  }, [])

  const handleSaveWord = useCallback(
    async (word1: string, word2: string, example?: string) => {
      // Normalize words (lowercase, trim) for comparison
      const normalizedWord1 = word1.trim().toLowerCase()
      const normalizedWord2 = word2.trim().toLowerCase()
      
      // Create normalized keys for comparison
      const key = `${normalizedWord1}:${normalizedWord2}`
      const reverseKey = `${normalizedWord2}:${normalizedWord1}`
      
      // Create a unique ID for this save operation to prevent double-clicks
      const saveId = key

      // Prevent multiple simultaneous saves of the same word
      if (savingWordId === saveId) {
        console.log('Save already in progress for:', saveId)
        return
      }

      // Check local state with normalized keys
      if (savedWordIds.has(key) || savedWordIds.has(reverseKey)) {
        toast.info('This word is already in your list.')
        return
      }

      // Set saving state to prevent double-clicks
      setSavingWordId(saveId)

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          toast.error('Please sign in to add words to your list.')
          setSavingWordId(null)
          return
        }

        // Check for duplicates in database - use case-insensitive comparison
        // Get all word pairs and check manually for better control
        const { data: allPairs, error: fetchError } = await supabase
          .from('word_pairs')
          .select('word1, word2')
          .eq('user_id', user.id)

        if (fetchError) throw fetchError

        // Check if this pair already exists (case-insensitive, both directions)
        const isDuplicate = allPairs?.some((pair) => {
          const pairWord1 = (pair.word1 || '').trim().toLowerCase()
          const pairWord2 = (pair.word2 || '').trim().toLowerCase()
          
          // Check both directions: word1:word2 and word2:word1
          return (
            (pairWord1 === normalizedWord1 && pairWord2 === normalizedWord2) ||
            (pairWord1 === normalizedWord2 && pairWord2 === normalizedWord1)
          )
        })

        if (isDuplicate) {
          toast.info('This word is already in your list.')
          // Update local state with normalized keys
          setSavedWordIds((prev) => new Set(prev).add(key).add(reverseKey))
          setSavingWordId(null)
          return
        }

        const { error: err } = await supabase.from('word_pairs').insert({
          user_id: user.id,
          word1: word1.trim(), // Store original case
          word2: word2.trim(),
          description: example ?? null,
        })

        if (err) throw err

        // Update local state with normalized keys
        setSavedWordIds((prev) => new Set(prev).add(key).add(reverseKey))
        toast.success('Added to your word list.')
      } catch (e) {
        console.error('Failed to save word pair', e)
        const msg = e instanceof Error ? e.message : String(e)
        toast.error(
          msg.includes('row-level security')
            ? 'No write permissions. Please check Supabase settings.'
            : 'Failed to add to list.'
        )
      } finally {
        // Clear saving state
        setSavingWordId(null)
      }
    },
    [savedWordIds, savingWordId]
  )

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    // Ensure we have a chat
    let chatId = currentChatId
    if (!chatId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          toast.error('Please sign in')
          return
        }

        const { data, error } = await supabase
          .from('chats')
          .insert({ user_id: user.id })
          .select()
          .single()

        if (error) throw error
        if (data) {
          chatId = data.id
          setCurrentChatId(data.id)
          setChats((prev) => [data, ...prev])
        }
      } catch (e) {
        console.error('Failed to create chat', e)
        toast.error('Failed to create chat')
        return
      }
    }

    setInput('')
    setSending(true)

    // Build history - include word_card responses for vocabulary intent
    // Detect if this is a vocabulary request
    const isVocabularyRequest = text.toLowerCase().includes('new word') ||
      text.toLowerCase().includes('teach me') ||
      text.toLowerCase().includes('learn') ||
      text.toLowerCase().includes('vocabulary') ||
      text.toLowerCase().includes('word to learn') ||
      text.toLowerCase().includes('give me a word') ||
      text.toLowerCase().includes('show me a word') ||
      text.toLowerCase().includes('another word') ||
      text.toLowerCase().includes('new vocabulary')

    const history: ChatHistoryItem[] = messages
      .filter((msg) => {
        if (msg.role === 'user') return true
        // For vocabulary requests, include both text and word_card responses
        if (msg.response.response_type === 'text') return true
        if (isVocabularyRequest && msg.response.response_type === 'word_card') {
          // Include word_card responses as text for vocabulary crew
          return true
        }
        return false
      })
      .map((msg) => ({
        role: msg.role,
        content:
          msg.role === 'user'
            ? (msg.response.response_type === 'text' ? msg.response.content : '')
            : msg.response.response_type === 'text'
              ? msg.response.content
              : msg.response.response_type === 'word_card'
                ? `Word: ${msg.response.payload.word}, Translation: ${msg.response.payload.translation}`
                : '',
      }))
      .filter((item) => item.content.trim().length > 0)

    // Add user message
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      response: { response_type: 'text', content: text },
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Check if this is the first message in the chat
    const isFirstMessage = messages.length === 0

    // Save user message to DB
    try {
      const { error: err } = await supabase.from('chat_messages').insert({
        chat_id: chatId!,
        role: 'user',
        content: text,
        metadata: userMessage.response,
      })
      if (err) console.error('Failed to save user message', err)
      
      // If this is the first message, update chat title
      if (isFirstMessage && chatId && !err) {
        // Generate title from first message
        const titleText = text.trim().replace(/\s+/g, ' ') // Normalize whitespace
        // Truncate to 50 characters, add ellipsis if longer
        const chatTitle = titleText.length > 50 
          ? titleText.substring(0, 50).trim() + '...'
          : titleText
        
        // Update chat title in database
        try {
          const { error: titleError } = await supabase
            .from('chats')
            .update({ title: chatTitle })
            .eq('id', chatId)
          
          if (!titleError) {
            // Update local state
            setChats((prev) =>
              prev.map((chat) =>
                chat.id === chatId ? { ...chat, title: chatTitle } : chat
              )
            )
          }
        } catch (e) {
          console.error('Failed to update chat title from first message', e)
          // Don't show error to user, title update is not critical
        }
      }
    } catch (e) {
      console.error('Failed to save user message', e)
    }

    try {
      const response: ChatResponse = await sendChatMessage(text, history)

      // Show tool results as toasts
      if ('tool_results' in response && response.tool_results) {
        response.tool_results.forEach((toolResult) => {
          if (toolResult.response_type === 'save_confirmation') {
            toast.success(toolResult.message)
          }
        })
      }

      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        response,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])

      // Save assistant message to DB
      try {
        const { error: err } = await supabase.from('chat_messages').insert({
          chat_id: chatId!,
          role: 'assistant',
          content: response.response_type === 'text' ? response.content : JSON.stringify(response),
          metadata: response,
        })
        if (err) console.error('Failed to save assistant message', err)

        // Update chat updated_at
        await supabase
          .from('chats')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', chatId!)
      } catch (e) {
        console.error('Failed to save assistant message', e)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send message'
      console.log('Error caught in sendMessage:', msg, 'Full error:', e)
      // Show error in dialog with copy button (don't show toast, only dialog)
      setErrorMessage(msg)
      setErrorDialogOpen(true)
      console.log('Error dialog opened, errorMessage:', msg)
    } finally {
      setSending(false)
    }
  }, [input, sending, messages, currentChatId])

  const renderMessage = (message: Message) => {
    if (!message || !message.response) {
      console.error('Invalid message:', message)
      return null
    }

    if (message.role === 'user') {
      return (
        <div className="flex justify-end">
          <div className="rounded-lg bg-primary text-primary-foreground px-4 py-2 max-w-[85%]">
            {message.response.response_type === 'text' ? message.response.content : ''}
          </div>
        </div>
      )
    }

    // Assistant message
    const { response } = message
    
    if (!response || !response.response_type) {
      console.error('Invalid response:', response)
      return (
        <div className="flex justify-start">
          <div className="rounded-lg bg-muted px-4 py-2 max-w-[85%] text-sm text-muted-foreground">
            Error: Invalid message format
          </div>
        </div>
      )
    }

    switch (response.response_type) {
      case 'text':
        // Check if this is a translation response with source_word and translated_word
        let translationData: { source_word?: string; translated_word?: string } | null = null
        
        // First, try to extract from response.raw (structured JSON)
        if (response.raw) {
          try {
            const parsed = typeof response.raw === 'string' ? JSON.parse(response.raw) : response.raw
            if (parsed.source_word && parsed.translated_word) {
              translationData = {
                source_word: parsed.source_word,
                translated_word: parsed.translated_word
              }
            }
          } catch {
            // Ignore parsing errors, will try fallback
          }
        }
        
        // Fallback: try to extract from response.content (format: "word → translation")
        if (!translationData && response.content) {
          try {
            // Pattern: "word → translation" or "word → translation\n\nexplanation"
            const arrowMatch = response.content.match(/^([^→\n]+)→\s*([^\n]+)/)
            if (arrowMatch) {
              const sourceWord = arrowMatch[1].trim()
              const translatedWord = arrowMatch[2].trim()
              if (sourceWord && translatedWord) {
                translationData = {
                  source_word: sourceWord,
                  translated_word: translatedWord
                }
              }
            }
          } catch {
            // Ignore parsing errors
          }
        }
        
        // Normalize for comparison
        const translationKey = translationData 
          ? `${(translationData.source_word || '').trim().toLowerCase()}:${(translationData.translated_word || '').trim().toLowerCase()}`
          : null
        const reverseTranslationKey = translationData
          ? `${(translationData.translated_word || '').trim().toLowerCase()}:${(translationData.source_word || '').trim().toLowerCase()}`
          : null
        const isTranslationSaved = translationKey 
          ? (savedWordIds.has(translationKey) || savedWordIds.has(reverseTranslationKey!))
          : false
        const isTranslationSaving = translationKey
          ? (savingWordId === translationKey || savingWordId === reverseTranslationKey)
          : false
        
        return (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-4 py-2 max-w-[85%] whitespace-pre-wrap">
              {response.content}
              {translationData && (
                <div className="mt-3 pt-3 border-t">
                  <Button
                    onClick={() => handleSaveWord(
                      translationData!.source_word!,
                      translationData!.translated_word!,
                      undefined
                    )}
                    disabled={isTranslationSaved || isTranslationSaving}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    {isTranslationSaving ? 'Saving...' : isTranslationSaved ? 'In your list' : 'Add to my list'}
                  </Button>
                </div>
              )}
              {response.raw && response.raw !== response.content && (
                <div className="mt-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <IconCode className="size-3 mr-1" />
                        View JSON
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                      <DialogHeader>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <DialogTitle>Raw Response (JSON)</DialogTitle>
                            <DialogDescription>
                              Raw response from the AI agent
                            </DialogDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 shrink-0 mr-8"
                            onClick={async () => {
                              try {
                                const jsonText = (() => {
                                  try {
                                    const parsed = typeof response.raw === 'string' ? JSON.parse(response.raw) : response.raw
                                    return JSON.stringify(parsed, null, 2)
                                  } catch {
                                    return typeof response.raw === 'string' ? response.raw : JSON.stringify(response.raw, null, 2)
                                  }
                                })()
                                await navigator.clipboard.writeText(jsonText)
                                setCopiedJsonId(message.id)
                                toast.success('JSON copied to clipboard')
                                setTimeout(() => setCopiedJsonId(null), 2000)
                              } catch (err) {
                                toast.error('Failed to copy JSON')
                              }
                            }}
                          >
                            {copiedJsonId === message.id ? (
                              <>
                                <IconCheck className="size-4" />
                                Copied
                              </>
                            ) : (
                              <>
                                <IconCopy className="size-4" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                      </DialogHeader>
                      <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                        {(() => {
                          try {
                            const parsed = typeof response.raw === 'string' ? JSON.parse(response.raw) : response.raw
                            return JSON.stringify(parsed, null, 2)
                          } catch {
                            return response.raw
                          }
                        })()}
                      </pre>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        )

      case 'word_card':
        // Normalize for comparison
        const normalizedWord = (response.payload.word || '').trim().toLowerCase()
        const normalizedTranslation = (response.payload.translation || '').trim().toLowerCase()
        const pairKey = `${normalizedWord}:${normalizedTranslation}`
        const reversePairKey = `${normalizedTranslation}:${normalizedWord}`
        const isSaved = savedWordIds.has(pairKey) || savedWordIds.has(reversePairKey)
        const isSaving = savingWordId === pairKey || savingWordId === reversePairKey

        return (
          <div className="flex justify-start">
            <div className="space-y-2">
              <WordCard
                {...response.payload}
                onSave={handleSaveWord}
                saved={isSaved || isSaving}
              />
              {response.raw && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      <IconCode className="size-3 mr-1" />
                      View JSON
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <DialogTitle>Raw Response (JSON)</DialogTitle>
                          <DialogDescription>
                            Raw response from the AI agent
                          </DialogDescription>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 shrink-0 mr-8"
                          onClick={async () => {
                            try {
                              const jsonText = (() => {
                                try {
                                  const parsed = typeof response.raw === 'string' ? JSON.parse(response.raw) : response.raw
                                  return JSON.stringify(parsed, null, 2)
                                } catch {
                                  return typeof response.raw === 'string' ? response.raw : JSON.stringify(response.raw, null, 2)
                                }
                              })()
                              await navigator.clipboard.writeText(jsonText)
                              setCopiedJsonId(message.id)
                              toast.success('JSON copied to clipboard')
                              setTimeout(() => setCopiedJsonId(null), 2000)
                            } catch (err) {
                              toast.error('Failed to copy JSON')
                            }
                          }}
                        >
                          {copiedJsonId === message.id ? (
                            <>
                              <IconCheck className="size-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <IconCopy className="size-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogHeader>
                    <pre className="text-xs bg-muted p-4 rounded overflow-auto">
                      {(() => {
                        try {
                          const parsed = typeof response.raw === 'string' ? JSON.parse(response.raw) : response.raw
                          return JSON.stringify(parsed, null, 2)
                        } catch {
                          return response.raw
                        }
                      })()}
                    </pre>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        )

      case 'save_confirmation':
        // This should be handled by toast, but render as text if it appears
        return (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-4 py-2 max-w-[85%] text-sm text-muted-foreground">
              {response.message}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex gap-4 w-full" style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}>
      {/* Chat List Sidebar - Fixed height */}
      <div className="w-64 border-r flex flex-col shrink-0" style={{ height: '100%' }}>
        <div className="p-4 border-b shrink-0">
          <Button onClick={createNewChat} className="w-full" size="sm">
            <IconPlus className="size-4 mr-2" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {loadingChats ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">Loading chats...</div>
          ) : chats.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">No chats yet</div>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => {
                const isEditing = editingChatId === chat.id
                const displayTitle = chat.title || `Chat ${new Date(chat.created_at).toLocaleDateString()}`

                return (
                  <div
                    key={chat.id}
                    className="group flex items-center gap-1 w-full"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingChatId(chat.id)
                      setEditingTitle(chat.title || '')
                    }}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              updateChatTitle(chat.id, editingTitle)
                            } else if (e.key === 'Escape') {
                              e.preventDefault()
                              setEditingChatId(null)
                              setEditingTitle('')
                            }
                          }}
                          onBlur={() => {
                            updateChatTitle(chat.id, editingTitle)
                          }}
                          autoFocus
                          className="h-8 text-sm flex-1"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingChatId(null)
                            setEditingTitle('')
                          }}
                        >
                          <IconX className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            try {
                              console.log('Selecting chat:', chat.id)
                              setCurrentChatId(chat.id)
                            } catch (err) {
                              console.error('Error selecting chat:', err)
                              toast.error('Error selecting chat')
                            }
                          }}
                          variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                          className="flex-1 justify-start"
                          size="sm"
                        >
                          <IconMessageCircle className="size-4 mr-2" />
                          <span className="truncate text-left flex-1">
                            {displayTitle}
                          </span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setEditingChatId(chat.id)
                            setEditingTitle(chat.title || '')
                          }}
                        >
                          <IconPencil className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chat Content */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ height: '100%' }}>
        <div className="mb-4 shrink-0">
          <h1 className="text-3xl font-bold">Language Tutor Chat</h1>
          <p className="text-muted-foreground mt-2">
            Ask for translations, learn new vocabulary, or get grammar help.
          </p>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ height: 'calc(100% - 80px)' }}>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <p>Start a conversation with your language tutor!</p>
                <p className="text-sm mt-2">
                  Try: "How do you say 'thank you' in Polish?" or "Give me a new word to learn"
                </p>
              </div>
            )}

            {messages.map((msg) => {
              const rendered = renderMessage(msg)
              return rendered ? <div key={msg.id}>{rendered}</div> : null
            })}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-muted px-4 py-2 text-muted-foreground text-sm">
                  Typing...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="border-t p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage()
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" disabled={sending || !input.trim()}>
                Send
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* Error Dialog */}
      {errorMessage && (
        <Dialog open={errorDialogOpen} onOpenChange={(open) => {
          setErrorDialogOpen(open)
          if (!open) {
            // Clear error message when dialog closes
            setErrorMessage('')
            setCopiedError(false)
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Error</DialogTitle>
              <DialogDescription>
                An error occurred while processing your request
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Error details:</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(errorMessage)
                      setCopiedError(true)
                      toast.success('Error message copied to clipboard')
                      setTimeout(() => setCopiedError(false), 2000)
                    } catch (err) {
                      toast.error('Failed to copy error message')
                    }
                  }}
                >
                  {copiedError ? (
                    <>
                      <IconCheck className="size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <IconCopy className="size-4" />
                      Copy Error
                    </>
                  )}
                </Button>
              </div>
              <pre className="text-sm bg-muted p-4 rounded overflow-auto max-h-96 whitespace-pre-wrap break-words border">
                {errorMessage}
              </pre>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
