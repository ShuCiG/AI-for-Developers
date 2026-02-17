import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconMessageCircle, IconPlus, IconQuestionMark, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useChats } from '@/hooks/use-chats'
import { useChatMessages } from '@/hooks/use-chat-messages'
import { sendChatMessage, type ChatApiResponse, type ChatHistoryItem } from '@/lib/ai-service'
import { supabase } from '@/lib/supabase'
import type { Database, Json } from '@/lib/database.types'
import { toast } from 'sonner'

type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row']

function buildHistory(messages: ChatMessageRow[]): ChatHistoryItem[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content || '',
  }))
}

function MessageBubble({
  message,
  onSaveWord,
  savedWordKeys,
}: {
  message: ChatMessageRow
  onSaveWord?: (word1: string, word2: string, description?: string) => void
  savedWordKeys?: Set<string>
}) {
  const meta = message.metadata as { response_type?: string; payload?: Record<string, unknown> } | null
  const isWordCard = meta?.response_type === 'word_card' && meta?.payload

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="rounded-lg bg-primary text-primary-foreground px-3 py-2 max-w-[85%]">
          {message.content}
        </div>
      </div>
    )
  }

  if (isWordCard && meta.payload) {
    const p = meta.payload as {
      word?: string
      translation?: string
      example_sentence?: string
      definition?: string | null
    }
    const word = p.word ?? ''
    const translation = p.translation ?? ''
    const example = p.example_sentence ?? ''
    const definition = p.definition ?? ''
    const pairKey = `${word}:${translation}`
    const isSaved = savedWordKeys?.has(pairKey)

    return (
      <div className="flex justify-start">
        <Card className="max-w-[85%] w-full">
          <CardContent className="pt-4 space-y-2">
            <div className="font-semibold text-lg">{word}</div>
            <div className="text-muted-foreground">{translation}</div>
            {example && <p className="text-sm">{example}</p>}
            {definition && <p className="text-xs text-muted-foreground">{definition}</p>}
            {onSaveWord && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                disabled={isSaved}
                onClick={() => onSaveWord(word, translation, example || undefined)}
              >
                {isSaved ? 'In your list' : 'Add to my list'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="rounded-lg bg-muted px-3 py-2 max-w-[85%] whitespace-pre-wrap">
        {message.content}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { chatId: routeChatId } = useParams()
  const navigate = useNavigate()
  const { chats, loading: chatsLoading, error: chatsError, createChat, deleteChat } = useChats()
  const {
    messages,
    loading: messagesLoading,
    appendUserMessage,
    appendAssistantMessage,
    updateChatTitle,
    touchChatUpdatedAt,
  } = useChatMessages(routeChatId ?? null)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedWordIds, setSavedWordIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const currentChatId = routeChatId ?? null

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSaveWord = useCallback(
    async (word1: string, word2: string, description?: string) => {
      const key = `${word1}:${word2}`
      if (savedWordIds.has(key)) return
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          toast.error('Войдите в аккаунт, чтобы добавлять слова в список.')
          return
        }
        const { error: err } = await supabase.from('word_pairs').insert({
          user_id: user.id,
          word1,
          word2,
          description: description ?? null,
        })
        if (err) throw err
        setSavedWordIds((prev) => new Set(prev).add(key))
        toast.success('Добавлено в ваш список слов.')
      } catch (e) {
        console.error('Failed to save word pair', e)
        const msg = e instanceof Error ? e.message : String(e)
        toast.error(msg.includes('row-level security') ? 'Нет прав на запись. Проверьте настройки Supabase.' : 'Не удалось добавить в список.')
      }
    },
    [savedWordIds]
  )

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || !currentChatId || sending) return

    setInput('')
    setError(null)
    setSending(true)

    const history = buildHistory(messages)

    try {
      const userMsg = await appendUserMessage(currentChatId, text)
      if (!userMsg) {
        setError('Не удалось сохранить сообщение. Проверьте миграции (chats, chat_messages) и Supabase.')
        setSending(false)
        return
      }
      await touchChatUpdatedAt(currentChatId)

      const isFirstMessage = messages.length === 0
      const response: ChatApiResponse = await sendChatMessage(currentChatId, text, history)

      if ('response_type' in response && response.response_type === 'word_card') {
        const payload = response.payload
        const displayContent = `${payload.word} — ${payload.translation}`
        const metadata: Json = {
          response_type: 'word_card',
          payload: { ...payload } as unknown as Json,
        }
        await appendAssistantMessage(currentChatId, displayContent, metadata)
      } else {
        const content = 'content' in response ? response.content : ''
        await appendAssistantMessage(currentChatId, content, null)
      }

      await touchChatUpdatedAt(currentChatId)
      if (isFirstMessage) {
        const title = text.slice(0, 50) + (text.length > 50 ? '…' : '')
        await updateChatTitle(currentChatId, title)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка отправки'
      if (msg.includes('authenticated') || msg.includes('Authorization')) setError('Войдите в аккаунт заново.')
      else if (msg.includes('timed out') || msg.includes('timeout')) setError('Сервер не ответил вовремя. Попробуйте ещё раз.')
      else if (msg.includes('503') || msg.includes('not configured')) setError('Сервис временно недоступен.')
      else setError(msg)
    } finally {
      setSending(false)
    }
  }, [
    input,
    currentChatId,
    sending,
    messages,
    appendUserMessage,
    appendAssistantMessage,
    touchChatUpdatedAt,
    updateChatTitle,
  ])

  const handleNewChat = useCallback(async () => {
    const chat = await createChat()
    if (chat) navigate(`/chat/${chat.id}`)
  }, [createChat, navigate])

  const handleDeleteChat = useCallback(
    async (id: string) => {
      await deleteChat(id)
      if (currentChatId === id) navigate('/chat')
    },
    [deleteChat, currentChatId, navigate]
  )

  const showEmpty = !currentChatId && !chatsLoading && chats.length === 0

  return (
    <div className="relative flex flex-col h-[calc(100vh-var(--header-height)-3rem)] min-h-0">
      {chatsError && (
        <div className="shrink-0 bg-destructive/15 text-destructive px-4 py-2 text-sm border-b">
          {typeof chatsError === 'string' ? chatsError : 'Ошибка загрузки чатов'}
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Left: chat list */}
      <aside className="w-56 border-r flex flex-col shrink-0">
        <div className="p-2 border-b flex items-center justify-between">
          <span className="font-medium text-sm">Chats</span>
          <Button variant="ghost" size="icon" onClick={handleNewChat} title="New chat">
            <IconPlus className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {chatsLoading ? (
            <div className="p-2 text-muted-foreground text-sm">Loading…</div>
          ) : (
            <ul className="p-1 space-y-0.5">
              {chats.map((chat) => (
                <li key={chat.id} className="flex items-center gap-1 group">
                  <Link
                    to={`/chat/${chat.id}`}
                    className={`flex-1 min-w-0 truncate rounded-md px-2 py-1.5 text-sm ${
                      currentChatId === chat.id ? 'bg-accent' : 'hover:bg-muted/70'
                    }`}
                  >
                    {chat.title || 'New chat'}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 shrink-0 h-7 w-7"
                    onClick={() => handleDeleteChat(chat.id)}
                    title="Delete chat"
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Right: messages + input */}
      <main className="flex-1 flex flex-col min-w-0">
        {!currentChatId && !showEmpty && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Select a chat or create a new one
          </div>
        )}

        {showEmpty && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <IconMessageCircle className="size-12" />
            <p>No chats yet. Start a new conversation.</p>
            <Button onClick={handleNewChat}>
              <IconPlus className="size-4 mr-2" />
              New chat
            </Button>
          </div>
        )}

        {currentChatId && (
          <>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="text-muted-foreground text-sm">Loading messages…</div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onSaveWord={handleSaveWord}
                    savedWordKeys={savedWordIds}
                  />
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-muted px-3 py-2 text-muted-foreground text-sm">
                    Typing…
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="px-4 py-2 text-destructive text-sm">{error}</div>
            )}

            <form
              className="p-4 border-t flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                sendMessage()
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for a translation, new word, grammar..."
                disabled={sending}
                className="flex-1"
              />
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" title="Help">
                    <IconQuestionMark className="size-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>What can the chat agent do?</DialogTitle>
                    <DialogDescription>
                      The language tutor helps only with language learning: translations, new vocabulary,
                      grammar, example sentences, and practice. You can add suggested words to your list
                      with &quot;Add to my list&quot; on word cards. Off-topic requests (e.g. recipes, math)
                      are politely declined.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 pt-2">
                    <p className="text-sm font-medium">Example prompts:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                      <li>How do you say &quot;thank you&quot; in Polish?</li>
                      <li>Give me a new word to learn today.</li>
                      <li>Explain when to use &quot;ser&quot; and &quot;estar&quot; in Spanish.</li>
                    </ol>
                  </div>
                </DialogContent>
              </Dialog>
              <Button type="submit" disabled={sending || !input.trim()}>
                Send
              </Button>
            </form>
          </>
        )}
      </main>
      </div>
    </div>
  )
}
