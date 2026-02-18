import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Word = Database['public']['Tables']['words']['Row']

const ITEMS_PER_PAGE = 20

type SortColumn = 'id' | 'word' | 'created_at'
type SortOrder = 'asc' | 'desc'

export function useWords() {
  const [words, setWords] = useState<Word[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortBy, setSortBy] = useState<SortColumn>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const fetchWords = useCallback(async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setWords([])
        setTotalCount(0)
        setLoading(false)
        return
      }

      // Get total count - RLS policy allows seed words (user_id IS NULL) and user's words
      const { count } = await supabase
        .from('words')
        .select('*', { count: 'exact', head: true })

      setTotalCount(count || 0)

      // Get paginated data - RLS policy filters automatically
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, error } = await supabase
        .from('words')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(from, to)

      if (error) {
        console.error('Error fetching words:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        setWords([])
        return
      }

      console.log('Fetched words:', data?.length || 0, 'words')
      setWords(data || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, sortBy, sortOrder])

  useEffect(() => {
    fetchWords()
  }, [currentPage, fetchWords])

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
    fetchWords()
  }

  const setSorting = useCallback((column: SortColumn) => {
    if (column === sortBy) {
      // Toggle order if same column
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      // Set new column with default order
      setSortBy(column)
      // Default order: desc for created_at, asc for others
      setSortOrder(column === 'created_at' ? 'desc' : 'asc')
    }
    // Reset to first page when sorting changes
    setCurrentPage(1)
  }, [sortBy])

  return {
    words,
    loading,
    currentPage,
    totalPages,
    totalCount,
    sortBy,
    sortOrder,
    setSorting,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    refresh,
  }
}
