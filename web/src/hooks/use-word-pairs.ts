import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type WordPair = Database['public']['Tables']['word_pairs']['Row']

const ITEMS_PER_PAGE = 20

export function useWordPairs() {
  const [wordPairs, setWordPairs] = useState<WordPair[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  useEffect(() => {
    fetchWordPairs()
  }, [currentPage])

  const fetchWordPairs = async () => {
    try {
      setLoading(true)

      // Get total count
      const { count } = await supabase
        .from('word_pairs')
        .select('*', { count: 'exact', head: true })

      setTotalCount(count || 0)

      // Get paginated data
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, error } = await supabase
        .from('word_pairs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Error fetching word pairs:', error)
        return
      }

      setWordPairs(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const refresh = () => {
    fetchWordPairs()
  }

  return {
    wordPairs,
    loading,
    currentPage,
    totalPages,
    totalCount,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    refresh,
  }
}

export function useWordPairMutations() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createWordPair = async (wordPair: Omit<WordPair, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('word_pairs')
        .insert([wordPair])
        .select()
        .single()

      if (error) {
        setError(error.message)
        return null
      }

      return data
    } catch (err) {
      setError('An unexpected error occurred')
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateWordPair = async (id: string, updates: Partial<Omit<WordPair, 'id' | 'created_at' | 'updated_at'>>) => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('word_pairs')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        setError(error.message)
        return null
      }

      return data
    } catch (err) {
      setError('An unexpected error occurred')
      return null
    } finally {
      setLoading(false)
    }
  }

  const deleteWordPair = async (id: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase
        .from('word_pairs')
        .delete()
        .eq('id', id)

      if (error) {
        setError(error.message)
        return false
      }

      return true
    } catch (err) {
      setError('An unexpected error occurred')
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    createWordPair,
    updateWordPair,
    deleteWordPair,
    loading,
    error,
    setError,
  }
}