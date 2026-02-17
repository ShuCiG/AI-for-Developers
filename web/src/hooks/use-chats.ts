import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import { useUser } from '@/contexts/UserContext'

type ChatRow = Database['public']['Tables']['chats']['Row']
type ChatInsert = Database['public']['Tables']['chats']['Insert']

export function useChats() {
  const { user } = useUser()
  const [chats, setChats] = useState<ChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchChats = useCallback(async () => {
    if (!user?.id) {
      setChats([])
      setLoading(false)
      setError(null)
      return
    }
    try {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('chats')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (err) throw err
      setChats(data ?? [])
    } catch (e) {
      console.error('Failed to fetch chats', e)
      setChats([])
      const msg = typeof e === 'object' && e !== null && 'message' in e ? String((e as { message: unknown }).message) : (e instanceof Error ? e.message : String(e))
      const text = msg.includes('relation') || msg.includes('does not exist') ? 'Таблицы чатов не найдены. Примените миграции: create_chats, create_chat_messages.' : (msg || 'Ошибка загрузки чатов')
      setError(text)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    fetchChats()
  }, [fetchChats])

  const createChat = useCallback(async (): Promise<ChatRow | null> => {
    if (!user?.id) return null
    try {
      const insert: ChatInsert = {
        user_id: user.id,
        title: null,
      }
      const { data, error } = await supabase
        .from('chats')
        .insert(insert)
        .select()
        .single()

      if (error) throw error
      setChats((prev) => [data, ...prev])
      return data
    } catch (e) {
      console.error('Failed to create chat', e)
      const raw = typeof e === 'object' && e !== null && 'message' in e ? (e as { message: unknown }).message : (e instanceof Error ? e.message : null)
      const msg = raw != null ? String(raw) : ''
      if (msg.includes('relation') || msg.includes('does not exist')) {
        setError('Таблицы чатов нет в БД. Примените миграции: create_chats, create_chat_messages (supabase db push или через Studio).')
      } else if (msg.includes('row-level security') || msg.includes('policy')) {
        setError('Доступ запрещён (RLS). Проверьте, что вы авторизованы и есть политики на таблицу chats.')
      } else {
        setError(msg || 'Не удалось создать чат. Проверьте миграции и Supabase.')
      }
      return null
    }
  }, [user?.id])

  const deleteChat = useCallback(async (chatId: string) => {
    const { error } = await supabase.from('chats').delete().eq('id', chatId)
    if (error) {
      console.error('Failed to delete chat', error)
      return false
    }
    setChats((prev) => prev.filter((c) => c.id !== chatId))
    return true
  }, [])

  return { chats, loading, error, createChat, deleteChat, refetch: fetchChats }
}
