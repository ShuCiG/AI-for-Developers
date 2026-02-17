import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ChatMessageRow = Database['public']['Tables']['chat_messages']['Row']
type ChatMessageInsert = Database['public']['Tables']['chat_messages']['Insert']

export function useChatMessages(chatId: string | null) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!chatId) {
      setMessages([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('Failed to fetch chat messages', error)
          setMessages([])
        } else {
          setMessages(data ?? [])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [chatId])

  const appendUserMessage = useCallback(async (chatId: string, content: string): Promise<ChatMessageRow | null> => {
    const insert: ChatMessageInsert = {
      chat_id: chatId,
      role: 'user',
      content,
    }
    const { data, error } = await supabase.from('chat_messages').insert(insert).select().single()
    if (error) {
      console.error('Failed to insert user message', error)
      return null
    }
    setMessages((prev) => [...prev, data])
    return data
  }, [])

  const appendAssistantMessage = useCallback(
    async (
      chatId: string,
      content: string,
      metadata: Database['public']['Tables']['chat_messages']['Row']['metadata'] = null
    ): Promise<ChatMessageRow | null> => {
      const insert: ChatMessageInsert = {
        chat_id: chatId,
        role: 'assistant',
        content,
        metadata,
      }
      const { data, error } = await supabase.from('chat_messages').insert(insert).select().single()
      if (error) {
        console.error('Failed to insert assistant message', error)
        return null
      }
      setMessages((prev) => [...prev, data])
      return data
    },
    []
  )

  const updateChatTitle = useCallback(async (chatId: string, title: string) => {
    await supabase.from('chats').update({ title, updated_at: new Date().toISOString() }).eq('id', chatId)
  }, [])

  const touchChatUpdatedAt = useCallback(async (chatId: string) => {
    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId)
  }, [])

  return {
    messages,
    loading,
    appendUserMessage,
    appendAssistantMessage,
    updateChatTitle,
    touchChatUpdatedAt,
  }
}
